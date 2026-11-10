import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../widgets/breakdown.dart';
import '../widgets/domain.dart';
import '../widgets/kit.dart';
import '../widgets/pages.dart';

const _sharedMonth = (period: 'month', offset: 0, scope: 'shared');

class FamilyScreen extends ConsumerStatefulWidget {
  const FamilyScreen({super.key});

  @override
  ConsumerState<FamilyScreen> createState() => _FamilyScreenState();
}

class _FamilyScreenState extends ConsumerState<FamilyScreen> {
  final _name = TextEditingController();
  final _code = TextEditingController();
  String? _busy;
  String? _error;
  Slice? _selected;

  @override
  void dispose() {
    _name.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _run(String key, Future<void> Function(TallyApi api) fn) async {
    setState(() {
      _busy = key;
      _error = null;
    });
    try {
      await fn(ref.read(apiProvider));
      invalidateHousehold(ref);
      await ref.read(sessionProvider.notifier).refreshUser();
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final household = ref.watch(householdProvider);
    return TabPage(
      onRefresh: () async => invalidateHousehold(ref),
      slivers: [
        SliverToBoxAdapter(
          child: AsyncView(
            value: household,
            onRetry: () => ref.invalidate(householdProvider),
            errorMessage: "Couldn't load your household.",
            loading: const LoadingBlock(height: 300),
            builder: (h) => h == null ? _setup(context) : _HouseholdHeader(household: h, busy: _busy, error: _error, run: _run),
          ),
        ),
        if (household.value != null) ..._sharedSlivers(context),
      ],
    );
  }

  Widget _setup(BuildContext context) {
    final c = context.colors;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const TabHeader(eyebrow: 'Family', title: 'One home,\none picture.'),
        Text('Share groceries, bills, the big stuff — while everyone keeps their own private view.', style: TextStyles.body.copyWith(color: c.inkMuted)),
        const SizedBox(height: Space.lg),
        AppCard(
          padding: const EdgeInsets.all(Space.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Start a household', style: TextStyles.heading.copyWith(color: c.ink)),
              const SizedBox(height: Space.sm),
              TextField(
                controller: _name,
                onChanged: (_) => setState(() {}),
                textCapitalization: TextCapitalization.words,
                style: TextStyles.body.copyWith(color: c.ink),
                decoration: const InputDecoration(hintText: 'e.g. The Sharmas'),
              ),
              const SizedBox(height: Space.sm),
              AppButton(
                label: 'Create',
                loading: _busy == 'create',
                onPressed: _name.text.trim().length < 2 || _busy != null ? null : () => _run('create', (api) => api.createHousehold(_name.text.trim())),
              ),
            ],
          ),
        ),
        const SizedBox(height: Space.sm),
        AppCard(
          padding: const EdgeInsets.all(Space.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Join with a code', style: TextStyles.heading.copyWith(color: c.ink)),
              const SizedBox(height: Space.sm),
              TextField(
                controller: _code,
                onChanged: (_) => setState(() {}),
                textCapitalization: TextCapitalization.characters,
                style: TextStyles.body.copyWith(color: c.ink),
                decoration: const InputDecoration(hintText: 'TAP-XXXXX'),
              ),
              const SizedBox(height: Space.sm),
              AppButton(
                label: 'Join',
                kind: ButtonKind.secondary,
                loading: _busy == 'join',
                onPressed: _code.text.trim().length < 5 || _busy != null ? null : () => _run('join', (api) => api.joinHousehold(_code.text.trim().toUpperCase())),
              ),
            ],
          ),
        ),
        if (_error != null) ...[const SizedBox(height: Space.sm), ErrorCard(message: _error!)],
      ],
    );
  }

  List<Widget> _sharedSlivers(BuildContext context) {
    final c = context.colors;
    final summary = ref.watch(summaryProvider(_sharedMonth));
    final feed = ref.watch(feedProvider(TransactionQuery(scope: 'shared', categoryIds: _selected?.categoryIds, limit: 30)));
    return [
      const SliverToBoxAdapter(child: SectionHeader(eyebrow: 'This month', title: 'Shared spend')),
      SliverToBoxAdapter(
        child: AsyncView(
          value: summary,
          onRetry: () => ref.invalidate(summaryProvider),
          loading: const LoadingBlock(height: 300),
          builder: (s) => BreakdownCard(summary: s, selected: _selected, onSelect: (sl) => setState(() => _selected = sl), periodLabel: 'household', title: 'Household'),
        ),
      ),
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.only(top: Space.sm),
          child: Text('Only purchases marked “shared” appear here. Toggle it on any purchase.', textAlign: TextAlign.center, style: TextStyles.caption.copyWith(color: c.inkMuted)),
        ),
      ),
      SliverToBoxAdapter(child: SectionHeader(title: _selected?.label ?? 'Shared purchases')),
      ...switch (feed) {
        AsyncValue(hasValue: true, :final value?) when value.items.isNotEmpty => [
            SliverList.separated(
              itemCount: value.items.length,
              separatorBuilder: (_, _) => Divider(indent: 60, color: c.border),
              itemBuilder: (context, i) => TransactionTile(tx: value.items[i], showShared: false, onTap: () => context.push('/transaction/${value.items[i].id}')),
            ),
          ],
        AsyncValue(hasValue: true) => [
            const SliverToBoxAdapter(
              child: EmptyState(icon: Icons.home_outlined, title: 'Nothing shared yet', body: 'Mark a grocery run or a bill as shared and it shows up here for everyone.'),
            ),
          ],
        AsyncValue(hasError: true) => [SliverToBoxAdapter(child: ErrorCard(message: "Couldn't load shared purchases.", onRetry: () => ref.invalidate(feedProvider)))],
        _ => [const SliverToBoxAdapter(child: LoadingBlock())],
      },
    ];
  }
}

