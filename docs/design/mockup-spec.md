# Sympera Scout — Mockup v1 implementation spec

**Source of truth:** the 11 approved artboards on canvas page "Mockup v1" (`/home/claude/mockup/*.dc.html`, titles in `canvas.json`), cross-checked against `plans/06-ui-service-design.md` §3 (tokens) and `plans/07-ui-service-plan.md` §6 (routes, components).
**Scope of this document:** everything an engineer needs to reproduce the artboards faithfully — tokens, shell, every screen's layout/copy/columns, sample data for fixtures, the component inventory, and the inconsistencies found. When the mockup does not show something it is marked **not shown**; nothing below is invented.
**Artboard → route map (from 07 §6.1):** Overview `/` · Jobs-Runs `/jobs` · Jobs-Scouts `/jobs/scouts` · Job-New `/jobs/new` · Job-Detail-Overview `/jobs/$jobId` · Job-Detail-Signals `/jobs/$jobId/signals` · Job-Detail-Tasks `/jobs/$jobId/tasks` · Signals `/signals` · Signals-Drawer `/signals?signal=` · Data-Sources `/sources` · Settings-Workers `/settings/workers`.
**Artboard sizes:** all 1440 px wide; heights 1060–1580 (page scrolls). Preview props: 1440×1040 (Overview, Jobs), 1440×1240 (New run, Job › Overview, Data Sources), 1440×1120 (Job › Signals/Tasks, Signals, Drawer), 1440×1300 (Settings).

---

## 1. Design tokens as used

### 1.1 Colors (every hex found in the artboards)

| Token (06 §3 name) | Hex | Used for (as observed) |
|---|---|---|
| page | `#F6F5FC` | `body` and root background |
| surface | `#FFFFFF` | sidebar, cards, table bodies, buttons, inputs, drawer |
| surface-2 | `#FAF9FE` | table header rows, row hover, sidebar search bg, sidebar footer box, neutral tags, segmented-control track, fan-out rows, suggestion cards, drawer footer, inactive tab-count badge |
| border | `#E7E4F3` | card/table/sidebar/tab borders, row dividers, disabled-button border, task-count chips, attention cards |
| border-strong | `#D9D5EA` | input/select/button borders, pending stage colour (bars, stepper ring, connectors), `⌘K` kbd border, tab divider, "cancelled" dot, "\|" separators |
| ink | `#1C1A33` | body text, headings, primary-button text, stepper check-circle text companion |
| ink-2 | `#4B4A63` | secondary text, inactive nav/tab text, labels, ghost-button text, neutral tag text, neutral status pill fg |
| muted | `#6E6A8A` | subtitles, table headers, meta lines, helper text, sub-labels, icons in inputs, chevron in row-open link |
| faint | `#9C9BB3` | placeholders, breadcrumb chevron, disabled button text, "—" in Last error, tree chevrons, "queued" dot |
| brand-50 | `#F5F1FF` | tonal button bg, selected radio-card bg, evidence blockquote bg |
| brand-100 | `#EEE8FF` | active nav bg, brand tags (batch, operator, finder, fan-out index), filter chips, industry tokens, note banner bg, meter/bar tracks, Medium materiality pill bg, active tab-count badge |
| brand-200 | `#DCD2FF` | tonal button border, evidence blockquote border, Low segment of the materiality split bar |
| brand-300 | `#C5A9FF` | **primary button fill**, current-stage stepper circle fill |
| brand-400 | `#A98BF5` | primary button border, selected radio-card border, Medium segment of the materiality split bar |
| brand-500 | `#8B6CE8` | current stage in StageBar, horizontal bar fills (cost by stage, dead tasks by category) |
| brand-600 | `#6E51D6` | links, "Scout" sub-label, active tab underline, sparkline end segment/dot, meter fills (confidence, precision), radio/checkbox `accent-color`, current-stage stepper ring |
| brand-700 | `#5A3FBE` | active nav text, link hover, brand tag text, filter chip text, tonal button text, current stage label, High segment of the materiality split bar, stepper inner dot |
| ring | `#B2B2FE` | `:focus-visible` outline (2 px, offset 2 px) |
| status running fg/bg | `#1D4ED8` / `#DBEAFE` | Analysing, Discovering, Exploring, Running pills; Live dot; "Auto-refresh" |
| status done fg/bg | `#15803D` / `#DCFCE7` | Completed, Finished, Succeeded, Active, Ready, Healthy, "US exit verified"; done stages; green dots |
| status warn fg/bg | `#92400E` / `#FEF3C7` | Partial, "Retry in 42 s", "Slow heartbeat", "1 dead" (Queue tile), **High materiality pill**, amber note banner, warning sub-labels, slow-worker dot |
| status fail fg/bg | `#B91C1C` / `#FEE2E2` | Failed, Dead pills; danger button text; dead-task error text; "dead" dot; attention icon |
| status neutral fg/bg | `#4B4A63` / `#ECEBF3` | Queued, No sections, Rejected, Removed pills; **Low materiality pill** |
| sparkline line | `#B8B4CF` | polyline stroke (not in 06 §3 — add as `--chart-line-muted`) |
| positive delta | `#006300` | "+18% vs previous 7 days", "+3 this week" (not in 06 §3 — see §6, recommend `#15803D`) |
| failed stage bar | `#D03B3B` | failed segment in StageBar (Jobs-Runs, Cook County) (not in 06 §3 — see §6, recommend `#B91C1C`) |
| white on green | `#ffffff` | check icon colour inside done stepper circle |
| overlay | `rgba(28, 26, 51, 0.22)` | drawer scrim |
| shadow-card | `0 1px 2px rgba(28, 26, 51, 0.04)` | cards, table containers |
| shadow-primary | `0 1px 2px rgba(110, 81, 214, 0.18)` | primary buttons |
| shadow-segment | `0 1px 2px rgba(28, 26, 51, 0.08)` | selected segmented-control button |
| shadow-drawer | `-12px 0 32px rgba(28, 26, 51, 0.12)` | drawer panel |

Dark theme: **not shown** in any artboard (06/07 define dark values; implement from those).

### 1.2 Status word → pill colour map

| Status word (as rendered) | Pair | Dot/icon | Where |
|---|---|---|---|
| Analysing · Discovering · Exploring · Running | running | 6 px dot `#1D4ED8` | jobs, scouts last run, tasks, drawer |
| Finding · Finalizing | — | **not shown** as a pill (only as stage names) | — |
| Queued | neutral | dot `#4B4A63` | jobs, scouts, tasks |
| Completed (job) · Finished (site run) · Succeeded (task) · Active (source) · Healthy (worker/storage) · Ready (API) · US exit verified (proxy) | done | dot `#15803D` | — |
| Partial (job/site run/task) · Retry in 42 s (task) · Slow heartbeat (worker) · 1 dead (queue tile) | warn | dot `#92400E` | — |
| Failed (job) | fail | **triangle-alert icon 12 px, stroke 2.25** instead of dot | Jobs-Runs |
| Dead (task) | fail | dot `#B91C1C` | Tasks |
| No sections (site run) · Rejected (task) · Removed (source) | neutral | dot `#4B4A63` | — |
| Cancelled | — | **not shown** as a pill (filter option only; count-chip dot `#D9D5EA`) | — |

Pill geometry: `inline-flex; align-items:center; gap:6px; height:24px; padding:0 10px; border-radius:999px; font-size:12px; font-weight:600; line-height:1; white-space:nowrap`. Dense variant (signal record cell, task rows, worker rows): `height:22px`. A secondary line under a pill (stop reason) is mono 11 px `#6E6A8A`, `margin-top:4px`.

### 1.3 Materiality ramp

| Level | Pill (as rendered everywhere) | Split-bar segment (Signals explorer) |
|---|---|---|
| High | `#92400E` on `#FEF3C7` (amber) | `#5A3FBE` (brand-700) |
| Medium | `#5A3FBE` on `#EEE8FF` (brand-700 on brand-100) | `#A98BF5` (brand-400) |
| Low | `#4B4A63` on `#ECEBF3` (neutral) | `#DCD2FF` (brand-200) |

Materiality pills have **no dot** (text only), height 22 px. Confidence meters (next to the pill) always fill with `#6E51D6` on a `#EEE8FF` track regardless of materiality. See §6.1 for the pill/ramp conflict.

### 1.4 Typography

- Families: `'Plus Jakarta Sans', 'Segoe UI', 'Helvetica Neue', sans-serif` (weights loaded 400/500/600/700); mono `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace` (weights 400/500). Google Fonts link: `css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap`. `-webkit-font-smoothing: antialiased`.
- Root: 14 px / line-height 1.45, colour ink.
- Scale actually used:

| Role | Size / weight / tracking |
|---|---|
| Page title `h1` | 26 px / 700 / −0.02em / lh 1.2 |
| Stat tile value | 30 px / 600 / −0.02em / lh 1 |
| Drawer title `h2` | 20 px / 700 / −0.01em |
| Counter-strip value | 18 px / 600 / −0.01em |
| Logo wordmark | 16 px / 700 / −0.01em |
| Card title `h2` | 15 px / 700 / −0.01em (plain 700 on "Active runs", "Site runs", "Workers", health tiles) |
| Body, nav items, tabs, md buttons, inputs, page subtitle, evidence blockquote | 14 px (500 nav/tab inactive; 600 nav/tab active & buttons) |
| Table cells, filters, sm buttons, meta lines, helper paragraphs, card subtitles, tile labels (600) | 13 px |
| Table headers (600, uppercase, +0.02em), tags, pills, sub-labels, xs buttons, tree ids, chips, stat sub-labels | 12 px |
| Logo sub-label "SCOUT" (600, uppercase, +0.06em), tab count badges (600), `⌘K` kbd (600), sub-industry / article-title sub-lines, bar sub-labels, "attempt n / m", stop-reason mono | 11 px |
| Drawer section heads `h3` | 12 px / 700 / uppercase / +0.04em / muted |

- Numeric columns and figures: `font-variant-numeric: tabular-nums`.
- Mono is used for: job ids (short 8-char and full UUID), task ids (`#48811`), task kinds, worker instance names and versions, stop reasons / error codes, settings values (`full`, `off`, `scout-7-2026-10-04`), `kind` and `prompt` tags, enrichment version, fan-out index badges, maintenance job names, dead-task categories.

### 1.5 Radii, sizes, spacing

