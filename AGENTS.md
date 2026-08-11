# AGENTS.md — Swangz Avenue AI Adoption Tracker

Instructions and context for AI coding agents (Codex, etc.) working on this project.

## What this is

A **single-file web app** that tracks AI-tool adoption across Swangz Avenue's departments
and doubles as a **tool-request platform**. Departments log the AI tools they use (or want),
with impact, time/cost comparison, projects, and revenue — so leadership can justify AI spend.
Admins compile the business case and triage new-tool requests.

- **Live:** https://swangz-ai-tracker.netlify.app
- **Everything is in `index.html`** — inline `<style>` + inline `<script>`, no build step,
  no framework, no bundler. Edit `index.html` directly.
- ~4,400 lines. Vanilla JS, no dependencies except the Supabase JS client loaded from a CDN.

## Golden rules

1. **No framework, no build.** Do not introduce React/Vue/bundlers/npm packages. Keep it a
   single static `index.html` that runs by opening it over HTTP. Match the existing vanilla-JS
   style (plain functions, template-literal HTML, `document.getElementById`).
2. **Escape all user/anon-supplied data** rendered into `innerHTML` with `escapeHTML` /
   `escapeAttr`, and route every URL through **`safeUrl()`** before it reaches an `href`
   (blocks `javascript:`/`data:`). Anonymous users can inject request data — treat it as hostile.
   **A value going into an `on*` attribute is JS source, not text — use `jsArg(v)`.**
   `escapeAttr` alone is not enough there: the parser decodes `&#39;` back to a quote
   *before* the handler is compiled, so a stored value could close the string literal and
   run whatever followed. That was a live stored-XSS route through the tool registry.
   Never write ``onclick="fn('${escapeAttr(x)}')"``; write ``onclick="fn(${jsArg(x)})"``.
3. **Preserve the field IDs.** The wizard steps reuse the original form field IDs
   (`f_toolName`, `f_category`, `f_status`, `f_reason`, `f_impact`, `f_tradTime`, `f_aiTime`,
   `f_tradCost`, `f_frequency`, `f_toolMonthlyCost`, `f_extraCredits`, `f_revenueDesc`,
   `f_revenueAmount`, plus `f_guestName/Email/Dept` for public mode). `loadDetailForm`,
   `saveDetail`, `updateConversions`, `renderProjects` all depend on them.
4. **Time is working time.** `UNIT_HOURS` says a day is 8 hours and a week 40, because
   every figure here is work, not elapsed calendar time. `smartUnit` reads those
   thresholds — never restate them. Figures are shown in hours, days or weeks; months
   and years are input units only ("3.5 months saved each month" is nonsense).
5. **Demo rows never leave the browser.** Anything tagged `isDemo` is filtered out of
   every backend push — seeding is preview-only, but a reviewer can also sign in for real
   on a preview host.
6. **There is a test harness** — `cd test && npm install && npm test`. Add a check when
   you fix something; `npm run audit` and `npm run dupes` catch whole classes at once.
7. **Supabase pushes are per-row upsert, never delete-all.** See "Backend/sync" — a blanket
   delete would wipe concurrently-inserted public requests.

## How to run locally

Static server + a localhost-only dev bypass (real Google OAuth only works on the deployed domain).

```bash
npx http-server . -p 5180 -c-1 --silent
# open http://localhost:5180
```

On `localhost`/`127.0.0.1` the sign-in screen shows a **"🔧 Continue as Local Dev"** button
(function `mountDevBypass`, guarded by `isLocalDev()`). It sets a synthetic `authUser` and skips
OAuth. This block is **inert on any real host** — it is safe in production but can be stripped
(search for `LOCAL DEV BYPASS`).

## Architecture

### Views + the wizard overlay
- Page "views" are `<section id="…View" class="view">` toggled by `switchView(v)`;
  `VIEW_IDS = ['auth','landing','tools','admin']`.
- The **tool wizard is NOT a view** — it's a floating glass overlay `#detailView.wizard-overlay`
  shown via `.open` (functions `openWizard`/`closeWizard`), independent of `switchView`.
  `switchView` calls `dismissOverlays()` first so a view change can't strand a modal.
- `currentView` tracks the active section; `wizardOpen` tracks the overlay.

### Multi-step wizard (replaces the old long form)
6 gated steps in `.wizard-step[data-step]`: **Identity → Why&Impact → Projects → Time&Cost →
AI Cost → Revenue**. Controller: `gotoStep/nextStep/prevStep/validateStep/finishWizard/
renderWizardProgress/updateWizardFooter`.
- New entries are **gated** (can't advance past a step until its required fields are valid;
  required = tool name + category on step 1, business reason on step 2).
