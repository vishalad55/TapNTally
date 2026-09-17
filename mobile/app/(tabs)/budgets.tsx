import { BudgetScope } from '@tapntally/shared';
import { Link, useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useBudgets } from '../../src/api/hooks';
import { BudgetBar } from '../../src/components/BudgetBar';
import { Button, EmptyState, ErrorBanner, Loading, Row, Screen, SectionHeader, Text } from '../../src/components/ui';
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
        contentContainerStyle={{ paddingBottom: 140, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <Text variant="title">Budgets</Text>
          <Link href="/budget-edit" asChild>
            <Pressable hitSlop={8}>
              <Text variant="heading" color={t.colors.accent}>
                + New
              </Text>
            </Pressable>
          </Link>
        </Row>
        <Text muted variant="caption">
          Monthly caps per category. We'll nudge you at 80%.
        </Text>

        {budgets.isLoading ? <Loading /> : null}
        {budgets.error ? <ErrorBanner message="Couldn't load budgets." onRetry={() => void budgets.refetch()} /> : null}

        {budgets.data && budgets.data.length === 0 ? (
          <EmptyState icon="🎯" title="No budgets yet" body="Set a cap on eating out, shopping — anything you'd like a heads-up on.">
            <Link href="/budget-edit" asChild>
              <Button title="Set your first budget" />
            </Link>
          </EmptyState>
        ) : null}

        {mine.length ? <SectionHeader title="Personal" /> : null}
        {mine.map((b) => (
          <BudgetBar key={b.budget.id} progress={b} onPress={() => edit(b)} />
        ))}

        {user?.householdId ? (
          <>
            <SectionHeader
              title="Household"
              right={
                <Link href={{ pathname: '/budget-edit', params: { scope: BudgetScope.HOUSEHOLD } }} asChild>
                  <Pressable hitSlop={8}>
                    <Text variant="caption" color={t.colors.accent}>
                      + Add
                    </Text>
                  </Pressable>
                </Link>
              }
            />
            {household.length === 0 ? (
              <Text muted variant="caption">
                Shared caps count only purchases marked "shared" by any member.
              </Text>
            ) : null}
            {household.map((b) => (
              <BudgetBar key={b.budget.id} progress={b} onPress={() => edit(b)} />
            ))}
          </>
        ) : null}
        <View style={{ height: 20 }} />
      </ScrollView>
    </Screen>
  );
}
