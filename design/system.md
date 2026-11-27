# Vigia design system

Synced read-only from `apps/web/app/globals.css` (Tailwind v4 CSS-first: `:root`, `[data-theme='dark']`, `@theme inline`), `apps/web/app/layout.tsx` and the dialog in `apps/web/src/modules/shared/components/layout/mapping-dialog.tsx`. Only values found in the sources are recorded. The app ships a light theme (`:root`, the default `data-theme="light"` set in `layout.tsx`) and a dark theme (`[data-theme='dark']`); both are listed. Dark is the reference theme for the artboards.

## Colors — light (:root)

| Token | Value | Usage | Source |
| --- | --- | --- | --- |
| `--bg` | `#f4f6f9` | Page background | `apps/web/app/globals.css` |
| `--surface` | `#ffffff` | Cards, modal, inputs | `apps/web/app/globals.css` |
| `--surface-2` | `#f1f4f8` | Raised areas: modal footer, table head, hover | `apps/web/app/globals.css` |
| `--surface-3` | `#e4e9f0` | Deeper fill, hover borders | `apps/web/app/globals.css` |
| `--border` | `#dfe5ec` | Default 1px borders | `apps/web/app/globals.css` |
| `--border-strong` | `#c9d2dd` | Stronger borders | `apps/web/app/globals.css` |
| `--text` | `#172133` | Body text | `apps/web/app/globals.css` |
| `--muted` | `#5a6678` | Secondary text, labels, icons | `apps/web/app/globals.css` |
| `--title` | `#2c384b` | Headings | `apps/web/app/globals.css` |
| `--accent` | `#2455a4` | Primary action, links, selected text | `apps/web/app/globals.css` |
| `--accent-hover` | `#1c4588` | Primary hover | `apps/web/app/globals.css` |
| `--accent-soft` | `#eaf1fb` | Soft accent fill | `apps/web/app/globals.css` |
| `--accent-contrast` | `#ffffff` | Text on accent fill | `apps/web/app/globals.css` |
| `--focus-ring` | `rgba(36, 85, 164, 0.3)` | Focus ring colour | `apps/web/app/globals.css` |
| `--danger` | `#b93a2b` | Error text/fill | `apps/web/app/globals.css` |
| `--danger-bg` | `#fcece9` | Error background | `apps/web/app/globals.css` |
| `--danger-border` | `#f2c7c0` | Error border | `apps/web/app/globals.css` |
| `--warning` | `#a35a06` | Warning text | `apps/web/app/globals.css` |
| `--warning-bg` | `#fdf3e2` | Warning background | `apps/web/app/globals.css` |
| `--warning-border` | `#f0d6a6` | Warning border | `apps/web/app/globals.css` |
| `--success-bg` | `#e6f4ee` | Success badge background | `apps/web/app/globals.css` |
| `--success-fg` | `#22704f` | Success badge text | `apps/web/app/globals.css` |
| `--rail` | `#16213a` | Sidebar background | `apps/web/app/globals.css` |
| `--rail-2` | `#212e4b` | Sidebar hover/active/border | `apps/web/app/globals.css` |
| `--rail-text` | `#a9b5cb` | Sidebar text | `apps/web/app/globals.css` |
| `--rail-strong` | `#f3f6fb` | Sidebar strong text | `apps/web/app/globals.css` |
| `--rail-accent` | `#8fb3f5` | Sidebar active accent | `apps/web/app/globals.css` |
| `--heat` | `36, 85, 164` | RGB triplet for heatmap tint | `apps/web/app/globals.css` |
| `--chart-grid` | `#e6ebf1` | Chart gridlines | `apps/web/app/globals.css` |
| `--series-muted-1` | `#8995a7` | Muted chart series 1 | `apps/web/app/globals.css` |
| `--series-muted-2` | `#b4bdca` | Muted chart series 2 | `apps/web/app/globals.css` |
| `--series-muted-3` | `#d2d8e1` | Muted chart series 3 | `apps/web/app/globals.css` |

## Colors — dark ([data-theme='dark'])

