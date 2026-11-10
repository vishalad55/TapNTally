import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../data/api.dart';
import '../../state/providers.dart';
import '../widgets/brand.dart';
import '../widgets/kit.dart';

/// Demo sign-in against the backend (AUTH_DEV_LOGIN), plus an offline demo
/// that needs no server at all — handy for pitches with bad Wi-Fi.
class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _email = TextEditingController(text: 'demo@tapntally.app');
  String? _busy;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _run(String key, Future<void> Function() fn) async {
    setState(() {
      _busy = key;
      _error = null;
    });
    try {
      await fn();
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final session = ref.read(sessionProvider.notifier);
    return Scaffold(
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, box) => SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: box.maxHeight),
              child: PageWidth(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Align(alignment: Alignment.centerRight, child: Padding(padding: EdgeInsets.only(top: Space.xs), child: ThemeToggle())),
                    const SizedBox(height: Space.lg),
                    const Align(alignment: Alignment.centerLeft, child: BrandMark(size: 68)),
                    const SizedBox(height: Space.lg),
                    Text.rich(
                      TextSpan(children: [
                        const TextSpan(text: 'Tap.\nTally.\n'),
                        TextSpan(text: 'Done.', style: TextStyle(color: c.accent)),
                      ]),
                      style: TextStyles.hero.copyWith(color: c.ink),
                    ),
                    const SizedBox(height: Space.sm),
                    Text(
                      'Tap your phone after you pay. The bill files itself — categorised, budgeted, shared with the household if you like.',
                      style: TextStyles.body.copyWith(color: c.inkMuted, fontSize: 16),
                    ),
                    const SizedBox(height: Space.xl),
                    AppCard(
                      padding: const EdgeInsets.all(Space.lg),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text('DEMO ACCOUNT', style: TextStyles.micro.copyWith(color: c.inkMuted)),
                          const SizedBox(height: Space.sm),
                          TextField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            autocorrect: false,
                            textInputAction: TextInputAction.go,
                            onSubmitted: (_) => _run('dev', () => session.signInDev(_email.text.trim())),
                            style: TextStyles.body.copyWith(color: c.ink),
                            decoration: const InputDecoration(hintText: 'you@example.com', prefixIcon: Icon(Icons.alternate_email_rounded, size: 20)),
                          ),
                          const SizedBox(height: Space.sm),
                          AppButton(
                            label: 'Continue',
                            icon: Icons.arrow_forward_rounded,
                            loading: _busy == 'dev',
                            onPressed: _busy != null ? null : () => _run('dev', () => session.signInDev(_email.text.trim())),
                          ),
                          const SizedBox(height: Space.sm),
                          Text(
                            'Try demo@tapntally.app or priya@tapntally.app — a seeded household with two months of purchases.',
                            style: TextStyles.caption.copyWith(color: c.inkFaint),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: Space.sm),
                    AppButton(
                      label: 'Explore offline instead',
                      icon: Icons.wifi_off_rounded,
                      kind: ButtonKind.ghost,
                      loading: _busy == 'demo',
                      onPressed: _busy != null ? null : () => _run('demo', session.exploreDemo),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: Space.sm),
                      ErrorCard(message: _error!),
                    ],
                    const SizedBox(height: Space.xl),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
