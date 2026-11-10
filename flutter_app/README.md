# TapNTally — Flutter app

A rebuild of the Expo/React Native client (`../mobile`) in Flutter. It talks to the same
NestJS backend (`../backend`, `/api/v1`) with the same endpoints, demo login and TBEF NFC
bill flow, so the two clients can run side by side while this one is rolled out.

```
lib/
├── core/      design tokens (Paper / Arcade themes), money + date helpers
├── data/      models (mirror shared/src/types), HTTP client, offline demo backend, NFC readers
├── state/     Riverpod providers: session, feeds, summaries, prefs
└── ui/        router, tab shell, tap flow, screens, widget kit
test/
├── unit_test.dart     money formatting, TBEF validator, query serialisation, demo backend
└── layout_test.dart   every screen at 320 / 393 / 820 px, 100 % + 130 % text, both themes
```

## Run it

Requires Flutter 3.47 (stable).

```bash
cd flutter_app
flutter pub get

# Against a local backend (see the root README: npm run db:seed && npm run dev:backend)
flutter run --dart-define=API_URL=http://10.0.2.2:3000/api/v1   # Android emulator
flutter run --dart-define=API_URL=http://localhost:3000/api/v1  # iOS simulator / desktop

# Against the hosted demo API (the default when API_URL is not set)
flutter run
```

Sign in with **demo@tapntally.app** or **priya@tapntally.app**, or tap **Explore offline instead**
for a seeded in-memory backend that needs no server at all (useful for pitches with bad Wi-Fi).

**Web:** `flutter run -d chrome --web-port 8081 --dart-define=API_URL=http://localhost:3000/api/v1`.
The backend only accepts origins listed in `CORS_ORIGINS` (`backend/.env.example` allows
`http://localhost:8081`), so either use port 8081 or add your origin there.

**NFC:** Settings → Tap terminal → *Auto* uses the phone's NFC when available and falls back to the
backend's signed demo terminal otherwise. *Demo scenario* lets a presenter trigger missed taps,
unsupported terminals and malformed bills to show the error handling.

## Test

```bash
flutter analyze
flutter test
```

`layout_test.dart` walks sign-in, all five tabs, the filter sheet, the full tap → receipt flow and every
pushed screen against the offline backend, on a 320 px phone with 130 % text, a regular phone and a
tablet, in both themes. Any overflow fails the test, and it checks geometrically that list content never
extends under the tab bar and that the six bar slots never overlap. The test font renders every glyph as
a full em-square (wider than Inter), so it is a pessimistic stress test.

## What changed from the Expo app

**Layout — nothing overlaps**
- The Tap button now lives *inside* the bottom bar instead of floating 76 px over the list; content ends
  where the bar begins on every screen, so the old 130 px "dodge the FAB" padding is gone.
- Save/Add actions on form screens are pinned below the scroll area (not on top of it) and ride above the keyboard.
- Content is capped at 560 px and centred on tablets and web; one 20 px gutter everywhere.
- Text that can grow is always flexible: it ellipsises or wraps instead of pushing neighbours off-screen.
  Pairs of buttons sit side by side when there is room and stack when there is not, so labels never truncate.
- System text size is honoured up to 130 %, the point where fixed chrome would start to collide.

**Look**
- Same Paper (light) and Arcade (dark) brands, tightened into one token system: 4-pt spacing, fixed radii,
  and a 1 px hairline on every card in *both* themes (the dark theme previously had borderless cards).
- Inter and Space Grotesk are bundled, not downloaded at runtime — no font pop-in, works offline.
- Tap-flow states are bottom sheets; the receipt shows the itemised bill behind a draining timer.

**Usability**
- History: one search box, period chips and a single **Filters** sheet with an active-count badge, instead of
  three horizontally scrolling chip rows where filters hid off-screen. Rows under a day header show just the time.
- "Is this category right?" now has a one-tap **Yes, that's right** (previously you could only change it).
- Home quick actions point at things not already in the tab bar: Tap bill, Add, Pair code, Sources.
- Accessibility: buttons have clear labels, tiles announce merchant/amount/category, non-interactive cards
  are no longer exposed as buttons, and touch targets are 38–52 px tall.

## Not yet ported

- **Google sign-in / connecting a new Gmail account** — needs per-build OAuth client IDs (also unset in the
  Expo build). Already-linked Gmail accounts can sync and disconnect from the Connections screen.
- **On-device SMS reading** (Android) — the Connections screen enables/disables the SMS connection on the
  server, but reading the inbox needs a native SMS plugin and Play Store SMS-permission review.
- **Push notifications** (FCM device registration).
- **Device builds** — Android/iOS projects are configured (NFC permission/entitlement, `app.tapntally.mobile`
  id to ship as an update of the Expo app), but this was verified with tests and the web build only, not on
  a physical phone. Before release: `flutter build apk` / `flutter build ipa`, check an NFC tap on a real
  terminal, and replace the default launcher icons.
