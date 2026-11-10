import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/api.dart';
import '../data/demo_api.dart';
import '../data/http_api.dart';
import '../data/models.dart';
import '../data/nfc.dart';
import '../data/token_store.dart';

// ------------------------------------------------------------------ infra

/// Overridden in `main()` (real prefs) and in tests (mock prefs).
final sharedPrefsProvider = Provider<SharedPreferences>((ref) => throw UnimplementedError('override sharedPrefsProvider'));

final tokenStoreProvider = Provider<TokenStore>((ref) => SecureTokenStore());

/// Base URL for the live backend (overridable for tests / custom builds).
final apiBaseUrlProvider = Provider<String>((ref) => kDefaultApiUrl);

/// True while the person is exploring the offline demo instead of the server.
class DemoModeNotifier extends Notifier<bool> {
  @override
  bool build() => false;
  void set(bool v) => state = v;
}

final demoModeProvider = NotifierProvider<DemoModeNotifier, bool>(DemoModeNotifier.new);

/// A single demo backend per app run so edits survive navigation.
final demoApiProvider = Provider<DemoTallyApi>((ref) => DemoTallyApi());

final liveApiProvider = Provider<TallyApi>((ref) => HttpTallyApi(baseUrl: ref.watch(apiBaseUrlProvider), tokens: ref.watch(tokenStoreProvider)));

final apiProvider = Provider<TallyApi>((ref) => ref.watch(demoModeProvider) ? ref.watch(demoApiProvider) : ref.watch(liveApiProvider));

// -------------------------------------------------------------- appearance

class AppearanceNotifier extends Notifier<ThemeMode> {
  static const _key = 'tapntally.appearance';
  @override
  ThemeMode build() {
    final raw = ref.read(sharedPrefsProvider).getString(_key);
    return ThemeMode.values.firstWhere((m) => m.name == raw, orElse: () => ThemeMode.system);
  }

  void set(ThemeMode mode) {
    state = mode;
    unawaited(ref.read(sharedPrefsProvider).setString(_key, mode.name));
  }
}

final appearanceProvider = NotifierProvider<AppearanceNotifier, ThemeMode>(AppearanceNotifier.new);

// --------------------------------------------------------------------- NFC

enum NfcMode {
  auto('Auto'),
  real('Real NFC'),
  demo('Demo terminal');

  const NfcMode(this.label);
  final String label;
}

class NfcPrefs {
  const NfcPrefs(this.mode, this.scenario);
  final NfcMode mode;
  final DemoScenario scenario;
}

class NfcPrefsNotifier extends Notifier<NfcPrefs> {
  static const _modeKey = 'tapntally.nfc.mode';
  static const _scenarioKey = 'tapntally.nfc.scenario';

  @override
  NfcPrefs build() {
    final p = ref.read(sharedPrefsProvider);
    return NfcPrefs(
      NfcMode.values.firstWhere((m) => m.name == p.getString(_modeKey), orElse: () => NfcMode.auto),
      DemoScenario.values.firstWhere((s) => s.name == p.getString(_scenarioKey), orElse: () => DemoScenario.signed),
    );
  }

  void setMode(NfcMode m) {
    state = NfcPrefs(m, state.scenario);
    unawaited(ref.read(sharedPrefsProvider).setString(_modeKey, m.name));
  }

  void setScenario(DemoScenario s) {
    state = NfcPrefs(state.mode, s);
    unawaited(ref.read(sharedPrefsProvider).setString(_scenarioKey, s.name));
  }
}

final nfcPrefsProvider = NotifierProvider<NfcPrefsNotifier, NfcPrefs>(NfcPrefsNotifier.new);

final realNfcReaderProvider = Provider<NfcReader>((ref) => RealNfcReader());
final demoTerminalProvider = Provider<DemoTerminal>((ref) => DemoTerminal(ref.watch(apiProvider)));

/// Picks the reader for the next tap: real hardware when present ("auto"), else the demo terminal.
final nfcReaderResolverProvider = Provider<Future<NfcReader> Function()>((ref) {
  return () async {
    final prefs = ref.read(nfcPrefsProvider);
    final demo = ref.read(demoTerminalProvider)..scenario = prefs.scenario;
    final real = ref.read(realNfcReaderProvider);
    return switch (prefs.mode) {
      NfcMode.demo => demo,
      NfcMode.real => real,
      NfcMode.auto => await real.isAvailable() ? real : demo,
    };
  };
});

// ----------------------------------------------------------------- session

enum SessionStatus { booting, signedOut, signedIn }

class SessionState {
  const SessionState(this.status, [this.user]);
  final SessionStatus status;
  final User? user;
}

class SessionNotifier extends Notifier<SessionState> {
  @override
  SessionState build() => const SessionState(SessionStatus.booting);

  TallyApi get _api => ref.read(apiProvider);

  /// Restore from secure storage on launch.
  Future<void> boot() async {
    final tokens = await ref.read(tokenStoreProvider).read();
    if (tokens == null) {
      state = const SessionState(SessionStatus.signedOut);
      return;
    }
    try {
      state = SessionState(SessionStatus.signedIn, await _api.me());
    } catch (_) {
      await ref.read(tokenStoreProvider).clear();
      state = const SessionState(SessionStatus.signedOut);
    }
  }

