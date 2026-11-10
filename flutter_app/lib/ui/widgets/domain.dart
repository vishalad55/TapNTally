import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/dates.dart';
import '../../core/money.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import 'kit.dart';

const _categoryIcons = <String, IconData>{
  'groceries': Icons.shopping_cart_outlined,
  'restaurants': Icons.restaurant_outlined,
  'shopping': Icons.shopping_bag_outlined,
  'electronics': Icons.smartphone_outlined,
  'transport': Icons.directions_car_outlined,
  'fuel': Icons.local_gas_station_outlined,
  'bills_utilities': Icons.bolt_outlined,
  'health': Icons.medical_services_outlined,
  'entertainment': Icons.movie_outlined,
  'education': Icons.school_outlined,
  'travel': Icons.flight_outlined,
  'personal_care': Icons.content_cut_outlined,
  'home': Icons.home_outlined,
  'gifts_donations': Icons.card_giftcard_outlined,
  'fees_charges': Icons.receipt_long_outlined,
  'uncategorized': Icons.help_outline_rounded,
};

IconData categoryIcon(String? slug) => _categoryIcons[slug] ?? Icons.sell_outlined;

Color catColor(BuildContext context, TxCategory c) => categoryColor(c.slug, c.color, context.colors);

/// Rounded square tinted with the category colour.
class CategoryTile extends StatelessWidget {
  const CategoryTile({super.key, required this.slug, required this.color, this.size = 44, this.icon});
  final String? slug;
  final Color color;
  final double size;
  final IconData? icon;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: color.withValues(alpha: context.colors.isDark ? 0.18 : 0.13),
          borderRadius: BorderRadius.circular(size * 0.32),
        ),
        child: Icon(icon ?? categoryIcon(slug), size: size * 0.48, color: color),
      );
}

/// One purchase in a list. Merchant and meta line ellipsize; the amount and
/// badges keep their intrinsic width, so nothing can collide at any width.
class TransactionTile extends StatelessWidget {
  const TransactionTile({super.key, required this.tx, this.onTap, this.showShared = true, this.timeOnly = false});
  final Transaction tx;
  final VoidCallback? onTap;
  final bool showShared;

