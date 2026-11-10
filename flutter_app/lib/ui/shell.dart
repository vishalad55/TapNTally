import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/theme.dart';
import 'tap_flow.dart';

class _Dest {
  const _Dest(this.label, this.icon, this.selectedIcon);
  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

const _tabs = [
  _Dest('Home', Icons.home_outlined, Icons.home_rounded),
  _Dest('History', Icons.receipt_long_outlined, Icons.receipt_long_rounded),
  _Dest('Budgets', Icons.donut_large_outlined, Icons.donut_large_rounded),
  _Dest('Recap', Icons.auto_awesome_outlined, Icons.auto_awesome_rounded),
  _Dest('Family', Icons.people_outline_rounded, Icons.people_rounded),
];

/// Hosts the five tabs. The bar is part of the Scaffold (not floating), so
/// tab content always ends above it and nothing is ever drawn underneath.
class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
        body: shell,
        bottomNavigationBar: TallyNavBar(
          index: shell.currentIndex,
          onTab: (i) => shell.goBranch(i, initialLocation: i == shell.currentIndex),
          onTap: () => startTap(context, ref),
        ),
      );
}

/// Six equal columns: two tabs, the Tap action, three tabs. Equal flex keeps
/// spacing symmetric whatever the label lengths; labels scale down rather than
/// clip on very narrow phones.
class TallyNavBar extends StatelessWidget {
  const TallyNavBar({super.key, required this.index, required this.onTab, required this.onTap});
  final int index;
  final ValueChanged<int> onTab;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final bottom = MediaQuery.paddingOf(context).bottom;
    Widget tab(int i) => Expanded(child: _NavItem(dest: _tabs[i], selected: index == i, onTap: () => onTab(i)));
    return Container(
      decoration: BoxDecoration(color: c.surface, border: Border(top: BorderSide(color: c.border))),
      padding: EdgeInsets.only(bottom: bottom),
      child: SizedBox(
        height: 68,
        child: Row(
          children: [
            tab(0),
            tab(1),
            Expanded(child: _TapItem(key: const Key('nav-tap'), onTap: onTap)),
            tab(2),
            tab(3),
            tab(4),
          ],
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({required this.dest, required this.selected, required this.onTap});
  final _Dest dest;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final color = selected ? c.ink : c.inkFaint;
    return Semantics(
      selected: selected,
      button: true,
      label: dest.label,
      excludeSemantics: true,
      child: InkResponse(
        onTap: onTap,
        radius: 32,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutCubic,
              width: selected ? 46 : 32,
              height: 30,
              decoration: BoxDecoration(color: selected ? c.accentSoft : Colors.transparent, borderRadius: BorderRadius.circular(Radii.pill)),
              child: Icon(selected ? dest.selectedIcon : dest.icon, size: 22, color: selected ? (c.isDark ? c.accent : c.ink) : color),
            ),
            const SizedBox(height: 4),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(dest.label, maxLines: 1, style: TextStyles.micro.copyWith(color: color, letterSpacing: 0.1, fontSize: 11, fontWeight: selected ? FontWeight.w800 : FontWeight.w600)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TapItem extends StatelessWidget {
  const _TapItem({super.key, required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      button: true,
      label: 'Tap to get your bill',
      excludeSemantics: true,
      child: Center(
        child: Material(
          color: c.accent,
          shape: const StadiumBorder(),
          elevation: 0,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: SizedBox(
              width: 54,
              height: 52,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.contactless_outlined, size: 24, color: c.accentInk),
                  FittedBox(fit: BoxFit.scaleDown, child: Text('TAP', style: TextStyles.micro.copyWith(color: c.accentInk, fontSize: 10, letterSpacing: 1.2))),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
