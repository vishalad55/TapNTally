import { BudgetScope } from '@tapntally/shared';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useBudgets } from '../../src/api/hooks';
import { BudgetBar } from '../../src/components/BudgetBar';
import { Button, EmptyState, ErrorBanner, Loading, Reveal, Row, Screen, SectionHeader, Text } from '../../src/components/ui';
import { useSession } from '../../src/store/session';
import { useTheme } from '../../src/theme';

export default function Budgets() {
  const t = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const budgets = useBudgets();
  const mine = budgets.data?.filter((b) => b.budget.scope === BudgetScope.USER) ?? [];
  const household = budgets.data?.filter((b) => b.budget.scope === BudgetScope.HOUSEHOLD) ?? [];

  const edit = (b: (typeof mine)[number]) =>
    router.push({
      pathname: '/budget-edit',
      params: { id: b.budget.id, scope: b.budget.scope, categoryId: b.budget.categoryId, limitPaise: String(b.budget.limitPaise), period: b.budget.period },
    });

  return (
    <Screen>
      <ScrollView
        refreshControl={<RefreshControl refreshing={budgets.isRefetching} onRefresh={() => void budgets.refetch()} tintColor={t.colors.accent} />}
        contentContainerStyle={{ paddingBottom: 150, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
          <View>
            <Text variant="title">Budgets</Text>
            <Text variant="caption" muted>
              Caps per category. We nudge you at 80%.
            </Text>
          </View>
          <Button title="New" icon="add" size="sm" onPress={() => router.push('/budget-edit')} />
        </Row>

        {budgets.isLoading ? <Loading /> : null}
        {budgets.error ? <ErrorBanner message="Couldn't load budgets." onRetry={() => void budgets.refetch()} /> : null}

        {budgets.data && budgets.data.length === 0 ? (
          <EmptyState icon="pie-chart-outline" title="No budgets yet" body="Set a cap on eating out, shopping — anything you'd like a heads-up on.">
            <Button title="Set your first budget" onPress={() => router.push('/budget-edit')} />
          </EmptyState>
        ) : null}

        {mine.length ? <SectionHeader eyebrow="Just you" title="Personal" /> : null}
        {mine.map((b, i) => (
          <Reveal key={b.budget.id} index={i}>
            <BudgetBar progress={b} onPress={() => edit(b)} />
          </Reveal>
        ))}

        {user?.householdId ? (
          <>
            <SectionHeader
              eyebrow="Everyone"
              title="Household"
              right={
                <Pressable onPress={() => router.push({ pathname: '/budget-edit', params: { scope: BudgetScope.HOUSEHOLD } })} hitSlop={8}>
                  <Text variant="caption" color={t.colors.accent}>
                    Add
                  </Text>
                </Pressable>
              }
            />
            {household.length === 0 ? (
              <Text muted variant="caption">
                Shared caps count only purchases marked "shared" by any member.
              </Text>
            ) : null}
            {household.map((b, i) => (
              <Reveal key={b.budget.id} index={i}>
                <BudgetBar progress={b} onPress={() => edit(b)} />
              </Reveal>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
