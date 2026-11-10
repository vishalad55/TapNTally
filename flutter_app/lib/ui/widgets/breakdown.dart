import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/money.dart';
import '../../core/theme.dart';
import '../../data/models.dart';
import 'domain.dart';

/// A selectable slice: one category, or the merged "Other" tail.
class Slice {
  const Slice({required this.id, required this.label, required this.slug, required this.color, required this.amountPaise, required this.share, required this.categoryIds});
  final String id;
  final String label;
  final String? slug;
  final Color color;
  final int amountPaise;
  final double share;
  final List<String> categoryIds;
  bool get isOther => id == otherSliceId;
}

const otherSliceId = '__other';
const _minShare = 0.025;

/// Largest-first, with slivers under 2.5 % merged so every slice is tappable.
List<Slice> buildSlices(BuildContext context, List<CategorySpend> data) {
  final sorted = [...data]..sort((a, b) => b.amountPaise.compareTo(a.amountPaise));
  final big = sorted.where((d) => d.share >= _minShare);
  final small = sorted.where((d) => d.share < _minShare && d.amountPaise > 0).toList();
  return [
    for (final d in big)
      Slice(
        id: d.category.id,
        label: d.category.name,
        slug: d.category.slug,
        color: catColor(context, d.category),
        amountPaise: d.amountPaise,
        share: d.share,
        categoryIds: [d.category.id],
      ),
    if (small.isNotEmpty)
      Slice(
        id: otherSliceId,
        label: 'Other',
        slug: null,
        color: context.colors.inkFaint,
        amountPaise: small.fold(0, (s, d) => s + d.amountPaise),
        share: small.fold(0.0, (s, d) => s + d.share),
        categoryIds: [for (final d in small) d.category.id],
      ),
  ];
}

/// Tappable donut. The ring draws in on mount, the selected slice lifts out
/// and the centre label swaps to that category.
class DonutChart extends StatefulWidget {
  const DonutChart({super.key, required this.slices, required this.totalPaise, required this.selectedId, required this.onSelect, this.periodLabel = 'this month', this.size = 220});
  final List<Slice> slices;
  final int totalPaise;
  final String? selectedId;
  final ValueChanged<Slice?> onSelect;
  final String periodLabel;
  final double size;

  @override
  State<DonutChart> createState() => _DonutChartState();
}

class _DonutChartState extends State<DonutChart> with SingleTickerProviderStateMixin {
  late final AnimationController _draw = AnimationController(vsync: this, duration: const Duration(milliseconds: 800))..forward();

  @override
  void dispose() {
    _draw.dispose();
    super.dispose();
  }

  static const _start = -math.pi / 2;

