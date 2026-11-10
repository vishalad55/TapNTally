import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../widgets/kit.dart';
import '../widgets/pages.dart';

/// Pairing code for terminals that can't write NFC: the cashier enters it and
/// the terminal posts the bill to this account. One code, one bill, five minutes.
class PairScreen extends ConsumerStatefulWidget {
  const PairScreen({super.key});

  @override
  ConsumerState<PairScreen> createState() => _PairScreenState();
}

class _PairScreenState extends ConsumerState<PairScreen> {
  PairingCode? _code;
  bool _loading = false;
  String? _error;
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _fetch();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) => mounted ? setState(() {}) : null);
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final code = await ref.read(apiProvider).pairingCode();
      if (mounted) setState(() => _code = code);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e, "Couldn't get a pairing code."));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final left = _code == null ? 0 : _code!.expiresAt.difference(DateTime.now()).inSeconds.clamp(0, 3600);
    final expired = _code != null && left == 0;
    final mm = (left ~/ 60).toString().padLeft(2, '0');
    final ss = (left % 60).toString().padLeft(2, '0');

    return FormPage(
      title: 'Pairing code',
      actions: [
        AppButton(
          label: expired ? 'Get a new code' : 'Refresh code',
          icon: Icons.refresh_rounded,
          kind: expired ? ButtonKind.primary : ButtonKind.secondary,
          loading: _loading,
          onPressed: _fetch,
        ),
      ],
      children: [
        Text('Show this code at the counter. The terminal sends the itemised bill straight to your account.', style: TextStyles.body.copyWith(color: c.inkMuted)),
        const SizedBox(height: Space.md),
        AppCard(
          padding: const EdgeInsets.symmetric(horizontal: Space.lg, vertical: Space.xxl),
          child: _error != null
              ? ErrorCard(message: _error!, onRetry: _fetch)
              : _code == null
                  ? const LoadingBlock(label: 'Getting a code')
                  : Column(
                      children: [
                        Text('PAIRING CODE', style: TextStyles.micro.copyWith(color: c.inkFaint)),
                        const SizedBox(height: Space.xs),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Opacity(
                            opacity: expired ? 0.35 : 1,
                            child: SelectableText(_code!.code, style: TextStyles.hero.copyWith(color: c.ink, letterSpacing: 8, fontSize: 44)),
                          ),
                        ),
                        const SizedBox(height: Space.sm),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.schedule_rounded, size: 16, color: expired ? c.danger : c.inkMuted),
                            const SizedBox(width: 6),
                            Flexible(child: Text(expired ? 'Expired' : 'Valid for $mm:$ss', style: TextStyles.caption.copyWith(color: expired ? c.danger : c.inkMuted))),
                          ],
                        ),
                      ],
                    ),
        ),
        const SectionHeader(title: 'How it works'),
        AppCard(
          tone: CardTone.alt,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _Step(n: 1, text: 'Pay as usual with card, UPI or cash.'),
              const _Step(n: 2, text: 'Read out or show this code; the cashier enters it on the terminal.'),
              const _Step(n: 3, text: 'The bill appears on your Home screen within a few seconds.'),
              Text('Each code works once and expires after five minutes. Terminals that support tap don’t need a code at all.', style: TextStyles.caption.copyWith(color: c.inkFaint)),
            ],
          ),
        ),
      ],
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({required this.n, required this.text});
  final int n;
  final String text;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    return Padding(
      padding: const EdgeInsets.only(bottom: Space.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 24,
            height: 24,
            alignment: Alignment.center,
            decoration: BoxDecoration(color: c.accent, shape: BoxShape.circle),
            child: Text('$n', style: TextStyles.micro.copyWith(color: c.accentInk)),
          ),
          const SizedBox(width: Space.sm),
          Expanded(child: Text(text, style: TextStyles.body.copyWith(color: c.ink))),
        ],
      ),
    );
  }
}
