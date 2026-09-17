import type { BudgetProgress } from '@tapntally/shared';
import { BudgetScope, formatPaise } from '@tapntally/shared';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Badge } from './TransactionRow';
import { Card, Row, Text } from './ui';

/** Green → amber → red as spend approaches the cap. */
export function budgetColor(status: BudgetProgress['status'], t: ReturnType<typeof useTheme>): string {
  return status === 'exceeded' ? t.colors.danger : status === 'warning' ? t.colors.warning : t.colors.accent;
}

export function BudgetBar({ progress, onPress }: { progress: BudgetProgress; onPress?: () => void }) {
  const t = useTheme();
  const { budget, spentPaise, ratio, status } = progress;
  const color = budgetColor(status, t);
  const remaining = budget.limitPaise - spentPaise;
  return (
    <Pressable onPress={onPress}>
      <Card style={{ gap: 10 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={8}>
            <Text style={{ fontSize: 20 }}>{budget.category.icon}</Text>
            <Text variant="heading">{budget.category.name}</Text>
            {budget.scope === BudgetScope.HOUSEHOLD ? <Badge label="household" color={t.colors.accent} /> : null}
          </Row>
          <Text variant="caption" muted>
            {budget.period}
          </Text>
        </Row>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: t.colors.border, overflow: 'hidden' }}>
          <View style={{ width: `${Math.min(100, ratio * 100)}%`, height: '100%', backgroundColor: color, borderRadius: 5 }} />
        </View>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="caption">
            <Text variant="caption" style={{ fontWeight: '700' }} color={color}>
              {formatPaise(spentPaise, { showDecimals: false })}
            </Text>
            <Text variant="caption" muted>
              {' '}
              of {formatPaise(budget.limitPaise, { showDecimals: false })}
            </Text>
          </Text>
          <Text variant="caption" muted>
            {status === 'exceeded'
              ? `${formatPaise(-remaining, { showDecimals: false })} over`
              : `${formatPaise(remaining, { showDecimals: false })} left · ${Math.round(ratio * 100)}%`}
          </Text>
        </Row>
      </Card>
    </Pressable>
  );
}