| Thing | Value |
|---|---|
| Cards, table containers | 12 px |
| Controls: buttons, inputs, selects, nav items, industry tokens, fan-out rows, "Across jobs" box | 8 px |
| Note banners, attention cards, radio cards, segmented-control track, summary strips, suggestion cards, sidebar footer box, evidence blockquote | 10 px |
| Segmented-control button | 7 px |
| Tags (neutral / brand / white) | 6 px |
| `⌘K` kbd, materiality split bar | 5 px |
| StageBar segments, legend squares | 3 px |
| Pills, filter chips, meters | 999 px |
| Dots, avatars | 50 % |
| Bars (cost/dead tasks) | `0 4px 4px 0` |
| Button heights | md 40 · sm 32 · xs 28 (icon-only: 40/32/28 square; copy button 24) |
| Input/select heights | form 40 · toolbar 36 |
| Table header row | 40 px |
| Table rows | 48 (jobs, scouts, site runs, overview) · 44 (workers) · 52 (tasks) · 64 (sources) · 72 (signals) — see §6.11 for compact |
| Cell padding | `10px 12px` (first cell left 20, last cell right 20); signal tables `10px 10px` (20 at edges) |
| Card padding | 20 px (stat tiles `18px 20px`); card internal gap 16 |
| Page gutter | main `padding: 28px 32px 40px`, vertical gap 20 between regions |
| Grid gaps | KPI row 16; two-column body 20; filter row 8; action group 10 (header) / 4–6 (row actions) |

### 1.6 Hover / focus / interaction styles (global CSS in every artboard)

```css
a { color:#6E51D6; text-decoration:none }  a:hover { color:#5A3FBE; text-decoration:underline }
nav a:hover { text-decoration:none }        aside nav a:hover { color:#1C1A33; background:#FAF9FE }
button:hover { filter:brightness(0.97) }    tbody tr:hover { background:#FAF9FE }
input::placeholder { color:#9C9BB3 }
a:focus-visible, button:focus-visible, select:focus-visible, input:focus-visible { outline:2px solid #B2B2FE; outline-offset:2px }
```
Disabled buttons: `color:#9C9BB3; border-color:#E7E4F3; background:#FFFFFF; cursor:default`. No pressed/active styles shown.

### 1.7 Icons (Lucide, 24-grid, `fill:none; stroke:currentColor; stroke-linecap/linejoin:round`)

Sizes: nav 18 px @ stroke 1.75 · md-button 16 px @ 2 · sm/xs-button 14 px @ 2 · toolbar icon-buttons 16 px @ 2 · sidebar search 15 px @ 2 · breadcrumb chevron 14 px · text-link chevron 13 px @ 2.25 · failed-pill icon 12 px @ 2.25 · chip × 12 px @ 2.5 · stepper check 14 px @ 2.5 · tree chevron 12 px @ 2 · row-open chevron 18 px @ 2.

| Lucide name | Where |
|---|---|
| `search` | sidebar search, every toolbar search |
| `layout-dashboard` · `briefcase` · `activity` · `database` | nav: Overview · Jobs · Signals · Data Sources |
| *(custom three-slider glyph — see note)* | nav: Settings |
| `plus` | New run, Add source, Add filter, Add to sources |
| `refresh-cw` | Overview "Refresh" |
| `chevron-right` / `chevron-left` / `chevron-down` | links, breadcrumbs, row open, tree, pagination, selects, Export menu caret, "Hide advanced" |
| `triangle-alert` | Failed pill, dead-task attention item |
| `clock` | partial-run attention item |
| `server` | slow-worker attention item |
| `bookmark` | "New Scout" |
| `rows-2` | density toggle (`aria-label="Toggle density"`) |
| `columns-2` | column chooser (`aria-label="Choose columns"`) |
| `download` / `upload` | Export CSV / Import CSV |
| `square` | Cancel / Cancel run (stop) |
| `ellipsis` | row "More actions", header more-actions |
| `rotate-ccw` | Resume, Retry, Retry all dead |
| `play` | Run (scout), Re-run, Create 3 jobs |
| `x` | remove token/chip, close drawer |
| `info` | note banners |
| `copy` | copy job id |
| `check` | done stepper step, drawer "verbatim match" / "name grounded" |
| `save` | Save view |
| `external-link` · `file-text` · `link` | drawer: Open article · Saved text · Copy link |

Settings nav icon note: the drawn path (`M4 7h9 / circle 16,7 r2 / M18 7h2 / M4 12h3 / circle 10,12 r2 / M12 12h8 / M4 17h11 / circle 18,17 r2`) is a three-row slider glyph that matches no current Lucide icon exactly; closest are `settings-2` / `sliders-horizontal`. Use `settings-2` or inline the mockup path for pixel fidelity.

---

## 2. App shell

### 2.1 Frame
Root: `display:flex; flex-wrap:wrap; min-height:100vh; background:#F6F5FC`. Sidebar `flex:0 0 240px`; main `flex:999 1 560px; min-width:0; display:flex; flex-direction:column; gap:20px; padding:28px 32px 40px`. No `max-width` on main (**not shown**); content width at 1440 is 1136 px. Responsive behaviour below 800 px: **not shown** (the flex-wrap lets the sidebar stack above main).

### 2.2 Sidebar (`<aside>`, bg `#FFFFFF`, `border-right:1px solid #E7E4F3`, `padding:20px 16px`, column gap 20)
1. **Logo block** — `<a href="/">`, flex gap 10, padding `4px 8px`, radius 8: `<img alt="Sympera AI logo">` 32×32 radius 8 (`sympera-logo.png`, lavender four-lobe mark) + two stacked lines (lh 1.15): "Sympera AI" 16/700/−0.01em ink; "Scout" rendered uppercase (`SCOUT`) 11/600/+0.06em `#6E51D6`.
2. **Search** — `<input type="search" aria-label="Search jobs, companies and signals" placeholder="Search…">` h36, padding `0 44px 0 32px`, 13 px, bg `#FAF9FE`, border `#E7E4F3`, radius 8; `search` icon 15 px at `left:11px` muted; `<kbd>⌘K</kbd>` at `right:8px` (11/600 muted, bg white, border `#D9D5EA`, radius 5, padding `1px 5px`). The palette itself is **not shown**.
3. **Nav** (`<nav aria-label="Main">`, column gap 4) — items `Overview`, `Jobs`, `Signals`, `Data Sources`, `Settings`; each `<a>` h40, padding `0 12px`, radius 8, gap 10, 14 px. Inactive: transparent, `#4B4A63`, 500. Active (`aria-current="page"`): bg `#EEE8FF`, `#5A3FBE`, 600. Hover: bg `#FAF9FE`, ink. Jobs is active on Jobs › Runs, Jobs › Scouts, New run and all Job detail tabs; Signals on explorer + drawer.
4. **Footer box** (`margin-top:auto`, padding 12, border `#E7E4F3`, radius 10, bg `#FAF9FE`, gap 10): line 1 — 8 px dot `#15803D` + "API ready · production" (12/600 `#4B4A63`); line 2 — "daniel-ops" (12 px muted) left, brand tag "operator" right (h22, padding `0 8px`, radius 6, `#EEE8FF`/`#5A3FBE`, 12/600). Sign-out / user menu: **not shown**.

### 2.3 Page header pattern (`<header>` column gap 10)
- Optional **breadcrumbs** `<nav aria-label="Breadcrumb">` 13 px, gap 6: link `#6E6A8A`/500 → `chevron-right` 14 px `#9C9BB3` → current `#4B4A63`/600. Used on New run (`Jobs › New run`) and Job detail (`Jobs › 0192f1c2`).
- **Title row** (`flex; wrap; justify-content:space-between; gap:16`): left block (`flex:1 1 480px`, gap 6) with `h1` + optional StatusPill (`margin-left:4px`) on the same line (gap 12) and either a subtitle `<p>` (14 px muted) or a **meta line** (13 px muted, `gap:8px 14px`, wraps): mono id + copy button (24×24 ghost), `kind` + mono neutral tag, `prompt` + mono neutral tag, "created today 11:02 by **daniel-ops**", "Scout [link] · run 7 · [batch tag]".
- **Actions** right (`flex:0 0 auto; gap:10`): md buttons — primary first on list pages; on Job detail: `Cancel run` (danger-secondary) · `Resume` (disabled) · `Export CSV ▾` (secondary with caret) · `⋯` (40×40 secondary icon button, `aria-label="More actions"`).

### 2.4 Tabs pattern (`<nav aria-label="Sections">`, `border-bottom:1px solid #E7E4F3`, gap 20, wraps)
Tab `<a>` h40, padding `0 4px`, `margin-bottom:-1px`, 14 px; inactive `border-bottom:2px solid transparent`, `#4B4A63`, 500; active `border-bottom:2px solid #6E51D6`, `#5A3FBE`, 600, `aria-current="page"`. Optional count badge: h18, padding `0 6px`, radius 999, 11/600 — active `#EEE8FF`/`#5A3FBE`, inactive `#FAF9FE`/`#6E6A8A`. A vertical divider (`1px × 20px #D9D5EA`, `margin:0 4px`) separates results tabs from operations tabs on Job detail.

### 2.5 Buttons (shared geometry: inline-flex, centered, gap 8, radius 8, 600, `white-space:nowrap`)

| Variant | Colours | Examples |
|---|---|---|
| Primary | bg `#C5A9FF`, border `#A98BF5`, text ink, shadow-primary | New run, Add source, Run (sm), Create 3 jobs |
| Secondary | bg white, border `#D9D5EA`, text ink | Refresh, New Scout, Export CSV, Cancel, Re-run, Edit, Work items, Logs, Open article, Saved text, Copy link, Export row, Restore, Next |
| Danger-secondary | secondary with text `#B91C1C` | Cancel run (md), Retry all dead (sm), Remove (xs) |
| Tonal | text `#5A3FBE`, bg `#F5F1FF`, border `#DCD2FF` | Resume (row), Retry (dead row), Add filter, Add to sources |
| Ghost | transparent bg+border, text `#4B4A63` | Exploration, Details, Dismiss, Drain, Summary record, Hide advanced, ⋯ row menus, Clear all (no border, muted text) |
| Disabled | text `#9C9BB3`, border `#E7E4F3`, cursor default | Resume (header while running), Previous |
| Text link | 13/500 `#6E51D6`, optional trailing `chevron-right` 13 px | All jobs ›, Open tab ›, Open profile ›, Open dead tasks ›, Open explorer, View all, Details, How Scouts work, See all 11, Failures view |

Sizes: md h40 `0 16px` 14 px (icon 16) · sm h32 `0 12px` 13 px (icon 14) · xs h28 `0 10px` 12 px (icon 14).

---

## 3. Screens

### 3.1 Overview (`Overview.dc.html`, route `/`)

**Layout (top → bottom):** header → KPI row (4 tiles, `flex-wrap; gap:16`, each `flex:1 1 220px`) → two-column body (`gap:20; align-items:flex-start`): left `flex:999 1 640px` = Active runs table + Recent signals card; right `flex:1 1 320px` = Needs attention card + Workers card.

**Header:** `h1` "Overview"; subtitle "Everything running right now, and what needs you"; actions: `[+ New run]` primary → `/jobs/new`; `[⟳ Refresh]` secondary.

**Stat tiles** (label 13/600 muted · value 30/600 · sub-labels; sparkline 96×28 at right when present):

