import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/money.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../widgets/domain.dart';
import '../widgets/kit.dart';
import '../widgets/pages.dart';

const _minRupees = 500.0;
const _maxRupees = 50000.0;

class BudgetEditScreen extends ConsumerStatefulWidget {
  const BudgetEditScreen({super.key, this.existing, this.initialScope});
  final Budget? existing;
  final BudgetScope? initialScope;

  @override
  ConsumerState<BudgetEditScreen> createState() => _BudgetEditScreenState();
}

class _BudgetEditScreenState extends ConsumerState<BudgetEditScreen> {
  late BudgetScope _scope = widget.existing?.scope ?? widget.initialScope ?? BudgetScope.user;
  late String? _categoryId = widget.existing?.categoryId;
  late double _rupees = (widget.existing?.limitPaise ?? 500000) / 100;
  late BudgetPeriod _period = widget.existing?.period ?? BudgetPeriod.monthly;
  late final _amount = TextEditingController(text: _rupees.round().toString());
  bool _saving = false;
  String? _error;

  bool get _editing => widget.existing != null;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  void _setRupees(double v, {bool fromField = false}) {
    setState(() => _rupees = v);
    if (!fromField) _amount.text = v.round().toString();
  }

  Future<void> _save() async {
    if (_categoryId == null) {
      setState(() => _error = 'Pick a category first.');
      return;
    }
    if (_rupees < 1) {
      setState(() => _error = 'Set a limit above ₹0.');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    final nav = Navigator.of(context);
    try {
      await ref.read(apiProvider).upsertBudget(scope: _scope, categoryId: _categoryId!, limitPaise: rupeesToPaise(_rupees), period: _period);
      ref.invalidate(budgetsProvider);
      nav.pop();
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e, 'Could not save budget.'));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _remove() async {
    final nav = Navigator.of(context);
    final ok = await confirm(context, title: 'Remove budget?', body: 'You can always set it again.', confirmLabel: 'Remove', cancelLabel: 'Keep', destructive: true);
    if (!ok) return;
    try {
      await ref.read(apiProvider).deleteBudget(widget.existing!.id);
      ref.invalidate(budgetsProvider);
      nav.pop();
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final user = ref.watch(currentUserProvider);
    return FormPage(
      title: _editing ? 'Edit budget' : 'New budget',
      appBarActions: [
        if (_editing) IconButton(tooltip: 'Remove budget', onPressed: _remove, icon: Icon(Icons.delete_outline_rounded, color: c.danger)),
      ],
      actions: [AppButton(label: _editing ? 'Save changes' : 'Set budget', loading: _saving, onPressed: _categoryId == null ? null : _save)],
      children: [
        if (user?.householdId != null) ...[
          const SectionHeader(title: 'Who is this for?', top: Space.sm),
          Wrap(
            spacing: Space.xs,
            runSpacing: Space.xs,
            children: [
              TallyChip(label: 'Just me', icon: Icons.person_outline_rounded, selected: _scope == BudgetScope.user, onTap: () => setState(() => _scope = BudgetScope.user)),
              TallyChip(label: 'Household', icon: Icons.people_outline_rounded, selected: _scope == BudgetScope.household, onTap: () => setState(() => _scope = BudgetScope.household)),
            ],
          ),
        ],
        SectionHeader(title: 'Limit', top: user?.householdId != null ? Space.xl : Space.sm),
        AppCard(
          padding: const EdgeInsets.all(Space.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(formatPaise(rupeesToPaise(_rupees), decimals: false), style: TextStyles.hero.copyWith(color: c.ink)),
              ),
              Text('per ${_period == BudgetPeriod.weekly ? 'week' : 'month'}', textAlign: TextAlign.center, style: TextStyles.caption.copyWith(color: c.inkMuted)),
              const SizedBox(height: Space.sm),
              Slider(
                min: _minRupees,
                max: _maxRupees,
                divisions: ((_maxRupees - _minRupees) / 100).round(),
                value: _rupees.clamp(_minRupees, _maxRupees),
                label: formatPaise(rupeesToPaise(_rupees), decimals: false),
                onChanged: (v) => _setRupees(v),
              ),
              LabeledField(
                label: 'Or type an exact amount',
                child: TextField(
                  controller: _amount,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  onChanged: (v) => _setRupees(double.tryParse(v) ?? 0, fromField: true),
                  style: TextStyles.money.copyWith(color: c.ink),
                  decoration: const InputDecoration(prefixText: '₹ '),
                ),
              ),
            ],
          ),
        ),
        const SectionHeader(title: 'Period'),
        Wrap(
          spacing: Space.xs,
          runSpacing: Space.xs,
          children: [
            TallyChip(label: 'Monthly', selected: _period == BudgetPeriod.monthly, onTap: () => setState(() => _period = BudgetPeriod.monthly)),
            TallyChip(label: 'Weekly', selected: _period == BudgetPeriod.weekly, onTap: () => setState(() => _period = BudgetPeriod.weekly)),
          ],
        ),
        const SectionHeader(title: 'Category'),
        CategoryPicker(value: _categoryId, onChanged: (cat) => setState(() => _categoryId = cat.id)),
        if (_error != null) ...[const SizedBox(height: Space.md), ErrorCard(message: _error!)],
      ],
    );
  }
}
