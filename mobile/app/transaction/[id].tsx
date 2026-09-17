import { CategoryConfidence, PaymentMethod, formatPaise } from '@tapntally/shared';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { ApiClientError } from '../../src/api/client';
import { useDeleteTransaction, useTransaction, useUpdateTransaction } from '../../src/api/hooks';
import { CategoryPicker } from '../../src/components/CategoryPicker';
import { Badge, friendlyDate } from '../../src/components/TransactionRow';
import { Button, Card, Chip, ErrorBanner, Loading, Row, SectionHeader, Text } from '../../src/components/ui';
import { useSession } from '../../src/store/session';
import { useTheme } from '../../src/theme';

const METHODS: Array<{ key: PaymentMethod; label: string }> = [
  { key: PaymentMethod.UPI, label: 'UPI' },
  { key: PaymentMethod.CARD, label: 'Card' },
  { key: PaymentMethod.CASH, label: 'Cash' },
  { key: PaymentMethod.NET_BANKING, label: 'Net banking' },
  { key: PaymentMethod.WALLET, label: 'Wallet' },
];

/**
 * Every transaction is editable. Auto-categorisation is a first guess: when
 * confidence is low/medium and unconfirmed we surface a "check this" nudge.
 */
export default function TransactionDetail() {
  const t = useTheme();
  const router = useRouter();
  const nav = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.user);
  const tx = useTransaction(id);
  const update = useUpdateTransaction(id);
  const del = useDeleteTransaction();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isShared, setIsShared] = useState(false);
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.UNKNOWN);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tx.data) {
      setCategoryId(tx.data.categoryId);
      setIsShared(tx.data.isShared);
      setTags(tx.data.tags.join(', '));
      setNotes(tx.data.notes ?? '');
      setMethod(tx.data.paymentMethod);
    }
  }, [tx.data]);

  useLayoutEffect(() => {
    nav.setOptions({ title: tx.data?.merchant ?? 'Transaction' });
  }, [nav, tx.data?.merchant]);

  if (tx.isLoading) return <Loading />;
  if (tx.error || !tx.data) return <ErrorBanner message="Couldn't load this transaction." onRetry={() => void tx.refetch()} />;
  const d = tx.data;
  const mine = d.userId === me?.id;
  const needsCheck = !d.categoryConfirmed && d.categoryConfidence !== CategoryConfidence.HIGH;
  const dirty = categoryId !== d.categoryId || isShared !== d.isShared || tags !== d.tags.join(', ') || notes !== (d.notes ?? '') || method !== d.paymentMethod;

  const save = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        categoryId: categoryId !== d.categoryId ? categoryId! : undefined,
        isShared,
        tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
        notes: notes.trim() || null,
        paymentMethod: method,
      });
      router.back();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not save.');
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete this purchase?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await del.mutateAsync(d.id);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <Card style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 40 }}>{d.category.icon}</Text>
        <Text variant="display" style={{ fontVariant: ['tabular-nums'] }}>
          {formatPaise(d.amountPaise)}
        </Text>
        <Text variant="heading">{d.merchant}</Text>
        <Text variant="caption" muted>
          {friendlyDate(d.occurredAt)}
        </Text>
        <Row gap={6} style={{ marginTop: 4 }}>
          <Badge label={d.source} color={t.colors.textFaint} />
          {d.source === 'nfc' ? <Badge label="itemised" color={t.colors.accent} /> : null}
          {d.isShared ? <Badge label="shared" color={t.colors.accent} /> : null}
        </Row>
      </Card>

      {needsCheck && mine ? (
        <Card style={{ backgroundColor: t.colors.accentSoft, borderColor: 'transparent' }}>
          <Text variant="heading">Is "{d.category.name}" right?</Text>
          <Text variant="caption" muted>
            We guessed this one. Tap a category below to correct it — we'll remember.
          </Text>
        </Card>
      ) : null}

      {d.items.length > 0 ? (
        <>
          <SectionHeader title={`Items · ${d.items.length}`} />
          <Card style={{ gap: 6 }}>
            {d.items.map((it, i) => (
              <Row key={i} style={{ justifyContent: 'space-between' }}>
                <Text style={{ flex: 1 }} numberOfLines={1}>
                  {it.name} <Text muted>× {it.qty}</Text>
                </Text>
                <Text style={{ fontVariant: ['tabular-nums'] }}>{formatPaise(it.totalPaise)}</Text>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      {mine ? (
        <>
          <SectionHeader title="Category" />
          <CategoryPicker value={categoryId} onChange={(c) => setCategoryId(c.id)} compact />

          <SectionHeader title="Paid with" />
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {METHODS.map((m) => (
              <Chip key={m.key} label={m.label} selected={method === m.key} onPress={() => setMethod(m.key)} />
            ))}
          </Row>

          <SectionHeader title="Share with household" />
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">{isShared ? 'Shared' : 'Personal'}</Text>
                <Text variant="caption" muted>
                  {me?.householdId ? 'Shared purchases count toward household budgets.' : 'Join a household on the Family tab to share.'}
                </Text>
              </View>
              <Switch value={isShared} onValueChange={setIsShared} disabled={!me?.householdId && !isShared} trackColor={{ true: t.colors.accent }} />
            </Row>
          </Card>

          <SectionHeader title="Tags" />
          <TextInput value={tags} onChangeText={setTags} placeholder="office, weekend, gift" placeholderTextColor={t.colors.textFaint} autoCapitalize="none" style={inputStyle(t)} />

          <SectionHeader title="Notes" />
          <TextInput value={notes} onChangeText={setNotes} placeholder="Anything worth remembering" placeholderTextColor={t.colors.textFaint} multiline style={[inputStyle(t), { minHeight: 80, textAlignVertical: 'top' }]} />

          {error ? <Text color={t.colors.danger}>{error}</Text> : null}
          <Button title="Save" onPress={save} loading={update.isPending} disabled={!dirty} style={{ marginTop: 8 }} />
          <Pressable onPress={confirmDelete} style={{ alignItems: 'center', padding: 12 }}>
            <Text color={t.colors.danger}>Delete purchase</Text>
          </Pressable>
        </>
      ) : (
        <Text muted variant="caption" style={{ textAlign: 'center', marginTop: 8 }}>
          Shared by a household member — only they can edit it.
        </Text>
      )}
    </ScrollView>
  );
}

const inputStyle = (t: ReturnType<typeof useTheme>) => ({
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: t.colors.border,
  borderRadius: t.radius.md,
  padding: 12,
  color: t.colors.text,
  backgroundColor: t.colors.surface,
  fontSize: 15,
});