| Title | Value | Sub-label 1 (12/600) | Sub-label 2 (12 muted) | Sparkline |
|---|---|---|---|---|
| Running jobs | 4 | "2 queued · 1 finalizing" (muted) | "across 3 Scouts" | — |
| Signals · last 7 days | 128 | "+18% vs previous 7 days" (`#006300`) | — | yes |
| Model + proxy cost · today | $14.20 | "+$3.10 vs yesterday" (muted) | — | yes |
| Dead tasks | 2 | "1 new since yesterday" (`#92400E`) | "retry from the job's Tasks tab" | — |

Sparkline anatomy: `<svg width=96 height=28 viewBox="0 0 96 28" aria-hidden>`; polyline stroke `#B8B4CF` 2 px round; last segment redrawn as a `<line>` stroke `#6E51D6` 2 px; end `<circle r=3.5 fill=#6E51D6 stroke=#FFFFFF stroke-width=2>`. 12 points, x = 2 … 94 step 8.36. Points — signals: `25,20,23,17,19,13,15,10,16,12,7,3`; cost: `25,19.5,22.2,16.8,8.5,14,11.2,5.8,16.8,8.5,11.2,3` (y values, 3 = top).

**Active runs** — section title `h2` "Active runs" (15/700) with text link "All jobs ›" → `/jobs`. Table `aria-label="Active runs"`, `min-width:640px`, rows 48:

| # | Header | Align | Cell anatomy |
|---|---|---|---|
| 1 | Job | left | line 1: link (600, ink, nowrap) "County, ST · Industry" → job detail; line 2 (12 muted, gap 6): mono short id · "·" · brand tag "batch n of 3" (only batch jobs) |
| 2 | Status | left | StatusPill |
| 3 | Stages | left | StageBar 84 px |
| 4 | Sites | right, tabular | "5 / 5" or "—" |
| 5 | Signals | right | "24" or "—" |
| 6 | Cost | right | "$3.12" or "—" |

**Recent signals** card — `h2` "Recent signals", sub "newest first, all jobs", link "Open explorer" → `/signals`. List of 5 rows (`padding:10px 0`, divider `#E7E4F3`, whole row is a link → drawer): company (600) over "Signal · County, ST · Mon D" (12 muted); right: materiality pill h22.

**Needs attention** card — `h2` "Needs attention", sub "3 items", link "View all" → Settings › Workers. Three link cards (padding 12, border `#E7E4F3`, radius 10, gap 10, icon 16 px top-left):
1. `triangle-alert` `#B91C1C` — "1 dead task · analyze_article" / "saved_content_unavailable · Orange County, FL · Construction" → Job › Tasks.
2. `clock` `#92400E` — "Partial run waiting for a decision" / "Maricopa County, AZ · Retail Trade · stopped on site_time_limit · resume?" → Jobs › Runs.
3. `server` `#92400E` — "analysis-2 heartbeat is slow" / "last seen 47 s ago · lease expires in 13 s" → Settings › Workers.

**Workers** card — `h2` "Workers", sub "8 instances · proxy exit US verified 4 min ago", link "Details" → Settings › Workers. Rows h32: 8 px dot + role (500) left, "N instance(s)" (12 muted) right: api 1 · maintenance 1 · finder 1 · sections 1 · discovery 2 · analysis 2 (analysis dot amber `#92400E`, all others green).

States: loading/empty/error **not shown**. Live indicator: none on this page (only "Refresh").

### 3.2 Jobs › Runs (`Jobs-Runs.dc.html`, route `/jobs`)

**Layout:** header → tabs → toolbar (filters left, table tools right) → table → pagination footer.

**Header:** `h1` "Jobs"; subtitle "Runs and the saved Scouts that launch them"; actions `[+ New run]` primary, `[🔖 New Scout]` secondary (both → `/jobs/new`).
**Tabs:** `Runs` (badge 12, active) · `Scouts` (badge 5).

**Toolbar (left, gap 8):**
- Search input (w 230, h36, white, border `#D9D5EA`, icon 16 at left 11): placeholder/aria "Search county, industry, domain, id".
- Selects (h36, padding `0 34px 0 12px`, 13/500, chevron-down 16 at right 11): `Status` [Status: all, Running, Queued, Completed, Partial, Failed, Cancelled] min-w 118 · `State` [State: all, FL, CO, TX, AZ, GA, IL] 100 · `County` [County: all, Orange, Jefferson, Harris, Maricopa, Fulton] 118 · `Industry` [Industry: all, Construction, Manufacturing, Retail Trade, Wholesale Trade, Utilities] 130 · `Created` [Last 7 days, Today, Last 30 days, Custom range] 120.
**Toolbar (right, gap 8):** `rows-2` icon button 32×32 "Toggle density" · `columns-2` 32×32 "Choose columns" · `[⤓ Export CSV]` sm secondary. Column-chooser popover and density compact state: **not shown**.

**Table** `aria-label="Runs"`, `min-width:1000px`, rows 48, sticky header **not shown**, sort indicators **not shown**:

| # | Header | Align | Cell anatomy |
|---|---|---|---|
| 1 | Job | left | link "County, ST · Industry" (600) / mono id · "location + industry" \| "seeds" (kind label) · optional brand tag "batch n of 3" |
| 2 | Status | left | StatusPill; Partial/Failed add a second line with mono 11 px stop reason (`site_time_limit`, `no_sources_found`) |
| 3 | Stages | left | StageBar 84 px (failed stage segment `#D03B3B`) |
| 4 | Sites | right | "5 / 5", "0 / 0", "—" |
| 5 | Articles | right | number or "—" |
| 6 | Signals | right | number or "—" |
| 7 | Cost | right | "$3.12" |
| 8 | Started | left, `#4B4A63` | "Today 11:02" over duration "29 min" (12 muted; "—" when queued) |
| 9 | *(no header)* | right | row actions sm: Running/Queued → `[▢ Cancel]` secondary (`aria-label="Cancel job 0192f1c2"`); Partial → `[↺ Resume]` tonal; Completed/Failed → `[▶ Re-run]` secondary ("Run job … again"); always `⋯` ghost 32×32 "More actions for job …" (menu items **not shown**) |

**Footer:** "Showing 1–8 of 12 runs" (13 muted) left; right `[‹ Previous]` (disabled) `[Next ›]` sm secondary.

### 3.3 Jobs › Scouts (`Jobs-Scouts.dc.html`, route `/jobs/scouts`)

Same header/tabs (Scouts active, badge 5 brand; Runs badge 12 neutral).

**Note banner** (`role="note"`, bg `#EEE8FF`, text `#4B4A63`, `info` icon `#5A3FBE`, padding `10px 14px`, radius 10): "A Scout is a saved setup: location, county, industries and sources. Running it creates one API job per industry; the runs stay listed under Runs." Right link "How Scouts work" (`href="#"`).

**Toolbar:** search w 280 "Search Scouts" · `State` [State: all, FL, CO, TX, AZ, GA] 110 · `Industry` [Industry: all, Construction, Manufacturing, Retail Trade, Wholesale Trade] 150 · right: density + columns icon buttons (no export).

**Table** `aria-label="Scouts"`, `min-width:1100px`, rows 48:

| # | Header | Align | Cell anatomy |
|---|---|---|---|
| 1 | Scout | left | name link (600) → *prototype links to Job detail* / "County, ST" 12 muted |
| 2 | Industries | left | neutral tags (h22, `#FAF9FE`/`#4B4A63`) wrap gap 6 |
| 3 | Sources | left, `#4B4A63` | "Finder · top 5 sites" or "4 seeds from Data Sources" |
| 4 | Schedule | left | "Manual" (all rows) |
| 5 | Last run | left | StatusPill over relative time 12 muted ("29 min ago", "just now", "yesterday", "2 days ago") |
| 6 | Runs | right | count |
| 7 | Signals (last run) | right | count or "—" |
| 8 | *(no header)* | right | `[▶ Run]` **primary sm** ("Run Scout {name}") · `[Edit]` secondary sm · `⋯` ghost ("More actions for Scout {name}") |

No pagination footer shown.

### 3.4 New run / Scout (`Job-New.dc.html`, route `/jobs/new`)

**Layout:** breadcrumbs `Jobs › New run` → header → two columns (`gap:20`): left `flex:999 1 560px` = three cards (Target, Sources, Settings); right `flex:1 1 320px; max-width:380px` = Summary card `position:sticky; top:24px`.
**Header:** `h1` "New run"; subtitle "Launch one job per industry, or save the setup as a Scout to run again later". No header actions.

**Card "Target"** (sub "Where to look and what to look for"):
- Label (13/600 `#4B4A63`) "How should the pipeline find articles?" + **segmented control** (`role="group" aria-label="Mode"`, track bg `#FAF9FE`, border `#E7E4F3`, radius 10, padding 3, gap 2): `Location + industries` (`aria-pressed=true`: white, border `#D9D5EA`, radius 7, shadow-segment, ink) · `Site URL` · `Seeds from Data Sources` (transparent, `#4B4A63`). The Site URL and Seeds modes' field sets are **not shown**.
- Mode helper (13 muted): "The finder searches the web for local news sites that cover each industry, ranks them, and explores the top sites."
- Row (two fields `width:calc(50% - 8px)`, gap 16): `State` select (h40) options "Florida (FL)" (selected), "Colorado (CO)", "Texas (TX)", "Arizona (AZ)", "Georgia (GA)" · `County` text input value "Orange" + helper "Required for every job: HQ scope and entity flags are derived relative to it." No visual required-marker (asterisk) is shown; "Required" is stated in helper text.
- `Location phrase for the finder` text input value "Orlando, FL" + helper "Pre-filled from the county; edit if the local press uses a different name."
- `Industries` multi-select box (`min-height:48; padding:8px 10px; border #D9D5EA; radius 8`, tokens h30 radius 8 `#EEE8FF`/`#5A3FBE` 13/600 with 20 px × button "Remove {industry}"): tokens Construction, Manufacturing, Wholesale Trade; inline input placeholder "Add an industry…". Helper: "Pick from the NAICS industry catalog. Each industry becomes its own job for this county." Dropdown/catalog UI **not shown**.
- **Fan-out preview:** "This will create 3 jobs" (13/600) + "(location, [industries]) fans out to one job per industry; they share a batch id so you can track them together)" (12 muted) — note the unbalanced closing parenthesis is in the mockup copy. Then 3 rows (padding `10px 12px`, border `#E7E4F3`, radius 8, bg `#FAF9FE`): mono brand tag "1"/"2"/"3" + "Orange County, FL · Construction|Manufacturing|Wholesale Trade" (600) left; "finder · top 5 sites · ~30–60 min" (12 muted) right.

**Card "Sources"** (sub "Who supplies the sites to explore") — two radio cards (`name="sources"`, radio `accent-color:#6E51D6`):
1. checked, border `#A98BF5`, bg `#F5F1FF`: "Let the finder search and rank sites" / "Up to 5 sites per job (setting: sites). Judged domains are remembered for 180 days, so repeat runs are cheaper."
2. border `#D9D5EA`, white: "Use the curated seeds for this county" / "4 active sources match Orange County, FL in Data Sources. Skips the finder; each seed becomes a site run."

