import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform, kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/dates.dart';
import '../../core/theme.dart';
import '../../data/api.dart';
import '../../data/models.dart';
import '../../state/providers.dart';
import '../widgets/kit.dart';
import '../widgets/pages.dart';

bool get _isAndroid => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

/// Online orders don't come through a terminal, so we read confirmations instead — narrowly.
class ConnectionsScreen extends ConsumerStatefulWidget {
  const ConnectionsScreen({super.key});

  @override
  ConsumerState<ConnectionsScreen> createState() => _ConnectionsScreenState();
}

class _ConnectionsScreenState extends ConsumerState<ConnectionsScreen> {
  String? _busy;
  String? _error;

  Future<void> _run(String key, Future<void> Function(TallyApi api) fn) async {
    setState(() {
      _busy = key;
      _error = null;
    });
    try {
      await fn(ref.read(apiProvider));
      ref.invalidate(connectionsProvider);
    } catch (e) {
      if (mounted) setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final conns = ref.watch(connectionsProvider);
    return FormPage(
      title: 'Connections',
      children: [
        Text("Online orders don't come through a terminal, so we read the confirmations instead — narrowly.", style: TextStyles.body.copyWith(color: c.inkMuted)),
        const SizedBox(height: Space.md),
        AsyncView(
          value: conns,
          onRetry: () => ref.invalidate(connectionsProvider),
          errorMessage: "Couldn't load connections.",
          builder: (list) {
            final gmail = list.where((x) => x.type == ConnectionType.gmail).firstOrNull;
            final sms = list.where((x) => x.type == ConnectionType.sms).firstOrNull;
            final gmailOn = gmail != null && gmail.status != ConnectionStatus.disconnected;
            final smsOn = sms?.status == ConnectionStatus.active;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _ConnectionCard(
                  icon: Icons.mail_outline_rounded,
                  title: 'Gmail',
                  conn: gmail,
                  trust:
                      'We search only for order confirmations and invoices from known shops (Amazon, Flipkart, Myntra, Swiggy…). Emails are parsed and discarded — never stored, never read by a person. Read-only; disconnect any time.',
                  actions: gmailOn
                      ? Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            AppButton(
                              label: 'Sync now',
                              icon: Icons.sync_rounded,
                              kind: ButtonKind.secondary,
                              loading: _busy == 'gmail-sync',
                              onPressed: _busy != null ? null : () => _run('gmail-sync', (api) => api.syncGmail()),
                            ),
                            const SizedBox(height: Space.xxs),
                            AppButton(
                              label: 'Disconnect',
                              kind: ButtonKind.ghost,
                              onPressed: _busy != null
                                  ? null
                                  : () async {
                                      final ok = await confirm(context,
                                          title: 'Disconnect Gmail?',
                                          body: 'We stop scanning immediately and delete our access token. Purchases already imported stay.',
                                          confirmLabel: 'Disconnect',
                                          cancelLabel: 'Keep',
                                          destructive: true);
                                      if (ok) await _run('gmail-off', (api) => api.disconnectGmail());
                                    },
                            ),
                          ],
                        )
                      : const _Note(text: 'Connecting a new Gmail account needs Google sign-in, which is configured per build. Accounts linked from the existing app keep syncing here.'),
                ),
                const SizedBox(height: Space.sm),
                _ConnectionCard(
                  icon: Icons.sms_outlined,
                  title: 'SMS',
                  conn: sms,
                  trust: _isAndroid
                      ? 'We look only at bank and merchant payment alerts (sender IDs like VM-HDFCBK). Messages are parsed and never stored — just the amount and merchant.'
                      : 'iOS and the web don’t let apps read SMS, so this is Android-only. Gmail and tap-to-bill cover most purchases elsewhere.',
                  actions: !_isAndroid
                      ? null
                      : smsOn
                          ? AppButton(
                              label: 'Stop reading SMS',
                              kind: ButtonKind.secondary,
                              loading: _busy == 'sms',
                              onPressed: _busy != null ? null : () => _run('sms', (api) => api.disableSms()),
                            )
                          : AppButton(
                              label: 'Allow SMS access',
                              loading: _busy == 'sms',
                              onPressed: _busy != null ? null : () => _run('sms', (api) => api.enableSms()),
                            ),
                ),
              ],
            );
          },
        ),
        if (_error != null) ...[const SizedBox(height: Space.md), ErrorCard(message: _error!)],
      ],
    );
  }
}

class _ConnectionCard extends StatelessWidget {
  const _ConnectionCard({required this.icon, required this.title, required this.conn, required this.trust, this.actions});
  final IconData icon;
  final String title;
  final Connection? conn;
  final String trust;
  final Widget? actions;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final status = conn?.status ?? ConnectionStatus.disconnected;
    final color = switch (status) {
      ConnectionStatus.active => c.money,
      ConnectionStatus.backfilling => c.warn,
      ConnectionStatus.needsReauth || ConnectionStatus.error => c.danger,
      ConnectionStatus.disconnected => c.inkMuted,
    };
    final meta = [
      if (conn != null && status != ConnectionStatus.disconnected) '${conn!.importedCount} purchase${conn!.importedCount == 1 ? '' : 's'} imported',
      if (conn?.lastSyncedAt != null) 'synced ${relativeTime(conn!.lastSyncedAt!)}',
    ].join(' · ');

    return AppCard(
      padding: const EdgeInsets.all(Space.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(Radii.md)),
                child: Icon(icon, color: c.ink),
              ),
              const SizedBox(width: Space.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: TextStyles.title.copyWith(color: c.ink)),
                    const SizedBox(height: 2),
                    Sticker(label: status.label, color: color, filled: false),
                  ],
                ),
              ),
            ],
          ),
          if (meta.isNotEmpty) ...[const SizedBox(height: Space.sm), Text(meta, style: TextStyles.caption.copyWith(color: c.inkMuted))],
          if (conn?.lastError != null) ...[const SizedBox(height: 4), Text('Last error: ${conn!.lastError}', style: TextStyles.caption.copyWith(color: c.danger))],
          const SizedBox(height: Space.sm),
          Container(
            padding: const EdgeInsets.all(Space.sm),
            decoration: BoxDecoration(color: c.surfaceAlt, borderRadius: BorderRadius.circular(Radii.md)),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.lock_outline_rounded, size: 16, color: c.inkMuted),
                const SizedBox(width: Space.xs),
                Expanded(child: Text(trust, style: TextStyles.caption.copyWith(color: c.ink))),
              ],
            ),
          ),
          if (actions != null) ...[const SizedBox(height: Space.md), actions!],
        ],
      ),
    );
  }
}

class _Note extends StatelessWidget {
  const _Note({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Text(text, style: TextStyles.caption.copyWith(color: context.colors.inkFaint));
}
