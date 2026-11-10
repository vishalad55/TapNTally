import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../data/api.dart';

/// Layout rule for every screen: centred column, never wider than
/// [Space.maxContentWidth], with the same side gutter everywhere.
class PageWidth extends StatelessWidget {
  const PageWidth({super.key, required this.child, this.padded = true});
  final Widget child;
  final bool padded;

  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: Space.maxContentWidth),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: padded ? Space.gutter : 0),
            child: child,
          ),
        ),
      );
}

/// Sliver equivalent of [PageWidth] for scroll views.
class SliverPage extends StatelessWidget {
  const SliverPage({super.key, required this.sliver});
  final Widget sliver;

  @override
  Widget build(BuildContext context) => SliverLayoutBuilder(builder: (context, constraints) {
        final extra = ((constraints.crossAxisExtent - Space.maxContentWidth) / 2).clamp(0.0, double.infinity);
        return SliverPadding(
          padding: EdgeInsets.symmetric(horizontal: Space.gutter + extra),
          sliver: sliver,
        );
      });
}

/// Bordered surface. Every card has the same radius, border and padding.
class AppCard extends StatelessWidget {
  const AppCard({super.key, required this.child, this.tone = CardTone.surface, this.padding = const EdgeInsets.all(Space.md), this.onTap});
  final Widget child;
  final CardTone tone;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final (bg, border) = switch (tone) {
      CardTone.surface => (c.surface, c.border),
      CardTone.alt => (c.surfaceAlt, c.border),
      CardTone.accent => (c.accentSoft, c.accent.withValues(alpha: 0.35)),
      CardTone.danger => (c.surface, c.danger),
    };
    final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.lg), side: BorderSide(color: border));
    return Material(
      color: bg,
      shape: shape,
      clipBehavior: Clip.antiAlias,
      // Only tappable cards get an ink layer: a non-interactive card must not
      // read as a button to screen readers (nor swallow buttons inside it).
      child: onTap == null ? Padding(padding: padding, child: child) : InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
    );
  }
}

enum CardTone { surface, alt, accent, danger }

/// Eyebrow + title on the left, an optional action on the right.
class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.eyebrow, this.trailing, this.top = Space.xl});
  final String title;
  final String? eyebrow;
  final Widget? trailing;
  final double top;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: EdgeInsets.only(top: top, bottom: Space.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (eyebrow != null) Text(eyebrow!.toUpperCase(), style: TextStyles.micro.copyWith(color: c.inkFaint), maxLines: 1, overflow: TextOverflow.ellipsis),
                Text(title, style: TextStyles.title.copyWith(color: c.ink), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: Space.sm), trailing!],
        ],
      ),
    );
  }
}

enum ButtonKind { primary, secondary, ghost, danger }

class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.kind = ButtonKind.primary,
    this.icon,
    this.loading = false,
    this.small = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final ButtonKind kind;
  final IconData? icon;
  final bool loading;
  final bool small;

  /// Fill the available width (default) or hug the content.
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final (bg, fg, border) = switch (kind) {
      ButtonKind.primary => (c.accent, c.accentInk, Colors.transparent),
      ButtonKind.secondary => (c.surfaceAlt, c.ink, c.border),
      ButtonKind.ghost => (Colors.transparent, c.ink, Colors.transparent),
      ButtonKind.danger => (c.danger, Colors.white, Colors.transparent),
    };
    final disabled = onPressed == null || loading;
    final child = Row(
      mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (loading)
          SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2.2, color: fg))
        else if (icon != null)
          Icon(icon, size: 18, color: fg),
        if (loading || icon != null) const SizedBox(width: Space.xs),
        Flexible(
          child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.heading.copyWith(color: fg, fontSize: small ? 14 : 15.5)),
        ),
      ],
    );
    return Opacity(
      opacity: onPressed == null && !loading ? 0.45 : 1,
      child: Material(
        color: bg,
        shape: StadiumBorder(side: BorderSide(color: border)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: disabled ? null : onPressed,
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: small ? 40 : 52),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: small ? Space.md : Space.lg, vertical: small ? 8 : 12),
              child: Center(widthFactor: expand ? null : 1, child: child),
            ),
          ),
        ),
      ),
    );
  }
}

