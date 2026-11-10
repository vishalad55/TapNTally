import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

import '../core/money.dart';
import '../core/theme.dart';
import '../data/api.dart';
import '../data/models.dart';
import '../data/nfc.dart';
import '../state/providers.dart';
import 'widgets/kit.dart';

const _titles = {
  NfcReadStatus.noTagFound: "Didn't catch the bill",
  NfcReadStatus.unsupportedTerminal: 'Terminal not supported yet',
  NfcReadStatus.malformedBill: "Couldn't read that bill",
  NfcReadStatus.nfcUnavailable: 'NFC is off',
};

/// The whole tap journey:
///   scanning sheet → read → POST /nfc/bills → receipt sheet → back on Home.
/// Failures land in a small sheet with a retry, never a full-screen error.
Future<void> startTap(BuildContext context, WidgetRef ref) async {
  final nav = Navigator.of(context, rootNavigator: true);
  final router = GoRouter.of(context);
  final reader = await ref.read(nfcReaderResolverProvider)();
  final phase = ValueNotifier<_Phase>(_Phase.scanning);
  var sheetOpen = true;
  unawaited(HapticFeedback.mediumImpact());

  if (!nav.mounted) return;
  final scanning = showModalBottomSheet<void>(
    context: nav.context,
    useRootNavigator: true,
    useSafeArea: true,
    builder: (_) => _ScanningSheet(phase: phase, isMock: reader.isMock, onCancel: () => nav.pop()),
  ).whenComplete(() {
    sheetOpen = false;
    if (phase.value == _Phase.scanning) unawaited(reader.cancel());
  });
  unawaited(scanning);

  void closeScanning() {
    if (sheetOpen) nav.pop();
  }

  final result = await reader.read();
  if (result.status == NfcReadStatus.cancelled || !sheetOpen) {
    closeScanning();
    return;
  }
  if (result.status != NfcReadStatus.success) {
    closeScanning();
    unawaited(HapticFeedback.heavyImpact());
    if (!nav.mounted) return;
    return _showError(
      nav,
      router,
      ref,
      title: _titles[result.status]!,
      message: result.message,
      details: result.errors,
      retryable: result.status != NfcReadStatus.nfcUnavailable && result.status != NfcReadStatus.unsupportedTerminal,
    );
  }

  phase.value = _Phase.posting;
  try {
    final res = await ref.read(apiProvider).ingestNfcBill(result.bill!, const Uuid().v4());
    invalidateSpend(ref);
    closeScanning();
    unawaited(HapticFeedback.lightImpact());
    if (!nav.mounted) return;
    await showModalBottomSheet<void>(
      context: nav.context,
      useRootNavigator: true,
      useSafeArea: true,
      isScrollControlled: true,
      showDragHandle: false,
      builder: (_) => ReceiptSheet(
        tx: res.transaction,
        verified: res.signatureVerified,
        duplicate: !res.created,
        onEdit: () {
          nav.pop();
          router.push('/transaction/${res.transaction.id}');
        },
      ),
    );
    router.go('/');
  } catch (e) {
    closeScanning();
    if (!nav.mounted) return;
    final api = e is ApiException ? e : null;
    return _showError(
      nav,
      router,
      ref,
      title: api?.code == 'NFC_MALFORMED_BILL' ? "Couldn't read that bill" : "Couldn't save the bill",
      message: friendlyError(e, 'Please try again.'),
      details: api?.detailErrors ?? const [],
      retryable: true,
    );
  }
}

enum _Phase { scanning, posting }