**Card "Settings"** (sub "Saved with the job; a resume can override site timeout and memory mode"):
- Row: "Defaults come from the platform settings · prompt version `2026.10`" (13 muted, version mono) left; ghost sm `[Hide advanced ⌄]` right (collapsed label **not shown**; shown expanded).
- Advanced grid `repeat(3, 1fr)` gap 16: `Days to look back` number 30 · `Sites per job` number 5 · `Site timeout (s)` number 0 + helper "0 = no per-site limit" · `Max runtime (s)` number 18000 · `Memory mode` select [full (selected), pages_only, off] · `Re-analysis` select ["Reuse summaries on matching prompt version" (selected), "Re-analyse every article (reanalyze)"].

**Card "Summary"** (sticky): 2-col grid gap 14 of label (12 muted) / value (13/600; mono for Kind, Prompt version): Kind `location_industry` · County · State "Orange County · FL" · Jobs to create "3" · Sources "Finder · top 5 sites" · Prompt version `2026.10` · Estimated cost "≈ $3 per job". Footnote: "Estimate from the last 10 completed runs with these settings (model + proxy)." Divider, then checkbox (16 px, accent brand) "Save as Scout" (checked, 600) + field `Scout name` value "Orange County builders". Buttons stacked (gap 8): `[▶ Create 3 jobs]` primary md → `/jobs`; `[Cancel]` secondary md → `/jobs`. Validation/error states: **not shown**.

### 3.5 Job › Overview (`Job-Detail-Overview.dc.html`, route `/jobs/$jobId`)

**Layout:** breadcrumbs → header (title + pill + meta + actions) → "Pipeline progress" card (stepper + counters) → tabs → Site runs section (title + table) → 2-up grid (`repeat(auto-fit, minmax(min(380px,100%),1fr))`, gap 20): Cost by stage card, Settings card.

**Header:** breadcrumbs `Jobs › 0192f1c2`; `h1` "Orange County, FL · Construction" + pill "Analysing"; meta line: `0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41` (mono 12) + copy button (`aria-label="Copy job id"`) · "kind" `location_industry` (mono neutral tag) · "prompt" `2026.10` · "created today 11:02 by **daniel-ops**" · "Scout [Orange County builders] · run 7 · [batch 1 of 3]". Actions: `[▢ Cancel run]` danger-secondary · `[↺ Resume]` disabled · `[⤓ Export CSV ⌄]` secondary · `⋯`. Export menu items **not shown** (06 §1: one CSV per table).

**Pipeline progress card:** `h2` "Pipeline progress", sub "Live · refreshed 4 s ago"; right: 8 px dot `#1D4ED8` + "Auto-refresh every 5 s" (12/600 `#1D4ED8`).
**Stepper** (5 equal columns `flex:1 1 0`, each: node row + label block `padding-right:12`):

| Stage | Node | Connector after | Label colour | Line 2 (12 muted) | Line 3 (12 `#4B4A63`) |
|---|---|---|---|---|---|
| Finding | done: 24 px circle `#15803D`, `check` 14 px white | 2 px `#15803D` | 700 ink | 2 min | 14 queries · 23 domains judged · 5 kept |
| Exploring | done | `#15803D` | ink | 6 min | 5 sites · 11 sections kept · 1 no_sections |
| Discovering | done | `#15803D` | ink | 18 min | 99 pages · 26.3K links · 40 articles |
| Analysing | **current**: 24 px circle bg `#C5A9FF`, `border:2px solid #6E51D6`, inner 8 px dot `#5A3FBE` | `#D9D5EA` | 700 `#5A3FBE` | 9 min so far | 31 / 40 summaries · 139 companies · 24 signals |
| Finalizing | pending: 24 px circle white, `border:2px solid #D9D5EA` | none | 700 `#6E6A8A` | — | summary, costs and coverage |

Connector: `flex:1 1 auto; height:2px; margin:0 8px`. Failed/cancelled stepper states: **not shown**.

**Counter strip** (below `border-top`, `padding-top:16`): left group of 8 counters (label 12 muted / value 18/600; each `padding-right:20; border-right:1px #E7E4F3; margin-right:20`): Seeds 5 · Sections 11 · Pages 99 · Links 26.3K · Articles 40 · Summaries 31 / 40 · Companies 139 · Signals 24. Right group (gap 24; label 12 / value 13/600): Cost so far "$3.12 · 1.6M tokens" · Elapsed "29 min · deadline in 4 h 31 min" · Tasks "9 queued · 2 running · 1 dead".

**Tabs:** Overview (active) · Signals 24 · Companies 139 · Summaries 31 · Articles 40 │ Site runs 5 · Sections 11 · Tasks 2 · Events. Only Overview/Signals/Tasks are designed; others `href="#"`.

**Site runs** section: `h2` "Site runs" + link "Open tab ›" (`#`). Table `aria-label="Site runs"`, `min-width:900px`, rows 48:

| # | Header | Align | Cell |
|---|---|---|---|
| 1 | Site run | left | domain link (600, `#`) / "rank n · finder" 12 muted |
| 2 | Status | left | pill: Finished / Partial / No sections |
| 3 | Sections | right | int |
| 4 | Pages | right | int |
| 5 | Articles | right | int |
| 6 | Fetched | right | "21.4 MB" |
| 7 | Stop reason | left | mono 12 `#4B4A63` (`no_new_accepted_articles`, `site_time_limit`, `no_sections`) |
| 8 | Duration | right | "27 min" |
| 9 | — | right | xs `[Work items]` secondary · `[Exploration]` ghost |

**Cost by stage** card: `h2` + sub "$3.12 · from the model-call ledger". Rows: grid `128px minmax(0,1fr) 56px`, gap 12; label (13/500) over "N calls · N tokens" (11 muted); bar track h18 `#EEE8FF` radius `0 4px 4px 0`, fill `#8B6CE8` width % of max; value 13 tabular right. Footnote 12 muted: "Proxy traffic: 56.8 MB so far (billed per GB, shown separately once priced)."
**Settings** card: `h2` "Settings", sub "Saved at creation; resume overrides are audited per site run"; 2-col grid of label/value (mono for Memory, Reanalyze, Client ref): Days 30 · Sites 5 · Site timeout none · Max runtime 5 h · Memory `full` · Reanalyze `off` · Client ref `scout-7-2026-10-04` · Location "Orlando, FL".

### 3.6 Job › Signals tab (`Job-Detail-Signals.dc.html`, route `/jobs/$jobId/signals`)

Header identical to 3.5. Then a **compact summary strip** (white, border `#E7E4F3`, radius 10, padding `10px 16px`, 13 px `#4B4A63`, gap 16): StageBar **140 px** · "**Analysing** · 31 / 40 summaries" · "|" (`#D9D5EA`) · "139 companies · 24 signals" · "|" · "$3.12 · 29 min" · right-aligned Live indicator (8 px dot + "Live", 12/600 `#1D4ED8`). Then tabs (Signals active, badge 24 brand).

**Toolbar left:** search w 250 "Search company, signal or evidence" · `Signal` [Signal: all, Major Contract Awarded, Mass Hiring, Operational Capacity Expansion, Closed Deal] 130 · `Materiality` [Materiality: all, High, Medium, Low] 130 · `Org kind` [Org kind: all, business, gov, nonprofit] 120 · `HQ scope` [HQ scope: all, local, state, national, unknown] 120 · `Industry` [Industry: all, Construction, Manufacturing, Real Estate, Public Administration] 120 · `Revenue bin` [Revenue: all, <$1M, $1M-$10M, $10M-$20M, $20M-$50M, $50M-$100M, $100M-$500M, >$500M] 120.
**Toolbar right:** density · columns · `[⤓ signals.csv]` sm secondary (label is the filename).

**Table** `aria-label="Signals of this job"`, `min-width:1000px`, rows **72**, cell padding `10px 10px` (20 at edges):

| # | Header | Align | Cell anatomy |
|---|---|---|---|
| 1 | Signal | left | **Record cell** (`max-width:330px`, column gap 5): line 1 — company link (600, nowrap → drawer) + org-kind neutral tag (`business`/`gov`); line 2 — signal type (500, nowrap) + materiality pill h22 + Meter (44×6, track `#EEE8FF`, fill `#6E51D6` = confidence %) + "0.92" (12 `#4B4A63` tabular); line 3 — evidence quote in curly quotes, 12 px `#4B4A63`, single line ellipsis |
| 2 | HQ city · scope | left | city (nowrap) over neutral tag `local`/`state` |
| 3 | HQ state | left | "FL" |
| 4 | Industry | left | industry over sub-industry (11 muted, ellipsis, `max-width:130`) |
| 5 | Revenue bin | left | "$10M-$20M", "unknown", "NA" |
| 6 | Date | left | "Oct 2, 2026" |
| 7 | Source | left | domain link (500, ellipsis, `max-width:130`) over article title (11 muted, ellipsis) |
| 8 | — | right | `chevron-right` 18 px muted link `aria-label="Open signal details"` → drawer |

**Footer:** "Showing 1–8 of 24 signals · 18 companies · HQ city, state and industry come from the enrichment flags (scope_place, hq_state, company_industry); date is the article's published date" + Previous (disabled) / Next.

### 3.7 Job › Tasks tab (`Job-Detail-Tasks.dc.html`, route `/jobs/$jobId/tasks`)

Header + summary strip identical to 3.6; tabs with Tasks active (badge 2).

**Toolbar left — status count chips** (h32, padding `0 12px`, border `#E7E4F3`, radius 8, white, 13 px; 8 px dot + word `#4B4A63` + bold count): queued 9 (`#9C9BB3`) · running 2 (`#1D4ED8`) · succeeded 61 (`#15803D`) · "failed · retrying" 1 (`#92400E`) · dead 1 (`#B91C1C`) · cancelled 0 (`#D9D5EA`).
**Toolbar right:** `Kind` select [Kind: all, find_sources, rank_sites, explore_site, discover_site, analyze_article, finalize_job] 150 · `Status` [Status: all, queued, running, succeeded, failed, dead] 130 · checkbox "Show as tree" (checked) · `[↺ Retry all dead]` sm danger-secondary.

**Table** `aria-label="Tasks of this job"`, `min-width:960px`, rows **52**:

| # | Header | Align | Cell anatomy |
|---|---|---|---|
| 1 | Kind · task | left, nowrap | indent spacer (0 / 18 / 36 / 54 / 72 px by depth) + `chevron-right` 12 px `#9C9BB3` (`margin-right:6`, children only) + kind (mono 12 ink) over "#48811" (mono 11 muted) |
| 2 | Target | left | `#4B4A63`, `max-width:170`, ellipsis, full text in `title` tooltip |
| 3 | Status | left | pill h22 (Succeeded / Running / Retry in 42 s / Dead / Partial / Rejected / Queued) over "attempt n / m" (11 muted) |
| 4 | Worker | left | mono 12 `#4B4A63` ("finder-1", "—") |
| 5 | Started · duration | right | "11:02:04" over "2 m 11 s" (12 muted; "—") |
| 6 | Last error | left | `max-width:180; line-height:1.3`; "—" faint; 12 px `#4B4A63` for retrying/partial/rejected; **`#B91C1C`** for dead |
| 7 | — | right | xs ghost `[Details]`; dead rows: xs tonal `[↺ Retry]` |

