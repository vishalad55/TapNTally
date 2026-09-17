import { formatPaise } from '@tapntally/shared';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSummary, useTransactions } from '../../src/api/hooks';
import { DonutChart, type DonutSelection } from '../../src/components/DonutChart';
import { ThemeToggle } from '../../src/components/ThemeToggle';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Card, Chip, EmptyState, ErrorBanner, IconButton, Loading, Reveal, Row, Screen, Text } from '../../src/components/ui';
import { useSession } from '../../src/store/session';
import { useTheme } from '../../src/theme';
import { categoryIconName } from '../../src/theme/icons';

/**
 * Home: hero month total with a hand-drawn underline, the tappable donut that
 * filters the feed below it, and the always-present TAP button (rendered by
 * the tabs layout so it floats over every tab).
 */
export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const [sel, setSel] = useState<DonutSelection | null>(null);

  const summary = useSummary('month', 0, 'personal');
  const feed = useTransactions({ categoryIds: sel?.categoryIds, limit: 30 });
  const rows = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const refreshing = summary.isRefetching || feed.isRefetching;
  const refresh = () => {
    void summary.refetch();
    void feed.refetch();
  };
  const initial = (user?.name ?? '?').trim().charAt(0).toUpperCase();

  const header = (
    <View style={{ gap: 6 }}>
      <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
        <Row gap={12}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: t.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="title" color={t.colors.accent}>
              {initial}
            </Text>
          </View>
          <View>
            <Text variant="caption" muted>
              {greeting()},
            </Text>
            <Text variant="title">{user?.name?.split(' ')[0] ?? 'there'}</Text>
          </View>
        </Row>
        <Row gap={8}>
          <ThemeToggle />
          <IconButton name="settings-outline" label="Settings" onPress={() => router.push('/settings')} />
        </Row>
      </Row>

      <View style={{ marginTop: 18 }}>
        <Text variant="micro" faint>
          Spent this month
        </Text>
        <View style={{ alignSelf: 'flex-start' }}>
          <Text variant="hero">{summary.data ? formatPaise(summary.data.totalPaise, { showDecimals: false }) : '—'}</Text>
          <Svg width="100%" height={10} viewBox="0 0 200 10" preserveAspectRatio="none" style={{ marginTop: -2 }}>
            <Path d="M2 7 C 40 2, 80 9, 120 4 S 180 8, 198 3" stroke={t.colors.pop} strokeWidth={3} strokeLinecap="round" fill="none" />
          </Svg>
        </View>
        {summary.data ? (
          <Text variant="caption" muted style={{ marginTop: 6 }}>
            across {summary.data.byCategory.reduce((s, c) => s + c.transactionCount, 0)} purchases · {summary.data.byCategory.length} categories
          </Text>
        ) : null}
      </View>

      <Card style={{ alignItems: 'center', marginTop: 14, paddingVertical: 12 }}>
        {summary.isLoading ? (
          <Loading />
        ) : summary.error ? (
          <ErrorBanner message="Couldn't load your spend chart." onRetry={() => void summary.refetch()} />
        ) : (
          <DonutChart data={summary.data?.byCategory ?? []} totalPaise={summary.data?.totalPaise ?? 0} selectedId={sel?.id ?? null} onSelect={setSel} />
        )}
        {summary.data && summary.data.byCategory.length > 0 ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={summary.data.byCategory}
            keyExtractor={(c) => c.category.id}
            style={{ alignSelf: 'stretch', marginTop: 4 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
            renderItem={({ item }) => (
              <Chip
                icon={categoryIconName(item.category.slug)}
                label={`${item.category.name} · ${formatPaise(item.amountPaise, { showDecimals: false, compact: true })}`}
                selected={sel?.categoryIds.length === 1 && sel.categoryIds[0] === item.category.id}
                color={item.category.color}
                onPress={() =>
                  setSel(sel?.id === item.category.id ? null : { id: item.category.id, categoryIds: [item.category.id], label: item.category.name, slug: item.category.slug })
                }
              />
            )}
          />
        ) : null}
      </Card>

      <Row style={{ justifyContent: 'space-between', marginTop: 22, marginBottom: 6 }}>
        <Text variant="title">{sel ? sel.label : 'Recent'}</Text>
        {sel ? (
          <Pressable onPress={() => setSel(null)} hitSlop={8}>
            <Text variant="caption" color={t.colors.accent}>
              Show all
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => router.push('/add-transaction')} hitSlop={8}>
            <Text variant="caption" color={t.colors.accent}>
              Add manually
            </Text>
          </Pressable>
        )}
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

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
