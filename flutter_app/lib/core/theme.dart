import 'package:flutter/material.dart';

/// Design tokens for TapNTally.
///
/// Two moods, carried over from the Expo app: "Paper" (warm paper + coral) by
/// day and "Arcade" (navy + electric lime) by night. The Flutter rebuild keeps
/// the brand but tightens the system:
///   * one 4-pt spacing scale ([Space]) used everywhere, so gutters line up;
///   * every card has a 1 px hairline border in *both* moods, so surfaces
///     never bleed into each other on low-contrast screens;
///   * a fixed set of radii ([Radii]) instead of per-widget numbers.
@immutable
class TallyColors extends ThemeExtension<TallyColors> {
  const TallyColors({
    required this.bg,
    required this.surface,
    required this.surfaceAlt,
    required this.border,
    required this.ink,
    required this.inkMuted,
    required this.inkFaint,
    required this.accent,
    required this.accentInk,
    required this.accentSoft,
    required this.pop,
    required this.money,
    required this.warn,
    required this.danger,
    required this.scrim,
    required this.isDark,
  });

  final Color bg;
  final Color surface;
  final Color surfaceAlt;
  final Color border;
  final Color ink;
  final Color inkMuted;
  final Color inkFaint;
  final Color accent;
  final Color accentInk;
  final Color accentSoft;

  /// Second voice: recap highlights and "shared" stickers.
  final Color pop;
  final Color money;
  final Color warn;
  final Color danger;
  final Color scrim;
  final bool isDark;

  static const paper = TallyColors(
    bg: Color(0xFFF6F2EA),
    surface: Color(0xFFFFFFFF),
    surfaceAlt: Color(0xFFEFE9DE),
    border: Color(0xFFE3DCCF),
    ink: Color(0xFF15130F),
    inkMuted: Color(0xFF6B6558),
    inkFaint: Color(0xFF8F887A),
    accent: Color(0xFFFF5A36),
    accentInk: Color(0xFFFFFFFF),
    accentSoft: Color(0xFFFFE3DB),
    pop: Color(0xFFFF5A36),
    money: Color(0xFF0E9F6E),
    warn: Color(0xFFD99A00),
    danger: Color(0xFFE2453C),
    scrim: Color(0x8C15130F),
    isDark: false,
  );

  static const arcade = TallyColors(
    bg: Color(0xFF0B0E15),
    surface: Color(0xFF151A26),
    surfaceAlt: Color(0xFF1E2533),
    border: Color(0xFF263042),
    ink: Color(0xFFF4F6FB),
    inkMuted: Color(0xFF9AA3B5),
    inkFaint: Color(0xFF6E778A),
    accent: Color(0xFFC8FF3D),
    accentInk: Color(0xFF0B0E15),
    accentSoft: Color(0xFF2A3A14),
    pop: Color(0xFFFF4FA3),
    money: Color(0xFF4ADE80),
    warn: Color(0xFFFBBF24),
    danger: Color(0xFFF87171),
    scrim: Color(0xB303050A),
    isDark: true,
  );

  @override
  TallyColors copyWith() => this;

  @override
  TallyColors lerp(ThemeExtension<TallyColors>? other, double t) {
    if (other is! TallyColors) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return TallyColors(
      bg: l(bg, other.bg),
      surface: l(surface, other.surface),
      surfaceAlt: l(surfaceAlt, other.surfaceAlt),
      border: l(border, other.border),
      ink: l(ink, other.ink),
      inkMuted: l(inkMuted, other.inkMuted),
      inkFaint: l(inkFaint, other.inkFaint),
      accent: l(accent, other.accent),
      accentInk: l(accentInk, other.accentInk),
      accentSoft: l(accentSoft, other.accentSoft),
      pop: l(pop, other.pop),
      money: l(money, other.money),
      warn: l(warn, other.warn),
      danger: l(danger, other.danger),
      scrim: l(scrim, other.scrim),
      isDark: t < 0.5 ? isDark : other.isDark,
    );
  }
}

