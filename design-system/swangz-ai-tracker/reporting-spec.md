# Reporting spec — from "reference for ai tools usage graph and summary" (632 frames studied)

Source: Control AI Policy Platform (fuselab creative). Studied frames 1, 140, 300, 470, 632.

## What the reference actually contains (3 linked parts)

### 1. Relationship / usage graph (frame 140)
- **Central node** (Constitution) with % badge, ornate glowing core.
- **Hub nodes** radiating out = categories (Government affairs 31%, Healthcare 11%, Education 25%, Sport 24%, Security 23%, Culture & media 22%, Justice 13%, Economy 15%, Energy/transport 38%, Family 33%, Environment 17%) — each a coloured sphere + label + % badge.
- **Satellite nodes** around each hub = individual items, small spheres with count badges.
- **Edge styles**: thick warm gold beams = primary/strong links; thin dotted = weak links; cyan = a second relation type.
- **Timeline axis** down the left (2016→2024) with the active year pill-highlighted + a density waveform.
- **Legend** bottom-left: node type → colour → count (Constitution 1, Entities 11, Legislation 18, Services 53, Regulations 61) + GAPS 32% / Updates 56%.
- **KPI strip** bottom-right: Compliance Rate, Total Laws, Public Engagement, Implementation Rate (icon + big number + unit).
- **Top toolbar**: graph/tree toggle, zoom +/−, filter (badge count), sort (badge count), AI action.

### 2. Entity summary panel (frame 1) — right rail
- Category icon + name (Healthcare)
- Big entity title
- **Status pill** (Active) + "last update" line + "Explore details ›" button
- **Rate card**: big % (45%) + delta (−4% last month, red arrow) + qualitative pill (Moderate) + dotted waveform sparkline
- **2×2 stat tiles**: icon + number + label (12 Public Complaints, 2 Related Regulations, 18 Services, 12 Entities Involved)
- **AI Analysis** block: recommendation title + explanation

### 3. Entity drill-down (frame 470)
- Focused entity node left, with a **vertical stack of breakdown metric cards** (18 Services / 3 Entities / 24 Related Laws / 32 KPIs / 12 Related Laws); the selected card is gold-outlined.
- The selected metric **fans out** into connected items on the right: name + GAPS% badge + a 3-segment health bar (red/orange/green).

### 4. AI ANALYSIS overlay (frame 300)
- Header "RI ANALYSIS" + collapse (+3) + close.
- **Finding cards**: coloured left bracket (red = Critical Concerns, teal = proposal), title, right-aligned **linked subject** with ↗, description sentence.
- Sits above the KPI strip + contextual ask bar ("Analyze X in Y").

## Mapping to Swangz AI Tracker
| Reference | Ours |
|---|---|
| Constitution (centre) | **Swangz Avenue** (company), % = overall adoption |
| Category hubs | **Departments** (12), % = share of tools / adoption |
| Satellites | **AI tools** reported in that department |
| Edge weight | net monthly saving / usage frequency |
| Legend counts | Departments · Tools · Requests · In use / Piloting |
| KPI strip | Tools tracked · Time saved · Net saved · Revenue |
| Entity summary panel | **Tool or department summary**: status, usage rate + delta, 2×2 stats, AI verdict |
| Drill-down fan-out | tool → departments using it, each with impact bar |
| RI ANALYSIS findings | **Auto-generated report**: overspend warnings, duplicate tools across depts, negative-ROI tools, adoption gaps, top performers |
| Contextual ask bar | our AI assistant |

## Build order (deadline-aware)
1. Usage graph (SVG, deterministic radial layout) + legend + KPI strip.
2. Click node → summary panel (real stats, usage rate, delta, 2×2 tiles).
3. AI Analysis findings generated from real data rules → this IS the "system report before human reports".
4. Export/print the generated report.
