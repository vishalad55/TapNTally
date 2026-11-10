import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/models.dart';
import '../state/providers.dart';
import 'screens/add_transaction_screen.dart';
import 'screens/budget_edit_screen.dart';
import 'screens/budgets_screen.dart';
import 'screens/connections_screen.dart';
import 'screens/family_screen.dart';
import 'screens/history_screen.dart';
import 'screens/home_screen.dart';
import 'screens/onboarding_screen.dart';
import 'screens/pair_screen.dart';
import 'screens/recap_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/sign_in_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/transaction_screen.dart';
import 'shell.dart';

final rootNavigatorKey = GlobalKey<NavigatorState>();

/// Re-runs redirects whenever the session changes.
class _SessionListenable extends ChangeNotifier {
  _SessionListenable(Ref ref) {
    ref.listen(sessionProvider, (_, _) => notifyListeners());
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresh = _SessionListenable(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    navigatorKey: rootNavigatorKey,
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) {
      final s = ref.read(sessionProvider);
      final loc = state.matchedLocation;
      switch (s.status) {
        case SessionStatus.booting:
          return loc == '/splash' ? null : '/splash';
        case SessionStatus.signedOut:
          return loc == '/sign-in' ? null : '/sign-in';
        case SessionStatus.signedIn:
          final needsTour = !(s.user?.onboardingCompleted ?? true);
          if (needsTour && loc != '/onboarding') return '/onboarding';
          if (loc == '/splash' || loc == '/sign-in') return '/';
          return null;
      }
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
      GoRoute(path: '/sign-in', builder: (_, _) => const SignInScreen()),
      GoRoute(path: '/onboarding', builder: (_, _) => const OnboardingScreen()),
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => AppShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/', builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/history', builder: (_, _) => const HistoryScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/budgets', builder: (_, _) => const BudgetsScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/recap', builder: (_, _) => const RecapScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/family', builder: (_, _) => const FamilyScreen())]),
        ],
      ),
      // Full-screen pages sit above the tab bar.
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: '/transaction/:id', builder: (_, s) => TransactionScreen(id: s.pathParameters['id']!)),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: '/add', builder: (_, _) => const AddTransactionScreen()),
      GoRoute(
        parentNavigatorKey: rootNavigatorKey,
        path: '/budget-edit',
        builder: (_, s) {
          final extra = s.extra;
          return BudgetEditScreen(
            existing: extra is BudgetProgress ? extra.budget : null,
            initialScope: extra is BudgetScope ? extra : null,
          );
        },
      ),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: '/pair', builder: (_, _) => const PairScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: '/settings', builder: (_, _) => const SettingsScreen()),
      GoRoute(parentNavigatorKey: rootNavigatorKey, path: '/connections', builder: (_, _) => const ConnectionsScreen()),
    ],
  );
});
