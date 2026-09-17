import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Share, TextInput, View } from 'react-native';
import { ApiClientError } from '../../src/api/client';
import { useHousehold, useHouseholdMutations, useSummary, useTransactions } from '../../src/api/hooks';
import { DonutChart, type DonutSelection } from '../../src/components/DonutChart';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Badge, Button, Card, EmptyState, Loading, Row, Screen, SectionHeader, Text } from '../../src/components/ui';
import { useSession } from '../../src/store/session';
import { type Theme, fonts, useTheme } from '../../src/theme';

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

  if (!household.data) {
    return (
      <Screen>
        <View style={{ gap: 14, paddingTop: 12 }}>
          <Text variant="micro" faint>
            Family
          </Text>
          <Text variant="display">One home,{'\n'}one picture.</Text>
          <Text muted>Share groceries, bills, the big stuff — while everyone keeps their own private view.</Text>
          <Card style={{ gap: 10 }}>
            <Text variant="heading">Start a household</Text>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. The Sharmas" placeholderTextColor={t.colors.inkFaint} style={inputStyle(t)} />
            <Button title="Create" onPress={() => run(() => create.mutateAsync(name.trim()))} loading={create.isPending} disabled={!name.trim()} />
          </Card>
          <Card style={{ gap: 10 }}>
            <Text variant="heading">Join with a code</Text>
            <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="TAP-XXXXX" placeholderTextColor={t.colors.inkFaint} style={inputStyle(t)} />
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
    <View style={{ gap: 10, paddingTop: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Text variant="micro" faint>
            Household
          </Text>
          <Text variant="title">{h.name}</Text>
        </View>
        <Pressable onPress={confirmLeave} hitSlop={8}>
          <Text variant="caption" color={t.colors.danger}>
            Leave
          </Text>
        </Pressable>
      </Row>

      <Card tone="accent" style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text variant="micro" muted>
              Invite code
            </Text>
            <Text variant="display" style={{ letterSpacing: 2 }}>
              {h.inviteCode}
            </Text>
          </View>
          <Row gap={6}>
            <Button title="Copy" icon="copy-outline" variant="secondary" size="sm" onPress={copyInvite} />
            <Button title="Share" icon="share-outline" size="sm" onPress={shareInvite} />
          </Row>
        </Row>
        {isOwner ? (
          <Pressable onPress={() => run(() => rotateInvite.mutateAsync())} hitSlop={8}>
            <Text variant="caption" muted>
              Generate a new code
            </Text>
          </Pressable>
        ) : null}
      </Card>

      <SectionHeader title={`Members · ${h.members.length}`} />
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {h.members.map((m) => (
          <View key={m.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.colors.surfaceAlt, borderRadius: t.radius.pill, paddingVertical: 7, paddingHorizontal: 12 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="micro" color={t.colors.accentInk}>
                {m.name.charAt(0)}
              </Text>
            </View>
            <Text variant="caption">
              {m.name}
              {m.userId === user?.id ? ' (you)' : ''}
            </Text>
            {m.role === 'owner' ? <Badge label="owner" color={t.colors.inkMuted} /> : null}
          </View>
        ))}
      </Row>

      <SectionHeader title="Shared spend" />
      <Card style={{ alignItems: 'center', paddingVertical: 10 }}>
        {summary.isLoading ? <Loading /> : <DonutChart data={summary.data?.byCategory ?? []} totalPaise={summary.data?.totalPaise ?? 0} selectedId={sel?.id ?? null} onSelect={setSel} periodLabel="household · month" />}
      </Card>
      <Text variant="caption" muted style={{ textAlign: 'center' }}>
        Only purchases marked "shared" appear here. Toggle it on any purchase.
      </Text>
      <Row style={{ justifyContent: 'space-between', marginTop: 16, marginBottom: 4 }}>
        <Text variant="title">{sel ? sel.label : 'Shared purchases'}</Text>
        {sel ? (
          <Pressable onPress={() => setSel(null)} hitSlop={8}>
            <Text variant="caption" color={t.colors.accent}>
              Show all
            </Text>
          </Pressable>
        ) : null}
      </Row>
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
        ListEmptyComponent={feed.isLoading ? <Loading /> : <EmptyState icon="home-outline" title="Nothing shared yet" body="Mark a grocery run or a bill as shared and it shows up here for everyone." />}
        ListFooterComponent={<View style={{ height: 130 }} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
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