Tree: root `find_sources` → `rank_sites` → `explore_site` → `discover_site` → `analyze_article`×4; `finalize_job` at root. Flat (non-tree) layout **not shown**. Task details view **not shown**.
**Amber note banner** below table (bg `#FEF3C7`, icon `#92400E`, text `#4B4A63`): "Dead tasks stop retrying after max attempts; the job finishes as partial. Retry resets attempts to 0 and re-queues the task; the job returns to analysing."

### 3.8 Signals explorer (`Signals.dc.html`, route `/signals`)

**Layout:** header → toolbar (search + saved view | density + columns) → active-filter chip row → materiality summary strip → table → pagination.
**Header:** `h1` "Signals"; subtitle "Every signal detected across jobs, with the evidence behind it"; actions `[⤓ Export CSV]` secondary · `[💾 Save view]` secondary · `[+ New run]` primary.
**Toolbar:** search w 320 "Search company, signal, evidence or domain" · `Saved view` select min-w 220 [View: Florida construction (selected), View: all signals, View: high materiality this week, Manage views…] · right: density, columns.
**Filter chips** (h30, padding `0 6px 0 12px`, radius 999, `#EEE8FF`/`#5A3FBE`, 12/600, 20 px × "Remove filter {label}"): "Date: last 7 days" · "State: FL, TX, CO" · "Materiality: high, medium" · `[+ Add filter]` xs tonal · "Clear all" (ghost, muted, no border) · right-aligned "128 signals · 61 companies · 9 jobs" (13 muted). The Add-filter picker (state, county, industry, signal, materiality, revenue bin, org kind, HQ scope, date, job per 06 §1) is **not shown**.
**Materiality strip** (white box, radius 10, padding `12px 16px`, gap 20): "By materiality" (13/600) · split bar 320×10 (gap 2, radius 5): `#5A3FBE` 17 % · `#A98BF5` 56 % · `#DCD2FF` 27 % · legend (10 px squares radius 3): High **22** · Medium **71** · Low **35** · right: "Top signal this week: Mass Hiring (19)" (12 muted).

**Table** `aria-label="Signals across jobs"`, `min-width:1000px`, rows 72:

| # | Header | Align | Cell anatomy |
|---|---|---|---|
| 1 | Signal | left | Record cell as 3.6 but `max-width:280px`; evidence shown trimmed (company name dropped from the start of the quote) |
| 2 | HQ city | left | plain text, **no scope chip** |
| 3 | HQ state | left | "FL" |
| 4 | Industry | left | industry / sub-industry |
| 5 | Revenue bin | left | |
| 6 | Date | left | |
| 7 | Job location · source | left | "Orange, FL" over "Construction · orlandomagazine.com" (11 muted, `max-width:140`, ellipsis) |
| 8 | Job | left | short id as text link, 12/500 `#6E51D6` (sans, **not** mono here) → job detail |
| 9 | — | right | open-drawer chevron |

**Footer:** "Showing 1–9 of 128 signals" + Previous/Next.

### 3.9 Signals · detail drawer (`Signals-Drawer.dc.html`, route `/signals?signal=…`)

Explorer unchanged underneath; scrim `<a aria-label="Close details">` `position:absolute; inset:0; background:rgba(28,26,51,0.22)` → closes (href back to `/signals`). Panel `<aside aria-label="Signal details">` right-anchored, `width:480px; max-width:100%`, white, `border-left:1px #E7E4F3`, shadow-drawer, column flex.

**Drawer header** (padding `20px 24px 16px`, border-bottom): `h2` "Lakeview Builders Group" (20/700) + tag `business`; line 2: "Major Contract Awarded" (600) + pill High + "Orange County, FL · Construction · Oct 2" (12 muted). Close button 32×32 secondary with `x` (`aria-label="Close details"`).

**Body** (scrolls, padding `20px 24px`, section gap 24; `h3` 12/700 uppercase muted):
1. **Evidence** — `<blockquote>` (padding `14px 16px`, radius 10, bg `#F5F1FF`, border `#DCD2FF`, 14 px, lh 1.55): "“Lakeview Builders Group was awarded the $42 million contract to build the new Kirkman Road logistics center, the company said Tuesday.”" · meta row 12 muted: "quote #3 · verbatim match ✓" · "name grounded ✓" · "role: subject" · row "Confidence" (13 `#4B4A63`) + Meter 140×6 (92 %) + "0.92 · high".
2. **Article** — title link "Kirkman Road logistics hub clears final approval" (600 ink, `#`) · "orlandomagazine.com · published Oct 2, 2026 · accepted Oct 4 11:14 · article #71334" (12 muted) · "Main idea: Orange County commissioners approved the final site plan for a 310,000 sq ft logistics center on Kirkman Road; construction starts in November." (13 `#4B4A63`) · buttons sm: `[↗ Open article]` secondary · `[📄 Saved text]` secondary · `[Summary record]` ghost.
3. **Company profile** — 2-col grid (label 12 muted / value 13/600): Org kind "business · name cue" · HQ scope "local · Orange County, FL" · Entity flag "local" · Industry "Construction · Nonresidential building (2362)" · Revenue bin "$10M-$20M · explicit figure" · Enrichment `rules_v1 · 2026.10` (mono). Then boxed row (border `#E7E4F3`, radius 8, padding `10px 12px`): "Across jobs: **3 mentions** in 2 jobs · **2 signals**" + link "Open profile ›" (`#`).
4. **Job** — link "Orange County, FL · Construction" (600) over "`0192f1c2` · Scout: Orange County builders · run 7" (12 muted); right: pill "Analysing".

**Footer** (padding `14px 24px`, border-top, bg `#FAF9FE`): left `[🔗 Copy link]` `[⤓ Export row]` sm secondary; right 32×32 icon buttons `chevron-left` "Previous signal" / `chevron-right` "Next signal". Keyboard handling, focus trap, URL binding: per 07 §6.4 (not visible in the mockup).

### 3.10 Data Sources (`Data-Sources.dc.html`, route `/sources`)

**Layout:** header → 4 stat tiles → toolbar → table → "Suggested by the finder" card.
**Header:** `h1` "Data Sources"; subtitle "Curated news sites used as seeds, fed by what the finder discovers"; actions `[+ Add source]` primary · `[⤒ Import CSV]` secondary. Add/import dialogs **not shown**.

**Tiles:** Active sources **23** / "across 5 counties" · Promoted from the finder **12** / "+3 this week" (`#006300`) / "finder-judged, kept by you" · Median precision · last run **11%** / "accepted articles ÷ candidates" + sparkline (y: `25,17.7,21.3,14,6.7,10.3,17.7,3,6.7,14,10.3,10.3`; last segment flat) · Removed **4** / "kept for history, never seeded".

**Toolbar:** search w 260 "Search name or domain" · `State` [State: all, FL, CO, TX, AZ, IL] 110 · `County` [County: all, Orange, Jefferson, Harris, Maricopa, Cook] 130 · `Industry` [Industry: all, Construction, Manufacturing, Retail Trade, Utilities] 140 · `Origin` [Origin: all, manual, finder] 120 · `Status` [Status: active (default), removed, all] 130 · right: density, columns, `[⤓ Export CSV]` sm.

**Table** `aria-label="Data sources"`, `min-width:900px`, rows **64**:

| # | Header | Align | Cell anatomy |
|---|---|---|---|
| 1 | Source | left | name (600, nowrap) over domain link (12, brand) |
| 2 | Location | left | "Orange County" over "FL" (12 muted) |
| 3 | Industries | left | neutral tags |
| 4 | Origin | left | tag `finder` (brand `#EEE8FF`/`#5A3FBE`) or `manual` (neutral) over "Promoted Sep 30 · rank 1" / "Added Sep 28 · rank 5" / "Added Sep 20" (12 muted) |
| 5 | Precision · last run | left | Meter 72×6 + "13%" · "18 / 142 candidates" (12 muted tabular) · job id link + "· today" / "· Oct 2" / "· yesterday" |
| 6 | Status | left | pill Active (done) / Removed (neutral) |
| 7 | — | right | xs `[Remove]` danger-secondary (Active) or `[Restore]` secondary (Removed) · 28×28 ghost `⋯` `aria-label="Run a seed job or edit {name}"` |

**Suggested by the finder** card: `h2` + sub "4 sites the finder kept recently that are not in your list"; link "See all 11" (`#`). Grid `repeat(auto-fit, minmax(min(240px,100%),1fr))` gap 12 of cards (padding `14px 16px`, border `#E7E4F3`, radius 10, bg `#FAF9FE`): domain link (600 ink) + white tag "Tier 1"/"Tier 2" · "County, ST · Industry" (12 muted) · reason (12 `#4B4A63`) · `[+ Add to sources]` xs tonal · `[Dismiss]` xs ghost. Footnote (12 muted): "Suggestions come from finder verdicts and rankings of the last 30 days (the judged-domain memory). Adding one copies it here with its tier and reason, so the next seed run can use it."

### 3.11 Settings › Workers & health (`Settings-Workers.dc.html`, route `/settings/workers`)

**Layout:** header → tabs → health tile grid (`repeat(auto-fit, minmax(min(240px,100%),1fr))`, gap 16) → Workers table → 2-up grid (`minmax(min(360px,100%),1fr)`, gap 20): Dead tasks by category · Maintenance schedule.
**Header:** `h1` "Settings"; subtitle "Operations, access and platform configuration"; no actions.
**Tabs:** API keys · **Workers & health** (active) · Stats & costs · Exports · System · Preferences (others `href="#"`, **not designed**).

**Health tiles** (card padding `18px 20px`; title `h2` 15/700 + pill right; rows 13 px label `#4B4A63` / value 600 tabular):

| Tile | Pill | Rows |
|---|---|---|
| API | Ready (done) | Database "ok" · Artifact store "ok · RustFS" · Migrations "head 0003" · Version "v2.1.0" |
| Proxy | US exit verified (done) | Checked "4 min ago" · Zone "multi_agent_article" · Traffic today "412 MB" · Next check "in 11 min" |
| Queue | 1 dead (warn) | Queued 9 · Running 2 · Failed · retrying 1 · Dead 1 · link "Open dead tasks ›" → Job › Tasks |
| Storage | Healthy (done) | Snapshots "38.2 GB" · Expiring in 7 d "2.1 GB" · Last backup "02:14 · 412 MB" · Disk "61% of 1 TB" |

