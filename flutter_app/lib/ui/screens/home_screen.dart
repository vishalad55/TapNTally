import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/dates.dart';
import '../../core/money.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../tap_flow.dart';
import '../widgets/brand.dart';
import '../widgets/breakdown.dart';
import '../widgets/domain.dart';
import '../widgets/kit.dart';
import '../widgets/pages.dart';

const _thisMonth = (period: 'month', offset: 0, scope: 'personal');
const _lastMonth = (period: 'month', offset: -1, scope: 'personal');

/// Home: this month's spend, quick actions, the selectable breakdown and the
/// recent feed it filters.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  Slice? _selected;

  TransactionQuery get _query => TransactionQuery(categoryIds: _selected?.categoryIds, limit: 20);

  Future<void> _refresh() async {
    ref.invalidate(summaryProvider);
    ref.invalidate(budgetsProvider);
    ref.invalidate(feedProvider);
    await ref.read(summaryProvider(_thisMonth).future).catchError((_) => const SpendSummary(totalPaise: 0, byCategory: []));
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final user = ref.watch(currentUserProvider);
    final summary = ref.watch(summaryProvider(_thisMonth));
    final previous = ref.watch(summaryProvider(_lastMonth));
    final budgets = ref.watch(budgetsProvider);
    final feed = ref.watch(feedProvider(_query));

    return TabPage(
      onRefresh: _refresh,
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.only(top: Space.sm, bottom: Space.md),
            child: Row(
              children: [
                InitialAvatar(name: user?.name ?? '?'),
                const SizedBox(width: Space.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(greeting(), style: TextStyles.caption.copyWith(color: c.inkMuted)),
                      Text(user?.firstName ?? 'there', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.title.copyWith(color: c.ink)),
                    ],
                  ),
                ),
                const ThemeToggle(),
                RoundIconButton(icon: Icons.settings_outlined, tooltip: 'Settings', onPressed: () => context.push('/settings')),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: _Hero(
            total: summary.value?.totalPaise,
            previous: previous.value?.totalPaise,
            purchases: summary.value?.purchaseCount ?? 0,
            budgets: budgets.value,
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: Space.lg),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _QuickAction(icon: Icons.contactless_outlined, label: 'Tap bill', primary: true, onTap: () => startTap(context, ref))),
                Expanded(child: _QuickAction(icon: Icons.add_rounded, label: 'Add', onTap: () => context.push('/add'))),
                Expanded(child: _QuickAction(icon: Icons.pin_outlined, label: 'Pair code', onTap: () => context.push('/pair'))),
                Expanded(child: _QuickAction(icon: Icons.link_rounded, label: 'Sources', onTap: () => context.push('/connections'))),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: AsyncView(
            value: summary,
            onRetry: () => ref.invalidate(summaryProvider),
            errorMessage: "Couldn't load your spend chart.",
            loading: const LoadingBlock(height: 320),
            builder: (s) => BreakdownCard(summary: s, selected: _selected, onSelect: (sl) => setState(() => _selected = sl)),
          ),
        ),
        SliverToBoxAdapter(
          child: SectionHeader(
            title: _selected?.label ?? 'Recent',
            eyebrow: _selected == null ? 'Latest purchases' : 'Filtered by category',
            trailing: TextButton(
              onPressed: () => context.go('/history'),
              child: Text('See all', style: TextStyles.caption.copyWith(color: c.accent, fontWeight: FontWeight.w700)),
            ),
          ),
        ),
        ..._feedSlivers(context, feed),
      ],
    );
  }

  List<Widget> _feedSlivers(BuildContext context, AsyncValue<FeedState> feed) {
    if (feed.isLoading && !feed.hasValue) return const [SliverToBoxAdapter(child: LoadingBlock())];
    if (feed.hasError && !feed.hasValue) {
      return [SliverToBoxAdapter(child: ErrorCard(message: "Couldn't load purchases.", onRetry: () => ref.invalidate(feedProvider)))];
    }
    final items = feed.requireValue.items;
    if (items.isEmpty) {
      return [
        SliverToBoxAdapter(
          child: EmptyState(
            icon: Icons.receipt_long_outlined,
            title: _selected != null ? 'Nothing here yet' : 'No purchases yet',
            body: 'Tap a terminal after paying, or connect Gmail and SMS to pull in your online orders.',
          ),
        ),
      ];
    }
    return [
      SliverList.separated(
        itemCount: items.length,
        separatorBuilder: (_, _) => Divider(indent: 60, color: context.colors.border),
        itemBuilder: (context, i) => TransactionTile(tx: items[i], onTap: () => context.push('/transaction/${items[i].id}')),
      ),
    ];
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.total, required this.previous, required this.purchases, required this.budgets});
  final int? total;
  final int? previous;
  final int purchases;
  final List<BudgetProgress>? budgets;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final ink = c.accentInk;
    final soft = ink.withValues(alpha: 0.78);
    final chip = c.isDark ? Colors.black.withValues(alpha: 0.14) : Colors.white.withValues(alpha: 0.22);
    final bubble = c.isDark ? Colors.black.withValues(alpha: 0.08) : Colors.white.withValues(alpha: 0.13);
    final delta = (previous ?? 0) > 0 && total != null ? (total! - previous!) / previous! : null;
    final budgetTotal = budgets?.fold<int>(0, (s, b) => s + b.budget.limitPaise) ?? 0;
    final budgetSpent = budgets?.fold<int>(0, (s, b) => s + b.spentPaise) ?? 0;
    final pct = budgetTotal > 0 ? (budgetSpent / budgetTotal).clamp(0.0, 1.0) : null;
    final end = Color.lerp(c.accent, c.isDark ? const Color(0xFF4ADE80) : const Color(0xFFFF2D55), 0.45)!;

    Widget pill(Widget child) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(color: chip, borderRadius: BorderRadius.circular(Radii.pill)),
          child: child,
        );

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(Radii.xl),
        gradient: LinearGradient(colors: [c.accent, end], begin: Alignment.topLeft, end: Alignment.bottomRight),
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Decorative circles stay in the corners, clear of the text.
          Positioned(right: -56, top: -64, child: _Bubble(size: 150, color: bubble)),
          Positioned(right: -24, bottom: -92, child: _Bubble(size: 130, color: bubble)),
          Padding(
            padding: const EdgeInsets.all(Space.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('SPENT THIS MONTH', style: TextStyles.micro.copyWith(color: soft)),
                const SizedBox(height: Space.xxs),
                SizedBox(
                  width: double.infinity,
                  child: FittedBox(
                    alignment: Alignment.centerLeft,
                    fit: BoxFit.scaleDown,
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(end: (total ?? 0).toDouble()),
                      duration: const Duration(milliseconds: 650),
                      curve: Curves.easeOutCubic,
                      builder: (_, v, _) => Text(total == null ? '—' : formatPaise(v.round(), decimals: false), style: TextStyles.hero.copyWith(color: ink, fontSize: 40)),
                    ),
                  ),
                ),
                const SizedBox(height: Space.sm),
                Wrap(
                  spacing: Space.xs,
                  runSpacing: Space.xs,
                  children: [
                    pill(Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(delta == null ? Icons.schedule_rounded : (delta >= 0 ? Icons.trending_up_rounded : Icons.trending_down_rounded), size: 15, color: ink),
                      const SizedBox(width: 5),
                      Flexible(
                        child: Text(
                          delta == null ? 'first month on record' : '${delta >= 0 ? '+' : '−'}${(delta.abs() * 100).round()}% vs last month',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyles.caption.copyWith(color: ink),
                        ),
                      ),
                    ])),
                    pill(Text('$purchases purchase${purchases == 1 ? '' : 's'}', style: TextStyles.caption.copyWith(color: ink))),
                  ],
                ),
                if (pct != null) ...[
                  const SizedBox(height: Space.md),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(value: pct, minHeight: 6, backgroundColor: chip, color: ink),
                  ),
                  const SizedBox(height: 6),
                  Text('${(pct * 100).round()}% of your ${formatPaise(budgetTotal, decimals: false)} budgets used', style: TextStyles.caption.copyWith(color: soft)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.size, required this.color});
  final double size;
  final Color color;
  @override
  Widget build(BuildContext context) => IgnorePointer(child: Container(width: size, height: size, decoration: BoxDecoration(color: color, shape: BoxShape.circle)));
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({required this.icon, required this.label, required this.onTap, this.primary = false});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool primary;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.md),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
          child: Column(
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  color: primary ? c.accent : c.surface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: primary ? c.accent : c.border),
                ),
                child: Icon(icon, color: primary ? c.accentInk : c.ink, size: 24),
              ),
              const SizedBox(height: 6),
              Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.caption.copyWith(color: c.ink, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}