Future<void> _showError(NavigatorState nav, GoRouter router, WidgetRef ref,
    {required String title, required String message, required List<String> details, required bool retryable}) async {
  final next = await showModalBottomSheet<String>(
    context: nav.context,
    useRootNavigator: true,
    useSafeArea: true,
    builder: (ctx) {
      final c = ctx.colors;
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(Space.xl, 0, Space.xl, Space.xl),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(color: c.warn.withValues(alpha: 0.16), shape: BoxShape.circle),
                  child: Icon(Icons.error_outline_rounded, color: c.warn),
                ),
                const SizedBox(width: Space.sm),
                Expanded(child: Text(title, style: TextStyles.title.copyWith(color: c.ink))),
              ],
            ),
            const SizedBox(height: Space.sm),
            Text(message, style: TextStyles.body.copyWith(color: c.inkMuted)),
            if (details.isNotEmpty) ...[
              const SizedBox(height: Space.xs),
              Text(details.take(3).join(' · '), style: TextStyles.caption.copyWith(color: c.inkFaint)),
            ],
            const SizedBox(height: Space.lg),
            if (retryable)
              ButtonPair(
                first: AppButton(label: 'Not now', kind: ButtonKind.secondary, onPressed: () => Navigator.pop(ctx)),
                second: AppButton(label: 'Tap again', icon: Icons.contactless_outlined, onPressed: () => Navigator.pop(ctx, 'retry')),
              )
            else
              AppButton(label: 'Not now', kind: ButtonKind.secondary, onPressed: () => Navigator.pop(ctx)),
            if (!retryable) ...[
              const SizedBox(height: Space.xs),
              AppButton(label: 'Use a pairing code instead', kind: ButtonKind.ghost, onPressed: () => Navigator.pop(ctx, 'pair')),
              AppButton(label: 'Add it manually instead', kind: ButtonKind.ghost, onPressed: () => Navigator.pop(ctx, 'add')),
            ],
          ],
        ),
      );
    },
  );
  switch (next) {
    case 'retry':
      if (nav.mounted) return startTap(nav.context, ref);
    case 'pair':
      router.push('/pair');
    case 'add':
      router.push('/add');
  }
}

class _ScanningSheet extends StatelessWidget {
  const _ScanningSheet({required this.phase, required this.isMock, required this.onCancel});
  final ValueNotifier<_Phase> phase;
  final bool isMock;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return ValueListenableBuilder<_Phase>(
      valueListenable: phase,
      builder: (context, p, _) => SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(Space.xl, 0, Space.xl, Space.xl),
        child: Column(
          children: [
            _Pulse(active: p == _Phase.scanning, child: p == _Phase.posting
                ? SizedBox.square(dimension: 40, child: CircularProgressIndicator(strokeWidth: 3, color: c.accent))
                : Icon(Icons.contactless_outlined, size: 48, color: c.accent)),
            const SizedBox(height: Space.lg),
            Text(p == _Phase.posting ? 'Filing your bill' : 'Hold near the terminal', textAlign: TextAlign.center, style: TextStyles.title.copyWith(color: c.ink)),
            const SizedBox(height: Space.xs),
            Text(
              p == _Phase.posting
                  ? 'Categorising it and updating your month.'
                  : isMock
                      ? 'Demo terminal — simulating a tap.'
                      : 'Keep your phone still against the contactless mark on the terminal.',
              textAlign: TextAlign.center,
              style: TextStyles.body.copyWith(color: c.inkMuted),
            ),
            const SizedBox(height: Space.lg),
            if (p == _Phase.scanning) AppButton(label: 'Cancel', kind: ButtonKind.secondary, onPressed: onCancel),
          ],
        ),
      ),
    );
  }
}

/// Soft expanding halo behind the scanning glyph.
class _Pulse extends StatefulWidget {
  const _Pulse({required this.active, required this.child});
  final bool active;
  final Widget child;

  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1300))..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return SizedBox.square(
      dimension: 120,
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (widget.active)
            AnimatedBuilder(
              animation: _c,
              builder: (_, _) => Transform.scale(
                scale: 1 + _c.value * 0.45,
                child: Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: c.accent.withValues(alpha: 0.28 * (1 - _c.value))),
                ),
              ),
            ),
          Container(
            width: 96,
            height: 96,
            alignment: Alignment.center,
            decoration: BoxDecoration(shape: BoxShape.circle, color: c.accentSoft),
            child: widget.child,
          ),
        ],
      ),
    );
  }
}

