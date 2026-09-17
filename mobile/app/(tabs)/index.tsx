import { formatPaise } from '@tapntally/shared';
import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useSummary, useTransactions } from '../../src/api/hooks';
import { DonutChart, type DonutSelection } from '../../src/components/DonutChart';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Chip, EmptyState, ErrorBanner, Loading, Row, Screen, SectionHeader, Text } from '../../src/components/ui';
import { useSession } from '../../src/store/session';
import { useTheme } from '../../src/theme';

/**
 * Home: tappable spend donut → filters the feed below it. The feed is one
 * FlatList with the chart as its header so the whole thing scrolls together
 * and the FAB (rendered by the tabs layout) stays put.
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

  const header = (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <View>
          <Text muted variant="caption">
            {greeting()}
          </Text>
          <Text variant="title">{user?.name?.split(' ')[0] ?? 'there'}</Text>
        </View>
        <Link href="/settings" asChild>
          <Pressable hitSlop={10} style={{ padding: 8 }}>
            <Text style={{ fontSize: 22 }}>⚙️</Text>
          </Pressable>
        </Link>
      </Row>

      <View style={{ alignItems: 'center', marginVertical: 8 }}>
        {summary.isLoading ? (
          <Loading />
        ) : summary.error ? (
          <ErrorBanner message="Couldn't load your spend chart." onRetry={() => void summary.refetch()} />
        ) : (
          <DonutChart data={summary.data?.byCategory ?? []} totalPaise={summary.data?.totalPaise ?? 0} selectedId={sel?.id ?? null} onSelect={setSel} />
        )}
      </View>

      {summary.data && summary.data.byCategory.length > 0 ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={summary.data.byCategory}
          keyExtractor={(c) => c.category.id}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          renderItem={({ item }) => (
            <Chip
              label={`${item.category.icon} ${item.category.name} · ${formatPaise(item.amountPaise, { showDecimals: false, compact: true })}`}
              selected={sel?.categoryIds.length === 1 && sel.categoryIds[0] === item.category.id}
              color={item.category.color}
              onPress={() =>
                setSel(
                  sel?.id === item.category.id
                    ? null
                    : { id: item.category.id, categoryIds: [item.category.id], label: item.category.name, icon: item.category.icon },
                )
              }
            />
          )}
        />
      ) : null}

      <SectionHeader
        title={sel ? `${sel.icon} ${sel.label}` : 'Recent'}
        right={
          sel ? (
            <Pressable onPress={() => setSel(null)} hitSlop={8}>
              <Text variant="caption" color={t.colors.accent}>
                Show all
              </Text>
            </Pressable>
          ) : (
            <Link href="/add-transaction" asChild>
              <Pressable hitSlop={8}>
                <Text variant="caption" color={t.colors.accent}>
                  + Add manually
                </Text>
              </Pressable>
            </Link>
          )
        }
      />
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(tx) => tx.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => <TransactionRow tx={item} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })} />}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={t.colors.accent} />}
        ListEmptyComponent={
          feed.isLoading ? (
            <Loading />
          ) : feed.error ? (
            <ErrorBanner message="Couldn't load transactions." onRetry={() => void feed.refetch()} />
          ) : (
            <EmptyState icon="🧾" title={sel ? 'Nothing here yet' : 'No purchases yet'} body="Tap a terminal after paying, or connect Gmail and SMS to pull in your online orders." />
          )
        }
        ListFooterComponent={feed.isFetchingNextPage ? <Loading /> : <View style={{ height: 120 }} />}
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
