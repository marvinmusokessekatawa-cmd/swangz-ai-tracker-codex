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
8. **`SUPER_ADMINS` keeps working everywhere, but is never rendered.** The two owners
   still sign in, still hold the `super` role and still receive notification mail exactly
   as before — they are simply not drawn on screen. `renderAdminsPanel()` lists granted
   admins only, and the count beside it must not mention owners. Do not re-add an owner
   row, and keep the outbox from printing those addresses (`visibleRecipients()`). This
   hides them from the interface, not from the page source — the file is served to every
   browser, so real enforcement still has to land in Supabase RLS.
9. **A granted admin must be an `@swangzavenue.com` account.** `addAdminEmail()` checks the
   domain *before* it says anything about an address already having access, so the form
   cannot be used to ask "is this one of the owners?". Keep that order.
10. **The Swangz Drive folder is a company setting, not a personal one.** An admin sets it under
   **Settings › Company Settings** (`acc_company`, field `cfg_drive`) and it applies to everyone;
   no department can point elsewhere. It is configuration, not a figure — it briefly sat in
   Money & Pricing, where nobody looks for a folder. It lives in `app_config`, because in
   localStorage the admin set it on their own laptop and every department user still read "ask
   an admin". `settings.driveFolderUrl` is only a cache. `saveCompanySettings()` publishes it
   and only when the folder itself changed — sharing the handler with the hourly rate re-published
   it on every keystroke. `configPushDrive()` re-checks `canSeeAdmin()` — the field not being
   rendered is not a gate.
11. **Custom report ranges are local dates, and both ends are included.** `dayStart()` builds
   a *local* midnight — `new Date('2026-08-13')` is UTC midnight, which in Kampala is 3am, so
   anything filed before then would fall outside its own day. `execWindow` pushes the "to"
   day to the following midnight because the window test is half-open (`>= from && < to`).
12. **Everyone lands in their department; the admin door is `#railAdminBtn`.** An admin is a
   member of staff with a second job, and the dashboard is that second job, not their home —
   `routeAfterSignIn()` sends everybody to `tools`. This is **only safe while the door is
   drawn**. `.view-toggle` is `display:none !important`, so routing used to be the sole way
   across, and routing on profile completeness alone once stranded every owner in the
   department view with no way out (it read from the inside exactly like "I signed in and I
   am not an owner"). The door is now explicit and lives in the **account menu** (`#railWho` →
   `#accountMenu`), repeated by name in `#profileMenu`. **The rail lists sections and nothing
   else** — Arnold asked for the standalone rail button to go, and it did. The account block is
   where it had to land: `#profileMenu` is inside `#toolsView`, so on its own it is missing from
   the portal, which is exactly where an admin needs the way back. The entry is drawn for *every*
   signed-in account and carries `.is-locked` for accounts without access: a locked door explains
   itself, a missing one reads as a bug. `paletteCommands()` also carries an explicit
   **Open the Admin Dashboard** entry: every other admin command is read out of `#adminNav`,
   which is empty until the admin view has rendered once.
13. **The admin list is a shared row, not a browser's.** `extraAdmins()` reads localStorage,
   but that is only a *cache* of `app_config.admin_emails`, published by `configPushAdmins()`
   and applied by `applyAdminsConfig()` on every `configPull()`. It used to be localStorage
   and nothing else, which meant a grant was written on the granting owner's own laptop and
   the person being promoted read their own empty copy for ever — "I added them as an admin
   and their dashboard never changed". An **absent** row is not an empty list: `applyAdminsConfig`
   ignores it, or an unreachable table would revoke everyone. Postgres enforces owner-only
   writes to that one key (`public.is_swangz_owner()` in `supabase/schema.sql`) — the app's
   owner check runs on the grantee's own machine and proves nothing. ⚠️ **The new policy must
   be re-run in the SQL editor** before a grant can leave the browser.
14. **The admin password belongs to the admin.** `settings.adminPasswordHash` was one shared
   secret: whoever opened the dashboard first chose it and every other admin typed that same
   string. It is now per-address, PBKDF2-stretched with a per-record salt, held per device in
   `swangz_admin_pass_v2`, and asked for **every** time the dashboard is entered (leaving it
   sets `adminUnlocked = false`). The Google session is the authentication; this is the second
   gate in front of the figures, against a laptop left open. `adoptLegacyAdminPassword()`
   accepts the old shared password exactly once and converts it, so an upgrade cannot lock an
   owner out of their own dashboard.
13. **The allowlist is enforced in Postgres, not only in JavaScript.** Google hands a session
   to *any* Google account; `enforceEmailAllowlist()` signs a stranger straight back out, but
   that runs on the visitor's own machine, and the policies used to be
   `to authenticated using (true)` — so a stranger who kept their access token could read,
   change and delete every row straight through the REST API. `public.is_swangz_staff()` now
   gates every policy on `entries` and `app_config`. It screens the domain with
   `split_part(email,'@',2) = 'swangzavenue.com'`, never `like '%@swangzavenue.com'`, which
   would also admit `evil-swangzavenue.com`. **The owner list exists in two places** —
   `SUPER_ADMINS` in `index.html` and the list inside that function. `npm test` asserts they
   agree; if they ever drift, a real member of staff gets a silent denial from Postgres that
   reading `index.html` would never explain.

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

### Two inboxes, one working tile
- **Reports Inbox** (`acc_reports`, `renderReportsInbox`) and **Requests Inbox** (`acc_requests`)
  are the same shape on the two kinds of entry, and both sit under the **Tools** door.
  A report had no inbox at all until now — the only routes to one were Tools Entered
  (consolidates by tool, loses who filed it) and Manage Submissions (for fixing attribution).
