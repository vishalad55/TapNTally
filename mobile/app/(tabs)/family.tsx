import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Share, StyleSheet, TextInput, View } from 'react-native';
import { ApiClientError } from '../../src/api/client';
import { useHousehold, useHouseholdMutations, useSummary, useTransactions } from '../../src/api/hooks';
import { DonutChart, type DonutSelection } from '../../src/components/DonutChart';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Button, Card, EmptyState, Loading, Row, Screen, SectionHeader, Text } from '../../src/components/ui';
import { useSession } from '../../src/store/session';
import { useTheme } from '../../src/theme';

export default function Family() {
  const t = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const refreshUser = useSession((s) => s.refreshUser);
  const household = useHousehold();
  const { create, join, leave, rotateInvite } = useHouseholdMutations();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<DonutSelection | null>(null);

  const summary = useSummary('month', 0, 'shared');
  const feed = useTransactions({ scope: 'shared', categoryIds: sel?.categoryIds, limit: 30 });
  const rows = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Something went wrong.');
    }
  };

  if (household.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  // ---- No household yet: create or join ----
  if (!household.data) {
    return (
      <Screen>
        <View style={{ gap: 14, paddingTop: 8 }}>
          <Text variant="title">Family</Text>
          <Text muted>Share the household picture — groceries, bills, the big stuff — while everyone keeps their own private view.</Text>
          <Card style={{ gap: 10 }}>
            <Text variant="heading">Start a household</Text>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. The Sharmas" placeholderTextColor={t.colors.textFaint} style={inputStyle(t)} />
            <Button title="Create" onPress={() => run(() => create.mutateAsync(name.trim()))} loading={create.isPending} disabled={!name.trim()} />
          </Card>
          <Card style={{ gap: 10 }}>
            <Text variant="heading">Join with a code</Text>
            <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="TAP-XXXXX" placeholderTextColor={t.colors.textFaint} style={inputStyle(t)} />
            <Button title="Join" variant="secondary" onPress={() => run(() => join.mutateAsync(code.trim()))} loading={join.isPending} disabled={code.trim().length < 5} />
          </Card>
          {error ? <Text color={t.colors.danger}>{error}</Text> : null}
        </View>
      </Screen>
    );
  }

  const h = household.data;
  const isOwner = user?.householdRole === 'owner';
  const shareInvite = () => Share.share({ message: `Join our household on TapNTally with code ${h.inviteCode}` });
  const copyInvite = async () => {
    await Clipboard.setStringAsync(h.inviteCode);
    Alert.alert('Copied', `${h.inviteCode} copied to clipboard.`);
  };
  const confirmLeave = () =>
    Alert.alert('Leave household?', 'Your purchases stay yours; they just stop appearing in the shared view.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => run(() => leave.mutateAsync()) },
    ]);

  const header = (
    <View style={{ gap: 10, paddingTop: 8 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="title">{h.name}</Text>
        <Pressable onPress={confirmLeave} hitSlop={8}>
          <Text variant="caption" color={t.colors.danger}>
            Leave
          </Text>
        </Pressable>
      </Row>

      <Card style={{ gap: 8 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text variant="caption" muted>
              Invite code
            </Text>
            <Text variant="title" style={{ letterSpacing: 2 }}>
              {h.inviteCode}
            </Text>
          </View>
          <Row gap={6}>
            <Button title="Copy" variant="secondary" onPress={copyInvite} style={{ paddingVertical: 8, paddingHorizontal: 12 }} />
            <Button title="Share" onPress={shareInvite} style={{ paddingVertical: 8, paddingHorizontal: 12 }} />
          </Row>
        </Row>
        {isOwner ? (
          <Pressable onPress={() => run(() => rotateInvite.mutateAsync())} hitSlop={8}>
            <Text variant="caption" color={t.colors.accent}>
              Generate a new code
            </Text>
          </Pressable>
        ) : null}
      </Card>

      <SectionHeader title={`Members · ${h.members.length}`} />
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {h.members.map((m) => (
          <View key={m.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.colors.surface, borderRadius: t.radius.pill, paddingVertical: 6, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border }}>
            <Text>{m.role === 'owner' ? '👑' : '👤'}</Text>
            <Text variant="caption" style={{ fontWeight: '600' }}>
              {m.name}
              {m.userId === user?.id ? ' (you)' : ''}
            </Text>
          </View>
        ))}
      </Row>

      <SectionHeader title="Shared spend" />
      <View style={{ alignItems: 'center' }}>
        {summary.isLoading ? <Loading /> : <DonutChart data={summary.data?.byCategory ?? []} totalPaise={summary.data?.totalPaise ?? 0} selectedId={sel?.id ?? null} onSelect={setSel} periodLabel="household · this month" />}
      </View>
      <Text variant="caption" muted style={{ textAlign: 'center' }}>
        Only purchases marked "shared" appear here. Toggle it on any transaction.
      </Text>
      <SectionHeader
        title={sel ? `${sel.icon} ${sel.label}` : 'Shared purchases'}
        right={
          sel ? (
            <Pressable onPress={() => setSel(null)} hitSlop={8}>
              <Text variant="caption" color={t.colors.accent}>
                Show all
              </Text>
            </Pressable>
          ) : null
        }
      />
      {error ? <Text color={t.colors.danger}>{error}</Text> : null}
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={rows}
        keyExtractor={(tx) => tx.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => <TransactionRow tx={item} showShared={false} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })} />}
        onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
        refreshControl={<RefreshControl refreshing={household.isRefetching || feed.isRefetching} onRefresh={() => { void household.refetch(); void summary.refetch(); void feed.refetch(); }} tintColor={t.colors.accent} />}
        ListEmptyComponent={feed.isLoading ? <Loading /> : <EmptyState icon="🏠" title="Nothing shared yet" body="Mark a grocery run or a bill as shared and it shows up here for everyone." />}
        ListFooterComponent={<View style={{ height: 120 }} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const inputStyle = (t: ReturnType<typeof useTheme>) => ({
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: t.colors.border,
  borderRadius: t.radius.md,
  padding: 12,
  color: t.colors.text,
  backgroundColor: t.colors.background,
});
