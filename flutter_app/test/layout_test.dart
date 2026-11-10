// Layout regression suite: walks every screen of the app on a small phone,
// a regular phone and a tablet, with enlarged text and in both moods, against
// the in-memory demo backend. Any RenderFlex overflow, clipped layout or
// exception fails the test. It also checks the structural "nothing sits under
// the tab bar" rule geometrically.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:tapntally/data/demo_api.dart';
import 'package:tapntally/data/models.dart';
import 'package:tapntally/data/token_store.dart';
import 'package:tapntally/main.dart';
import 'package:tapntally/state/providers.dart';
import 'package:tapntally/ui/router.dart';
import 'package:tapntally/ui/shell.dart';

class Variant {
  const Variant(this.name, this.size, {this.textScale = 1.0, this.dark = false});
  final String name;
  final Size size;
  final double textScale;
  final bool dark;
}

const variants = [
  Variant('small phone 320x568, text 130%, Paper', Size(320, 568), textScale: 1.3),
  Variant('small phone 320x568, text 130%, Arcade', Size(320, 568), textScale: 1.3, dark: true),
  Variant('phone 393x852, Paper', Size(393, 852)),
  Variant('phone 393x852, text 130%, Arcade', Size(393, 852), textScale: 1.3, dark: true),
  Variant('tablet 820x1180, Paper', Size(820, 1180)),
];

/// Pumps frames for [d] without waiting for "settled" (some screens tick every second).
Future<void> settle(WidgetTester t, [Duration d = const Duration(milliseconds: 900)]) async {
  for (var i = 0; i < d.inMilliseconds ~/ 50; i++) {
    await t.pump(const Duration(milliseconds: 50));
  }
}

void expectClean(WidgetTester t, String where) {
  final e = t.takeException();
  expect(e, isNull, reason: 'Layout error on $where: $e');
}

Future<ProviderContainer> launch(WidgetTester t, Variant v) async {
  // Echo full diagnostics (incl. the creator chain of an overflowing widget) to the console.
  final original = FlutterError.onError;
  FlutterError.onError = (details) {
    FlutterError.dumpErrorToConsole(details, forceReport: true);
    original?.call(details);
  };
  addTearDown(() => FlutterError.onError = original);
  t.view.devicePixelRatio = 2;
  t.view.physicalSize = v.size * 2;
  t.platformDispatcher.textScaleFactorTestValue = v.textScale;
  addTearDown(t.view.reset);
  addTearDown(t.platformDispatcher.clearTextScaleFactorTestValue);

  SharedPreferences.setMockInitialValues({
    'tapntally.appearance': v.dark ? 'dark' : 'light',
    'tapntally.nfc.mode': 'demo',
  });
  final prefs = await SharedPreferences.getInstance();
  final container = ProviderContainer(overrides: [
    sharedPrefsProvider.overrideWithValue(prefs),
    tokenStoreProvider.overrideWithValue(MemoryTokenStore()),
    demoApiProvider.overrideWithValue(DemoTallyApi(latency: Duration.zero)),
  ]);
  addTearDown(container.dispose);

  await t.pumpWidget(UncontrolledProviderScope(container: container, child: const TapNTallyApp(boot: false)));
  await settle(t);
  return container;
}

Finder navLabel(String label) => find.descendant(of: find.byType(TallyNavBar), matching: find.text(label));

/// Scrolls the primary scrollable to the end, checking for errors on the way.
Future<void> scrollThrough(WidgetTester t, String where) async {
  final scrollable = find.byType(Scrollable).first;
  for (var i = 0; i < 12; i++) {
    await t.drag(scrollable, const Offset(0, -400), warnIfMissed: false);
    await settle(t, const Duration(milliseconds: 200));
    expectClean(t, '$where (scrolled)');
  }
}

