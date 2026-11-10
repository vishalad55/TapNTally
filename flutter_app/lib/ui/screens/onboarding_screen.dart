import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/api.dart';
import '../../state/providers.dart';
import '../widgets/brand.dart';
import '../widgets/kit.dart';

/// First-run tour: three short steps, every one skippable. Completion is
/// stored on the account, so a second device goes straight to Home.
/// Each step scrolls independently and its button bar is pinned below the
/// content, so long copy at large text sizes never pushes anything off-screen.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  int _step = 0;
  bool _finishing = false;

  // Household step state
  bool _create = true;
  final _value = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _value.dispose();
    super.dispose();
  }

  Future<void> _finish({String? then}) async {
    if (_finishing) return;
    setState(() => _finishing = true);
    final router = GoRouter.of(context);
    try {
      final user = await ref.read(apiProvider).updateMe(onboardingCompleted: true);
      ref.read(sessionProvider.notifier).setUser(user);
    } catch (_) {
      // Not fatal: the tour can be replayed from Settings.
    }
    router.go('/');
    if (then != null) router.push(then);
  }

  Future<void> _submitHousehold() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final api = ref.read(apiProvider);
      if (_create) {
        await api.createHousehold(_value.text.trim());
      } else {
        await api.joinHousehold(_value.text.trim().toUpperCase());
      }
      invalidateHousehold(ref);
      await _finish();
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final name = ref.watch(currentUserProvider)?.firstName;
    final (content, actions) = switch (_step) {
      0 => (_welcome(c, name), [AppButton(label: 'Continue', icon: Icons.arrow_forward_rounded, onPressed: () => setState(() => _step = 1))]),
      1 => (
          _sources(c),
          [
            AppButton(label: 'Connect Gmail or SMS', icon: Icons.link_rounded, onPressed: () => _finish(then: '/connections')),
            const SizedBox(height: Space.xs),
            AppButton(label: 'Not now', kind: ButtonKind.ghost, onPressed: () => setState(() => _step = 2)),
          ]
        ),
      _ => (
          _householdStep(c),
          [
            AppButton(
              label: _create ? 'Create household' : 'Join household',
              loading: _busy,
              onPressed: _value.text.trim().length < (_create ? 2 : 5) ? null : _submitHousehold,
            ),
            const SizedBox(height: Space.xs),
            AppButton(label: 'Skip for now', kind: ButtonKind.ghost, onPressed: () => _finish()),
          ]
        ),
    };

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            PageWidth(
              child: SizedBox(
                height: 56,
                child: Row(
                  children: [
                    if (_step > 0)
                      IconButton(tooltip: 'Back', onPressed: () => setState(() => _step--), icon: Icon(Icons.arrow_back_rounded, color: c.ink))
                    else
                      const SizedBox(width: 48),
                    Expanded(child: Center(child: _Dots(count: 3, active: _step))),
                    TextButton(onPressed: _finishing ? null : () => _finish(), child: Text('Skip', style: TextStyles.heading.copyWith(color: c.inkMuted))),
                  ],
                ),
              ),
            ),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 280),
                transitionBuilder: (child, a) => FadeTransition(
                  opacity: a,
                  child: SlideTransition(position: Tween(begin: const Offset(0, 0.04), end: Offset.zero).animate(a), child: child),
                ),
                child: SingleChildScrollView(
                  key: ValueKey(_step),
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.only(top: Space.md, bottom: Space.lg),
                  child: PageWidth(child: content),
                ),
              ),
            ),
            DecoratedBox(
              decoration: BoxDecoration(border: Border(top: BorderSide(color: c.border))),
              child: PageWidth(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: Space.sm),
                  child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: actions),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _welcome(TallyColors c, String? name) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const BrandMark(size: 76),
          const SizedBox(height: Space.xl),
          Text(name != null ? 'Hi $name.\nBills that file themselves.' : 'Hello.\nBills that file themselves.', style: TextStyles.display.copyWith(color: c.ink)),
          const SizedBox(height: Space.sm),
          Text(
            'After you pay at a shop, hold your phone near the card machine. The itemised bill lands in TapNTally, already categorised, and your month updates on the spot.',
            style: TextStyles.body.copyWith(color: c.inkMuted, fontSize: 16),
          ),
          const SizedBox(height: Space.lg),
          const _Point(icon: Icons.contactless_outlined, title: 'Tap to get the bill', body: 'Works with any terminal on the TapNTally network. No paper, no photos.'),
          const _Point(icon: Icons.donut_large_outlined, title: 'See where the money goes', body: 'A live breakdown by category, budgets that nudge you at 80%.'),
          const _Point(icon: Icons.people_outline_rounded, title: 'Share what’s shared', body: 'Groceries and bills for the household; everything else stays private.'),
        ],
      );

  Widget _sources(TallyColors c) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('STEP 2 OF 3', style: TextStyles.micro.copyWith(color: c.inkFaint)),
          const SizedBox(height: Space.xxs),
          Text('Where should we look?', style: TextStyles.display.copyWith(color: c.ink)),
          const SizedBox(height: Space.xs),
          Text('Tapping covers shops. For online orders we can read confirmations, narrowly, and only with your say-so.', style: TextStyles.body.copyWith(color: c.inkMuted)),
          const SizedBox(height: Space.lg),
          ListRow(icon: Icons.contactless_outlined, title: 'Tap at terminals', subtitle: 'Itemised bills straight from the card machine.', trailing: Sticker(label: 'always on', color: c.money, filled: false)),
          const SizedBox(height: Space.xs),
          const ListRow(icon: Icons.mail_outline_rounded, title: 'Gmail order confirmations', subtitle: 'Read-only. Only order emails from known shops; never stored.'),
          const SizedBox(height: Space.xs),
          ListRow(icon: Icons.sms_outlined, title: 'Bank SMS alerts', subtitle: 'Parsed on your phone. Only amount and merchant are kept.', trailing: Sticker(label: 'android', color: c.inkMuted, filled: false)),
        ],
      );

  Widget _householdStep(TallyColors c) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('STEP 3 OF 3', style: TextStyles.micro.copyWith(color: c.inkFaint)),
          const SizedBox(height: Space.xxs),
          Text('Share with your home?', style: TextStyles.display.copyWith(color: c.ink)),
          const SizedBox(height: Space.xs),
          Text('Set up a household now, or later from the Family tab. Your own purchases stay private either way.', style: TextStyles.body.copyWith(color: c.inkMuted)),
          const SizedBox(height: Space.lg),
          Row(
            children: [
              Expanded(child: _Choice(icon: Icons.home_outlined, label: 'Start one', selected: _create, onTap: () => setState(() => _create = true))),
              const SizedBox(width: Space.sm),
              Expanded(child: _Choice(icon: Icons.key_outlined, label: 'Join with code', selected: !_create, onTap: () => setState(() => _create = false))),
            ],
          ),
          const SizedBox(height: Space.md),
          TextField(
            controller: _value,
            onChanged: (_) => setState(() {}),
            textCapitalization: _create ? TextCapitalization.words : TextCapitalization.characters,
            style: TextStyles.body.copyWith(color: c.ink),
            decoration: InputDecoration(hintText: _create ? 'Household name, e.g. The Sharmas' : 'Invite code, e.g. TAP-XXXXX'),
          ),
          if (_error != null) ...[const SizedBox(height: Space.sm), Text(_error!, style: TextStyles.body.copyWith(color: c.danger))],
        ],
      );
}

