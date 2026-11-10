import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/dates.dart';
import '../../core/money.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../widgets/domain.dart';
import '../widgets/kit.dart';
import '../widgets/pages.dart';

const _methods = [PaymentMethod.upi, PaymentMethod.card, PaymentMethod.cash, PaymentMethod.netBanking, PaymentMethod.wallet];

/// Every purchase is editable; auto-categorisation is a first guess with a visible review nudge.
class TransactionScreen extends ConsumerWidget {
  const TransactionScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tx = ref.watch(transactionProvider(id));
    return switch (tx) {
      AsyncData(:final value) => _Editor(key: ValueKey(value.id), tx: value),
      AsyncError() => Scaffold(
          appBar: AppBar(title: const Text('Purchase')),
          body: PageWidth(child: Padding(padding: const EdgeInsets.only(top: Space.md), child: ErrorCard(message: "Couldn't load this purchase.", onRetry: () => ref.invalidate(transactionProvider(id))))),
        ),
      _ => Scaffold(appBar: AppBar(title: const Text('Purchase')), body: const LoadingBlock()),
    };
  }
}

class _Editor extends ConsumerStatefulWidget {
  const _Editor({super.key, required this.tx});
  final Transaction tx;

  @override
  ConsumerState<_Editor> createState() => _EditorState();
}