**Workers** section: `h2` "Workers" + "8 instances · heartbeats every 30 s · gone after 3 missed" (13 muted). Table `aria-label="Workers"`, `min-width:1000px`, rows **44**:

| # | Header | Cell |
|---|---|---|
| 1 | Instance | mono 13 ink |
| 2 | Role | neutral tag |
| 3 | Version | mono 12 `#4B4A63` |
| 4 | Started | "Oct 3, 22:10" |
| 5 | Last heartbeat | "2 s ago" (400 `#4B4A63`); slow → "47 s ago" **600 `#92400E`** |
| 6 | Current tasks | `#4B4A63` text: "—", "sweep_jobs", "idle", "explore_site · orlandoweekly.com", "analyze_article ×2" |
| 7 | Proxy | "US · ok" or "—" |
| 8 | Status | pill h22 Healthy / Slow heartbeat |
| 9 | — | xs `[Logs]` secondary · `[Drain]` ghost |

**Dead tasks by category** card: sub "last 7 days · 7 tasks"; link "Failures view" (`#`); rows grid `180px minmax(0,1fr) 32px`: mono label · bar h16 (`#EEE8FF` track, `#8B6CE8` fill) · count.
**Maintenance schedule** card: sub "single maintenance instance holds the scheduler lock"; rows (padding `8px 0`, divider): mono job name over cadence (12 muted) left; right 8 px dot + "time · result" (`#4B4A63`).

---

## 4. Sample data appendix (build fixtures from these)

### 4.1 Jobs (Runs table; Overview shows the first 5)

| Short id | Full id | Title | Kind | Batch | Status | Stop reason | Stages done→current | Sites | Articles | Signals | Cost | Started | Duration | Row action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0192f1c2 | 0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41 | Orange County, FL · Construction | location + industry | batch 1 of 3 | Analysing | — | 3 done → Analysing | 5 / 5 | 40 | 24 | $3.12 | Today 11:02 | 29 min | Cancel |
| 0192f1c3 | — | Orange County, FL · Manufacturing | location + industry | batch 2 of 3 | Discovering | — | 2 → Discovering | 3 / 5 | 12 | 3 | $0.86 | Today 11:02 | 29 min | Cancel |
| 0192f1c4 | — | Orange County, FL · Wholesale Trade | location + industry | batch 3 of 3 | Exploring | — | 1 → Exploring | 0 / 5 | — | — | $0.21 | Today 11:02 | 29 min | Cancel |
| 0192f0aa | — | Jefferson County, CO · Construction | seeds | — | Discovering | — | 2 → Discovering | 2 / 4 | 17 | 6 | $1.04 | Today 10:48 | 43 min | Cancel |
| 0192ef10 | — | Harris County, TX · Manufacturing | location + industry | — | Queued | — | none | — | — | — | — | Today 11:29 | — | Cancel |
| 0192ee55 | — | Maricopa County, AZ · Retail Trade | seeds | — | Partial | site_time_limit | all 5 done | 3 / 3 | 22 | 9 | $1.90 | Yesterday 16:10 | 1 h 12 min | Resume |
| 0192ea31 | — | Fulton County, GA · Wholesale Trade | location + industry | — | Completed | — | all 5 done | 5 / 5 | 35 | 18 | $2.74 | Oct 2, 09:30 | 54 min | Re-run |
| 0192e8c0 | — | Cook County, IL · Utilities | location + industry | — | Failed | no_sources_found | Finding failed (red), rest pending | 0 / 0 | — | — | $0.09 | Oct 1, 14:05 | 4 min | Re-run |
| 0192d9b4 | — | Harris County, TX · Manufacturing (earlier run; appears only as a link in the Signals explorer and Data Sources "· Oct 2") | — | — | not shown | — | — | — | — | — | — | Oct 2 (last used) | — | — |

Total shown: "Showing 1–8 of 12 runs". Job 0192f1c2 extras: Scout "Orange County builders" run 7, client ref `scout-7-2026-10-04`, location "Orlando, FL", prompt 2026.10, created today 11:02 by daniel-ops, settings Days 30 / Sites 5 / Site timeout none / Max runtime 5 h / Memory full / Reanalyze off; cost $3.12 · 1.6M tokens; elapsed 29 min · deadline in 4 h 31 min; tasks 9 queued · 2 running · 1 dead; counters Seeds 5 · Sections 11 · Pages 99 · Links 26.3K · Articles 40 · Summaries 31/40 · Companies 139 · Signals 24; proxy traffic 56.8 MB.

**Cost by stage (job 0192f1c2):** Classification $1.21 (145 calls · 612K tokens, 100 %) · Summary $1.04 (62 calls · 540K, 86 %) · Company pass $0.46 (31 calls · 231K, 38 %) · Sections agent $0.28 (5 agents · 164K, 23 %) · Finder + ranker $0.13 (19 calls · 71K, 11 %).

**Stage stepper (job 0192f1c2):** see §3.5 table.

### 4.2 Site runs (job 0192f1c2)

| Domain | Rank | Status | Sections | Pages | Articles | Fetched | Stop reason | Duration |
|---|---|---|---|---|---|---|---|---|
| orlandomagazine.com | 1 · finder | Finished | 4 | 38 | 18 | 21.4 MB | no_new_accepted_articles | 27 min |
| orlandosentinel.com | 2 · finder | Finished | 3 | 31 | 14 | 19.8 MB | no_new_accepted_articles | 24 min |
| bizjournals.com/orlando | 3 · finder | Partial | 2 | 19 | 6 | 9.1 MB | site_time_limit | 30 min |
| orlandoweekly.com | 4 · finder | No sections | 0 | 0 | 0 | 0.3 MB | no_sections | 3 min |
| growthspotter.com | 5 · finder | Finished | 2 | 11 | 2 | 6.2 MB | no_new_accepted_articles | 22 min |

### 4.3 Tasks (job 0192f1c2, tree order)

| Depth | Kind | Id | Target | Status | Attempt | Worker | Started | Duration | Last error | Action |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | find_sources | #48811 | Orlando, FL · Construction | Succeeded | 1 / 2 | finder-1 | 11:02:04 | 2 m 11 s | — | Details |
| 1 | rank_sites | #48812 | 23 kept domains | Succeeded | 1 / 2 | finder-1 | 11:04:15 | 1 m 48 s | — | Details |
| 2 | explore_site | #48813 | orlandomagazine.com | Succeeded | 1 / 2 | sections-1 | 11:06:03 | 4 m 02 s | — | Details |
| 3 | discover_site | #48817 | orlandomagazine.com | Succeeded | 1 / 3 | discovery-1 | 11:10:09 | 27 m 14 s | — | Details |
| 4 | analyze_article | #48902 | #71334 · Kirkman Road logistics hub clears final approval | Succeeded | 1 / 4 | analysis-1 | 11:21:40 | 38 s | — | Details |
| 4 | analyze_article | #48911 | #71341 · Apopka plant expansion to add 40 jobs | Running | 1 / 4 | analysis-2 | 11:30:52 | 41 s | — | Details |
| 4 | analyze_article | #48915 | #71345 · Steel fabricator plans hiring push | Retry in 42 s | 2 / 4 | analysis-1 | 11:29:10 | — | model_rate_limited · DeepSeek 429 after 3 calls | Details |
| 4 | analyze_article | #48920 | #71352 · County weighs impact fee increase | Dead | 4 / 4 | analysis-2 | 11:26:33 | — | saved_content_unavailable · text artifact 410 (expired) (red) | Retry |
| 2 | explore_site | #48814 | bizjournals.com/orlando | Succeeded | 1 / 2 | sections-1 | 11:06:05 | 5 m 20 s | — | Details |
| 3 | discover_site | #48818 | bizjournals.com/orlando | Partial | 1 / 3 | discovery-2 | 11:11:31 | 30 m 00 s | site_time_limit | Details |
| 2 | explore_site | #48816 | orlandoweekly.com | Rejected | 1 / 2 | sections-1 | 11:06:08 | 3 m 05 s | no_sections · business no-op | Details |
| 0 | finalize_job | #48930 | waiting for 9 pending tasks | Queued | 0 / 5 | — | — | — | — | Details |

Counts: queued 9 · running 2 · succeeded 61 · failed · retrying 1 · dead 1 · cancelled 0.

### 4.4 Scouts

| Name | Location | Industries | Sources | Schedule | Last run | Runs | Signals (last run) |
|---|---|---|---|---|---|---|---|
| Orange County builders | Orange County, FL | Construction, Manufacturing, Wholesale Trade | Finder · top 5 sites | Manual | Analysing · 29 min ago | 7 | 24 |
| Denver metro construction | Jefferson County, CO | Construction | 4 seeds from Data Sources | Manual | Discovering · 43 min ago | 3 | 6 |
| Houston manufacturing | Harris County, TX | Manufacturing | Finder · top 5 sites | Manual | Queued · just now | 2 | — |
| Phoenix retail | Maricopa County, AZ | Retail Trade | 3 seeds from Data Sources | Manual | Partial · yesterday | 5 | 9 |
| Atlanta wholesale | Fulton County, GA | Wholesale Trade | Finder · top 5 sites | Manual | Completed · 2 days ago | 4 | 18 |

### 4.5 Signals (union of Job › Signals tab, explorer, Overview list)

