import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../state/providers.dart';

/// The tilted accent tile with the contactless glyph.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 64});
  final double size;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Transform.rotate(
      angle: -6 * math.pi / 180,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(color: c.accent, borderRadius: BorderRadius.circular(size * 0.32)),
        child: Icon(Icons.contactless_outlined, size: size * 0.56, color: c.accentInk),
      ),
    );
  }
}

/// Cycles System → Paper → Arcade.
class ThemeToggle extends ConsumerWidget {
  const ThemeToggle({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final mode = ref.watch(appearanceProvider);
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Tooltip(
      message: dark ? 'Switch to Paper (light)' : 'Switch to Arcade (dark)',
      child: SizedBox.square(
        dimension: 48,
        child: Center(
          child: Material(
            color: c.surface,
            shape: CircleBorder(side: BorderSide(color: c.border)),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => ref.read(appearanceProvider.notifier).set(dark ? ThemeMode.light : ThemeMode.dark),
              child: SizedBox.square(
                dimension: 42,
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 250),
                  transitionBuilder: (child, a) => RotationTransition(turns: Tween(begin: 0.75, end: 1.0).animate(a), child: FadeTransition(opacity: a, child: child)),
                  child: Icon(
                    dark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                    key: ValueKey('$dark-$mode'),
                    size: 21,
                    color: c.ink,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
