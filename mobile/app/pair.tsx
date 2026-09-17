import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { usePairingCode } from '../src/api/hooks';
import { Button, Card, ErrorBanner, Loading, Row, Text } from '../src/components/ui';
import { useTheme } from '../src/theme';
import { Icon } from '../src/theme/icons';

/**
 * Pairing code for terminals that cannot write NFC. The cashier types the
 * code (or scans it, in partner software) and the terminal posts the bill to
 * this account through the partner API. One code, one bill, ten minutes.
 */
export default function Pair() {
  const t = useTheme();
  const pairing = usePairingCode();
  const requestCode = pairing.mutate; // stable reference from react-query
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    requestCode();
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [requestCode]);

  const data = pairing.data;
  const secondsLeft = data ? Math.max(0, Math.round((new Date(data.expiresAt).getTime() - now) / 1000)) : 0;
  const expired = !!data && secondsLeft === 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 60 }}>
      <Text muted>Show this code at the counter. The terminal sends the itemised bill straight to your account.</Text>

      <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 28 }}>
        {pairing.isPending ? <Loading label="Getting a code" /> : null}
        {pairing.error ? <ErrorBanner message="Couldn't get a pairing code." onRetry={() => pairing.mutate()} /> : null}
        {data ? (
          <>
            <Text variant="micro" faint>
              Pairing code
            </Text>
            <Text variant="hero" style={{ letterSpacing: 8, opacity: expired ? 0.35 : 1 }} numberOfLines={1}>
              {data.code}
            </Text>
            <Row gap={6}>
              <Icon name="time-outline" size={16} color={expired ? t.colors.danger : t.colors.inkMuted} />
              <Text variant="caption" color={expired ? t.colors.danger : t.colors.inkMuted}>
                {expired ? 'Expired' : `Valid for ${mm}:${ss}`}
              </Text>
            </Row>
          </>
        ) : null}
        <Button title={expired ? 'Get a new code' : 'Refresh code'} variant={expired ? 'primary' : 'secondary'} icon="refresh-outline" size="sm" onPress={() => pairing.mutate()} loading={pairing.isPending} style={{ marginTop: 8 }} />
      </Card>

      <Card tone="alt" style={{ gap: 10 }}>
        <Text variant="heading">How it works</Text>
        <Step n={1} text="Pay as usual with card, UPI or cash." />
        <Step n={2} text="Read out or show this code; the cashier enters it on the terminal." />
        <Step n={3} text="The bill appears on your Home screen within a few seconds." />
        <Text variant="caption" faint>
          Each code works once and expires after ten minutes. Terminals that support tap don't need a code at all.
        </Text>
      </Card>
    </ScrollView>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  const t = useTheme();
  return (
    <Row gap={10} style={{ alignItems: 'flex-start' }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="micro" color={t.colors.accentInk}>
          {n}
        </Text>
      </View>
      <Text style={{ flex: 1, minWidth: 0 }}>{text}</Text>
    </Row>
  );
}