/// Circular header action with a 48 px touch target.
class RoundIconButton extends StatelessWidget {
  const RoundIconButton({super.key, required this.icon, required this.onPressed, required this.tooltip, this.size = 42});
  final IconData icon;
  final VoidCallback? onPressed;
  final String tooltip;
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Tooltip(
      message: tooltip,
      child: SizedBox.square(
        dimension: 48,
        child: Center(
          child: Material(
            color: c.surface,
            shape: CircleBorder(side: BorderSide(color: c.border)),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onPressed,
              child: SizedBox.square(dimension: size, child: Icon(icon, size: size * 0.5, color: c.ink)),
            ),
          ),
        ),
      ),
    );
  }
}

/// Filter / choice chip in the brand style.
class TallyChip extends StatelessWidget {
  const TallyChip({super.key, required this.label, this.selected = false, this.onTap, this.icon, this.color});
  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final IconData? icon;

  /// Category colour for category chips; defaults to the accent.
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final accent = color ?? c.accent;
    final fg = selected ? (color != null ? contrastInk(accent) : c.accentInk) : c.ink;
    return Semantics(
      selected: selected,
      button: true,
      child: Material(
        color: selected ? accent : c.surface,
        shape: StadiumBorder(side: BorderSide(color: selected ? accent : c.border)),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 38),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[Icon(icon, size: 16, color: selected ? fg : (color ?? c.inkMuted)), const SizedBox(width: 6)],
                  Flexible(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.caption.copyWith(color: fg))),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Horizontally scrolling row of chips with the page gutter on both ends,
/// so the first chip lines up with the content above it.
class ChipStrip extends StatelessWidget {
  const ChipStrip({super.key, required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 40,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: Space.gutter),
          itemCount: children.length,
          separatorBuilder: (_, _) => const SizedBox(width: Space.xs),
          itemBuilder: (_, i) => Center(child: children[i]),
        ),
      );
}

/// Small uppercase label (VERIFIED, SHARED, OVER).
class Sticker extends StatelessWidget {
  const Sticker({super.key, required this.label, required this.color, this.filled = true});
  final String label;
  final Color color;
  final bool filled;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          color: filled ? color : color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(label.toUpperCase(), maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.micro.copyWith(color: filled ? contrastInk(color) : color, fontSize: 10)),
      );
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, this.body, this.action});
  final IconData icon;
  final String title;
  final String? body;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: Space.xxl, horizontal: Space.md),
      child: Column(
        children: [
          Container(
            width: 76,
            height: 76,
            decoration: BoxDecoration(color: c.surfaceAlt, shape: BoxShape.circle, border: Border.all(color: c.border)),
            child: Icon(icon, size: 32, color: c.inkMuted),
          ),
          const SizedBox(height: Space.md),
          Text(title, textAlign: TextAlign.center, style: TextStyles.title.copyWith(color: c.ink)),
          if (body != null) ...[
            const SizedBox(height: Space.xs),
            Text(body!, textAlign: TextAlign.center, style: TextStyles.body.copyWith(color: c.inkMuted)),
          ],
          if (action != null) ...[const SizedBox(height: Space.lg), action!],
        ],
      ),
    );
  }
}

class LoadingBlock extends StatelessWidget {
  const LoadingBlock({super.key, this.label, this.height = 120});
  final String? label;
  final double height;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: height,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox.square(dimension: 26, child: CircularProgressIndicator(strokeWidth: 2.6)),
              if (label != null) ...[
                const SizedBox(height: Space.sm),
                Text(label!, style: TextStyles.caption.copyWith(color: context.colors.inkMuted)),
              ],
            ],
          ),
        ),
      );
}