- Existing entries (`currentToolId` set) open **fully unlocked** for free review/edit.

### Report vs Request (same wizard, a tag)
- Every entry has `tag: 'report' | 'request'`. "+ Add Tool" opens a chooser (`#addChooser`,
  `openAddChooser`/`chooseAddType`). Requests also carry `requestStatus`
  (`new → reviewed → approved → declined`) and `adminNote`.
- **Public (no sign-in) requests:** auth-screen button → `startPublicRequest()` → wizard in
  `wizardMode='public'` (guest name/email/dept, tag locked to request) → `submitPublicRequest()`
  → single additive Supabase insert via `insertPublicRequestRow()`.

### Admin
- Password-gated dashboard (`renderAdmin`) with accordions. **Requests Inbox**
  (`renderRequestsInbox`, `setRequestStatus`, `setRequestNote`) triages `tag==='request'` entries.
- `filteredEntries()` **excludes `tag==='request'`** so requests don't inflate the realized-value
  KPIs — they live only in the inbox.

### Data model (one entry object, stored as JSON)
`id, kind('tool'|'registry'), tag, requestStatus, adminNote, department, submittedBy,
submittedByEmail, role, toolName, toolNameRaw, officialUrl, persistInRegistry, category, status,
reason, impact, projects[], tradTime, tradTimeUnit, aiTime, aiTimeUnit, tradCost, currency,
frequency, revenueDesc, revenueAmount, toolMonthlyCost, extraCredits, submittedAt, updatedAt`.
Registry "stubs" (`kind:'registry'`) power the tool-name autocomplete and are filtered out of
dashboards by `dashboardEntries()`.

## Backend / sync

Pluggable backend (`settings.backend.mode`): `local` (browser only) | `sheets` (Google Apps
Script, see `apps-script/Code.gs`) | `supabase` (default).

- **Supabase project ref:** `ykzaaszeaufaxyxyzuti`. The **publishable key** is hard-coded in
  `index.html` (`SUPABASE_KEY_PUB`) — this is by design for an internal tool; it's the new
  opaque `sb_publishable_…` format (NOT a JWT) and maps to the Postgres `anon` role. Send it as
  the `apikey` header for REST.
- **Auth:** Supabase Google OAuth, `persistSession`. Access limited to `@swangzavenue.com`
  (`ALLOWED_DOMAINS` / `enforceEmailAllowlist`).
- **Sync:** `supabasePushAll` = per-row **upsert** (`Prefer: resolution=merge-duplicates`,
  `on_conflict=id`). Deletions propagate via targeted `supabaseDeleteIds` (called from
  `removeTool`/`deleteCurrent`); `wipeAll` is the only delete-all. `supabasePullAll` reads
  `select=payload`; `mergeEntries` is newest-wins by `updatedAt`.
- **RLS (`supabase/schema.sql`, already applied to the live DB):** `authenticated` = full CRUD;
  `anon` = INSERT only, and only rows where `tag='request'` AND `isPublic='true'` AND
  `requestStatus='new'`; plus a `octet_length(payload::text) < 32768` size guard. Anon cannot
  read/update/delete. If you change the anon-writable shape, update this policy and re-run it.

## Deploy

Static hosting. `netlify.toml` (site `swangz-ai-tracker`) and `vercel.json` are both configured
(publish root = `.`, SPA rewrite → `/index.html`, security headers). See `DEPLOY.md` for the full
Netlify/Vercel/Sheets/Supabase setup. Netlify CLI deploy:
`netlify deploy --prod --dir . --site <id>`.

## Known limitations / good next tasks

- **Multi-admin concurrency:** merge is newest-wins by *client* clock; simultaneous edits from
  skewed clocks can lose a field. A field-level merge (or server `updated_at`) would harden it.
- **Anon abuse:** size-capped but no rate limiting; a Supabase Edge Function fronting inserts
  would add rate-limit + validation.
- **A11y:** wizard has Escape/backdrop-close + initial focus, but no full Tab focus-trap or
  `inert` background yet.
- **Dev bypass** is still present (inert in prod) — strip before a hardened release if desired.

## Files

```
index.html          the entire app (HTML + CSS + JS)
supabase/schema.sql  DB schema + RLS policies (source of truth; already applied)
apps-script/Code.gs  Google Sheets backend (Option 2 in DEPLOY.md)
netlify.toml         Netlify config      vercel.json  Vercel config
DEPLOY.md            hosting + backend setup guide
base44-prompt.md     original generation prompt (historical)
```