  /// Under a day header the date is redundant; show just the time.
  final bool timeOnly;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final color = catColor(context, tx.category);
    return Semantics(
      button: onTap != null,
      label: '${tx.merchant}, ${formatPaise(tx.amountPaise)}, ${tx.category.name}',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(Radii.md),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          child: Row(
            children: [
              CategoryTile(slug: tx.category.slug, color: color),
              const SizedBox(width: Space.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(tx.merchant, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.heading.copyWith(color: c.ink)),
                    const SizedBox(height: 2),
                    Text.rich(
                      TextSpan(children: [
                        TextSpan(text: tx.category.name),
                        if (tx.needsReview) TextSpan(text: ' · Review', style: TextStyle(color: c.warn, fontWeight: FontWeight.w600)),
                        TextSpan(text: ' · ${timeOnly ? DateFormat('h:mm a').format(tx.occurredAt.toLocal()) : friendlyDate(tx.occurredAt)}', style: TextStyle(color: c.inkFaint)),
                      ]),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyles.caption.copyWith(color: c.inkMuted),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: Space.sm),
              // The amount column is capped (≈38% of the screen), so the
              // merchant name always keeps a readable share of the row.
              ConstrainedBox(
                constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width.clamp(0, Space.maxContentWidth) * 0.38),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    FittedBox(fit: BoxFit.scaleDown, child: Text(formatPaise(tx.amountPaise), maxLines: 1, style: TextStyles.money.copyWith(color: c.ink))),
                    const SizedBox(height: 4),
                    Wrap(
                      alignment: WrapAlignment.end,
                      spacing: 4,
                      runSpacing: 4,
                      children: [
                        if (showShared && tx.isShared) Sticker(label: 'shared', color: c.pop),
                        Sticker(label: tx.source.label, color: tx.source == TransactionSource.nfc ? c.money : c.inkMuted, filled: false),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Thin rounded progress track.
class ProgressTrack extends StatelessWidget {
  const ProgressTrack({super.key, required this.value, required this.color, this.height = 10, this.marker});
  final double value;
  final Color color;
  final double height;

  /// Optional tick (0–1), e.g. the 80 % alert threshold.
  final double? marker;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return LayoutBuilder(builder: (context, box) {
      final w = box.maxWidth;
      return SizedBox(
        height: height,
        child: Stack(
          children: [
            Positioned.fill(child: DecoratedBox(decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(height)))),
            AnimatedContainer(
              duration: const Duration(milliseconds: 500),
              curve: Curves.easeOutCubic,
              width: (w * value.clamp(0.0, 1.0)).clamp(value > 0 ? height : 0.0, w),
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(height)),
            ),
            if (marker != null) Positioned(left: (w * marker!).clamp(0.0, w - 2), top: 0, bottom: 0, child: Container(width: 2, color: c.bg.withValues(alpha: 0.85))),
          ],
        ),
      );
    });
  }
}

Color budgetColor(BuildContext context, BudgetStatus s) {
  final c = context.colors;
  return switch (s) {
    BudgetStatus.exceeded => c.danger,
    BudgetStatus.warning => c.warn,
    BudgetStatus.ok => c.money,
  };
}

class BudgetCard extends StatelessWidget {
  const BudgetCard({super.key, required this.progress, this.onTap});
  final BudgetProgress progress;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final b = progress.budget;
    final color = budgetColor(context, progress.status);
    final remaining = b.limitPaise - progress.spentPaise;
    final pct = (progress.ratio * 100).round();
    return AppCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              CategoryTile(slug: b.category.slug, color: catColor(context, b.category), size: 40),
              const SizedBox(width: Space.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(b.category.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.heading.copyWith(color: c.ink)),
                    Text(b.period == BudgetPeriod.weekly ? 'This week' : 'This month', style: TextStyles.caption.copyWith(color: c.inkMuted)),
                  ],
                ),
              ),
              if (b.scope == BudgetScope.household) ...[const SizedBox(width: Space.xs), Sticker(label: 'home', color: c.pop, filled: false)],
              if (progress.status == BudgetStatus.exceeded) ...[const SizedBox(width: Space.xs), Sticker(label: 'over', color: c.danger)],
            ],
          ),
          const SizedBox(height: Space.sm),
          ProgressTrack(value: progress.ratio, color: color, marker: b.alertThreshold),
          const SizedBox(height: Space.sm),
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: Space.xs,
            runSpacing: 2,
            children: [
              Text.rich(
                TextSpan(children: [
                  TextSpan(text: formatPaise(progress.spentPaise, decimals: false), style: TextStyles.money.copyWith(color: color)),
                  TextSpan(text: '  of ${formatPaise(b.limitPaise, decimals: false)}', style: TextStyles.caption.copyWith(color: c.inkMuted)),
                ]),
              ),
              Text(
                progress.status == BudgetStatus.exceeded ? '${formatPaise(-remaining, decimals: false)} over' : '${formatPaise(remaining, decimals: false)} left · $pct%',
                style: TextStyles.caption.copyWith(color: c.inkMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Grid of category choices. Column count adapts to the available width so
/// labels are never squeezed below a readable size.
class CategoryPicker extends ConsumerWidget {
  const CategoryPicker({super.key, required this.value, required this.onChanged});
  final String? value;
  final ValueChanged<TxCategory> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final cats = ref.watch(categoriesProvider);
    return AsyncView(
      value: cats,
      onRetry: () => ref.invalidate(categoriesProvider),
      errorMessage: "Couldn't load categories.",
      builder: (list) => LayoutBuilder(builder: (context, box) {
        const gap = Space.xs;
        final cols = (box.maxWidth / 150).floor().clamp(2, 4);
        final w = (box.maxWidth - gap * (cols - 1)) / cols;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final cat in list)
              SizedBox(
                width: w,
                child: _CategoryOption(cat: cat, selected: cat.id == value, onTap: () => onChanged(cat), color: catColor(context, cat), c: c),
              ),
          ],
        );
      }),
    );
  }
}

class _CategoryOption extends StatelessWidget {
  const _CategoryOption({required this.cat, required this.selected, required this.onTap, required this.color, required this.c});
  final TxCategory cat;
  final bool selected;
  final VoidCallback onTap;
  final Color color;
  final TallyColors c;

  @override
  Widget build(BuildContext context) => Semantics(
        selected: selected,
        button: true,
        child: Material(
          color: selected ? color.withValues(alpha: 0.16) : c.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Radii.md),
            side: BorderSide(color: selected ? color : c.border, width: selected ? 1.6 : 1),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 46),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                child: Row(
                  children: [
                    Icon(categoryIcon(cat.slug), size: 18, color: selected ? color : c.inkMuted),
                    const SizedBox(width: Space.xs),
                    Expanded(
                      child: Text(cat.name,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyles.caption.copyWith(color: c.ink, fontWeight: selected ? FontWeight.w700 : FontWeight.w500)),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
}

/// Avatar circle with the person's initial.
class InitialAvatar extends StatelessWidget {
  const InitialAvatar({super.key, required this.name, this.size = 44, this.filled = false});
  final String name;
  final double size;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final initial = name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: filled ? c.accent : c.accentSoft, shape: BoxShape.circle),
      child: Text(initial, style: TextStyles.title.copyWith(color: filled ? c.accentInk : c.accent, fontSize: size * 0.42, height: 1)),
    );
  }
}
