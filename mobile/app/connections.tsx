import type { Connection } from '@tapntally/shared';
import { ConnectionStatus, ConnectionType } from '@tapntally/shared';
import Constants from 'expo-constants';
import { formatDistanceToNow } from 'date-fns';
import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { ApiClientError } from '../src/api/client';
import { useConnectionMutations, useConnections } from '../src/api/hooks';
import { Badge, Button, Card, ErrorBanner, Loading, Row, Text } from '../src/components/ui';
import { collectPaymentSms, markScanned, requestSmsPermission, resetScanCursor, smsSupported } from '../src/sms';
import { useTheme } from '../src/theme';

const GOOGLE_WEB_CLIENT_ID = (Constants.expoConfig?.extra as { googleWebClientId?: string } | undefined)?.googleWebClientId ?? '';
const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

const STATUS_LABEL: Record<ConnectionStatus, { label: string; tone: 'ok' | 'warn' | 'bad' | 'off' }> = {
  [ConnectionStatus.DISCONNECTED]: { label: 'Not connected', tone: 'off' },
  [ConnectionStatus.BACKFILLING]: { label: 'Scanning history…', tone: 'warn' },
  [ConnectionStatus.ACTIVE]: { label: 'Connected', tone: 'ok' },
  [ConnectionStatus.NEEDS_REAUTH]: { label: 'Needs reconnect', tone: 'bad' },
  [ConnectionStatus.ERROR]: { label: 'Sync error', tone: 'bad' },
};

