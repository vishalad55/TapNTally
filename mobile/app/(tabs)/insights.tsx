import { formatPaise } from '@tapntally/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRecap } from '../../src/api/hooks';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Card, Chip, ErrorBanner, Loading, Reveal, Row, Screen, SectionHeader, Text } from '../../src/components/ui';
import { useSession } from '../../src/store/session';
import { useTheme } from '../../src/theme';

/** The recap: one big headline, two bars, and a handful of human sentences. */
export default function Insights() {
  const t = useTheme();
  const router = useRouter();
  const user = useSession((s) => s.user);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const [scope, setScope] = useState<'personal' | 'shared'>('personal');
  const recap = useRecap(period, scope);
  const r = recap.data;
  const label = period === 'weekly' ? 'week' : 'month';
  const max = Math.max(r?.totalPaise ?? 0, r?.previousTotalPaise ?? 0, 1);

  return (
    <Screen>
      <ScrollView
        refreshControl={<RefreshControl refreshing={recap.isRefetching} onRefresh={() => void recap.refetch()} tintColor={t.colors.accent} />}
        contentContainerStyle={{ paddingBottom: 150, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ marginTop: 12 }}>
          <Text variant="micro" faint>
            Recap
          </Text>
          <Text variant="title">Your {label} in money</Text>
        </View>
        <Row gap={8}>
          <Chip label="This month" selected={period === 'monthly'} onPress={() => setPeriod('monthly')} />
          <Chip label="This week" selected={period === 'weekly'} onPress={() => setPeriod('weekly')} />
          {user?.householdId ? <Chip label="👨‍👩‍👧 Household" selected={scope === 'shared'} onPress={() => setScope(scope === 'shared' ? 'personal' : 'shared')} /> : null}
        </Row>

        {recap.isLoading ? <Loading label="Crunching the numbers…" /> : null}
        {recap.error ? <ErrorBanner message="Couldn't build your recap." onRetry={() => void recap.refetch()} /> : null}

        {r ? (
          <>
            <Reveal>
              <Card tone="accent" style={{ gap: 14, padding: 22 }}>
                <Text variant="display" style={{ lineHeight: 36 }}>
                  {r.headline}
                </Text>
                <View style={{ gap: 8 }}>
                  <Bar label={`This ${label}`} value={r.totalPaise} max={max} color={t.colors.accent} />
                  <Bar label={`Last ${label}`} value={r.previousTotalPaise} max={max} color={t.colors.inkFaint} />
                </View>
              </Card>
            </Reveal>

            <SectionHeader title="Highlights" />
            {r.highlights.map((h, i) => (
              <Reveal key={i} index={i + 1}>
                <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <View style={{ width: 8, alignSelf: 'stretch', borderRadius: 4, backgroundColor: i % 2 ? t.colors.pop : t.colors.accent }} />
                  <Text style={{ flex: 1, lineHeight: 22 }}>{h}</Text>
                </Card>
              </Reveal>
            ))}

            {r.priciestPurchase ? (
              <>
                <SectionHeader title="Biggest purchase" />
                <Card style={{ paddingVertical: 2 }}>
                  <TransactionRow tx={r.priciestPurchase} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: r.priciestPurchase!.id } })} />
                </Card>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="caption" muted>
          {label}
        </Text>
        <Text variant="money">{formatPaise(value, { showDecimals: false })}</Text>
      </Row>
      <View style={{ height: 12, borderRadius: 6, backgroundColor: t.colors.surface, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(2, (value / max) * 100)}%`, height: '100%', backgroundColor: color, borderRadius: 6 }} />
      </View>
    </View>
  );
}
