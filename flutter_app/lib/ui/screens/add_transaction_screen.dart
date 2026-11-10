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

/// Manual entry — the fallback for cash at a stall that can't tap.
/// Category is optional: leave it and the server guesses.
class AddTransactionScreen extends ConsumerStatefulWidget {
  const AddTransactionScreen({super.key});

  @override
  ConsumerState<AddTransactionScreen> createState() => _AddTransactionScreenState();
}

class _AddTransactionScreenState extends ConsumerState<AddTransactionScreen> {
  final _amount = TextEditingController();
  final _merchant = TextEditingController();
  String? _categoryId;
  PaymentMethod _method = PaymentMethod.upi;
  bool _shared = false;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _amount.dispose();
    _merchant.dispose();
    super.dispose();
  }

  int? get _paise => parseRupeeInput(_amount.text);
  bool get _valid => _merchant.text.trim().isNotEmpty && (_paise ?? 0) > 0;

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    final nav = Navigator.of(context);
    try {
      await ref.read(apiProvider).createTransaction(
            merchant: _merchant.text.trim(),
            amountPaise: _paise!,
            categoryId: _categoryId,
            paymentMethod: _method,
            isShared: _shared,
          );
      invalidateSpend(ref);
      if (mounted) showToast(context, 'Purchase added');
      nav.pop();
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e, 'Could not save.'));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final me = ref.watch(currentUserProvider);
    return FormPage(
      title: 'Add a purchase',
      actions: [AppButton(label: 'Add purchase', loading: _saving, onPressed: _valid ? _save : null)],
      children: [
        AppCard(
          padding: const EdgeInsets.all(Space.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('AMOUNT', style: TextStyles.micro.copyWith(color: c.inkFaint)),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Text('₹', style: TextStyles.hero.copyWith(color: c.inkMuted)),
                  const SizedBox(width: Space.xs),
                  Expanded(
                    child: TextField(
                      controller: _amount,
                      autofocus: true,
                      onChanged: (_) => setState(() {}),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]'))],
                      style: TextStyles.hero.copyWith(color: c.ink),
                      decoration: InputDecoration(
                        hintText: '0',
                        hintStyle: TextStyles.hero.copyWith(color: c.inkFaint),
                        filled: false,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: Space.xs),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: Space.sm),
              LabeledField(
                label: 'Where?',
                child: TextField(
                  controller: _merchant,
                  onChanged: (_) => setState(() {}),
                  textCapitalization: TextCapitalization.words,
                  style: TextStyles.body.copyWith(color: c.ink),
                  decoration: const InputDecoration(hintText: 'e.g. Corner tea stall', prefixIcon: Icon(Icons.storefront_outlined, size: 20)),
                ),
              ),
            ],
          ),
        ),
        const SectionHeader(title: 'Paid with'),
        Wrap(
          spacing: Space.xs,
          runSpacing: Space.xs,
          children: [
            for (final m in const [PaymentMethod.upi, PaymentMethod.card, PaymentMethod.cash])
              TallyChip(label: m.label, selected: _method == m, onTap: () => setState(() => _method = m)),
          ],
        ),
        const SectionHeader(title: 'Category', eyebrow: 'Optional — we’ll guess'),
        CategoryPicker(value: _categoryId, onChanged: (cat) => setState(() => _categoryId = cat.id == _categoryId ? null : cat.id)),
        if (me?.householdId != null) ...[
          const SizedBox(height: Space.lg),
          AppCard(
            padding: const EdgeInsets.symmetric(horizontal: Space.md, vertical: Space.xs),
            child: SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _shared,
              onChanged: (v) => setState(() => _shared = v),
              title: Text('Share with household', style: TextStyles.heading.copyWith(color: c.ink)),
            ),
          ),
        ],
        if (_error != null) ...[const SizedBox(height: Space.md), ErrorCard(message: _error!)],
      ],
    );
  }
}