| Token | Value | Usage | Source |
| --- | --- | --- | --- |
| `--bg` | `#0f1522` | Page background | `apps/web/app/globals.css` |
| `--surface` | `#161e2e` | Cards, modal, inputs | `apps/web/app/globals.css` |
| `--surface-2` | `#1c2538` | Raised areas: modal footer, table head, hover | `apps/web/app/globals.css` |
| `--surface-3` | `#253047` | Deeper fill, hover borders | `apps/web/app/globals.css` |
| `--border` | `#273249` | Default 1px borders | `apps/web/app/globals.css` |
| `--border-strong` | `#34415c` | Stronger borders | `apps/web/app/globals.css` |
| `--text` | `#e7ecf4` | Body text | `apps/web/app/globals.css` |
| `--muted` | `#9aa6ba` | Secondary text, labels, icons | `apps/web/app/globals.css` |
| `--title` | `#cdd5e2` | Headings | `apps/web/app/globals.css` |
| `--accent` | `#7aa5ee` | Primary action, links, selected text | `apps/web/app/globals.css` |
| `--accent-hover` | `#9abcf5` | Primary hover | `apps/web/app/globals.css` |
| `--accent-soft` | `#1d2a45` | Soft accent fill | `apps/web/app/globals.css` |
| `--accent-contrast` | `#0c1629` | Text on accent fill | `apps/web/app/globals.css` |
| `--focus-ring` | `rgba(122, 165, 238, 0.35)` | Focus ring colour | `apps/web/app/globals.css` |
| `--danger` | `#f08a7c` | Error text/fill | `apps/web/app/globals.css` |
| `--danger-bg` | `#331b1a` | Error background | `apps/web/app/globals.css` |
| `--danger-border` | `#5e2d29` | Error border | `apps/web/app/globals.css` |
| `--warning` | `#f1b45e` | Warning text | `apps/web/app/globals.css` |
| `--warning-bg` | `#2f2412` | Warning background | `apps/web/app/globals.css` |
| `--warning-border` | `#5b4519` | Warning border | `apps/web/app/globals.css` |
| `--success-bg` | `#14302a` | Success badge background | `apps/web/app/globals.css` |
| `--success-fg` | `#74cfa6` | Success badge text | `apps/web/app/globals.css` |
| `--rail` | `#0b1120` | Sidebar background | `apps/web/app/globals.css` |
| `--rail-2` | `#18223a` | Sidebar hover/active/border | `apps/web/app/globals.css` |
| `--rail-text` | `#93a0b7` | Sidebar text | `apps/web/app/globals.css` |
| `--rail-strong` | `#e7ecf4` | Sidebar strong text | `apps/web/app/globals.css` |
| `--rail-accent` | `#8fb3f5` | Sidebar active accent | `apps/web/app/globals.css` |
| `--heat` | `122, 165, 238` | RGB triplet for heatmap tint | `apps/web/app/globals.css` |
| `--chart-grid` | `#222c41` | Chart gridlines | `apps/web/app/globals.css` |
| `--series-muted-1` | `#7d899d` | Muted chart series 1 | `apps/web/app/globals.css` |
| `--series-muted-2` | `#556177` | Muted chart series 2 | `apps/web/app/globals.css` |
| `--series-muted-3` | `#3a455a` | Muted chart series 3 | `apps/web/app/globals.css` |

## Shadows

