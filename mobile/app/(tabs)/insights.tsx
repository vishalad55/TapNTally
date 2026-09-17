import { formatPaise } from '@tapntally/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRecap } from '../../src/api/hooks';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Card, Chip, ErrorBanner, Loading, Row, Screen, SectionHeader, Text } from '../../src/components/ui';
import { useSession } from '../../src/store/session';
import { useTheme } from '../../src/theme';

/** The recap: a headline, a couple of bars, and a handful of human sentences. */
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
        contentContainerStyle={{ paddingBottom: 140, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <Text variant="title">Your {label} in money</Text>
        </Row>
        <Row gap={8}>
          <Chip label="This month" selected={period === 'monthly'} onPress={() => setPeriod('monthly')} />
          <Chip label="This week" selected={period === 'weekly'} onPress={() => setPeriod('weekly')} />
          {user?.householdId ? <Chip label="👨‍👩‍👧 Household" selected={scope === 'shared'} onPress={() => setScope(scope === 'shared' ? 'personal' : 'shared')} /> : null}
        </Row>

        {recap.isLoading ? <Loading label="Crunching the numbers…" /> : null}
        {recap.error ? <ErrorBanner message="Couldn't build your recap." onRetry={() => void recap.refetch()} /> : null}

        {r ? (
          <>
            <Card style={{ backgroundColor: t.colors.accentSoft, borderColor: 'transparent', gap: 10 }}>
              <Text variant="title" style={{ lineHeight: 30 }}>
                {r.headline}
              </Text>
              <View style={{ gap: 6, marginTop: 4 }}>
                <Bar label={`This ${label}`} value={r.totalPaise} max={max} color={t.colors.accent} />
                <Bar label={`Last ${label}`} value={r.previousTotalPaise} max={max} color={t.colors.textFaint} />
              </View>
            </Card>

            <SectionHeader title="Highlights" />
            {r.highlights.map((h, i) => (
              <Card key={i} style={{ paddingVertical: 14 }}>
                <Text style={{ lineHeight: 22 }}>{h}</Text>
              </Card>
            ))}

            {r.priciestPurchase ? (
              <>
                <SectionHeader title="Biggest purchase" />
                <Card style={{ paddingVertical: 0 }}>
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
    <View style={{ gap: 3 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="caption" muted>
          {label}
        </Text>
        <Text variant="caption" style={{ fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {formatPaise(value, { showDecimals: false })}
        </Text>
      </Row>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: t.colors.surface, overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(2, (value / max) * 100)}%`, height: '100%', backgroundColor: color, borderRadius: 5 }} />
      </View>
    </View>
  );
}