  void _onTap(TapUpDetails d, double size, double thickness) {
    final center = Offset(size / 2, size / 2);
    final v = d.localPosition - center;
    final r = v.distance;
    final outer = size / 2 - 10;
    if (r < outer - thickness - 8 || r > outer + 12) return widget.onSelect(null);
    var a = math.atan2(v.dy, v.dx);
    if (a < _start) a += math.pi * 2;
    var acc = _start;
    for (final s in widget.slices) {
      final end = acc + s.share * math.pi * 2;
      if (a >= acc && a < end) return widget.onSelect(s.id == widget.selectedId ? null : s);
      acc = end;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final size = widget.size;
    final thickness = size * 0.13;
    final selected = widget.slices.where((s) => s.id == widget.selectedId).firstOrNull;
    final empty = widget.totalPaise == 0 || widget.slices.isEmpty;

    return Semantics(
      label: 'Spending by category, ${formatPaise(widget.totalPaise, decimals: false)} ${widget.periodLabel}',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapUp: (d) => _onTap(d, size, thickness),
        child: SizedBox.square(
          dimension: size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              AnimatedBuilder(
                animation: _draw,
                builder: (context, _) => TweenAnimationBuilder<double>(
                  tween: Tween(end: selected == null ? 0 : 1),
                  duration: const Duration(milliseconds: 260),
                  curve: Curves.easeOutBack,
                  builder: (context, lift, _) => CustomPaint(
                    size: Size.square(size),
                    painter: _DonutPainter(
                      slices: empty ? const [] : widget.slices,
                      selectedId: widget.selectedId,
                      progress: Curves.easeOutCubic.transform(_draw.value),
                      lift: lift,
                      thickness: thickness,
                      track: c.surfaceAlt,
                      gapColor: c.surface,
                    ),
                  ),
                ),
              ),
              // Centre label lives strictly inside the hole.
              SizedBox.square(
                dimension: size - thickness * 2 - 40,
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 200),
                  child: _Centre(
                    key: ValueKey(selected?.id ?? (empty ? 'empty' : 'total')),
                    top: selected == null ? (empty ? null : widget.periodLabel.toUpperCase()) : null,
                    icon: selected == null ? null : (selected.isOther ? Icons.more_horiz_rounded : categoryIcon(selected.slug)),
                    iconColor: selected?.color,
                    amount: empty ? '₹0' : formatPaise(selected?.amountPaise ?? widget.totalPaise, decimals: false),
                    bottom: empty ? 'nothing yet' : (selected == null ? 'tap a slice' : '${selected.label} · ${(selected.share * 100).round()}%'),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Centre extends StatelessWidget {
  const _Centre({super.key, this.top, this.icon, this.iconColor, required this.amount, required this.bottom});
  final String? top;
  final IconData? icon;
  final Color? iconColor;
  final String amount;
  final String bottom;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (top != null) Text(top!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.micro.copyWith(color: c.inkFaint)),
        if (icon != null) Icon(icon, size: 20, color: iconColor),
        FittedBox(fit: BoxFit.scaleDown, child: Text(amount, maxLines: 1, style: TextStyles.display.copyWith(color: c.ink))),
        Text(bottom, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: TextStyles.caption.copyWith(color: c.inkMuted)),
      ],
    );
  }
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({required this.slices, required this.selectedId, required this.progress, required this.lift, required this.thickness, required this.track, required this.gapColor});
  final List<Slice> slices;
  final String? selectedId;
  final double progress;
  final double lift;
  final double thickness;
  final Color track;
  final Color gapColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.width / 2 - 10 - thickness / 2;
    canvas.drawCircle(center, radius, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = thickness
      ..color = track);
    if (slices.isEmpty) return;

    const start = -math.pi / 2;
    final gap = slices.length > 1 ? 0.018 : 0.0;
    var acc = start;
    for (final s in slices) {
      final sweep = s.share * math.pi * 2;
      final from = start + (acc - start) * progress;
      final to = start + (acc + sweep - start) * progress;
      acc += sweep;
      if (to - from <= gap) continue;
      final isSel = s.id == selectedId;
      final mid = (from + to) / 2;
      final offset = isSel ? Offset(math.cos(mid), math.sin(mid)) * 7 * lift : Offset.zero;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = isSel ? thickness + 4 * lift : thickness
        ..strokeCap = StrokeCap.butt
        ..color = selectedId != null && !isSel ? s.color.withValues(alpha: 0.28) : s.color;
      canvas.drawArc(Rect.fromCircle(center: center + offset, radius: radius), from + gap / 2, to - from - gap, false, paint);
    }
  }

  @override
  bool shouldRepaint(_DonutPainter old) =>
      old.progress != progress || old.lift != lift || old.selectedId != selectedId || old.slices != slices || old.track != track;
}

/// The list half of the breakdown, kept in sync with the donut.
class BreakdownLegend extends StatefulWidget {
  const BreakdownLegend({super.key, required this.slices, required this.selectedId, required this.onSelect, this.initial = 4});
  final List<Slice> slices;
  final String? selectedId;
  final ValueChanged<Slice?> onSelect;
  final int initial;

  @override
  State<BreakdownLegend> createState() => _BreakdownLegendState();
}

class _BreakdownLegendState extends State<BreakdownLegend> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final shown = _expanded ? widget.slices : widget.slices.take(widget.initial).toList();
    final maxShare = widget.slices.fold<double>(0.0001, (m, s) => math.max(m, s.share));
    return Column(
      children: [
        for (final s in shown)
          Padding(
            padding: const EdgeInsets.only(bottom: 2),
            child: Material(
              color: s.id == widget.selectedId ? s.color.withValues(alpha: c.isDark ? 0.16 : 0.10) : Colors.transparent,
              borderRadius: BorderRadius.circular(Radii.md),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => widget.onSelect(s.id == widget.selectedId ? null : s),
                child: Opacity(
                  opacity: widget.selectedId != null && widget.selectedId != s.id ? 0.5 : 1,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 9),
                    child: Row(
                      children: [
                        CategoryTile(slug: s.slug, color: s.color, size: 34, icon: s.isOther ? Icons.more_horiz_rounded : null),
                        const SizedBox(width: Space.sm),
                        Expanded(
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Expanded(child: Text(s.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.heading.copyWith(color: c.ink, fontSize: 14))),
                                  const SizedBox(width: Space.xs),
                                  Text(formatPaise(s.amountPaise, decimals: false), style: TextStyles.money.copyWith(color: c.ink, fontSize: 14)),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  Expanded(child: ProgressTrack(value: s.share / maxShare, color: s.color, height: 5)),
                                  SizedBox(
                                    width: 42,
                                    child: Text('${(s.share * 100).round()}%', textAlign: TextAlign.right, style: TextStyles.caption.copyWith(color: c.inkFaint)),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        if (widget.slices.length > widget.initial)
          TextButton.icon(
            onPressed: () => setState(() => _expanded = !_expanded),
            icon: Icon(_expanded ? Icons.expand_less_rounded : Icons.expand_more_rounded, color: c.accent, size: 18),
            label: Text(_expanded ? 'Show less' : 'Show all ${widget.slices.length}', style: TextStyles.caption.copyWith(color: c.accent, fontWeight: FontWeight.w700)),
          ),
      ],
    );
  }
}

/// Donut + legend inside one card, sharing a single selection.
class BreakdownCard extends StatelessWidget {
  const BreakdownCard({super.key, required this.summary, required this.selected, required this.onSelect, this.periodLabel = 'this month', this.title = 'By category'});
  final SpendSummary summary;
  final Slice? selected;
  final ValueChanged<Slice?> onSelect;
  final String periodLabel;
  final String title;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final slices = buildSlices(context, summary.byCategory);
    return DecoratedBox(
      decoration: BoxDecoration(color: c.surface, borderRadius: BorderRadius.circular(Radii.lg), border: Border.all(color: c.border)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(Space.md, Space.md, Space.md, Space.xs),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('BREAKDOWN', style: TextStyles.micro.copyWith(color: c.inkFaint)),
                      Text(title, style: TextStyles.title.copyWith(color: c.ink)),
                    ],
                  ),
                ),
                if (selected != null)
                  TextButton.icon(
                    onPressed: () => onSelect(null),
                    icon: Icon(Icons.close_rounded, size: 16, color: c.accent),
                    label: Text('Clear', style: TextStyles.caption.copyWith(color: c.accent, fontWeight: FontWeight.w700)),
                  ),
              ],
            ),
            const SizedBox(height: Space.sm),
            LayoutBuilder(
              builder: (context, box) => DonutChart(
                slices: slices,
                totalPaise: summary.totalPaise,
                selectedId: selected?.id,
                onSelect: onSelect,
                periodLabel: periodLabel,
                size: math.min(232, box.maxWidth),
              ),
            ),
            const SizedBox(height: Space.sm),
            BreakdownLegend(slices: slices, selectedId: selected?.id, onSelect: onSelect),
          ],
        ),
      ),
    );
  }
}