/// 4-pt spacing scale. Screens use [Space.gutter] on both sides, always.
abstract final class Space {
  static const double xxs = 4;
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double xl = 24;
  static const double xxl = 32;

  /// Horizontal page padding.
  static const double gutter = 20;

  /// Content never grows wider than this (tablets, web, landscape).
  static const double maxContentWidth = 560;
}

abstract final class Radii {
  static const double sm = 10;
  static const double md = 14;
  static const double lg = 20;
  static const double xl = 28;
  static const double pill = 999;
}

/// Brand type: Space Grotesk for display/money, Inter for body. Both are
/// bundled in `assets/fonts` (see pubspec.yaml).
abstract final class AppFonts {
  static const displayFamily = 'SpaceGrotesk';
  static const bodyFamily = 'Inter';

  static TextStyle display(TextStyle base) => base.copyWith(fontFamily: displayFamily);
  static TextStyle body(TextStyle base) => base.copyWith(fontFamily: bodyFamily);
}

/// Named text styles. Colours come from [TallyColors]; these are size/weight only.
abstract final class TextStyles {
  static TextStyle get hero => AppFonts.display(const TextStyle(fontSize: 38, height: 1.12, fontWeight: FontWeight.w700, letterSpacing: -1));
  static TextStyle get display => AppFonts.display(const TextStyle(fontSize: 28, height: 1.2, fontWeight: FontWeight.w700, letterSpacing: -0.5));
  static TextStyle get title => AppFonts.display(const TextStyle(fontSize: 21, height: 1.3, fontWeight: FontWeight.w700));
  static TextStyle get money => AppFonts.display(const TextStyle(
        fontSize: 16,
        height: 1.3,
        fontWeight: FontWeight.w600,
        fontFeatures: [FontFeature.tabularFigures()],
      ));
  static TextStyle get heading => AppFonts.body(const TextStyle(fontSize: 15.5, height: 1.4, fontWeight: FontWeight.w600));
  static TextStyle get body => AppFonts.body(const TextStyle(fontSize: 15, height: 1.45, fontWeight: FontWeight.w400));
  static TextStyle get caption => AppFonts.body(const TextStyle(fontSize: 13, height: 1.4, fontWeight: FontWeight.w500));
  static TextStyle get micro =>
      AppFonts.body(const TextStyle(fontSize: 11, height: 1.3, fontWeight: FontWeight.w700, letterSpacing: 0.8));
}

extension TallyThemeX on BuildContext {
  TallyColors get colors => Theme.of(this).extension<TallyColors>()!;
}