| Token | Value | Usage | Source |
| --- | --- | --- | --- |
| `--shadow-sm` | `0 1px 2px rgba(23, 33, 51, 0.05)` | Small shadow (light) | `apps/web/app/globals.css` |
| `--shadow-md` | `0 12px 32px -8px rgba(23, 33, 51, 0.18), 0 2px 6px rgba(23, 33, 51, 0.06)` | Modal and menu shadow (light) | `apps/web/app/globals.css` |
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.4)` | Small shadow (dark) | `apps/web/app/globals.css` |
| `--shadow-md` | `0 12px 32px -8px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.3)` | Modal and menu shadow (dark) | `apps/web/app/globals.css` |

## Radius

| Token | Value | Usage | Source |
| --- | --- | --- | --- |
| `--radius` | `12px` | Cards and modal | `apps/web/app/globals.css` |
| `--radius-sm` | `8px` | Buttons, inputs | `apps/web/app/globals.css` |

## Motion

| Token | Value | Usage | Source |
| --- | --- | --- | --- |
| `--ease` | `cubic-bezier(0.2, 0.7, 0.2, 1)` | Standard easing curve | `apps/web/app/globals.css` |

Reduced motion: `@media (prefers-reduced-motion: reduce)` shortens every animation and transition to `0.01ms` (`apps/web/app/globals.css`).

## Typography

| Token | Value | Usage | Source |
| --- | --- | --- | --- |
| `--font-sans` | `var(--font-public-sans), system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` | Body font stack (`@theme inline`); `--font-public-sans` is Public Sans loaded by next/font in `layout.tsx`. Artboards cannot load it, so they list `'Public Sans'` first and fall back to the system stack | `apps/web/app/globals.css` |

| Role | Size / weight | Source |
| --- | --- | --- |
| Body | `14px`, antialiased | `apps/web/app/globals.css` (`body`) |
| Modal title (`text-lg font-semibold text-title`) | Tailwind `text-lg` (18px) / 600 | `mapping-dialog.tsx` |
| Section title (`.section-title`) | `15px` / 650 | `apps/web/app/globals.css` |
| Buttons | `14px` / 550 | `apps/web/app/globals.css` |
| Inputs, select | `14px` / 400 (select value 600) | `apps/web/app/globals.css` |
| Row label input (`.map-label-input`) | `14px` / 600 | `apps/web/app/globals.css` |
| Secondary text (`.card-sub`, `.map-privacy`, `.map-notes`) | `13px`, line-height 1.45–1.55 | `apps/web/app/globals.css` |
| Captions, field labels, samples, reasons, badges | `12px` / 400–600 | `apps/web/app/globals.css` |

## Spacing

The sources define no spacing tokens. Observed values in the modal styles (`apps/web/app/globals.css`): header `padding: 20px 24px 16px`, body `padding: 16px 24px 20px`, footer `padding: 14px 24px` with `gap: 8px`, row `padding: 14px` with `gap: 16px`, meta grid `gap: 12px`, sample chips `gap: 4px`.

## Component rules

Source for every rule below: `apps/web/app/globals.css` unless noted.

- **Modal (`.modal`)**: `1px solid var(--border)`, `border-radius: var(--radius)`, `background: var(--surface)`, `box-shadow: var(--shadow-md)`, `padding: 24px`, width `min(720px, 100vw - 32px)`. Backdrop `rgba(15, 21, 34, 0.5)` with `backdrop-filter: blur(2px)`. Open animation `modal-in 0.22s var(--ease)` (8px rise, scale .98).
- **Mapping dialog (`.map-dialog`)**: width `min(980px, 100vw - 32px)`, `max-height: calc(100vh - 32px)`, `padding: 0`, flex column: `.map-header` (bottom border, `padding: 20px 24px 16px`), scrolling `.map-body`, `.map-footer` (top border, `background: var(--surface-2)`, buttons right-aligned).
- **Close button (`.map-close`)**: 36×36, radius 8px, `color: var(--muted)`; hover `background: var(--surface-2)` and `color: var(--text)`; focus `box-shadow: 0 0 0 3px var(--focus-ring)`.
- **Button (`.btn`)**: height 36px, padding `0 14px`, `1px solid var(--border)`, `border-radius: var(--radius-sm)`, `background: var(--surface)`, 14px/550; hover `background: var(--surface-2)`; disabled `opacity: 0.45`, `cursor: not-allowed`; focus-visible 3px ring of `color-mix(in srgb, var(--accent) 28%, transparent)` with `border-color: var(--accent)`.
- **Primary button (`.btn-primary`)**: `background: var(--accent)`, `color: var(--accent-contrast)`; hover `var(--accent-hover)`.
- **Input (`.input`)**: height 36px, padding `0 10px`, `1px solid var(--border)`, radius `var(--radius-sm)`, `background: var(--surface)`, 14px; placeholder `var(--muted)`.
- **Field label (`.map-field`)**: column, gap 4px, `color: var(--muted)`, 12px/600.
- **Row label input (`.map-label-input`)**: padding `8px 32px 8px 10px`, border `var(--border)`, radius 8px, 14px/600, pencil icon at right; hover border `var(--muted)`; focus border `var(--accent)` plus 3px `var(--focus-ring)`.
- **Sample chip (`.map-sample`)**: padding `2px 8px`, radius 6px, `background: var(--surface-2)`, 12px, ellipsis.
- **Privacy note (`.map-privacy`)**: flex, gap 8px, padding `10px 12px`, radius `var(--radius-sm)`, `background: var(--surface-2)`, 13px, lock icon coloured `var(--accent)`.
- **Notes (`.map-notes`)**: disc list, 13px, `color: var(--muted)`.
- **Badge (`.badge`)**: pill (`999px`), padding `2px 9px`, 12px/600; `.badge-ok`, `.badge-warn`, `.badge-danger` use the success / warning / danger background and foreground token pairs.
- **Select (`.select-trigger.is-boxed`)**: height 34px, `1px solid var(--border)`, `background: var(--surface)`, 14px, chevron `var(--muted)`. List (`.select-list`): padding 6px, `1px solid var(--border)`, radius 10px, `var(--shadow-md)`, pop-in 0.16s; option padding `8px 10px`, radius 6px, active `var(--surface-2)`, selected `var(--accent)` / 600, hint 12px `var(--muted)`.
- **Link button (`.link-btn`)**: 13px/600, `color: var(--accent)`, underline on hover.
- **Card (`.card`)**: `var(--surface)`, `1px solid var(--border)`, radius `var(--radius)`, padding 20px.
- **Sidebar (`.rail`)**: 236px wide, `var(--rail)`; active item (`.nav-btn.active`) `var(--rail-2)` with a 3px `var(--rail-accent)` marker.
- **Responsive**: `@media (max-width: 720px)` stacks `.map-row` to one column and hides the table head.