| Company | Org | Signal | Mat. | Conf. | Evidence (full, as on job tab / drawer) | HQ city | Scope | St | Industry · sub | Revenue | Date | Source domain · article title | Job (location · industry) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Lakeview Builders Group | business | Major Contract Awarded | High | 0.92 | “Lakeview Builders Group was awarded the $42 million contract to build the new Kirkman Road logistics center.” (drawer adds ", the company said Tuesday.") | Orlando | local | FL | Construction · Nonresidential building | $10M-$20M | Oct 2, 2026 | orlandomagazine.com · Kirkman Road logistics hub clears final approval | 0192f1c2 (Orange, FL · Construction) |
| Central Florida Concrete | business | Operational Capacity Expansion | High | 0.88 | “Central Florida Concrete is adding a third batching plant in Apopka to keep up with demand.” | Apopka | local | FL | Manufacturing · Ready-mix concrete | $20M-$50M | Oct 1, 2026 | orlandosentinel.com · Apopka plant expansion to add 40 jobs | 0192f1c2 |
| Orange Blossom Development | business | Groundbreaking Ceremony | Medium | 0.81 | “Orange Blossom Development broke ground Tuesday on a 220-unit apartment community near Lake Nona.” | Orlando | local | FL | Real Estate · Residential development | unknown | Sep 30, 2026 | growthspotter.com · 220 apartments break ground near Lake Nona | 0192f1c2 |
| Osceola Steel Fabricators | business | Mass Hiring | High | 0.86 | “Osceola Steel Fabricators plans to hire 120 welders and fitters over the next six months.” | Kissimmee | state | FL | Manufacturing · Structural steel | $50M-$100M | Sep 29, 2026 | bizjournals.com/orlando · Steel fabricator plans hiring push | 0192f1c2 |
| City of Winter Garden | gov | Active Construction Projects | Low | 0.74 | “The City of Winter Garden approved the second phase of the downtown streetscape project.” | Winter Garden | local | FL | Public Administration · Local government | NA | Sep 28, 2026 | orlandosentinel.com · Winter Garden approves streetscape phase two | 0192f1c2 |
| Baldwin Park Homes | business | New Office or Location Opening | Medium | 0.79 | “Baldwin Park Homes opened a design studio on Colonial Drive to serve its Orange County buyers.” | Orlando | local | FL | Construction · Residential building | $1M-$10M | Sep 27, 2026 | orlandomagazine.com · Homebuilder opens Colonial Drive design studio | 0192f1c2 |
| Mills 50 Partners | business | Closed Deal | Medium | 0.90 | “Mills 50 Partners closed on the 3.1-acre Virginia Drive parcel for $8.6 million.” | Orlando | local | FL | Real Estate · Land development | unknown | Sep 26, 2026 | growthspotter.com · Virginia Drive parcel sells for $8.6M | 0192f1c2 |
| Sunshine Roofing Co. | business | Industry Award or Recognition | Low | 0.71 | “Sunshine Roofing Co. was named contractor of the year by the Central Florida Roofing Association.” | Ocoee | local | FL | Construction · Roofing contractors | <$1M | Sep 25, 2026 | orlandomagazine.com · Roofing association names 2026 award winners | 0192f1c2 |
| Bayou Steel Works | business | Mass Hiring | High | 0.88 | “Hiring begins next month as the Houston mill moves to a third shift to meet demand.” (explorer form) | Houston | not shown | TX | Manufacturing · Steel mills | $50M-$100M | Oct 2, 2026 | houstonledger.com (title not shown) | 0192d9b4 (Harris, TX · Manufacturing) |
| Front Range Builders | business | Groundbreaking Ceremony | Medium | 0.81 | “Broke ground on a second Denver plant slated to open in Q2 2027 with roughly 60 jobs.” | Lakewood | not shown | CO | Construction · Nonresidential building | $10M-$20M | Oct 1, 2026 | rangewire.com | 0192f0aa (Jefferson, CO · Construction) |
| Peachtree Distribution | business | Operational Capacity Expansion | Medium | 0.84 | “A $6M build-out adds cold storage and 30 dock doors at the Fulton County site.” | Atlanta | not shown | GA | Wholesale Trade · Grocery wholesale | $50M-$100M | Sep 30, 2026 | peachreport.com | 0192ea31 (Fulton, GA · Wholesale Trade) |
| Sun Valley Retail Group | business | New Office or Location Opening | Medium | 0.79 | “The chain will open locations in Mesa, Chandler and Glendale before the holidays.” | Phoenix | not shown | AZ | Retail Trade · General merchandise | $10M-$20M | Sep 30, 2026 | sonoranpost.com | 0192ee55 (Maricopa, AZ · Retail Trade) |
| Gulf Coast Packaging | business | Capital Raise | High | 0.90 | “Closed a $25 million growth round led by a Houston-based family office.” | Pasadena | not shown | TX | Manufacturing · Paperboard containers | $20M-$50M | Sep 29, 2026 | houstonledger.com | 0192d9b4 (Harris, TX · Manufacturing) |

Explorer-trimmed evidence for the FL rows: "Awarded the $42 million contract…", "Adding a third batching plant in Apopka…", "Plans to hire 120 welders and fitters…", "Closed on the 3.1-acre Virginia Drive parcel…". Explorer totals: 128 signals · 61 companies · 9 jobs; High 22 / Medium 71 / Low 35; top signal this week Mass Hiring (19). Job tab totals: 24 signals · 18 companies. Overview recent list order: Lakeview (High, Oct 2) · Bayou Steel (High, Oct 2) · Central Florida Concrete (High, Oct 1) · Front Range (Medium, Oct 1) · Peachtree (Medium, Sep 30).

**Drawer record (Lakeview):** quote #3 · verbatim match · name grounded · role: subject · confidence 0.92 · high; article #71334 published Oct 2, 2026, accepted Oct 4 11:14, main idea "Orange County commissioners approved the final site plan for a 310,000 sq ft logistics center on Kirkman Road; construction starts in November."; org kind "business · name cue"; HQ scope "local · Orange County, FL"; entity flag local; industry "Construction · Nonresidential building (2362)"; revenue bin "$10M-$20M · explicit figure"; enrichment `rules_v1 · 2026.10`; across jobs 3 mentions in 2 jobs · 2 signals.

### 4.6 Data sources

| Name | Domain | County | St | Industries | Origin | Origin sub-line | Precision | Accepted / candidates | Last job · when | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| Orlando Magazine | orlandomagazine.com | Orange County | FL | Construction, Manufacturing | finder | Promoted Sep 30 · rank 1 | 13% | 18 / 142 | 0192f1c2 · today | Active |
| Orlando Sentinel | orlandosentinel.com | Orange County | FL | Construction, Health Care | finder | Promoted Sep 30 · rank 2 | 11% | 14 / 131 | 0192f1c2 · today | Active |
| GrowthSpotter | growthspotter.com | Orange County | FL | Construction | manual | Added Sep 28 · rank 5 | 4% | 2 / 46 | 0192f1c2 · today | Active |
| Range Wire | rangewire.com | Jefferson County | CO | Construction | manual | Added Sep 20 | 10% | 9 / 88 | 0192f0aa · today | Active |
| Houston Ledger | houstonledger.com | Harris County | TX | Manufacturing | finder | Promoted Sep 24 · rank 1 | 11% | 11 / 97 | 0192d9b4 · Oct 2 | Active |
| Sonoran Post | sonoranpost.com | Maricopa County | AZ | Retail Trade | manual | Added Sep 18 · rank 3 | 6% | 4 / 63 | 0192ee55 · yesterday | Active |
| Prairie Post | prairiepost.com | Cook County | IL | Utilities | manual | Added Sep 12 | 0% | 0 / 41 | 0192e8c0 · Oct 1 | Removed |

Tiles: Active 23 (across 5 counties) · Promoted 12 (+3 this week) · Median precision 11% · Removed 4.
**Suggestions (4 of 11):** orlandoweekly.com Tier 2, Orange County, FL · Construction, "Kept by the finder (coverage: local, relevance: medium); explored, no sections kept" · floridadaily.com Tier 1, Orange County, FL · Manufacturing, "Kept by the finder (coverage: state, relevance: high); ranked 4th" · westorlandonews.com Tier 2, Orange County, FL · Construction, "Kept by the finder (coverage: local, relevance: high); ranked 6th" · denverite.com Tier 1, Jefferson County, CO · Construction, "Found through the judged-domain memory (judged Sep 21, kept)".

### 4.7 Workers and health

| Instance | Role | Version | Started | Last heartbeat | Current tasks | Proxy | Status |
|---|---|---|---|---|---|---|---|
| api-1 | api | v2.1.0 | Oct 3, 22:10 | 2 s ago | — | — | Healthy |
| maintenance-1 | maintenance | v2.1.0 | Oct 3, 22:10 | 4 s ago | sweep_jobs | — | Healthy |
| finder-1 | finder | v2.1.0 | Oct 3, 22:10 | 3 s ago | idle | US · ok | Healthy |
| sections-1 | sections | v2.1.0 | Oct 3, 22:10 | 6 s ago | explore_site · orlandoweekly.com | US · ok | Healthy |
| discovery-1 | discovery | v2.1.0 | Oct 3, 22:10 | 1 s ago | discover_site · rangewire.com | US · ok | Healthy |
| discovery-2 | discovery | v2.1.0 | Oct 4, 10:52 | 2 s ago | discover_site · orlandosentinel.com | US · ok | Healthy |
| analysis-1 | analysis | v2.1.0 | Oct 3, 22:10 | 5 s ago | analyze_article ×2 | — | Healthy |
| analysis-2 | analysis | v2.1.0 | Oct 3, 22:10 | 47 s ago (amber) | analyze_article ×2 | — | Slow heartbeat |

Health tiles: see §3.11. **Dead tasks by category (7 days, 7 tasks):** model_rate_limited 3 (100 %) · saved_content_unavailable 2 (67 %) · task_timeout 1 (33 %) · network_error 1 (33 %). **Maintenance schedule:** sweep_jobs every 60 s → "11:31:12 · ok" · expire_artifacts hourly → "11:00:03 · 1,204 objects" · purge_work_items daily 03:00 UTC → "03:00:41 · 2 partitions" · backup_database daily 02:00 UTC → "02:14:09 · 412 MB" · export_dataset on demand → "yesterday · 3 exports" (grey dot `#4B4A63`; all others green).

### 4.8 Overview stats and New-run defaults
Overview tiles: Running jobs 4 (2 queued · 1 finalizing, across 3 Scouts) · Signals last 7 days 128 (+18 %) · Model + proxy cost today $14.20 (+$3.10 vs yesterday) · Dead tasks 2 (1 new since yesterday). Workers: 8 instances, proxy exit US verified 4 min ago.
New run defaults: mode Location + industries · State Florida (FL) · County Orange · Location phrase "Orlando, FL" · Industries [Construction, Manufacturing, Wholesale Trade] · Sources finder (4 active seeds available) · Days 30 · Sites 5 · Site timeout 0 · Max runtime 18000 · Memory full · Re-analysis reuse · prompt 2026.10 · estimate ≈ $3 per job · Save as Scout checked, name "Orange County builders".

---

## 5. Component inventory (de-duplicated; names follow 07 §6.4)

