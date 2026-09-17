import type { Transaction } from '@tapntally/shared';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { ApiClientError } from '../api/client';
import { useIngestNfcBill } from '../api/hooks';
import { useNfcTap, type NfcReadResult } from '../nfc';
import { useTheme } from '../theme';
import { NfcFab } from './NfcFab';
import { ReceiptFlash } from './ReceiptFlash';
import { Button, Row, Text } from './ui';

type FlowState =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'posting' }
  | { kind: 'flash'; tx: Transaction; verified: boolean; duplicate: boolean }
  | { kind: 'error'; title: string; message: string; details?: string[]; retryable: boolean };

/**
 * The whole tap journey, mounted once above the tabs:
 *   FAB → scanning sheet → read → POST → receipt flash → back on the dashboard.
 * Failures land in a small, dismissible sheet with a retry — never a full-screen error.
 */
export function TapFlow() {
  const t = useTheme();
  const router = useRouter();
  const { tap, cancel, readerKind } = useNfcTap();
  const ingest = useIngestNfcBill();
  const [state, setState] = useState<FlowState>({ kind: 'idle' });

  const start = useCallback(async () => {
    setState({ kind: 'scanning' });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result: NfcReadResult = await tap();

    if (result.status === 'cancelled') return setState({ kind: 'idle' });
    if (result.status !== 'success') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return setState({
        kind: 'error',
        title: TITLES[result.status],
        message: result.message,
        details: result.errors,
        retryable: result.status !== 'nfc_unavailable' && result.status !== 'unsupported_terminal',
      });
    }

    setState({ kind: 'posting' });
    try {
      const res = await ingest.mutateAsync({ bill: result.bill, idempotencyKey: Crypto.randomUUID() });
      setState({ kind: 'flash', tx: res.transaction, verified: res.signatureVerified, duplicate: !res.created });
    } catch (err) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const e = err instanceof ApiClientError ? err : null;
      setState({
        kind: 'error',
        title: e?.code === 'NFC_MALFORMED_BILL' ? "Couldn't read that bill" : "Couldn't save the bill",
        message: e?.message ?? 'Please try again.',
        details: (e?.details as { errors?: string[] } | undefined)?.errors,
        // Network / server errors are retryable; validation errors need a fresh tap.
        retryable: true,
      });
    }
  }, [tap, ingest]);

  const dismiss = useCallback(async () => {
    await cancel();
    setState({ kind: 'idle' });
  }, [cancel]);

  return (
    <>
      <NfcFab onPress={start} active={state.kind !== 'idle'} />

      {/* Scanning / posting sheet */}
      <Modal visible={state.kind === 'scanning' || state.kind === 'posting'} transparent animationType="fade" onRequestClose={dismiss}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: '#00000088' }]} onPress={state.kind === 'scanning' ? dismiss : undefined} />
        <View style={[styles.sheet, { backgroundColor: t.colors.surface, borderRadius: t.radius.xl }]}>
          <View style={{ alignItems: 'center', gap: 14 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              {state.kind === 'posting' ? <ActivityIndicator size="large" color={t.colors.accent} /> : <Text style={{ fontSize: 44 }}>📡</Text>}
            </View>
            <Text variant="title">{state.kind === 'posting' ? 'Saving your bill…' : 'Hold near the terminal'}</Text>
            <Text muted style={{ textAlign: 'center' }}>
              {state.kind === 'posting'
                ? 'Categorising and filing it for you.'
                : readerKind === 'mock'
                  ? 'Demo terminal — simulating a tap.'
                  : 'Keep your phone still against the NFC mark on the terminal.'}
            </Text>
            {state.kind === 'scanning' ? <Button title="Cancel" variant="ghost" onPress={dismiss} /> : null}
          </View>
        </View>
      </Modal>

      {/* Error sheet */}
      <Modal visible={state.kind === 'error'} transparent animationType="fade" onRequestClose={dismiss}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: '#00000088' }]} onPress={dismiss} />
        {state.kind === 'error' ? (
          <View style={[styles.sheet, { backgroundColor: t.colors.surface, borderRadius: t.radius.xl, gap: 12 }]}>
            <Row gap={10}>
              <Text style={{ fontSize: 28 }}>😕</Text>
              <Text variant="title" style={{ flex: 1 }}>
                {state.title}
              </Text>
            </Row>
            <Text muted>{state.message}</Text>
            {state.details?.length ? (
              <Text variant="caption" faint>
                {state.details.slice(0, 3).join(' · ')}
              </Text>
            ) : null}
            <Row gap={10} style={{ marginTop: 6 }}>
              <Button title="Not now" variant="secondary" onPress={dismiss} style={{ flex: 1 }} />
              {state.retryable ? <Button title="Tap again" onPress={start} style={{ flex: 1 }} /> : null}
            </Row>
            {!state.retryable ? (
              <Button
                title="Add it manually instead"
                variant="ghost"
                onPress={() => {
                  setState({ kind: 'idle' });
                  router.push('/add-transaction');
                }}
              />
            ) : null}
          </View>
        ) : null}
      </Modal>

      {/* Receipt flash */}
      <Modal visible={state.kind === 'flash'} transparent animationType="none" onRequestClose={() => setState({ kind: 'idle' })}>
        {state.kind === 'flash' ? (
          <ReceiptFlash
            tx={state.tx}
            verified={state.verified}
            onDone={() => {
              setState({ kind: 'idle' });
              router.navigate('/(tabs)');
            }}
            onEdit={() => {
              const id = state.tx.id;
              setState({ kind: 'idle' });
              router.push({ pathname: '/transaction/[id]', params: { id } });
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

const TITLES: Record<Exclude<NfcReadResult['status'], 'success' | 'cancelled'>, string> = {
  no_tag_found: "Didn't catch the bill",
  unsupported_terminal: 'Terminal not supported yet',
  malformed_bill: "Couldn't read that bill",
  nfc_unavailable: 'NFC is off',
};

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 16, right: 16, bottom: 40, padding: 24 },
});
