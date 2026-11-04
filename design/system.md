# Vigia — Design system

Extracted from the project source. Every entry names its source path.

Source: `web/src/App.css` (tokens); chart series colors from `web/src/App.jsx`.
The system is themeable: `:root` holds light tokens, `[data-theme="dark"]`
overrides them. Components must reference tokens, never raw hex values.

## Colors — light

| Token | Value | Usage |
| --- | --- | --- |
| `--bg` | `#f8fafc` | App background |
| `--surface` | `#ffffff` | Cards, header, sidebar |
| `--surface-2` | `#f1f5f9` | Hover, muted fills |
| `--border` | `#e2e8f0` | Borders, dividers |
| `--text` | `#0f172a` | Body text |
| `--muted` | `#64748b` | Secondary text, labels |
| `--accent` | `#0f766e` | Primary action, active nav |
| `--accent-hover` | `#115e56` | Primary hover |
| `--accent-soft` | `#f0fdfa` | Narrative callout |
| `--accent-contrast` | `#ffffff` | Text on accent |
| `--danger` | `#b91c1c` | Errors, destructive text |
| `--warning` | `#92400e` | Disclaimer |

## Colors — dark (`[data-theme="dark"]`)

| Token | Value |
| --- | --- |
| `--bg` | `#0b1220` |
| `--surface` | `#111a2b` |
| `--surface-2` | `#16223a` |
| `--border` | `#243349` |
| `--text` | `#e6edf7` |
| `--muted` | `#94a3b8` |
| `--accent` | `#14b8a6` |
| `--accent-hover` | `#2dd4bf` |
| `--accent-contrast` | `#04211f` |

Theme is chosen from `localStorage['vigia-theme']`, falling back to
`prefers-color-scheme`; an inline script in `web/index.html` applies it before
first paint to avoid a flash.

Chart series (data viz): `#0f766e`, `#2563eb`, `#d97706`, `#dc2626`, `#7c3aed`, `#059669` (App.jsx `COLORS`).

## Typography

- Family: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Scale (px): 12 heatmap labels · 13 muted/table/disclaimer · 14 controls/narrative · 15 section titles · 18 app title.
- Weights: 400 body, 600 table headers.

## Spacing

2, 8, 12, 16, 20 px. Cards padding 16; controls 8; gaps 8/12/20.

## Radius

2 heatmap cells · 8 (`--radius-sm`) buttons/inputs/callouts · 10 (`--radius`) cards.

## Shadows

`--shadow-sm` cards and buttons · `--shadow-md` modal and tooltips. Dark theme
deepens both.

## Component rules

- **Header**: sticky, translucent `--surface` with backdrop blur, 1px `--border` bottom. Logo only (32px, circular); no repeated wordmark.
- **Sidebar**: 232px, `--surface`, circular 64px logo, `.nav-btn` items (radius 8, hover `--surface-2`, active = `--accent` fill with `--accent-contrast` text).
- **Button** (`.btn`): height 36, radius 8, weight 500, 0.15s transitions, `:focus-visible` accent ring. Intents: `.btn-primary` (accent fill), `.btn` (surface + border), `.btn-ghost` (transparent), `.btn-danger` (red text). `.btn-icon` is a 36×36 square. Disabled = 45% opacity.
- **Inputs**: height 36, radius 8, focus = accent border + 3px accent ring at 22%.
- **Section/card**: `--surface`, `--border`, radius 10, padding 18, `--shadow-sm`.
- **Table**: 13px body, 11px uppercase 600 headers in `--muted`, row hover `--surface-2`.
- **Badge**: pill, 11px 600; `.ok` / `.warn` / `.danger` use the semantic token pairs.
- **Narrative**: 3px `--accent` left border, `--accent-soft` background.
- **Disclaimer**: `--warning` on `--warning-bg`, top border only.
- **Heatmap**: 14×14 cells, radius 2, intensity via `rgba(var(--heat), alpha)` so it flips with the theme.
- **Charts**: grid `var(--chart-grid)`, ticks `var(--muted)`, tooltip uses `TOOLTIP_STYLE` from tokens; every axis carries a title.
- **Motion**: respect `prefers-reduced-motion` — transitions disabled.
