import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/nfc.dart';
import '../../state/providers.dart';
import '../widgets/domain.dart';
import '../widgets/kit.dart';
import '../widgets/pages.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  bool _savingConsent = false;

  Future<void> _toggleConsent(bool v) async {
    setState(() => _savingConsent = true);
    try {
      final user = await ref.read(apiProvider).updateMe(aggregateInsightsConsent: v);
      ref.read(sessionProvider.notifier).setUser(user);
    } catch (e) {
      if (mounted) showToast(context, friendlyError(e));
    } finally {
      if (mounted) setState(() => _savingConsent = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final user = ref.watch(currentUserProvider);
    final mode = ref.watch(appearanceProvider);
    final nfc = ref.watch(nfcPrefsProvider);
    final demo = ref.watch(demoModeProvider);

    return FormPage(
      title: 'Settings',
      children: [
        AppCard(
          child: Row(
            children: [
              InitialAvatar(name: user?.name ?? '?', size: 52, filled: true),
              const SizedBox(width: Space.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(user?.name ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.title.copyWith(color: c.ink)),
                    Text(user?.email ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.caption.copyWith(color: c.inkMuted)),
                    if (demo) ...[const SizedBox(height: Space.xxs), Sticker(label: 'offline demo', color: c.pop, filled: false)],
                  ],
                ),
              ),
            ],
          ),
        ),
        const SectionHeader(title: 'Appearance'),
        Wrap(
          spacing: Space.xs,
          runSpacing: Space.xs,
          children: [
            for (final (m, label, icon) in const [
              (ThemeMode.system, 'System', Icons.phone_iphone_rounded),
              (ThemeMode.light, 'Paper', Icons.light_mode_outlined),
              (ThemeMode.dark, 'Arcade', Icons.dark_mode_outlined),
            ])
              TallyChip(label: label, icon: icon, selected: mode == m, onTap: () => ref.read(appearanceProvider.notifier).set(m)),
          ],
        ),
        const SizedBox(height: Space.xs),
        Text('Paper by day, Arcade by night — two moods, not one palette inverted.', style: TextStyles.caption.copyWith(color: c.inkMuted)),
        const SectionHeader(title: 'Sources & terminals'),
        ListRow(icon: Icons.link_rounded, title: 'Gmail & SMS', subtitle: 'Pull in online orders automatically.', onTap: () => context.push('/connections')),
        const SizedBox(height: Space.xs),
        ListRow(icon: Icons.pin_outlined, title: 'Pair with a terminal', subtitle: 'For counters that can’t tap: show a 6-character code.', onTap: () => context.push('/pair')),
        const SizedBox(height: Space.xs),
        ListRow(icon: Icons.slideshow_outlined, title: 'Replay the welcome tour', onTap: () => context.push('/onboarding')),
        const SectionHeader(title: 'Tap terminal'),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('“Auto” uses the phone’s NFC when available and falls back to the demo terminal otherwise.', style: TextStyles.caption.copyWith(color: c.inkMuted)),
              const SizedBox(height: Space.sm),
              Wrap(
                spacing: Space.xs,
                runSpacing: Space.xs,
                children: [
                  for (final m in NfcMode.values) TallyChip(label: m.label, selected: nfc.mode == m, onTap: () => ref.read(nfcPrefsProvider.notifier).setMode(m)),
                ],
              ),
              if (nfc.mode != NfcMode.real) ...[
                const SizedBox(height: Space.md),
                Text('DEMO SCENARIO', style: TextStyles.micro.copyWith(color: c.inkFaint)),
                const SizedBox(height: Space.xs),
                Wrap(
                  spacing: Space.xs,
                  runSpacing: Space.xs,
                  children: [
                    for (final s in DemoScenario.values)
                      TallyChip(label: s.label, selected: nfc.scenario == s, onTap: () => ref.read(nfcPrefsProvider.notifier).setScenario(s)),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SectionHeader(title: 'Privacy'),
        AppCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                value: user?.aggregateInsightsConsent ?? false,
                onChanged: _savingConsent ? null : _toggleConsent,
                title: Text('Help improve spending insights', style: TextStyles.heading.copyWith(color: c.ink)),
              ),
              Text(
                'When on, your purchases contribute to anonymised, aggregated trends. Your identity, individual purchases and notes are never included, and any group smaller than 20 people is suppressed entirely. Off by default.',
                style: TextStyles.caption.copyWith(color: c.inkMuted),
              ),
            ],
          ),
        ),
        const SectionHeader(title: 'About'),
        AppCard(
          tone: CardTone.alt,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('DATA SOURCE', style: TextStyles.micro.copyWith(color: c.inkFaint)),
              const SizedBox(height: 2),
              SelectableText(ref.watch(apiProvider).endpointLabel, style: TextStyles.caption.copyWith(color: c.ink)),
            ],
          ),
        ),
        const SizedBox(height: Space.xl),
        AppButton(
          label: 'Sign out',
          icon: Icons.logout_rounded,
          kind: ButtonKind.secondary,
          onPressed: () async {
            final ok = await confirm(context, title: 'Sign out?', body: 'You can sign back in any time.', confirmLabel: 'Sign out');
            if (ok) await ref.read(sessionProvider.notifier).signOut();
          },
        ),
      ],
    );
  }
}
