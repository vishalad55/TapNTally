import type { BudgetProgress } from '@tapntally/shared';
import { BudgetScope, formatPaise } from '@tapntally/shared';
import { Pressable, View } from 'react-native';
import { type Theme, useTheme } from '../theme';
import { CategoryTile } from '../theme/icons';
import { Card, Row, Sticker, Text } from './ui';

/** Money-green → butter → coral as spend approaches the cap. */
export function budgetColor(status: BudgetProgress['status'], t: Theme): string {
  return status === 'exceeded' ? t.colors.danger : status === 'warning' ? t.colors.warn : t.colors.money;
}

export function BudgetBar({ progress, onPress }: { progress: BudgetProgress; onPress?: () => void }) {
  const t = useTheme();
  const { budget, spentPaise, ratio, status } = progress;
  const color = budgetColor(status, t);
  const remaining = budget.limitPaise - spentPaise;
  const pct = Math.round(ratio * 100);
  return (
    <Pressable onPress={onPress}>
      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={10}>
            <CategoryTile slug={budget.category.slug} color={budget.category.color} size={40} />
            <View>
              <Text variant="heading">{budget.category.name}</Text>
              <Text variant="caption" muted>
                {budget.period === 'weekly' ? 'this week' : 'this month'}
              </Text>
            </View>
          </Row>
          {budget.scope === BudgetScope.HOUSEHOLD ? <Sticker label="household" color={t.colors.pop} /> : null}
          {status === 'exceeded' ? <Sticker label="over" color={t.colors.danger} tilt={3} /> : null}
        </Row>

        <View style={{ height: 12, borderRadius: 6, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(100, pct)}%`, height: '100%', backgroundColor: color, borderRadius: 6 }} />
          <View style={{ position: 'absolute', left: `${budget.alertThreshold * 100}%`, top: 0, bottom: 0, width: 2, backgroundColor: t.colors.bg, opacity: 0.8 }} />
        </View>

        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={4}>
            <Text variant="money" color={color}>
              {formatPaise(spentPaise, { showDecimals: false })}
            </Text>
            <Text variant="caption" muted>
              of {formatPaise(budget.limitPaise, { showDecimals: false })}
            </Text>
          </Row>
          <Text variant="caption" muted>
            {status === 'exceeded' ? `${formatPaise(-remaining, { showDecimals: false })} over` : `${formatPaise(remaining, { showDecimals: false })} left · ${pct}%`}
          </Text>
        </Row>
      </Card>
    </Pressable>
  );
}
