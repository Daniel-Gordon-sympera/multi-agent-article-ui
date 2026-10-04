# 06 — UI service: design decisions and mockup v1

**Status:** Mockup v1 **approved by Daniel on 2026-10-04** (canvas https://claude.ai/artifact/ULw9xzmzWvYXmBQ72k2V5A, page "Mockup v1", 11 prototype-linked artboards). Stack approved the same day; the implementation plan is `07-ui-service-plan.md`. · **Depends on:** `00-system-overview.md` (ADR-019 said "API only first; dashboard later on the same read models" — this is that later), `01-platform-and-api.md` (the REST contract the UI consumes).
**Repo:** the UI is a separate service, implemented in `/Users/symperaai/multi-agent-articles-ui` (empty on 2026-10-04 apart from `docs/plan/`). The backend branch `feature/platform-and-api` already implements the API (`api/` FastAPI, `X-API-Key` auth with operator/reader roles, keyset pagination `{items, next_cursor}`, RFC 9457 problems, no CORS middleware; Caddy fronts only the API).

## 1. Answers Daniel gave (guided questions, 2026-10-04)

| Topic | Decision |
|---|---|
| Audience | Operators (Daniel/engineers), but the UI must stay easy and light to use |
| Job model | **Runs + saved Scouts**: a job in the UI is one API run; a *Scout* is a saved setup (state, county, industries, sources) owned by the UI; running a Scout creates one API job per industry and keeps a run history |
| Multi-industry | The creation form takes `(location, [ind1, ind2, ind3])` and fans out to one job per industry — `(location, ind1)`, `(location, ind2)`, … — tracked together as a batch |
| Data Sources | **Curated seed list fed by the finder**: UI-owned list of news sites per location/industry (add URL, import CSV, remove/restore), used to launch `seeds` jobs; sites the finder found/ranked can be promoted into it with their observed precision |
| Job detail | **Results first, operations in tabs**: header with stage stepper, live counters and cost; results tabs (Signals, Companies, Summaries, Articles) first; operations tabs (Site runs, Sections, Tasks with retry, Events) after; CSV per table from an Export menu |
| Job creation | One form, input modes as tabs (Location + industries / Site URL / Seeds from Data Sources), county + state always required, settings collapsed under Advanced with defaults shown, "Save as Scout" |
| Live progress | Stage stepper (finding → exploring → discovering → analysing → finalizing) + per-site-run rows, polling every ~5 s |
| Signals page | **Cross-job signals explorer**: multi-filters (state, county, industry, signal, materiality, revenue bin, org kind, HQ scope, date, job), column chooser, saved views, CSV export, detail drawer (evidence quote, article, company flags, job). **Signal tables carry HQ city (`scope_place`), HQ state (`hq_state`), industry (`company_industry` + sub-industry) and the article date as columns** (added at Daniel's request after the first mockup) |
| Settings | **Operations-grade**: API keys, workers & health, stats & costs, exports center, system (model prices, prompt version read-only), preferences |
| Style | Refine the sketch; add cards, buttons and tabs where needed |
| Accent | Pale lavender **#C5A9FF / #B2B2FE** family — used with dark ink on top (white text on it fails contrast); deeper lavender for links/accent text |
| Theme | Light first, dark-ready semantic tokens |
| Density | Comfortable rows by default (48 px), compact toggle (~36 px) |
| Typography | Plus Jakarta Sans (400–700) + JetBrains Mono for ids, URLs, token/cost figures |
| Branding | Sympera AI logo from the sketch; product sub-label "Scout" |
| Icons | Lucide (outline, 1.75 px strokes) |
| Charts | KPI cards + small charts where they help (sparklines, stage bars, single-hue bars); no decorative charts |

## 2. Information architecture (mockup v1)

Sidebar: Overview · Jobs (tabs Runs | Scouts) · Signals · Data Sources · Settings; search (⌘K); footer shows API readiness + key role.

Screens on the canvas (11 artboards, prototype-linked): Overview (KPI tiles, active runs, needs-attention, workers, recent signals) · Jobs › Runs · Jobs › Scouts · New run / Scout (fan-out preview "This will create 3 jobs") · Job › Overview (stepper, counters, site runs, cost by stage, settings) · Job › Signals tab · Job › Tasks tab (task tree, dead-letter retry) · Signals explorer · Signals with detail drawer · Data Sources (curated list + "Suggested by the finder") · Settings › Workers & health (health tiles, workers, dead tasks by category, maintenance schedule).

Job detail tabs: Overview · Signals · Companies (carries the one-row-per-company flags view) · Summaries · Articles | Site runs (carries the finder's sources and ranking) · Sections · Tasks · Events. Exports live in the header's Export CSV menu.

Signal row anatomy (both tables): one record cell (company + org kind · signal + materiality + confidence meter · evidence quote, single line, full text in the drawer), then HQ city (+ HQ scope chip), HQ state, Industry (+ sub-industry), Revenue bin, Date, Source (domain + article title) — and in the explorer, Job location · source and Job.

## 3. Design tokens (light; dark to be derived from the same semantic names)

Page #F6F5FC · surface #FFFFFF · surface-2 #FAF9FE · border #E7E4F3 · border-strong #D9D5EA · ink #1C1A33 · ink-2 #4B4A63 · muted #6E6A8A · faint #9C9BB3 (placeholders only).
Brand ramp: 50 #F5F1FF · 100 #EEE8FF · 200 #DCD2FF · **300 #C5A9FF (primary fill, dark ink on top, 8.4:1)** · 400 #A98BF5 · 500 #8B6CE8 · **600 #6E51D6 (links/accent text, 5.5:1 on white)** · 700 #5A3FBE · ring #B2B2FE (focus).
Status (functional, never the brand): running blue #1D4ED8 on #DBEAFE · done green #15803D on #DCFCE7 · warn amber #92400E on #FEF3C7 · fail red #B91C1C on #FEE2E2 · neutral #4B4A63 on #ECEBF3. Materiality uses the brand ramp (700/400/200 = high/medium/low).
Radii: cards 12 px, controls 8 px, pills 999. Buttons 40 px (md) / 32 (sm) / 28 (xs). Tables: 40 px header, 48 px rows (64–72 px for two-line rows), 12 px cell padding (10 px on dense signal tables), tabular numerals in numeric columns, sticky header + overflow-x box when wider than the viewport.

## 4. What the mockup needs beyond the current API (input to the plan — now §8 of `07`)

1. A cross-job signals read (`GET /v1/signals` with the same filters as the per-job list, plus county/state/date and the HQ/industry columns).
2. UI-service storage for Scouts, batches, Data Sources, saved views (and the "promote from finder" copy of a judged domain).
3. CORS on the API or a backend-for-frontend proxy in front of `/v1` holding the API key (decided: BFF, no CORS).
4. Source precision = accepted articles ÷ candidates per domain from `site_runs.stats`; cost estimate per job from the `model_calls` ledger of recent runs.
5. "Retry all dead" = loop over `POST /v1/tasks/{id}/retry` or a new bulk endpoint (decided: new endpoint). Resume/cancel/retry exist already.

## 5. Next steps

Plan draft `07-ui-service-plan.md` written 2026-10-04 (phases U0–U6, backend PRs B1–B4, `ui` schema, BFF endpoints, deployment). Daniel reviews the plan and its §16 open questions → implementation starts with U0 in `multi-agent-articles-ui`.