class _HouseholdHeader extends ConsumerWidget {
  const _HouseholdHeader({required this.household, required this.busy, required this.error, required this.run});
  final Household household;
  final String? busy;
  final String? error;
  final Future<void> Function(String, Future<void> Function(TallyApi)) run;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = context.colors;
    final me = ref.watch(currentUserProvider);
    final h = household;

    Future<void> copy(String text, String toast) async {
      await Clipboard.setData(ClipboardData(text: text));
      if (context.mounted) showToast(context, toast);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TabHeader(
          eyebrow: 'Household',
          title: h.name,
          trailing: TextButton(
            onPressed: () async {
              final ok = await confirm(context,
                  title: 'Leave household?',
                  body: 'Your purchases stay yours; they just stop appearing in the shared view.',
                  confirmLabel: 'Leave',
                  cancelLabel: 'Stay',
                  destructive: true);
              if (ok) await run('leave', (api) => api.leaveHousehold());
            },
            child: Text('Leave', style: TextStyles.heading.copyWith(color: c.danger)),
          ),
        ),
        AppCard(
          tone: CardTone.accent,
          padding: const EdgeInsets.all(Space.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(child: Text('INVITE CODE', style: TextStyles.micro.copyWith(color: c.inkMuted))),
                  if (me?.isHouseholdOwner ?? false)
                    TextButton.icon(
                      onPressed: busy != null ? null : () => run('rotate', (api) => api.rotateInvite()),
                      icon: Icon(Icons.refresh_rounded, size: 16, color: c.accent),
                      label: Text('New code', style: TextStyles.caption.copyWith(color: c.accent, fontWeight: FontWeight.w700)),
                    ),
                ],
              ),
              FittedBox(
                alignment: Alignment.centerLeft,
                fit: BoxFit.scaleDown,
                child: SelectableText(h.inviteCode, style: TextStyles.display.copyWith(color: c.ink, letterSpacing: 3)),
              ),
              const SizedBox(height: Space.md),
              ButtonPair(
                first: AppButton(label: 'Copy code', icon: Icons.copy_rounded, kind: ButtonKind.secondary, small: true, onPressed: () => copy(h.inviteCode, 'Invite code copied')),
                second: AppButton(
                  label: 'Copy invite',
                  icon: Icons.ios_share_rounded,
                  small: true,
                  onPressed: () => copy('Join our household on TapNTally with code ${h.inviteCode}', 'Invite message copied — paste it anywhere'),
                ),
              ),
            ],
          ),
        ),
        SectionHeader(title: 'Members · ${h.members.length}'),
        Wrap(
          spacing: Space.xs,
          runSpacing: Space.xs,
          children: [
            for (final m in h.members)
              Container(
                padding: const EdgeInsets.fromLTRB(6, 6, 12, 6),
                decoration: BoxDecoration(color: c.surface, border: Border.all(color: c.border), borderRadius: BorderRadius.circular(Radii.pill)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    InitialAvatar(name: m.name, size: 28, filled: true),
                    const SizedBox(width: Space.xs),
                    Flexible(
                      child: Text('${m.name}${m.userId == me?.id ? ' (you)' : ''}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.caption.copyWith(color: c.ink)),
                    ),
                    if (m.role == 'owner') ...[const SizedBox(width: 6), Sticker(label: 'owner', color: c.inkMuted, filled: false)],
                  ],
                ),
              ),
          ],
        ),
        if (error != null) ...[const SizedBox(height: Space.sm), ErrorCard(message: error!)],
      ],
    );
  }
}
