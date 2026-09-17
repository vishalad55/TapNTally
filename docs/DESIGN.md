# TapNTally design system

One source of truth for the Figma file and `mobile/src/theme`. Change it here first.

## Personality

Confident, warm, a little cheeky. Fintech that feels like a good receipt — crisp numbers, generous whitespace, one loud accent, tiny moments of delight (the tap pulse, the receipt "tearing" in, the recap copy). Never cartoonish; never a bank statement.

## Two moods, not one palette inverted

Light and dark are deliberately different colour worlds so the toggle feels like a mode change, not a filter.

### Light — "Paper" 
Warm paper ground, ink text, **coral** as the single action colour, **mint** for money-positive, **butter** for warnings.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#F6F2EA` | screen ground (warm paper) |
| `surface` | `#FFFFFF` | cards |
| `surfaceAlt` | `#EFE9DE` | chips, inputs, secondary buttons |
| `border` | `#E3DCCF` | hairlines |
| `ink` | `#15130F` | primary text |
| `inkMuted` | `#6B6558` | secondary text |
| `inkFaint` | `#A39C8D` | placeholders, captions |
| `accent` | `#FF5A36` | primary action, FAB, selection (coral) |
| `accentInk` | `#FFFFFF` | text on accent |
| `accentSoft` | `#FFE3DB` | accent tints |
| `money` | `#0E9F6E` | positive, "under budget" |
| `warn` | `#F5B400` | 80 % budget |
| `danger` | `#E2453C` | over budget, destructive |
| `donut ring bg` | `#EFE9DE` | empty chart |

### Dark — "Arcade"
Near-black navy ground, **electric lime** as the action colour, **hot pink** as the second voice. Reads like a night-mode terminal that's having fun.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0B0E15` | screen ground |
| `surface` | `#151A26` | cards |
| `surfaceAlt` | `#1E2533` | chips, inputs |
| `border` | `#2A3242` | hairlines |
| `ink` | `#F4F6FB` | primary text |
| `inkMuted` | `#9AA3B5` | secondary |
| `inkFaint` | `#5F6779` | captions |
| `accent` | `#C8FF3D` | primary action, FAB (lime) |
| `accentInk` | `#0B0E15` | text on accent |
| `accentSoft` | `#2A3A14` | accent tints |
| `pop` | `#FF4FA3` | second accent — recap highlights, shared badge |
| `money` | `#4ADE80` | positive |
| `warn` | `#FBBF24` | warning |
| `danger` | `#F87171` | danger |

Category colours (chart slices) stay identical across modes for recognisability; they were chosen to sit on both grounds.

## Type

- **Display / numbers:** Space Grotesk (700, 500) — geometric, slightly quirky, tabular figures for money.
- **Body / UI:** Inter (400, 500, 600).

| Style | Font | Size / line | Weight |
|---|---|---|---|
| `hero` | Space Grotesk | 40 / 44 | 700, -1 tracking |
| `display` | Space Grotesk | 30 / 36 | 700, -0.5 |
| `title` | Space Grotesk | 22 / 28 | 700 |
| `money` | Space Grotesk | 17 / 22 | 500, tabular |
| `heading` | Inter | 16 / 22 | 600 |
| `body` | Inter | 15 / 22 | 400 |
| `caption` | Inter | 13 / 18 | 500 |
| `micro` | Inter | 11 / 14 | 700, +0.6 tracking, uppercase |

## Shape & motion

- Radii: 12 (inputs), 20 (cards), 28 (sheets), pill (chips, buttons).
- Cards: no border in dark mode (surface contrast is enough); 1 px `border` in light.
- Shadows only on the FAB and the receipt sheet.
- Motion: FAB idle pulse 1.8 s; receipt springs up (damping 16); donut slice pops 8 px on select; every list row fades/slides 12 px on mount (staggered 30 ms).

## Signature elements

- **The Tap button**: 76 px circle, accent fill, concentric ring animation while scanning.
- **Receipt sheet**: zig-zag torn top edge, monospaced-feel line items, draining timer bar in accent.
- **Hero number**: month total in `hero` with a hand-drawn underline stroke in `pop` (dark) / `accent` (light).
- **Stickers**: rotated −3° pill labels ("VERIFIED", "SHARED") for badges.

## Figma

Tokens, type styles and screen mockups live in **TapNTally Design System**: https://www.figma.com/design/vb4uLMCmMyjpPYahteoIXh — variables are grouped `paper/*`, `arcade/*`, `category/*` (the starter plan allows one mode per collection, so the two moods are groups rather than modes).
