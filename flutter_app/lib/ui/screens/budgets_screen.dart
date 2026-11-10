import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/money.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../widgets/domain.dart';
import '../widgets/kit.dart';
import '../widgets/pages.dart';

class BudgetsScreen extends ConsumerWidget {
  const BudgetsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final user = ref.watch(currentUserProvider);
    final budgets = ref.watch(budgetsProvider);

    void edit(BudgetProgress b) => context.push('/budget-edit', extra: b);

    return TabPage(
      onRefresh: () => ref.refresh(budgetsProvider.future).catchError((_) => <BudgetProgress>[]),
      slivers: [
        SliverToBoxAdapter(
          child: TabHeader(
            title: 'Budgets',
            eyebrow: 'Spending caps',
            subtitle: 'We nudge you at 80% of any cap.',
            trailing: AppButton(label: 'New', icon: Icons.add_rounded, small: true, expand: false, onPressed: () => context.push('/budget-edit')),
          ),
        ),
        SliverToBoxAdapter(
          child: AsyncView(
            value: budgets,
            onRetry: () => ref.invalidate(budgetsProvider),
            errorMessage: "Couldn't load budgets.",
            builder: (list) {
              if (list.isEmpty) {
                return EmptyState(
                  icon: Icons.donut_large_outlined,
                  title: 'No budgets yet',
                  body: "Set a cap on eating out, shopping — anything you'd like a heads-up on.",
                  action: AppButton(label: 'Set your first budget', expand: false, onPressed: () => context.push('/budget-edit')),
                );
              }
              final mine = list.where((b) => b.budget.scope == BudgetScope.user).toList();
              final home = list.where((b) => b.budget.scope == BudgetScope.household).toList();
              final limit = mine.fold<int>(0, (s, b) => s + b.budget.limitPaise);
              final spent = mine.fold<int>(0, (s, b) => s + b.spentPaise);
              final atRisk = list.where((b) => b.status != BudgetStatus.ok).length;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (mine.isNotEmpty)
                    AppCard(
                      tone: CardTone.alt,
                      child: Row(
                        children: [
                          Expanded(child: _Stat(label: 'Spent', value: formatPaise(spent, decimals: false))),
                          _VLine(color: c.border),
                          Expanded(child: _Stat(label: 'Budgeted', value: formatPaise(limit, decimals: false))),
                          _VLine(color: c.border),
                          Expanded(child: _Stat(label: 'Near / over', value: '$atRisk', color: atRisk > 0 ? c.warn : c.money)),
                        ],
                      ),
                    ),
                  if (mine.isNotEmpty) const SectionHeader(eyebrow: 'Just you', title: 'Personal'),
                  for (final b in mine) Padding(padding: const EdgeInsets.only(bottom: Space.sm), child: BudgetCard(progress: b, onTap: () => edit(b))),
                  if (user?.householdId != null) ...[
                    SectionHeader(
                      eyebrow: 'Everyone',
                      title: 'Household',
                      trailing: TextButton.icon(
                        onPressed: () => context.push('/budget-edit', extra: BudgetScope.household),
                        icon: Icon(Icons.add_rounded, size: 18, color: c.accent),
                        label: Text('Add', style: TextStyles.caption.copyWith(color: c.accent, fontWeight: FontWeight.w700)),
                      ),
                    ),
                    if (home.isEmpty) Text('Shared caps count only purchases marked “shared” by any member.', style: TextStyles.caption.copyWith(color: c.inkMuted)),
                    for (final b in home) Padding(padding: const EdgeInsets.only(bottom: Space.sm), child: BudgetCard(progress: b, onTap: () => edit(b))),
                  ],
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.color});
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      children: [
        FittedBox(fit: BoxFit.scaleDown, child: Text(value, style: TextStyles.money.copyWith(color: color ?? c.ink, fontSize: 17))),
        const SizedBox(height: 2),
        Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.caption.copyWith(color: c.inkMuted, fontSize: 12)),
      ],
    );
  }
}

class _VLine extends StatelessWidget {
  const _VLine({required this.color});
  final Color color;
  @override
  Widget build(BuildContext context) => Container(width: 1, height: 32, color: color, margin: const EdgeInsets.symmetric(horizontal: Space.xs));
}