export default function Connections() {
  const t = useTheme();
  const conns = useConnections();
  const m = useConnectionMutations();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const gmail = conns.data?.find((c) => c.type === ConnectionType.GMAIL);
  const sms = conns.data?.find((c) => c.type === ConnectionType.SMS);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : (err as Error)?.message ?? 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const connectGmail = () =>
    run('gmail', async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
      GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, offlineAccess: true, scopes: [GMAIL_SCOPE], forceCodeForRefreshToken: true });
      await GoogleSignin.hasPlayServices();
      const res = await GoogleSignin.signIn();
      const code = res.data?.serverAuthCode;
      if (!code) throw new Error('Google did not return an authorization code. Try again.');
      await m.connectGmail.mutateAsync(code);
    });

  const disconnectGmail = () =>
    Alert.alert('Disconnect Gmail?', 'We stop scanning immediately and delete our access token. Purchases already imported stay.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: () => run('gmail', () => m.disconnectGmail.mutateAsync()) },
    ]);

  const scanSms = (full: boolean) =>
    run('sms', async () => {
      const messages = await collectPaymentSms({ fullBackfill: full });
      if (messages.length === 0) {
        await markScanned();
        Alert.alert('Nothing new', 'No new payment alerts since the last scan.');
        return;
      }
      const res = await m.ingestSms.mutateAsync({ messages });
      await markScanned();
      Alert.alert('SMS scanned', `${res.parsed} new purchase${res.parsed === 1 ? '' : 's'} added · ${res.duplicates} already known · ${res.skipped} not purchases.`);
    });

  const connectSms = () =>
    run('sms', async () => {
      const granted = await requestSmsPermission();
      if (!granted) throw new Error('SMS permission was not granted.');
      await m.enableSms.mutateAsync();
      await resetScanCursor();
      await scanSms(true);
    });

  const disconnectSms = () =>
    Alert.alert('Stop reading SMS?', 'You can revoke the Android permission in Settings as well.', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: () => run('sms', () => m.disableSms.mutateAsync()) },
    ]);

  if (conns.isLoading) return <Loading />;
  if (conns.error) return <ErrorBanner message="Couldn't load connections." onRetry={() => void conns.refetch()} />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 60 }}>
      <Text muted>Online orders don't come through a terminal, so we read the confirmations instead — narrowly.</Text>

      <ConnectionCard
        icon="✉️"
        title="Gmail"
        conn={gmail}
        trust="We search only for order confirmations and invoices from known shops (Amazon, Flipkart, Myntra, Swiggy…). Emails are parsed and discarded — never stored, never read by a person. Read-only access; disconnect any time."
        actions={
          gmail?.status === ConnectionStatus.DISCONNECTED || !gmail ? (
            <>
              <Button title="Connect Gmail" onPress={connectGmail} loading={busy === 'gmail'} disabled={!GOOGLE_WEB_CLIENT_ID} />
              {!GOOGLE_WEB_CLIENT_ID ? (
                <Text variant="caption" faint>
                  Needs a Google client ID in app.json → extra.googleWebClientId
                </Text>
              ) : null}
            </>
          ) : (
            <Row gap={8}>
              <Button title={gmail.status === ConnectionStatus.NEEDS_REAUTH ? 'Reconnect' : 'Sync now'} variant="secondary" onPress={gmail.status === ConnectionStatus.NEEDS_REAUTH ? connectGmail : () => run('gmail', () => m.syncGmail.mutateAsync())} loading={busy === 'gmail'} style={{ flex: 1 }} />
              <Button title="Disconnect" variant="ghost" onPress={disconnectGmail} />
            </Row>
          )
        }
      />

      <ConnectionCard
        icon="💬"
        title="SMS"
        conn={sms}
        trust={
          smsSupported
            ? 'We look only at bank and merchant payment alerts (sender IDs like VM-HDFCBK) to catch card, UPI and wallet payments. Messages are parsed on the spot and never uploaded or stored — just the amount and merchant.'
            : 'iOS does not let apps read SMS, so this is Android-only. Gmail and tap-to-bill cover most purchases on iPhone.'
        }
        actions={
          !smsSupported ? null : sms?.status === ConnectionStatus.ACTIVE ? (
            <Row gap={8}>
              <Button title="Scan new" variant="secondary" onPress={() => scanSms(false)} loading={busy === 'sms'} style={{ flex: 1 }} />
              <Button title="Rescan" variant="ghost" onPress={() => scanSms(true)} />
              <Button title="Stop" variant="ghost" onPress={disconnectSms} />
            </Row>
          ) : (
            <Button title="Allow SMS access" onPress={connectSms} loading={busy === 'sms'} />
          )
        }
      />

      {error ? <Text color={t.colors.danger}>{error}</Text> : null}
    </ScrollView>
  );
}

function ConnectionCard({ icon, title, conn, trust, actions }: { icon: string; title: string; conn: Connection | undefined; trust: string; actions: React.ReactNode }) {
  const t = useTheme();
  const status = conn?.status ?? ConnectionStatus.DISCONNECTED;
  const s = STATUS_LABEL[status];
  const color = s.tone === 'ok' ? t.colors.money : s.tone === 'warn' ? t.colors.warn : s.tone === 'bad' ? t.colors.danger : t.colors.inkFaint;
  return (
    <Card style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={10}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22 }}>{icon}</Text>
          </View>
          <Text variant="title">{title}</Text>
        </Row>
        <Badge label={s.label} color={color} />
      </Row>
      {conn && status !== ConnectionStatus.DISCONNECTED ? (
        <Text variant="caption" muted>
          {conn.importedCount} purchase{conn.importedCount === 1 ? '' : 's'} imported
          {conn.lastSyncedAt ? ` · synced ${formatDistanceToNow(new Date(conn.lastSyncedAt), { addSuffix: true })}` : ''}
          {conn.lastError ? `\n⚠️ ${conn.lastError}` : ''}
        </Text>
      ) : null}
      <View style={{ backgroundColor: t.colors.surfaceAlt, borderRadius: t.radius.md, padding: 12 }}>
        <Text variant="caption" style={{ lineHeight: 18 }}>
          🔒 {trust}
        </Text>
      </View>
      {actions}
    </Card>
  );
}