ThemeData buildTheme(TallyColors c) {
  final scheme = ColorScheme(
    brightness: c.isDark ? Brightness.dark : Brightness.light,
    primary: c.accent,
    onPrimary: c.accentInk,
    secondary: c.pop,
    onSecondary: c.isDark ? c.bg : Colors.white,
    error: c.danger,
    onError: Colors.white,
    surface: c.surface,
    onSurface: c.ink,
    surfaceContainerHighest: c.surfaceAlt,
    outline: c.border,
    outlineVariant: c.border,
  );
  final base = ThemeData(
    useMaterial3: true,
    fontFamily: AppFonts.bodyFamily,
    colorScheme: scheme,
    scaffoldBackgroundColor: c.bg,
    extensions: [c],
    splashFactory: InkSparkle.splashFactory,
  );
  OutlineInputBorder field(Color color, [double w = 1]) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(Radii.md),
        borderSide: BorderSide(color: color, width: w),
      );
  return base.copyWith(
    textTheme: base.textTheme.apply(bodyColor: c.ink, displayColor: c.ink).copyWith(bodyMedium: TextStyles.body.copyWith(color: c.ink)),
    appBarTheme: AppBarTheme(
      backgroundColor: c.bg,
      foregroundColor: c.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyles.title.copyWith(color: c.ink),
    ),
    dividerTheme: DividerThemeData(color: c.border, thickness: 1, space: 1),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: c.surfaceAlt,
      hintStyle: TextStyles.body.copyWith(color: c.inkFaint),
      contentPadding: const EdgeInsets.symmetric(horizontal: Space.md, vertical: 14),
      border: field(c.border),
      enabledBorder: field(c.border),
      focusedBorder: field(c.accent, 1.6),
      errorBorder: field(c.danger),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? c.accentInk : c.inkFaint),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? c.accent : c.surfaceAlt),
      trackOutlineColor: WidgetStateProperty.all(c.border),
    ),
    sliderTheme: SliderThemeData(
      activeTrackColor: c.accent,
      inactiveTrackColor: c.surfaceAlt,
      thumbColor: c.accent,
      overlayColor: c.accent.withValues(alpha: 0.15),
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: c.accent),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: c.ink,
      contentTextStyle: TextStyles.body.copyWith(color: c.bg),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.md)),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: c.surface,
      modalBackgroundColor: c.surface,
      showDragHandle: true,
      dragHandleColor: c.border,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(Radii.xl))),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: c.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(Radii.lg)),
      titleTextStyle: TextStyles.title.copyWith(color: c.ink),
      contentTextStyle: TextStyles.body.copyWith(color: c.inkMuted),
    ),
  );
}

/// Category colours anchored on each mood's accent. Custom categories keep their own hex.
const _paperCats = <String, Color>{
  'shopping': Color(0xFFFF5A36),
  'groceries': Color(0xFF0E9F6E),
  'restaurants': Color(0xFFF28C28),
  'electronics': Color(0xFF3A6FF2),
  'transport': Color(0xFFE6A100),
  'fuel': Color(0xFFA0673A),
  'bills_utilities': Color(0xFF6B7A90),
  'health': Color(0xFFE2453C),
  'entertainment': Color(0xFF8B5CF6),
  'education': Color(0xFF0EA5C9),
  'travel': Color(0xFF14B8A6),
  'personal_care': Color(0xFFEC5FA5),
  'home': Color(0xFFB08968),
  'gifts_donations': Color(0xFFD946A8),
  'fees_charges': Color(0xFF7C8894),
  'uncategorized': Color(0xFFA39C8D),
};

const _arcadeCats = <String, Color>{
  'shopping': Color(0xFFC8FF3D),
  'groceries': Color(0xFF4ADE80),
  'restaurants': Color(0xFFFFA85C),
  'electronics': Color(0xFF6AA6FF),
  'transport': Color(0xFFFBBF24),
  'fuel': Color(0xFFD6A374),
  'bills_utilities': Color(0xFF94A3B8),
  'health': Color(0xFFF87171),
  'entertainment': Color(0xFFB191FF),
  'education': Color(0xFF22D3EE),
  'travel': Color(0xFF2DD4BF),
  'personal_care': Color(0xFFFF4FA3),
  'home': Color(0xFFCDA97E),
  'gifts_donations': Color(0xFFF472B6),
  'fees_charges': Color(0xFF8B95A7),
  'uncategorized': Color(0xFF6B7386),
};

Color categoryColor(String? slug, String fallbackHex, TallyColors c) {
  final table = c.isDark ? _arcadeCats : _paperCats;
  return (slug != null ? table[slug] : null) ?? parseHex(fallbackHex) ?? c.inkFaint;
}

Color? parseHex(String hex) {
  final h = hex.replaceAll('#', '');
  if (h.length != 6) return null;
  final v = int.tryParse(h, radix: 16);
  return v == null ? null : Color(0xFF000000 | v);
}

/// Black or white ink for a given background.
Color contrastInk(Color bg) => bg.computeLuminance() > 0.45 ? const Color(0xFF15130F) : Colors.white;
