# Swangz AI Tracker — Redesign Reference Brief (from user's references, 2026-08-08)

## Unified design DNA (across all 7 references + logo)
1. **Dark, premium, glassy** — deep near-black bg, ambient glow, frosted cards (blur), 1px light borders, soft depth shadow + top highlight.
2. **GOLD/amber is the hero accent** — the smart-ring & admin-motion refs are literally gold-on-black = our exact palette. Green/red for good/bad metrics. (Teal/pink appearing in some refs → override with gold per user's explicit note "keeping colors as per the app".)
3. **Card dashboards**, radius 16–24px, generous padding.
4. **Left sidebar nav** on desktop (both dashboard refs) — biggest structural change. Smart-ring ref uses a floating pill nav variant.
5. **Greeting hero** ("Good morning, X" / "Welcome back") + prominent gold CTA.
6. **KPI/stat cards**: icon + big number (mono) + delta pill (green +, red −) + tiny sparkline.
7. **Gold data-viz**: smooth gradient line/area charts, circular gauges/score rings, horizontal % progress bars, waveforms, sparklines.
8. **Tables**: avatar + name, status pills, right-aligned mono money.
9. **Pills** (status/priority/tag) + **avatar stacks** with +N.
10. **Relationship graph** (entity ↔ related items) for the AI-tools view — aspirational.
11. **Motion**: cinematic reveal/zoom intro, staggered card entrance, subtle 3D tilt, animated numbers/charts.

## Reference → our screen mapping
- **Leadly** (department dash) → our **Departments/tools** view: sidebar + greeting + card grid + goals progress bars.
- **DriveOps + admin-motion** → our **Admin Dashboard**: KPI cards (delta+sparkline), gradient line chart (dept savings over time), % progress bars (net savings by dept), activities table.
- **Control AI graph** → our **tool drill-down**: summary side-panel (stat tiles + usage% + AI analysis); optional relationship graph.
- **Pink phones** → our **responsive mobile**: glass cards, circular gauges, big numbers — in gold.
- **Smart-ring loading** → **loading intro**: cinematic card reveal.
- **Nurein** → overall layout grammar (greeting, quick-stat circles, week strip, area charts).

## Logo
Gold gradient **Africa badge** + "SWANGZ" wordmark (SWANGZ-2022-logo-2_autowc.webp). KEEP the badge; add "AI TRACKER" product tag. Wire into header, auth-logo, favicon.

## Honest scope for Sun 1pm
Very achievable: glass+gold system, sidebar, greeting hero, KPI cards w/ delta+sparkline, gradient line/area charts, circular gauges, % bars, tables, pills, motion (reveal/stagger/counters/hover).
Stretch (only if time): interactive node/relationship graph, full cinematic 3D fly-over. Ship tasteful "lite" versions; flag full versions as post-Sunday.