/// Post-tap receipt: itemised bill behind a draining timer; auto-closes after
/// ~5.5 s. Tap "Done" to close early, "Edit category" to jump to the purchase.
class ReceiptSheet extends StatefulWidget {
  const ReceiptSheet({super.key, required this.tx, required this.verified, required this.duplicate, required this.onEdit, this.duration = const Duration(milliseconds: 5500)});
  final Transaction tx;
  final bool verified;
  final bool duplicate;
  final VoidCallback onEdit;
  final Duration duration;

  @override
  State<ReceiptSheet> createState() => _ReceiptSheetState();
}

class _ReceiptSheetState extends State<ReceiptSheet> with SingleTickerProviderStateMixin {
  late final AnimationController _drain = AnimationController(vsync: this, duration: widget.duration)
    ..forward()
    ..addStatusListener((s) {
      if (s == AnimationStatus.completed && mounted) Navigator.of(context).maybePop();
    });

  @override
  void dispose() {
    _drain.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final tx = widget.tx;
    final maxH = MediaQuery.sizeOf(context).height * 0.82;
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxH),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(Radii.xl)),
            child: AnimatedBuilder(
              animation: _drain,
              builder: (_, _) => LinearProgressIndicator(value: 1 - _drain.value, minHeight: 4, backgroundColor: c.surfaceAlt, color: c.accent),
            ),
          ),
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(Space.xl, Space.lg, Space.xl, Space.sm),
                child: Row(
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(color: c.money.withValues(alpha: 0.15), shape: BoxShape.circle),
                      child: Icon(Icons.check_rounded, color: c.money, size: 26),
                    ),
                    const SizedBox(width: Space.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(widget.duplicate ? 'Already filed' : 'Bill received', style: TextStyles.title.copyWith(color: c.ink)),
                          Text('Filed under ${tx.category.name}', maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyles.caption.copyWith(color: c.inkMuted)),
                        ],
                      ),
                    ),
                    const SizedBox(width: Space.xs),
                    Sticker(label: widget.verified ? 'verified' : 'unverified', color: widget.verified ? c.money : c.inkFaint),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Space.xl),
                child: _Dashed(color: c.border),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(Space.xl, Space.sm, Space.xl, 0),
                child: Text(tx.merchant, style: TextStyles.heading.copyWith(color: c.ink)),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Space.xl, vertical: Space.xs),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (tx.items.isEmpty) Text('No line items on this bill.', style: TextStyles.caption.copyWith(color: c.inkMuted)),
                    for (final it in tx.items)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 5),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text.rich(
                                TextSpan(children: [TextSpan(text: it.name), TextSpan(text: '  × ${it.qtyLabel}', style: TextStyle(color: c.inkMuted))]),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
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
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Space.xl),
                child: _Dashed(color: c.border),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(Space.xl, Space.sm, Space.xl, Space.md),
                child: Row(
                  children: [
                    Text('Total', style: TextStyles.heading.copyWith(color: c.ink)),
                    const SizedBox(width: Space.sm),
                    Expanded(
                      child: FittedBox(
                        alignment: Alignment.centerRight,
                        fit: BoxFit.scaleDown,
                        child: Text(formatPaise(tx.amountPaise), style: TextStyles.display.copyWith(color: c.ink)),
                      ),
                    ),
                  ],
                ),
              ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(Space.xl, 0, Space.xl, Space.lg),
            child: ButtonPair(
              first: AppButton(label: 'Edit category', kind: ButtonKind.secondary, onPressed: widget.onEdit),
              second: AppButton(label: 'Done', onPressed: () => Navigator.of(context).pop()),
            ),
          ),
        ],
      ),
    );
  }
}

class _Dashed extends StatelessWidget {
  const _Dashed({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, box) {
        final n = (box.maxWidth / 8).floor();
        return Row(
          children: List.generate(n, (_) => Expanded(child: Container(height: 1, margin: const EdgeInsets.symmetric(horizontal: 2), color: color))),
        );
      });
}
