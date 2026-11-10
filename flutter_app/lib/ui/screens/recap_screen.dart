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

/// One big headline, a this-vs-last comparison, and a handful of human sentences.
class RecapScreen extends ConsumerStatefulWidget {
  const RecapScreen({super.key});

  @override
  ConsumerState<RecapScreen> createState() => _RecapScreenState();
}

class _RecapScreenState extends ConsumerState<RecapScreen> {
  String _period = 'monthly';
  bool _household = false;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final user = ref.watch(currentUserProvider);
    final args = (period: _period, scope: _household ? 'shared' : 'personal');
    final recap = ref.watch(recapProvider(args));
    final label = _period == 'weekly' ? 'week' : 'month';

    return TabPage(
      onRefresh: () async => ref.invalidate(recapProvider(args)),
      slivers: [
        SliverToBoxAdapter(child: TabHeader(eyebrow: 'Recap', title: 'Your $label in money')),
        SliverToBoxAdapter(
          child: Wrap(
            spacing: Space.xs,
            runSpacing: Space.xs,
            children: [
              TallyChip(label: 'This month', selected: _period == 'monthly', onTap: () => setState(() => _period = 'monthly')),
              TallyChip(label: 'This week', selected: _period == 'weekly', onTap: () => setState(() => _period = 'weekly')),
              if (user?.householdId != null)
                TallyChip(label: 'Household', icon: Icons.people_outline_rounded, selected: _household, onTap: () => setState(() => _household = !_household)),
            ],
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: Space.md)),
        SliverToBoxAdapter(
          child: AsyncView(
            value: recap,
            onRetry: () => ref.invalidate(recapProvider(args)),
            errorMessage: "Couldn't build your recap.",
            loading: const LoadingBlock(label: 'Crunching the numbers', height: 240),
            builder: (r) => _RecapBody(recap: r, label: label, c: c),
          ),
        ),
      ],
    );
  }
}

class _RecapBody extends StatelessWidget {
  const _RecapBody({required this.recap, required this.label, required this.c});
  final Recap recap;
  final String label;
  final TallyColors c;

  @override
  Widget build(BuildContext context) {
    final max = [recap.totalPaise, recap.previousTotalPaise, 1].reduce((a, b) => a > b ? a : b);
    final change = recap.changeRatio;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppCard(
          tone: CardTone.accent,
          padding: const EdgeInsets.all(Space.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (change != null)
                Align(
                  alignment: Alignment.centerLeft,
                  child: Sticker(
                    label: '${change <= 0 ? '↓' : '↑'} ${(change.abs() * 100).round()}% vs last $label',
                    color: change <= 0 ? c.money : c.warn,
                  ),
                ),
              if (change != null) const SizedBox(height: Space.sm),
              Text(recap.headline, style: TextStyles.display.copyWith(color: c.ink, fontSize: 24)),
              const SizedBox(height: Space.lg),
              _Bar(label: 'This $label', value: recap.totalPaise, max: max, color: c.accent),
              const SizedBox(height: Space.sm),
              _Bar(label: 'Last $label', value: recap.previousTotalPaise, max: max, color: c.inkFaint),
            ],
          ),
        ),
        if (recap.highlights.isNotEmpty) ...[
          const SectionHeader(title: 'Highlights'),
          for (var i = 0; i < recap.highlights.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: Space.xs),
              child: AppCard(
                child: IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(width: 4, decoration: BoxDecoration(color: i.isOdd ? c.pop : c.accent, borderRadius: BorderRadius.circular(2))),
                      const SizedBox(width: Space.sm),
                      Expanded(child: Text(recap.highlights[i], style: TextStyles.body.copyWith(color: c.ink))),
                    ],
                  ),
                ),
              ),
            ),
        ],
        if (recap.priciestPurchase != null) ...[
          const SectionHeader(title: 'Biggest purchase'),
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: Space.sm, vertical: Space.xxs),
            child: TransactionTile(tx: recap.priciestPurchase!, onTap: () => context.push('/transaction/${recap.priciestPurchase!.id}')),
          ),
        ],
      ],
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({required this.label, required this.value, required this.max, required this.color});
  final String label;
  final int value;
  final int max;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(child: Text(label, style: TextStyles.caption.copyWith(color: c.inkMuted))),
            Text(formatPaise(value, decimals: false), style: TextStyles.money.copyWith(color: c.ink)),
          ],
        ),
        const SizedBox(height: 6),
        ProgressTrack(value: value / max, color: color, height: 12),
      ],
    );
  }
}
