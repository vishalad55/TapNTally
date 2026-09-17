import Slider from '@react-native-community/slider';
import { BudgetPeriod, BudgetScope, formatPaise, rupeesToPaise } from '@tapntally/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ApiClientError } from '../src/api/client';
import { useDeleteBudget, useUpsertBudget } from '../src/api/hooks';
import { CategoryPicker } from '../src/components/CategoryPicker';
import { Button, Chip, Row, SectionHeader, Text } from '../src/components/ui';
import { useSession } from '../src/store/session';
import { useTheme } from '../src/theme';

const MIN_RUPEES = 500;
const MAX_RUPEES = 50_000;

export default function BudgetEdit() {
  const t = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const params = useLocalSearchParams<{ id?: string; scope?: string; categoryId?: string; limitPaise?: string; period?: string }>();
  const editing = !!params.id;

  const [scope, setScope] = useState<BudgetScope>((params.scope as BudgetScope) ?? BudgetScope.USER);
  const [categoryId, setCategoryId] = useState<string | null>(params.categoryId ?? null);
  const [rupees, setRupees] = useState<number>(params.limitPaise ? Number(params.limitPaise) / 100 : 5000);
  const [period, setPeriod] = useState<BudgetPeriod>((params.period as BudgetPeriod) ?? BudgetPeriod.MONTHLY);
  const [error, setError] = useState<string | null>(null);

  const upsert = useUpsertBudget();
  const del = useDeleteBudget();

  const save = async () => {
    if (!categoryId) return setError('Pick a category first.');
    setError(null);
    try {
      await upsert.mutateAsync({ scope, categoryId, limitPaise: rupeesToPaise(rupees), period });
      router.back();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not save budget.');
    }
  };

  const remove = () =>
    Alert.alert('Remove budget?', 'You can always set it again.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await del.mutateAsync(params.id!);
          router.back();
        },
      },
    ]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colors.background }} contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 60 }}>
      {user?.householdId ? (
        <>
          <SectionHeader title="Who is this for?" />
          <Row gap={8}>
            <Chip label="👤 Just me" selected={scope === BudgetScope.USER} onPress={() => setScope(BudgetScope.USER)} />
            <Chip label="👨‍👩‍👧 Household" selected={scope === BudgetScope.HOUSEHOLD} onPress={() => setScope(BudgetScope.HOUSEHOLD)} />
          </Row>
          {scope === BudgetScope.HOUSEHOLD ? (
            <Text variant="caption" muted>
              Counts purchases any member marks as shared. Everyone gets the alert.
            </Text>
          ) : null}
        </>
      ) : null}

      <SectionHeader title="Category" />
      <CategoryPicker value={categoryId} onChange={(c) => setCategoryId(c.id)} compact />

      <SectionHeader title="Limit" />
      <View style={{ alignItems: 'center', gap: 4 }}>
        <Text variant="display" style={{ fontVariant: ['tabular-nums'] }}>
          {formatPaise(rupeesToPaise(rupees), { showDecimals: false })}
        </Text>
        <Text variant="caption" muted>
          per {period === BudgetPeriod.WEEKLY ? 'week' : 'month'}
        </Text>
      </View>
      <Slider
        minimumValue={MIN_RUPEES}
        maximumValue={MAX_RUPEES}
        step={100}
        value={Math.min(MAX_RUPEES, Math.max(MIN_RUPEES, rupees))}
        onValueChange={setRupees}
        minimumTrackTintColor={t.colors.accent}
        maximumTrackTintColor={t.colors.border}
        thumbTintColor={t.colors.accent}
      />
      <Row gap={8}>
        <Text muted>or type: ₹</Text>
        <TextInput
          keyboardType="number-pad"
          value={String(Math.round(rupees))}
          onChangeText={(v) => setRupees(Math.max(0, Number(v.replace(/[^0-9]/g, '')) || 0))}
          style={{
            flex: 1,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.colors.border,
            borderRadius: t.radius.md,
            padding: 10,
            color: t.colors.text,
            backgroundColor: t.colors.surface,
          }}
        />
      </Row>

      <SectionHeader title="Period" />
      <Row gap={8}>
        <Chip label="Monthly" selected={period === BudgetPeriod.MONTHLY} onPress={() => setPeriod(BudgetPeriod.MONTHLY)} />
        <Chip label="Weekly" selected={period === BudgetPeriod.WEEKLY} onPress={() => setPeriod(BudgetPeriod.WEEKLY)} />
      </Row>

      {error ? (
        <Text color={t.colors.danger} style={{ marginTop: 8 }}>
          {error}
        </Text>
      ) : null}
      <View style={{ height: 8 }} />
      <Button title={editing ? 'Save changes' : 'Set budget'} onPress={save} loading={upsert.isPending} />
      {editing ? <Button title="Remove budget" variant="ghost" onPress={remove} loading={del.isPending} /> : null}
    </ScrollView>
  );
}
