import { CategoryConfidence, PaymentMethod, TransactionSource, formatPaise } from '@tapntally/shared';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { ApiClientError } from '../../src/api/client';
import { useDeleteTransaction, useTransaction, useUpdateTransaction } from '../../src/api/hooks';
import { CategoryPicker } from '../../src/components/CategoryPicker';
import { friendlyDate } from '../../src/components/TransactionRow';
import { Badge, Button, Card, Chip, ErrorBanner, Loading, Row, SectionHeader, Sticker, Text } from '../../src/components/ui';
import { useSession } from '../../src/store/session';
import { type Theme, fonts, useTheme } from '../../src/theme';

const METHODS: Array<{ key: PaymentMethod; label: string }> = [
  { key: PaymentMethod.UPI, label: 'UPI' },
  { key: PaymentMethod.CARD, label: 'Card' },
  { key: PaymentMethod.CASH, label: 'Cash' },
  { key: PaymentMethod.NET_BANKING, label: 'Net banking' },
  { key: PaymentMethod.WALLET, label: 'Wallet' },
];

/** Every purchase is editable; auto-categorisation is a first guess with a visible "check?" nudge. */
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
    nav.setOptions({ title: tx.data?.merchant ?? 'Purchase' });
  }, [nav, tx.data?.merchant]);

  if (tx.isLoading) return <Loading />;
  if (tx.error || !tx.data) return <ErrorBanner message="Couldn't load this purchase." onRetry={() => void tx.refetch()} />;
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
      { text: 'Delete', style: 'destructive', onPress: async () => { await del.mutateAsync(d.id); router.back(); } },
    ]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.bg }} contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <Card style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: d.category.color + '26', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 32 }}>{d.category.icon}</Text>
        </View>
        <Text variant="hero">{formatPaise(d.amountPaise)}</Text>
        <Text variant="heading">{d.merchant}</Text>
        <Text variant="caption" muted>
          {friendlyDate(d.occurredAt)}
        </Text>
        <Row gap={8} style={{ marginTop: 6 }}>
          <Badge label={d.source} color={t.colors.inkFaint} />
          {d.source === TransactionSource.NFC ? <Sticker label="itemised" color={t.colors.money} /> : null}
          {d.isShared ? <Sticker label="shared" color={t.colors.pop} tilt={3} /> : null}
        </Row>
      </Card>

      {needsCheck && mine ? (
        <Card tone="accent" style={{ gap: 2 }}>
          <Text variant="heading">Is "{d.category.name}" right?</Text>
          <Text variant="caption" muted>
            We guessed this one. Pick a category below to correct it.
          </Text>
        </Card>
      ) : null}

      {d.items.length > 0 ? (
        <>
          <SectionHeader title={`Items · ${d.items.length}`} />
          <Card style={{ gap: 8 }}>
            {d.items.map((it, i) => (
              <Row key={i} style={{ justifyContent: 'space-between' }}>
                <Text style={{ flex: 1 }} numberOfLines={1}>
                  {it.name} <Text muted>× {it.qty}</Text>
                </Text>
                <Text variant="money">{formatPaise(it.totalPaise)}</Text>
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
          <TextInput value={tags} onChangeText={setTags} placeholder="office, weekend, gift" placeholderTextColor={t.colors.inkFaint} autoCapitalize="none" style={inputStyle(t)} />

          <SectionHeader title="Notes" />
          <TextInput value={notes} onChangeText={setNotes} placeholder="Anything worth remembering" placeholderTextColor={t.colors.inkFaint} multiline style={[inputStyle(t), { minHeight: 80, textAlignVertical: 'top' }]} />

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

const inputStyle = (t: Theme) => ({
  borderRadius: t.radius.md,
  padding: 14,
  color: t.colors.ink,
  backgroundColor: t.colors.surfaceAlt,
  fontFamily: fonts.body,
  fontSize: 15,
});
