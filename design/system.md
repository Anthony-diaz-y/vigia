# Vigia — Design system

Extracted from the project source. Every entry names its source path.

Source: `web/src/App.css` (all tokens); chart series colors from `web/src/App.jsx`.

## Colors

| Token | Value | Usage | Source |
| --- | --- | --- | --- |
| `--accent` | `#0f766e` | Primary actions, active accent, narrative border | App.css |
| `--border` | `#e2e8f0` | Borders, dividers, table rules | App.css |
| `--muted` | `#64748b` | Secondary text, table headers | App.css |
| `text` | `#0f172a` | Body text | App.css |
| `background` | `#f8fafc` | App background | App.css |
| `surface` | `#ffffff` | Header, cards/sections | App.css |
| `surface-title` | `#334155` | Section titles | App.css |
| `error` | `#b91c1c` / bg `#fef2f2` / border `#fecaca` | Error state | App.css |
| `warning` | `#92400e` / bg `#fffbeb` / border `#fde68a` | Disclaimer / warning | App.css |
| `info-bg` | `#f0fdfa` | Narrative callout background | App.css |

Chart series (data viz): `#0f766e`, `#2563eb`, `#d97706`, `#dc2626`, `#7c3aed`, `#059669` (App.jsx `COLORS`).

## Typography

- Family: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Scale (px): 12 heatmap labels · 13 muted/table/disclaimer · 14 controls/narrative · 15 section titles · 18 app title.
- Weights: 400 body, 600 table headers.

## Spacing

2, 8, 12, 16, 20 px. Cards padding 16; controls 8; gaps 8/12/20.

## Radius

2 heatmap cells · 8 buttons/inputs/callouts · 12 cards.

## Shadows

None defined in the source.

## Component rules

- **Header**: sticky, `surface`, 1px `--border` bottom, 18px title.
- **Button**: white bg, 1px `--border`, radius 8, padding 8×12; `.primary` = `--accent` bg + white text; disabled = 50% opacity.
- **Section/card**: `surface`, 1px `--border`, radius 12, padding 16; h2 uppercase 15px `surface-title`.
- **Table**: 13px, `--muted` 600 headers, rows divided by `--border`.
- **Error**: radius 8, red block.
- **Narrative**: 3px `--accent` left border, `#f0fdfa` bg, radius 0 8 8 0.
- **Disclaimer**: amber block, radius 12.
- **Heatmap**: 14×14 cells, radius 2, 2px gap, teal alpha intensity.
