import { formatPaise } from '@tapntally/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useBudgets, useSummary, useTransactions } from '../../src/api/hooks';
import { BreakdownLegend } from '../../src/components/BreakdownLegend';
import { DonutChart, type DonutSelection, buildSlices } from '../../src/components/DonutChart';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Card, EmptyState, ErrorBanner, IconButton, Loading, Reveal, Row, Screen, Text } from '../../src/components/ui';
import { useSession } from '../../src/store/session';
import { useTapRequest } from '../../src/store/tap';
import { fonts, useTheme } from '../../src/theme';
import { Icon, type IoniconName } from '../../src/theme/icons';
import { useCountUp } from '../../src/theme/motion';
import { catColor, mix } from '../../src/theme/palette';

/**
 * Home — the dashboard. A gradient hero with this month's spend and the
 * change versus last month, a row of quick actions, the selectable breakdown
 * (donut + legend, one shared selection) and the recent feed it filters.
 */
export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const requestTap = useTapRequest((s) => s.requestTap);
  const [sel, setSel] = useState<DonutSelection | null>(null);

  const summary = useSummary('month', 0, 'personal');
  const previous = useSummary('month', -1, 'personal');
  const budgets = useBudgets();
  const feed = useTransactions({ categoryIds: sel?.categoryIds, limit: 30 });
  const rows = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const slices = useMemo(() => buildSlices(summary.data?.byCategory ?? [], (c) => catColor(c, t), t.colors.inkFaint), [summary.data, t]);

  const refreshing = summary.isRefetching || feed.isRefetching;
  const refresh = () => {
    void summary.refetch();
    void previous.refetch();
    void feed.refetch();
  };

  const total = summary.data?.totalPaise ?? 0;
  const prevTotal = previous.data?.totalPaise ?? 0;
  const delta = prevTotal > 0 ? (total - prevTotal) / prevTotal : null;
  const purchases = summary.data?.byCategory.reduce((s, c) => s + c.transactionCount, 0) ?? 0;
  const budgetTotal = budgets.data?.reduce((s, b) => s + b.budget.limitPaise, 0) ?? 0;
  const budgetSpent = budgets.data?.reduce((s, b) => s + b.spentPaise, 0) ?? 0;
  const initial = (user?.name ?? '?').trim().charAt(0).toUpperCase();

  const header = (
    <View style={{ gap: 14 }}>
      <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
        <Row gap={12} style={{ flex: 1, minWidth: 0 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="title" color={t.colors.accent}>
              {initial}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="caption" muted>
              {greeting()}
            </Text>
            <Text variant="title" numberOfLines={1}>
              {user?.name?.split(' ')[0] ?? 'there'}
            </Text>
          </View>
        </Row>
        <Row gap={8}>
          <ThemeToggle />
          <IconButton name="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
        </Row>
      </Row>

      <Hero total={total} delta={delta} purchases={purchases} loading={summary.isLoading} budgetSpent={budgetSpent} budgetTotal={budgetTotal} />

      <Row gap={10}>
        <QuickAction icon="wifi" label="Tap bill" onPress={requestTap} primary />
        <QuickAction icon="add" label="Add" onPress={() => router.push('/add-transaction')} />
        <QuickAction icon="pie-chart-outline" label="Budgets" onPress={() => router.push('/(tabs)/budgets')} />
        <QuickAction icon="sparkles-outline" label="Recap" onPress={() => router.push('/(tabs)/insights')} />
      </Row>

      <Card style={{ gap: 6, paddingTop: 18 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text variant="micro" faint>
              Breakdown
            </Text>
            <Text variant="title">By category</Text>
          </View>
          {sel ? (
            <Pressable onPress={() => setSel(null)} hitSlop={8}>
              <Row gap={4}>
                <Text variant="caption" color={t.colors.accent}>
                  Clear
                </Text>
                <Icon name="close-circle" size={16} color={t.colors.accent} />
              </Row>
            </Pressable>
          ) : null}
        </Row>
        {summary.isLoading ? (
          <Loading />
        ) : summary.error ? (
          <ErrorBanner message="Couldn't load your spend chart." onRetry={() => void summary.refetch()} />
        ) : (
          <>
            <View style={{ alignItems: 'center', marginVertical: 4 }}>
              <DonutChart data={summary.data?.byCategory ?? []} totalPaise={total} selectedId={sel?.id ?? null} onSelect={setSel} />
            </View>
            <BreakdownLegend slices={slices} selectedId={sel?.id ?? null} onSelect={setSel} />
          </>
        )}
      </Card>

      <Row style={{ justifyContent: 'space-between', marginTop: 8, marginBottom: 2 }}>
        <Text variant="title" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
          {sel ? sel.label : 'Recent'}
        </Text>
        <Pressable onPress={() => router.push('/(tabs)/history')} hitSlop={8}>
          <Row gap={2}>
            <Text variant="caption" color={t.colors.accent}>
              See all
            </Text>
            <Icon name="chevron-forward" size={14} color={t.colors.accent} />
          </Row>
        </Pressable>
      </Row>
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(tx) => tx.id}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <Reveal index={index}>
            <TransactionRow tx={item} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })} />
          </Reveal>
        )}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.colors.accent} />}
        ListEmptyComponent={
          feed.isLoading ? (
            <Loading />
          ) : feed.error ? (
            <ErrorBanner message="Couldn't load transactions." onRetry={() => void feed.refetch()} />
          ) : (
            <EmptyState icon="receipt-outline" title={sel ? 'Nothing here yet' : 'No purchases yet'} body="Tap a terminal after paying, or connect Gmail and SMS to pull in your online orders." />
          )
        }
        ListFooterComponent={feed.isFetchingNextPage ? <Loading /> : <View style={{ height: 130 }} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function Hero({ total, delta, purchases, loading, budgetSpent, budgetTotal }: { total: number; delta: number | null; purchases: number; loading: boolean; budgetSpent: number; budgetTotal: number }) {
  const t = useTheme();
  const shown = useCountUp(total);
  const ink = t.colors.accentInk;
  const soft = t.dark ? 'rgba(11,14,21,0.55)' : 'rgba(255,255,255,0.75)';
  const chip = t.dark ? 'rgba(11,14,21,0.16)' : 'rgba(255,255,255,0.22)';
  const pct = budgetTotal > 0 ? Math.min(1, budgetSpent / budgetTotal) : null;
  const deltaLabel = delta === null ? 'first month on record' : `${delta >= 0 ? '+' : '−'}${Math.round(Math.abs(delta) * 100)}% vs last month`;
  const deltaIcon: IoniconName = delta === null ? 'time-outline' : delta >= 0 ? 'trending-up' : 'trending-down';

  return (
    <LinearGradient colors={[t.colors.accent, mix(t.colors.accent, t.dark ? '#4ADE80' : '#FF2D55', 0.45)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: t.radius.xl, padding: 22, gap: 14, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', right: -30, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: chip }} />
      <View style={{ position: 'absolute', right: 40, bottom: -70, width: 140, height: 140, borderRadius: 70, backgroundColor: chip }} />
      <Text variant="micro" color={soft}>
        Spent this month
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.display, fontSize: 42, lineHeight: 48, letterSpacing: -1, color: ink }}>
        {loading ? '—' : formatPaise(shown, { showDecimals: false })}
      </Text>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: chip, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 }}>
          <Icon name={deltaIcon} size={14} color={ink} />
          <Text variant="caption" color={ink}>
            {deltaLabel}
          </Text>
        </View>
        <View style={{ backgroundColor: chip, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 }}>
          <Text variant="caption" color={ink}>
            {purchases} purchase{purchases === 1 ? '' : 's'}
          </Text>
        </View>
      </Row>
      {pct !== null ? (
        <View style={{ gap: 6 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: chip, overflow: 'hidden' }}>
            <View style={{ width: `${Math.max(2, pct * 100)}%`, height: '100%', backgroundColor: ink, borderRadius: 3 }} />
          </View>
          <Text variant="caption" color={soft}>
            {Math.round(pct * 100)}% of your {formatPaise(budgetTotal, { showDecimals: false })} budgets used
          </Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

function QuickAction({ icon, label, onPress, primary }: { icon: IoniconName; label: string; onPress: () => void; primary?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 7, transform: [{ scale: pressed ? 0.95 : 1 }], opacity: pressed ? 0.85 : 1 })}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 18,
          backgroundColor: primary ? t.colors.accent : t.colors.surface,
          borderWidth: primary ? 0 : t.cardBorderWidth,
          borderColor: t.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={22} color={primary ? t.colors.accentInk : t.colors.ink} />
      </View>
      <Text variant="caption" numberOfLines={1} style={{ fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