class _Dots extends StatelessWidget {
  const _Dots({required this.count, required this.active});
  final int count;
  final int active;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      label: 'Step ${active + 1} of $count',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < count; i++)
            AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: i == active ? 22 : 8,
              height: 8,
              decoration: BoxDecoration(color: i == active ? c.accent : c.border, borderRadius: BorderRadius.circular(4)),
            ),
        ],
      ),
    );
  }
}

class _Point extends StatelessWidget {
  const _Point({required this.icon, required this.title, required this.body});
  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: Space.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: c.accentSoft, borderRadius: BorderRadius.circular(Radii.sm)),
            child: Icon(icon, size: 20, color: c.accent),
          ),
          const SizedBox(width: Space.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyles.heading.copyWith(color: c.ink)),
                Text(body, style: TextStyles.caption.copyWith(color: c.inkMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Choice extends StatelessWidget {
  const _Choice({required this.icon, required this.label, required this.selected, required this.onTap});
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Semantics(
      selected: selected,
      button: true,
      child: AppCard(
        tone: selected ? CardTone.accent : CardTone.surface,
        onTap: onTap,
        child: Column(
          children: [
            Icon(icon, color: selected ? c.accent : c.inkMuted),
            const SizedBox(height: Space.xs),
            Text(label, textAlign: TextAlign.center, maxLines: 2, style: TextStyles.heading.copyWith(color: c.ink)),
          ],
        ),
      ),
    );
  }
}