- Reports carry `reportStatus`: `new → reviewed → confirmed → returned`. Nothing filters on it —
  an unconfirmed report is still what the team reported, and dropping it from `filteredEntries()`
  would change the company's numbers based on an admin's reading habits.
- **`DECK.register('decide')` is the one action tile** for both kinds: the three status buttons
  (`DECISIONS` / `REPORT_DECISIONS`), the note, the price, and the per-message BCC choice.
  Deciding and pricing used to be two errands in two places and the second was easy to skip.
  It is gated on `canSeeAdmin()` **in the builder**, not only by who can reach it.
- `decide._bcc` carries the tile's copy choice into the `setRequestStatus`/`setReportStatus`
  wrappers, which are what actually send. A status change from anywhere else uses the standing list.

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

15. **The mail endpoint must be sent `action:'notify'`.** The app used to POST `{kind:'notify'}`
   while `apps-script/Code.gs` dispatched on `body.action` and **defaulted to `replaceAll`** —
   so a notification, which carries no entries, read as *replace every row with nothing*.
   Pointing the mail endpoint at the sheet URL would have emptied the spreadsheet on the first
   message. The script now refuses an actionless POST; `deliver()` names the action. A `200`
   carrying `{ok:false}` is a refusal, not a success — check the body, not the status.
   Mail settings live in `app_config.notify_settings` for the same reason the admin list does.
16. **Media is any link, and it is shown rather than described.** `DRIVE_HOSTS`/`isDriveLink`
   still exist for the *company folder*, but a project's link may be anywhere — `mediaKind()`
   names the host and `mediaViewerHTML()` plays it. **Host checks come before extension checks**:
   a Dropbox share URL ends in `.mov` but serves an HTML page. Anything unrecognised is a link
   and is **never** put in an `<iframe>`, so a pasted URL cannot become an arbitrary frame.
   Do not add `referrerpolicy="no-referrer"` to the video iframes — YouTube and Vimeo check the
   referrer and answer "Error 153" without one.
17. **The tool name is a real combobox, not a `<datalist>`.** Chrome filters a datalist against
   what is already typed, so once a tool was chosen the list held one entry — its own — and the
   dropdown read as dead; you could not change your mind without clearing the field first.
   `toolPickerMatches()` deliberately returns **everything** when the value exactly matches a
   known tool. The list is built at body level (`toolPickerEl`) because the wizard step is its
   own scroller and would crop it to four rows.

18. **Every delete must call `backendDeleteEntry`/`backendDeleteEntries`.** Pushes are upsert-only,
   so a row removed from `entries` and nothing else is pulled straight back on the next sync.
   `removeTool` and `deleteCurrent` always did this; **`deleteSubmission` and `deleteRegistryTool`
   did not** — which is why rubbish an admin had deleted kept reappearing on every screen. If you
   add a delete path, propagate it or it does not exist.
   Related: **`looksLikeTest()` flags, it never removes.** "test" is a guess and a guess must not
   delete a department's work on its own; the admin ticks and confirms. `pickAllManage` selects
   only `manageVisible` — all of what is *listed*, never all of what exists.
   It matches on two things: `JUNK_NAMES` (the whole name is junk) and `JUNK_MARKERS` (a phrase
   that means junk **anywhere** in the name or the submitter). The row that prompted it was
   `__POLICY TEST - delete me__` filed by `policy-test` — someone checking the anon-insert policy
   against the live database and leaving the rows behind — which an exact-name match walked past.
   Keep `JUNK_MARKERS` to phrases no real product carries: a bare `\btest\b` would take
   *TestGorilla* and *A/B Test Suite* with it. Both inboxes mark flagged rows, because that is
   where they are actually seen.

19. **It is an installable app, and the HTML must never be cached first.** `manifest.webmanifest`
   + `sw.js` make the page installable on Windows, macOS and Android; `APPS.md` covers the
   packaged `.exe`/`.dmg`/`.apk` built by `.github/workflows/apps.yml`. The one rule inside the
   worker that must not change: **index.html is network-first.** The whole app is that one file,
   so a cache-first rule would freeze every installed user on the build they happened to install
   and no deploy could ever reach them. Everything else is cache-first. Bump `CACHE` in `sw.js`
   when `SHELL` changes. Supabase, Google and Apps Script URLs are never intercepted — a cached
   answer for someone's entries, or for an auth call, is a bug with consequences.
   The desktop and Android apps are **windows onto the live URL**, not copies: Google refuses
   OAuth from an embedded browser, so `desktop/main.js` strips `Electron/…` out of the user agent
   and the Android build is a TWA (real Chrome underneath). `/.well-known/assetlinks.json` carries
   the signing key's fingerprint and must be regenerated with the key if it ever changes.
20. **The default theme is midnight, and it is stamped in `<head>`.** `THEME_DEFAULT` sets it, but
   the chooser lives at the foot of the page — so a small inline script in `<head>` applies the
   saved theme before a rule is parsed. Without it every load painted the base palette and flipped,
   which is a gold flash on a slow machine. Anyone who has already chosen a theme keeps it; only
   the default moved.

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
- **`public.app_config` — site-wide settings, one row per key.** ⚠️ **Added after the original
  schema was applied, so it must be re-run in the SQL editor before it does anything.** Holds
  `drive_folder`; read by any `authenticated` user, written by the admin dashboard only.
  `configPull()` runs from `autoSyncOnLoad()` above the once-per-load guard, so it lands on a
  local backend and again after sign-in (the first attempt has no session for RLS to accept).
  Every call fails quietly — a missing table or paused project must never block page load.

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