void main() {
  for (final v in variants) {
    group(v.name, () {
      testWidgets('signed-out screens', (t) async {
        final c = await launch(t, v);
        await c.read(sessionProvider.notifier).boot();
        await settle(t);
        expect(find.text('DEMO ACCOUNT'), findsOneWidget);
        expectClean(t, 'sign-in');
        await scrollThrough(t, 'sign-in');
      });

      testWidgets('tabs, tap flow and pushed screens', (t) async {
        final c = await launch(t, v);
        await c.read(sessionProvider.notifier).exploreDemo();
        await settle(t);
        final router = c.read(routerProvider);

        // ---- Home
        expect(find.text('SPENT THIS MONTH'), findsOneWidget);
        expectClean(t, 'home');

        // The tab bar is never overlapped: the scroll view ends where the bar begins…
        final bar = t.getRect(find.byType(TallyNavBar));
        final body = t.getRect(find.byType(CustomScrollView).first);
        expect(body.bottom, lessThanOrEqualTo(bar.top + 0.5), reason: 'content extends under the tab bar');
        // …and its six slots don't overlap each other.
        final slots = [
          for (final l in ['Home', 'History', 'Budgets', 'Recap', 'Family']) t.getRect(navLabel(l)),
          t.getRect(find.byKey(const Key('nav-tap'))),
        ];
        for (var i = 0; i < slots.length; i++) {
          expect(bar.contains(slots[i].center), isTrue, reason: 'nav slot $i outside the bar');
          for (var j = i + 1; j < slots.length; j++) {
            expect(slots[i].overlaps(slots[j]), isFalse, reason: 'nav slots $i and $j overlap');
          }
        }

        await scrollThrough(t, 'home');

        // ---- Each tab
        for (final tab in ['History', 'Budgets', 'Recap', 'Family']) {
          await t.tap(navLabel(tab));
          await settle(t);
          expectClean(t, tab);
          await scrollThrough(t, tab);
        }

        // ---- History filter sheet
        await t.tap(navLabel('History'));
        await settle(t);
        for (var i = 0; i < 12; i++) {
          await t.drag(find.byType(Scrollable).first, const Offset(0, 600), warnIfMissed: false);
          await t.pump(const Duration(milliseconds: 50));
        }
        await settle(t, const Duration(seconds: 2)); // let the pull-to-refresh finish
        await t.tap(find.byTooltip('Filters'));
        await settle(t);
        expect(find.text('Show results'), findsOneWidget);
        expectClean(t, 'filter sheet');
        await t.tap(find.text('Show results'));
        await settle(t);

        // ---- Tap → demo terminal → receipt
        await t.tap(find.byKey(const Key('nav-tap')));
        await settle(t, const Duration(milliseconds: 600));
        expect(find.text('Hold near the terminal'), findsOneWidget);
        expectClean(t, 'scanning sheet');
        await settle(t, const Duration(milliseconds: 1500));
        expect(find.text('Bill received'), findsOneWidget);
        expectClean(t, 'receipt sheet');
        await t.tap(find.text('Done'));
        await settle(t);
        expect(router.routerDelegate.currentConfiguration.uri.path, '/', reason: 'tap flow should land on Home');

        // ---- Pushed screens
        final txId = (await c.read(apiProvider).transactions(const TransactionQuery(scope: 'personal'))).items.first.id;
        for (final route in ['/settings', '/add', '/budget-edit', '/pair', '/connections', '/transaction/$txId', '/onboarding']) {
          router.push(route);
          await settle(t);
          expectClean(t, route);
          await scrollThrough(t, route);
          if (route == '/onboarding') {
            await t.tap(find.text('Continue'));
            await settle(t);
            expectClean(t, 'onboarding step 2');
            await t.tap(find.text('Not now'));
            await settle(t);
            expectClean(t, 'onboarding step 3');
          }
          router.go('/');
          await settle(t);
        }

        // Dispose the tree so periodic timers (pairing countdown) stop.
        await t.pumpWidget(const SizedBox());
        await settle(t, const Duration(seconds: 6));
      });
    });
  }
}
