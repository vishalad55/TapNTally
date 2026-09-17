import { PaymentMethod, rupeesToPaise } from '@tapntally/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { ApiClientError } from '../src/api/client';
import { useCreateTransaction } from '../src/api/hooks';
import { CategoryPicker } from '../src/components/CategoryPicker';
import { Button, Card, Chip, Row, SectionHeader, Text } from '../src/components/ui';
import { useSession } from '../src/store/session';
import { useTheme } from '../src/theme';

const METHODS: Array<{ key: PaymentMethod; label: string }> = [
  { key: PaymentMethod.UPI, label: 'UPI' },
  { key: PaymentMethod.CARD, label: 'Card' },
  { key: PaymentMethod.CASH, label: 'Cash' },
];

/** Manual entry — the fallback for cash at an unsupported stall. Category is optional: leave it and we guess. */
export default function AddTransaction() {
  const t = useTheme();
  const router = useRouter();
  const me = useSession((s) => s.user);
  const create = useCreateTransaction();
  const [merchant, setMerchant] = useState('');
  const [rupees, setRupees] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.UPI);
  const [isShared, setIsShared] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = Number(rupees.replace(/[^0-9.]/g, ''));
  const valid = merchant.trim().length > 0 && amount > 0;

  const save = async () => {
    setError(null);
    try {
      await create.mutateAsync({ merchant: merchant.trim(), amountPaise: rupeesToPaise(amount), categoryId: categoryId ?? undefined, paymentMethod: method, isShared });
      router.back();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not save.');
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: 10 }}>
        <Row gap={6}>
          <Text variant="display">₹</Text>
          <TextInput
            value={rupees}
            onChangeText={setRupees}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={t.colors.textFaint}
            autoFocus
            style={{ flex: 1, fontSize: 34, fontWeight: '800', color: t.colors.text, fontVariant: ['tabular-nums'] }}
          />
        </Row>
        <TextInput value={merchant} onChangeText={setMerchant} placeholder="Where? e.g. Corner tea stall" placeholderTextColor={t.colors.textFaint} style={inputStyle(t)} />
      </Card>

      <SectionHeader title="Paid with" />
      <Row gap={8}>
        {METHODS.map((m) => (
          <Chip key={m.key} label={m.label} selected={method === m.key} onPress={() => setMethod(m.key)} />
        ))}
      </Row>

      <SectionHeader title="Category (optional — we'll guess)" />
      <CategoryPicker value={categoryId} onChange={(c) => setCategoryId(c.id === categoryId ? null : c.id)} compact />

      {me?.householdId ? (
        <Card style={{ marginTop: 8 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="heading">Share with household</Text>
            </View>
            <Switch value={isShared} onValueChange={setIsShared} trackColor={{ true: t.colors.accent }} />
          </Row>
        </Card>
      ) : null}

      {error ? <Text color={t.colors.danger}>{error}</Text> : null}
      <Button title="Add purchase" onPress={save} loading={create.isPending} disabled={!valid} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

const inputStyle = (t: ReturnType<typeof useTheme>) => ({
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: t.colors.border,
  borderRadius: t.radius.md,
  padding: 12,
  color: t.colors.text,
  backgroundColor: t.colors.background,
  fontSize: 15,
});