class ErrorCard extends StatelessWidget {
  const ErrorCard({super.key, required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppCard(
      tone: CardTone.danger,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(Icons.error_outline_rounded, color: c.danger),
              const SizedBox(width: Space.sm),
              Expanded(child: Text(message, style: TextStyles.body.copyWith(color: c.ink))),
            ],
          ),
          if (onRetry != null) ...[
            const SizedBox(height: Space.sm),
            Align(alignment: Alignment.centerLeft, child: AppButton(label: 'Retry', icon: Icons.refresh_rounded, kind: ButtonKind.secondary, small: true, expand: false, onPressed: onRetry)),
          ],
        ],
      ),
    );
  }
}

/// Renders an [AsyncValue] with consistent loading and error states.
class AsyncView<T> extends StatelessWidget {
  const AsyncView({super.key, required this.value, required this.builder, required this.onRetry, this.errorMessage = "Couldn't load this.", this.loading});
  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final VoidCallback onRetry;
  final String errorMessage;
  final Widget? loading;

  @override
  Widget build(BuildContext context) => switch (value) {
        AsyncData(:final value) => builder(value),
        AsyncError(:final error) when !value.isLoading => ErrorCard(message: error is ApiException && error.isNetwork ? error.message : errorMessage, onRetry: onRetry),
        _ when value.hasValue => builder(value.requireValue),
        _ => loading ?? const LoadingBlock(),
      };
}

/// Labelled text field with consistent spacing.
class LabeledField extends StatelessWidget {
  const LabeledField({super.key, required this.label, required this.child, this.hint});
  final String label;
  final String? hint;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyles.caption.copyWith(color: c.inkMuted)),
        const SizedBox(height: 6),
        child,
        if (hint != null) ...[
          const SizedBox(height: 6),
          Text(hint!, style: TextStyles.caption.copyWith(color: c.inkFaint)),
        ],
      ],
    );
  }
}

/// A settings-style row: leading icon, title, subtitle, trailing widget.
class ListRow extends StatelessWidget {
  const ListRow({super.key, required this.title, this.subtitle, this.icon, this.trailing, this.onTap});
  final String title;
  final String? subtitle;
  final IconData? icon;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: Space.md, vertical: 14),
      child: Row(
        children: [
          if (icon != null) ...[
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(Radii.sm)),
              child: Icon(icon, size: 20, color: c.ink),
            ),
            const SizedBox(width: Space.sm),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyles.heading.copyWith(color: c.ink)),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(subtitle!, style: TextStyles.caption.copyWith(color: c.inkMuted)),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: Space.sm), trailing!] else if (onTap != null) ...[
            const SizedBox(width: Space.sm),
            Icon(Icons.chevron_right_rounded, color: c.inkFaint),
          ],
        ],
      ),
    );
  }
}

/// Confirmation dialog. Returns true when the person confirms.
Future<bool> confirm(BuildContext context, {required String title, required String body, required String confirmLabel, bool destructive = false, String cancelLabel = 'Cancel'}) async {
  final c = context.colors;
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Text(body),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(cancelLabel, style: TextStyles.heading.copyWith(color: c.inkMuted))),
        TextButton(onPressed: () => Navigator.pop(ctx, true), child: Text(confirmLabel, style: TextStyles.heading.copyWith(color: destructive ? c.danger : c.accent))),
      ],
    ),
  );
  return ok ?? false;
}

void showToast(BuildContext context, String message) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(message)));
}

/// Two actions side by side when each gets enough room for its full label,
/// stacked full-width otherwise — so labels never truncate on narrow phones.
class ButtonPair extends StatelessWidget {
  const ButtonPair({super.key, required this.first, required this.second, this.minEach = 150});
  final Widget first;
  final Widget second;
  final double minEach;

  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, box) {
        final scale = MediaQuery.textScalerOf(context).scale(1);
        if ((box.maxWidth - Space.sm) / 2 >= minEach * scale) {
          return Row(children: [Expanded(child: first), const SizedBox(width: Space.sm), Expanded(child: second)]);
        }
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [second, const SizedBox(height: Space.xs), first]);
      });
}