| Component | Props / variants (as implied) | Used on |
|---|---|---|
| `AppShell` | sidebar (logo, search+⌘K, nav with `active`, footer {apiStatus, env, user, role}); main slot | all |
| `PageHeader` | `crumbs?`, `title`, `status?` (StatusPill), `subtitle?` or `meta?` (MetaLine: mono id + CopyButton, tag pairs, text, links), `actions` | all |
| `Tabs` | items {label, count?, active, href}, optional divider; count badge active/inactive | Jobs, Job detail, Settings |
| `StatusPill` | `tone`: running/done/warn/fail/neutral; `size`: md 24 / sm 22; `indicator`: dot \| icon(triangle-alert) \| none; `secondaryLine?` (mono stop reason); maps for job / site-run / task / worker / source / health | everywhere |
| `MaterialityPill` | High (warn pair) / Medium (brand-100/700) / Low (neutral); no dot; h22 | Overview, signal tables, drawer |
| `Tag` | `tone`: neutral (`#FAF9FE`) / brand (`#EEE8FF`) / white (on tinted cards); `mono?`; h22 radius 6 | tables, meta line, scouts, sources, workers |
| `StageBar` | 5 segments (Finding, Exploring, Discovering, Analysing, Finalizing) with `title` tooltips; states done `#15803D` / current `#8B6CE8` / pending `#D9D5EA` / failed `#D03B3B`; `width` 84 (table) or 140 (strip); h6 radius 3 gap 3; `aria-label="Stage progress"` | Overview, Runs, Job › Signals/Tasks strip |
| `Stepper` | per stage {name, state done/current/pending, duration, stats}; node 24 px variants; connectors | Job › Overview |
| `JobSummaryStrip` | StageBar 140 + stage text + separators + counters + `LiveDot` | Job › Signals, Job › Tasks |
| `LiveDot` / live text | 8 px dot `#1D4ED8` + "Live" or "Auto-refresh every 5 s" (12/600 blue); card sub "Live · refreshed 4 s ago" | Job detail |
| `StatTile` | `label`, `value`, `delta?` {text, tone: muted/positive(`#006300`)/warn(`#92400E`)}, `note?`, `sparkline?` | Overview, Data Sources |
| `Sparkline` | 96×28, 12 y-values, muted polyline + brand last segment + end dot | Overview ×2, Data Sources ×1 |
| `Meter` | `value` 0–1 or %, `width` 44 / 72 / 140, h6, track `#EEE8FF`, fill `#6E51D6`, trailing label (tabular 12) | signal record cell, drawer, sources |
| `HorizontalBars` | rows {label, subLabel?, pct, value}; grid `128|1fr|56` (h18) or `180|1fr|32` (h16); track `#EEE8FF`, fill `#8B6CE8` | Cost by stage, Dead tasks by category |
| `SplitBar` + legend | segments {pct, color}, 320×10, legend squares 10 px | Signals explorer |
| `CounterStrip` | items {label, value} with vertical dividers; secondary group {label, value 13/600} | Job › Overview |
| `DataTable` | container (border, radius 12, shadow, `overflow-x:auto`), `minWidth`, header row 40 uppercase, `rowHeight` 44/48/52/64/72, numeric right + tabular, last col actions right, row hover; features in mockup: density toggle button, column chooser button, Export CSV button, pagination footer "Showing a–b of N {noun}" + Previous/Next; **not shown**: sticky header, sort indicators, compact rows, column chooser popover, selection, loading/empty/error states | Overview, Runs, Scouts, Site runs, Signals ×2, Tasks, Sources, Workers |
| `SignalRecordCell` | company link + org Tag; signal + MaterialityPill + Meter + score; evidence line (ellipsis); `maxWidth` 330 / 280 | Job › Signals, explorer |
| `TasksTree` | indent 18 px/level, chevron for children, kind/id mono stack; "Show as tree" checkbox | Job › Tasks |
| `TaskStatusCounts` | chips {dot colour, label, count} | Job › Tasks |
| `FilterBar` | `SearchInput` (w 230–320, icon left) + `FilterSelect` (h36, "Label: all" first option, chevron) ×N; right slot (density, columns, export) | Runs, Scouts, Job › Signals, Tasks, Sources, explorer |
| `FilterChips` | chip {label, onRemove}, `[+ Add filter]` tonal xs, "Clear all" ghost, right summary text | Signals explorer |
| `SavedViewsMenu` | select "View: …" + "Manage views…"; `[Save view]` header button | Signals explorer |
| `Drawer` | right 480 px, scrim, header (title + tag + line 2 + close), scrolling body with `DrawerSection` (h3 uppercase), footer (actions left, prev/next right) | Signals |
| `EvidenceQuote` | blockquote tinted brand-50/200 + verification meta (check icons) | drawer |
| `KeyValueGrid` | 2-col label/value (mono option); 3-col form variant | New run Summary, Job Settings, drawer profile |
| `NoteBanner` | tone brand (`#EEE8FF`) / warn (`#FEF3C7`), `info` icon, text, optional right link | Scouts, Tasks |
| `AttentionItem` | icon (tone fail/warn), title, sub, href | Overview |
| `WorkerRoleList` | rows dot + role + "N instances" | Overview |
| `HealthTile` | title + StatusPill + label/value rows + optional link | Settings |
| `ScheduleList` | mono name + cadence, dot + last result | Settings |
| `SuggestionCard` | domain link + Tier tag, location line, reason, Add/Dismiss | Data Sources |
| `NewRunForm` | `SegmentedControl` (modes), `FormField` (label 13/600, control h40, helper 12), `IndustryTokenInput`, `FanOutPreview` rows, `RadioCard`, Advanced toggle + 3-col grid, sticky `SummaryCard` with Save-as-Scout checkbox | New run |
| `Button` | variants primary / secondary / danger-secondary / tonal / ghost / disabled; sizes md/sm/xs; icon-only; `TextLink` (with/without chevron) | all |
| `CopyButton` | 24×24 ghost `copy` icon, `aria-label="Copy job id"` | Job header |
| `RelativeTime` | "29 min ago", "just now", "Today 11:02", "Yesterday 16:10", "Oct 2, 09:30", "2 s ago"; local/UTC tooltip per 07 (not visible) | tables |
| `Pagination` | "Showing 1–8 of 12 runs" + `[‹ Previous]` (disabled on first page) `[Next ›]` | Runs, Job › Signals, explorer |
| `ConfirmDialog`, `EmptyState`, loading skeleton, toasts, ⌘K palette, column-chooser popover, row ⋯ menus, Export menu | **not shown** in any artboard — design from 07 §6.4 |

---

## 6. Open questions and inconsistencies (with recommendations)

1. **High materiality is amber, not brand.** Every materiality *pill* renders High as warn (`#92400E`/`#FEF3C7`), Medium as brand-700/100, Low as neutral, while the canvas legend and 06 §3 say "Materiality uses the lavender ramp (700/400/200 = high/medium/low)" — which only the explorer's split bar follows. Amber is also the "partial / retrying / slow" status colour. **Recommendation:** implement `MaterialityPill` as a single variant map and ship it as drawn (the approved look); record the shared-amber caveat in the ADR, and if Daniel prefers the legend rule switch High to brand-700 text on brand-200 bg — a one-line change.
2. **Two signal column sets.** Job › Signals: `Signal · HQ city · scope · HQ state · Industry · Revenue bin · Date · Source`. Explorer: `Signal · HQ city · HQ state · Industry · Revenue bin · Date · Job location · source · Job`. The scope chip and the article title appear only on the job tab; the explorer also trims the evidence quote. **Recommendation:** one `SignalsTable` with a column registry (`record, hqCity, hqScope, hqState, industry, revenueBin, date, source, jobLocation, job, open`) and per-route default visibility; always render the verbatim `evidence_quote` from the API and let CSS ellipsize (never pre-trim); consider showing the scope chip in both.
3. **Off-token colours.** `#006300` (positive deltas), `#D03B3B` (failed stage bar segment) and `#B8B4CF` (sparkline) are not in 06 §3. **Recommendation:** use `#15803D` for positive deltas, `#B91C1C` for the failed segment, and add `--chart-line-muted: #B8B4CF` as a chart token.
4. **Pagination model.** Mockup shows "Showing 1–8 of 12 runs" with Previous/Next; 07 §6.2 specifies keyset pagination with "Load more" and no totals from the API. **Recommendation:** keep the mockup's footer visually, implement Next with `next_cursor` and Previous with a client-side cursor stack; render "of N" only when the BFF supplies a count, otherwise "Showing 1–8".
5. **Sticky header / sort / compact density** are specified in 06 §3 and 07 §6.4 but no artboard shows them (every table has a density and column-chooser button whose open/compact states are undrawn). **Recommendation:** sticky `thead` on every DataTable; compact = 36 px single-line / 56 px two-line rows and 6 px vertical cell padding; no sortable headers in v1 unless the API sorts.
6. **Export button labels differ:** "Export CSV" (Runs, Sources, explorer, job header with caret menu) vs "signals.csv" (Job › Signals tab). Menu items for the job-level Export are not drawn. **Recommendation:** list pages: "Export CSV" exports the current table with current filters; job header menu: one item per tab table (Signals, Companies, Summaries, Articles, Site runs, Sections, Tasks, Events) per 06 §1; drop the filename label.
7. **Prototype-only link targets.** Scout name → Job detail; "View all" (Needs attention) → Settings › Workers; "Partial run" item → Runs list; Companies/Summaries/Articles/Site runs/Sections/Events tabs, Settings tabs other than Workers, "How Scouts work", "Open profile", "Open tab", "See all 11", "Failures view", drawer article links are all `#`. **Recommendation:** Scout name → `/jobs/new?scout=` (edit) and Runs filtered by Scout from the ⋯ menu; attention items deep-link to the job/tasks/worker they describe; undesigned tabs/pages are out of mockup scope (U-phases in 07).
8. **Runs "Created" filter** has no "Created: all" option (defaults to "Last 7 days") unlike every other select ("Label: all" first); Data Sources "Status" defaults to "active" with options `removed`, `all`. **Recommendation:** keep the defaults (sensible) but label them "Created: last 7 days" and "Status: active" so the pattern reads consistently.
9. **Scouts "Schedule" column** always reads "Manual"; no scheduling feature exists in the plan. **Recommendation:** keep the column rendering "Manual" (cheap, future-proof) or hide it via the column chooser by default.
10. **Fan-out helper copy** has an unbalanced parenthesis: "(location, [industries]) fans out to one job per industry; they share a batch id so you can track them together)". **Recommendation:** drop the trailing ")".
11. **Batch count badge vs Overview tile:** Runs tab badge "12", Scouts "5", but the Overview tile says "across 3 Scouts" — consistent (only 3 Scouts have active runs); no change needed, just fixture-align.
12. **"New Scout" and "New run"** both open `/jobs/new`; nothing distinguishes them in the mockup. **Recommendation:** "New Scout" opens the same form with "Save as Scout" pre-checked and the primary button reading "Save Scout" (copy not shown — confirm with Daniel).
13. **Resume in the job header is disabled while Analysing**, enabled only for Partial runs (Runs row shows tonal Resume). Cancel run is danger-secondary in the header but plain secondary in the Runs row. **Recommendation:** use danger-secondary for Cancel in both places.
14. **Status words vs API enums.** Pills show stage names (Analysing, Discovering, Exploring) for running jobs, "Completed" for jobs but "Finished" for site runs and "Succeeded" for tasks; the filter uses "Running" while the pill shows the stage. **Recommendation:** StatusPill maps `job.status=running` + `job.stage` → stage label; keep "Completed/Finished/Succeeded" per entity as drawn.
15. **Industry filter sources differ:** Runs/Scouts/Sources use job industries (`INDUSTRY_OPTIONS`); Job › Signals uses company industries (Real Estate, Public Administration). **Recommendation:** two option sources: job catalog for jobs/sources; `company_industry` values from the enrichment catalogue for signal filters.
16. **Settings nav icon** is a custom three-slider glyph (see §1.7). **Recommendation:** Lucide `settings-2` unless pixel parity is required.
17. **Loading, empty, error and dark states are absent from all 11 artboards**, as are the ⌘K palette, column chooser, row menus, confirm dialogs, Add source / Import CSV dialogs, and task Details. Build them from 07 §6.4 using the tokens above and flag for a design pass.
