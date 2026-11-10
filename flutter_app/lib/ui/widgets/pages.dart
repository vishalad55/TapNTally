import 'package:flutter/material.dart';

import '../../core/theme.dart';
import 'kit.dart';

/// A tab inside the shell: safe-area top, pull-to-refresh, width-capped slivers.
/// Bottom padding is small because the tab bar is part of the Scaffold —
/// content never needs to dodge a floating button.
class TabPage extends StatelessWidget {
  const TabPage({super.key, required this.slivers, required this.onRefresh, this.controller});
  final List<Widget> slivers;
  final Future<void> Function() onRefresh;
  final ScrollController? controller;

  @override
  Widget build(BuildContext context) => ColoredBox(
        color: context.colors.bg,
        child: SafeArea(
          bottom: false,
          child: RefreshIndicator(
            onRefresh: onRefresh,
            color: context.colors.accent,
            backgroundColor: context.colors.surface,
            child: CustomScrollView(
              controller: controller,
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                ...slivers.map((s) => SliverPage(sliver: s)),
                const SliverToBoxAdapter(child: SizedBox(height: Space.xxl)),
              ],
            ),
          ),
        ),
      );
}

/// Large-title header used at the top of each tab.
class TabHeader extends StatelessWidget {
  const TabHeader({super.key, required this.title, this.eyebrow, this.subtitle, this.trailing});
  final String title;
  final String? eyebrow;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(top: Space.md, bottom: Space.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (eyebrow != null) Text(eyebrow!.toUpperCase(), style: TextStyles.micro.copyWith(color: c.inkFaint)),
                Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyles.display.copyWith(color: c.ink)),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(subtitle!, style: TextStyles.caption.copyWith(color: c.inkMuted)),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: Space.sm), trailing!],
        ],
      ),
    );
  }
}

/// A pushed screen with an app bar, scrollable content and an optional
/// sticky action area. The action area sits *below* the scroll view (not on
/// top of it) and rides above the keyboard, so fields are never covered.
class FormPage extends StatelessWidget {
  const FormPage({super.key, required this.title, required this.children, this.actions, this.appBarActions});
  final String title;
  final List<Widget> children;
  final List<Widget>? actions;
  final List<Widget>? appBarActions;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Scaffold(
      appBar: AppBar(title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis), actions: appBarActions),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.only(top: Space.xs, bottom: Space.xl),
              children: [PageWidth(child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children))],
            ),
          ),
          if (actions != null && actions!.isNotEmpty)
            DecoratedBox(
              decoration: BoxDecoration(color: c.bg, border: Border(top: BorderSide(color: c.border))),
              child: SafeArea(
                top: false,
                child: PageWidth(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: Space.sm),
                    child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: actions!),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
