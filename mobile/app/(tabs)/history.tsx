import type { Transaction, TransactionQuery } from '@tapntally/shared';
import { PaymentMethod, TransactionSource } from '@tapntally/shared';
import { format, isToday, isYesterday, startOfMonth, subDays, subMonths } from 'date-fns';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useCategories, useTransactions } from '../../src/api/hooks';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Chip, EmptyState, ErrorBanner, Loading, Row, Screen, Text } from '../../src/components/ui';
import { useSession } from '../../src/store/session';
import { fonts, useTheme } from '../../src/theme';

type DateKey = 'month' | 'last_month' | '90d' | 'all';
type AmountKey = 'lt500' | '500_2k' | 'gt2k' | 'all';

const DATE_OPTS: Array<{ key: DateKey; label: string }> = [
  { key: 'month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: '90d', label: '3 months' },
  { key: 'all', label: 'All time' },
];
const AMOUNT_OPTS: Array<{ key: AmountKey; label: string }> = [
  { key: 'all', label: 'Any amount' },
  { key: 'lt500', label: 'Under ₹500' },
  { key: '500_2k', label: '₹500–2k' },
  { key: 'gt2k', label: 'Over ₹2k' },
];
const METHOD_OPTS: Array<{ key: PaymentMethod; label: string }> = [
  { key: PaymentMethod.UPI, label: 'UPI' },
  { key: PaymentMethod.CARD, label: 'Card' },
  { key: PaymentMethod.CASH, label: 'Cash' },
];
const SOURCE_OPTS: Array<{ key: TransactionSource; label: string }> = [
  { key: TransactionSource.NFC, label: '📡 Tap' },
  { key: TransactionSource.GMAIL, label: '✉️ Gmail' },
  { key: TransactionSource.SMS, label: '💬 SMS' },
  { key: TransactionSource.MANUAL, label: '✍️ Manual' },
];

type Item = { type: 'header'; key: string; label: string } | { type: 'tx'; key: string; tx: Transaction };

/** Search & filter, modelled on Google Pay / Amazon order history: no new conventions to learn. */
export default function History() {
  const t = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const cats = useCategories();

  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [date, setDate] = useState<DateKey>('month');
  const [amount, setAmount] = useState<AmountKey>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [source, setSource] = useState<TransactionSource | null>(null);
  const [scope, setScope] = useState<'personal' | 'shared'>('personal');

  useEffect(() => {
    const h = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(h);
  }, [text]);

  const query = useMemo<TransactionQuery>(() => {
    const now = new Date();
    const range =
      date === 'month'
        ? { from: startOfMonth(now).toISOString() }
        : date === 'last_month'
          ? { from: startOfMonth(subMonths(now, 1)).toISOString(), to: startOfMonth(now).toISOString() }
          : date === '90d'
            ? { from: subDays(now, 90).toISOString() }
            : {};
    const amt = amount === 'lt500' ? { maxPaise: 49_999 } : amount === '500_2k' ? { minPaise: 50_000, maxPaise: 200_000 } : amount === 'gt2k' ? { minPaise: 200_001 } : {};
    return { q: q || undefined, categoryIds: category ? [category] : undefined, paymentMethods: method ? [method] : undefined, sources: source ? [source] : undefined, scope, limit: 40, ...range, ...amt };
  }, [q, date, amount, category, method, source, scope]);

  const feed = useTransactions(query);
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    let lastDay = '';
    for (const tx of feed.data?.pages.flatMap((p) => p.items) ?? []) {
      const d = new Date(tx.occurredAt);
      const day = format(d, 'yyyy-MM-dd');
      if (day !== lastDay) {
        out.push({ type: 'header', key: `h:${day}`, label: isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE, d MMM') });
        lastDay = day;
      }
      out.push({ type: 'tx', key: tx.id, tx });
    }
    return out;
  }, [feed.data]);

  const activeFilters = [date !== 'month', amount !== 'all', !!category, !!method, !!source].filter(Boolean).length;
  const clear = () => {
    setDate('month');
    setAmount('all');
    setCategory(null);
    setMethod(null);
    setSource(null);
  };

  return (
    <Screen>
      <View style={{ gap: 10, paddingTop: 12 }}>
        <Text variant="title">History</Text>
        <Row gap={10}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.colors.surfaceAlt, borderRadius: t.radius.pill, paddingHorizontal: 16 }}>
            <Text muted>🔍</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Search merchants"
              placeholderTextColor={t.colors.inkFaint}
              autoCorrect={false}
              returnKeyType="search"
              style={{ flex: 1, paddingVertical: 13, color: t.colors.ink, fontSize: 15, fontFamily: fonts.body }}
            />
            {text ? (
              <Pressable onPress={() => setText('')} hitSlop={8}>
                <Text muted>✕</Text>
              </Pressable>
            ) : null}
          </View>
          {user?.householdId ? (
            <Chip label={scope === 'shared' ? '👨‍👩‍👧 Household' : '👤 Mine'} selected={scope === 'shared'} onPress={() => setScope(scope === 'shared' ? 'personal' : 'shared')} />
          ) : null}
        </Row>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {activeFilters > 0 ? <Chip label={`Clear (${activeFilters})`} selected onPress={clear} /> : null}
          {DATE_OPTS.map((o) => (
            <Chip key={o.key} label={o.label} selected={date === o.key} onPress={() => setDate(o.key)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {AMOUNT_OPTS.map((o) => (
            <Chip key={o.key} label={o.label} selected={amount === o.key} onPress={() => setAmount(o.key)} />
          ))}
          {METHOD_OPTS.map((o) => (
            <Chip key={o.key} label={o.label} selected={method === o.key} onPress={() => setMethod(method === o.key ? null : o.key)} />
          ))}
          {SOURCE_OPTS.map((o) => (
            <Chip key={o.key} label={o.label} selected={source === o.key} onPress={() => setSource(source === o.key ? null : o.key)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(cats.data ?? []).map((c) => (
            <Chip key={c.id} label={`${c.icon} ${c.name}`} color={c.color} selected={category === c.id} onPress={() => setCategory(category === c.id ? null : c.id)} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        style={{ marginTop: 6 }}
        data={items}
        keyExtractor={(i) => i.key}
        renderItem={({ item }) =>
          item.type === 'header' ? (
            <Text variant="micro" faint style={{ marginTop: 16, marginBottom: 4 }}>
              {item.label}
            </Text>
          ) : (
            <TransactionRow tx={item.tx} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.tx.id } })} />
          )
        }
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        onEndReachedThreshold={0.4}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          feed.data ? (
            <Text variant="caption" faint style={{ marginTop: 8 }}>
              {feed.data.pages[0]?.total ?? 0} result{feed.data.pages[0]?.total === 1 ? '' : 's'}
            </Text>
          ) : null
        }
        ListEmptyComponent={feed.isLoading ? <Loading /> : feed.error ? <ErrorBanner message="Couldn't search right now." onRetry={() => void feed.refetch()} /> : <EmptyState icon="🔎" title="No matches" body="Try a different merchant name or loosen a filter." />}
        ListFooterComponent={feed.isFetchingNextPage ? <Loading /> : <View style={{ height: 130 }} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