  Future<void> signInDev(String email) async {
    ref.read(demoModeProvider.notifier).set(false);
    final (user, _) = await ref.read(apiProvider).signInDev(email);
    state = SessionState(SessionStatus.signedIn, user);
  }

  /// Offline demo: no network, seeded data, nothing persisted.
  Future<void> exploreDemo() async {
    ref.read(demoModeProvider.notifier).set(true);
    final (user, _) = await ref.read(apiProvider).signInDev('demo@tapntally.app');
    state = SessionState(SessionStatus.signedIn, user);
  }

  Future<void> refreshUser() async {
    if (state.status != SessionStatus.signedIn) return;
    state = SessionState(SessionStatus.signedIn, await _api.me());
  }

  void setUser(User user) => state = SessionState(SessionStatus.signedIn, user);

  Future<void> signOut() async {
    final store = ref.read(tokenStoreProvider);
    final tokens = await store.read();
    if (tokens != null && !ref.read(demoModeProvider)) {
      try {
        await _api.logout(tokens.refreshToken);
      } catch (_) {
        /* best effort */
      }
    }
    await store.clear();
    ref.read(demoModeProvider.notifier).set(false);
    state = const SessionState(SessionStatus.signedOut);
  }
}

final sessionProvider = NotifierProvider<SessionNotifier, SessionState>(SessionNotifier.new);
final currentUserProvider = Provider<User?>((ref) => ref.watch(sessionProvider).user);

// ------------------------------------------------------------------- reads

final categoriesProvider = FutureProvider<List<TxCategory>>((ref) => ref.watch(apiProvider).categories());

typedef SummaryArgs = ({String period, int offset, String scope});

final summaryProvider = FutureProvider.autoDispose.family<SpendSummary, SummaryArgs>(
  (ref, a) => ref.watch(apiProvider).summary(period: a.period, offset: a.offset, scope: a.scope),
);

final budgetsProvider = FutureProvider.autoDispose<List<BudgetProgress>>((ref) => ref.watch(apiProvider).budgets());

typedef RecapArgs = ({String period, String scope});

final recapProvider = FutureProvider.autoDispose.family<Recap, RecapArgs>(
  (ref, a) => ref.watch(apiProvider).recap(period: a.period, scope: a.scope),
);

final householdProvider = FutureProvider.autoDispose<Household?>((ref) => ref.watch(apiProvider).household());

final connectionsProvider = FutureProvider.autoDispose<List<Connection>>((ref) async {
  final list = await ref.watch(apiProvider).connections();
  // Poll while a first-time backfill is running.
  if (list.any((c) => c.status == ConnectionStatus.backfilling)) {
    final timer = Timer(const Duration(seconds: 5), ref.invalidateSelf);
    ref.onDispose(timer.cancel);
  }
  return list;
});

final transactionProvider = FutureProvider.autoDispose.family<Transaction, String>((ref, id) => ref.watch(apiProvider).transaction(id));

/// Cursor-paginated feed for one [TransactionQuery].
class FeedState {
  const FeedState({required this.items, required this.nextCursor, required this.total, this.loadingMore = false});
  final List<Transaction> items;
  final String? nextCursor;
  final int total;
  final bool loadingMore;
  bool get hasMore => nextCursor != null;
}

class FeedNotifier extends AsyncNotifier<FeedState> {
  FeedNotifier(this.query);
  final TransactionQuery query;

  @override
  Future<FeedState> build() async {
    final page = await ref.watch(apiProvider).transactions(query);
    return FeedState(items: page.items, nextCursor: page.nextCursor, total: page.total);
  }

  Future<void> loadMore() async {
    final cur = state.value;
    if (cur == null || !cur.hasMore || cur.loadingMore) return;
    state = AsyncData(FeedState(items: cur.items, nextCursor: cur.nextCursor, total: cur.total, loadingMore: true));
    try {
      final page = await ref.read(apiProvider).transactions(query, cursor: cur.nextCursor);
      if (!ref.mounted) return;
      state = AsyncData(FeedState(items: [...cur.items, ...page.items], nextCursor: page.nextCursor, total: page.total));
    } catch (_) {
      if (!ref.mounted) return;
      state = AsyncData(cur);
    }
  }
}

final feedProvider = AsyncNotifierProvider.autoDispose.family<FeedNotifier, FeedState, TransactionQuery>(FeedNotifier.new);

/// Anything that changes spend refreshes feed, charts, budgets and recap together.
void invalidateSpend(WidgetRef ref) {
  ref.invalidate(feedProvider);
  ref.invalidate(transactionProvider);
  ref.invalidate(summaryProvider);
  ref.invalidate(budgetsProvider);
  ref.invalidate(recapProvider);
}

void invalidateHousehold(WidgetRef ref) {
  ref.invalidate(householdProvider);
  ref.invalidate(budgetsProvider);
  invalidateSpend(ref);
}