class _EditorState extends ConsumerState<_Editor> {
  late String _categoryId = widget.tx.categoryId;
  late bool _shared = widget.tx.isShared;
  late PaymentMethod _method = widget.tx.paymentMethod;
  late final _tags = TextEditingController(text: widget.tx.tags.join(', '));
  late final _notes = TextEditingController(text: widget.tx.notes ?? '');
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _tags.dispose();
    _notes.dispose();
    super.dispose();
  }

  List<String> get _tagList => _tags.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();

  bool get _dirty {
    final t = widget.tx;
    return _categoryId != t.categoryId ||
        _shared != t.isShared ||
        _method != t.paymentMethod ||
        _tagList.join(',') != t.tags.join(',') ||
        _notes.text.trim() != (t.notes ?? '');
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    final nav = Navigator.of(context);
    try {
      final notes = _notes.text.trim();
      await ref.read(apiProvider).updateTransaction(
            widget.tx.id,
            categoryId: _categoryId != widget.tx.categoryId ? _categoryId : null,
            isShared: _shared,
            tags: _tagList,
            notes: notes.isEmpty ? null : notes,
            clearNotes: notes.isEmpty,
            paymentMethod: _method,
          );
      invalidateSpend(ref);
      if (mounted) showToast(context, 'Purchase updated');
      nav.pop();
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e, 'Could not save.'));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  bool _confirming = false;

  /// Accept the auto-assigned category: PATCHing the same categoryId marks it confirmed.
  Future<void> _confirmGuess() async {
    setState(() => _confirming = true);
    try {
      await ref.read(apiProvider).updateTransaction(widget.tx.id, categoryId: widget.tx.categoryId);
      invalidateSpend(ref);
      if (mounted) showToast(context, 'Category confirmed');
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e, 'Could not confirm.'));
    } finally {
      if (mounted) setState(() => _confirming = false);
    }
  }

  Future<void> _delete() async {
    final nav = Navigator.of(context);
    final ok = await confirm(context, title: 'Delete this purchase?', body: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true);
    if (!ok) return;
    try {
      await ref.read(apiProvider).deleteTransaction(widget.tx.id);
      invalidateSpend(ref);
      nav.pop();
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e, 'Could not delete.'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final d = widget.tx;
    final me = ref.watch(currentUserProvider);
    final mine = d.userId == me?.id;
    final color = catColor(context, d.category);

    return FormPage(
      title: d.merchant,
      appBarActions: [
        if (mine) IconButton(tooltip: 'Delete purchase', onPressed: _delete, icon: Icon(Icons.delete_outline_rounded, color: c.danger)),
      ],
      actions: mine ? [AppButton(label: 'Save changes', loading: _saving, onPressed: _dirty ? _save : null)] : null,
      children: [
        AppCard(
          padding: const EdgeInsets.symmetric(horizontal: Space.lg, vertical: Space.xl),
          child: Column(
            children: [
              CategoryTile(slug: d.category.slug, color: color, size: 60),
              const SizedBox(height: Space.sm),
              FittedBox(fit: BoxFit.scaleDown, child: Text(formatPaise(d.amountPaise), style: TextStyles.hero.copyWith(color: c.ink))),
              const SizedBox(height: Space.xxs),
              Text(d.merchant, textAlign: TextAlign.center, style: TextStyles.heading.copyWith(color: c.ink)),
              Text(friendlyDate(d.occurredAt), style: TextStyles.caption.copyWith(color: c.inkMuted)),
              const SizedBox(height: Space.sm),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 6,
                runSpacing: 6,
                children: [
                  Sticker(label: d.source.label, color: c.inkMuted, filled: false),
                  if (d.source == TransactionSource.nfc) Sticker(label: 'itemised', color: c.money),
                  if (d.isShared) Sticker(label: 'shared', color: c.pop),
                ],
              ),
            ],
          ),
        ),
        if (d.needsReview && mine) ...[
          const SizedBox(height: Space.sm),
          AppCard(
            tone: CardTone.accent,
            child: Row(
              children: [
                Icon(Icons.help_outline_rounded, color: c.accent),
                const SizedBox(width: Space.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Is “${d.category.name}” right?', style: TextStyles.heading.copyWith(color: c.ink)),
                      Text('We guessed this one. Confirm it, or pick another category below.', style: TextStyles.caption.copyWith(color: c.inkMuted)),
                      const SizedBox(height: Space.xs),
                      AppButton(
                        label: 'Yes, that’s right',
                        icon: Icons.check_rounded,
                        small: true,
                        expand: false,
                        loading: _confirming,
                        onPressed: _confirming ? null : _confirmGuess,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
        if (d.items.isNotEmpty) ...[
          SectionHeader(title: 'Items · ${d.items.length}'),
          AppCard(
            child: Column(
              children: [
                for (final it in d.items)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 5),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text.rich(
                            TextSpan(children: [TextSpan(text: it.name), TextSpan(text: '  × ${it.qtyLabel}', style: TextStyle(color: c.inkMuted))]),
                            style: TextStyles.body.copyWith(color: c.ink),
                          ),
                        ),
                        const SizedBox(width: Space.sm),
                        Text(formatPaise(it.totalPaise), style: TextStyles.money.copyWith(color: c.ink)),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
        if (!mine)
          Padding(
            padding: const EdgeInsets.only(top: Space.lg),
            child: Text('Shared by a household member — only they can edit it.', textAlign: TextAlign.center, style: TextStyles.caption.copyWith(color: c.inkMuted)),
          )
        else ...[
          const SectionHeader(title: 'Category'),
          CategoryPicker(value: _categoryId, onChanged: (cat) => setState(() => _categoryId = cat.id)),
          const SectionHeader(title: 'Paid with'),
          Wrap(
            spacing: Space.xs,
            runSpacing: Space.xs,
            children: [for (final m in _methods) TallyChip(label: m.label, selected: _method == m, onTap: () => setState(() => _method = m))],
          ),
          const SectionHeader(title: 'Share with household'),
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: Space.md, vertical: Space.xs),
            child: SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _shared,
              onChanged: me?.householdId == null && !_shared ? null : (v) => setState(() => _shared = v),
              title: Text(_shared ? 'Shared' : 'Personal', style: TextStyles.heading.copyWith(color: c.ink)),
              subtitle: Text(
                me?.householdId != null ? 'Shared purchases count toward household budgets.' : 'Join a household on the Family tab to share.',
                style: TextStyles.caption.copyWith(color: c.inkMuted),
              ),
            ),
          ),
          const SectionHeader(title: 'Notes & tags'),
          LabeledField(
            label: 'Tags',
            hint: 'Separate with commas',
            child: TextField(
              controller: _tags,
              onChanged: (_) => setState(() {}),
              style: TextStyles.body.copyWith(color: c.ink),
              decoration: const InputDecoration(hintText: 'office, weekend, gift'),
            ),
          ),
          const SizedBox(height: Space.md),
          LabeledField(
            label: 'Notes',
            child: TextField(
              controller: _notes,
              onChanged: (_) => setState(() {}),
              minLines: 3,
              maxLines: 6,
              style: TextStyles.body.copyWith(color: c.ink),
              decoration: const InputDecoration(hintText: 'Anything worth remembering'),
            ),
          ),
          if (_error != null) ...[const SizedBox(height: Space.md), ErrorCard(message: _error!)],
        ],
      ],
    );
  }
}
