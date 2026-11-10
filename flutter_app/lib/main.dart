import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/theme.dart';
import 'state/providers.dart';
import 'ui/router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();
  runApp(ProviderScope(
    overrides: [sharedPrefsProvider.overrideWithValue(prefs)],
    child: const TapNTallyApp(),
  ));
}

class TapNTallyApp extends ConsumerStatefulWidget {
  const TapNTallyApp({super.key, this.boot = true});

  /// Tests drive the session themselves and pass false.
  final bool boot;

  @override
  ConsumerState<TapNTallyApp> createState() => _TapNTallyAppState();
}

class _TapNTallyAppState extends ConsumerState<TapNTallyApp> {
  @override
  void initState() {
    super.initState();
    if (widget.boot) Future.microtask(() => ref.read(sessionProvider.notifier).boot());
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'TapNTally',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(TallyColors.paper),
      darkTheme: buildTheme(TallyColors.arcade),
      themeMode: ref.watch(appearanceProvider),
      routerConfig: ref.watch(routerProvider),
      // Respect the system font size, but cap it so fixed-height chrome
      // (tab bar, chips, buttons) can't be pushed into overlapping.
      builder: (context, child) => MediaQuery.withClampedTextScaling(maxScaleFactor: 1.3, child: child!),
    );
  }
}
