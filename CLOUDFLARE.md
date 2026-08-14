# Deploying the preview to Cloudflare Pages

The repo stays **private** — Cloudflare Pages deploys from private repos on the free plan.

## One-time setup
1. Go to <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
2. Authorise GitHub and pick **`arnoldkigozi0/swangz-ai-tracker-redesign`**.
3. Settings:
   - **Project name:** `swangz-ai-tracker`
     (the preview bypass that used to be scoped to this hostname is gone —
     see the warning under "The preview toolbar")
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
4. **Save and Deploy.**

Live at **https://swangz-ai-tracker.arnoldkigozi.workers.dev** — and every push to `main`
redeploys automatically.

## The preview toolbar

⚠️ **Since 14 Aug 2026 this means localhost only.** `previewHost()` is now just
`isLocalDev()`, and the bypass host lists are empty, so nothing deployed —
including a Cloudflare deployment of this repo — shows the toolbar or the
sign-in bypass. A deployed preview is an ordinary copy of the live app and has
to be signed into like any other. If you want a private preview, put the
hostname behind Cloudflare Access rather than relying on anything in the page.

The bar at the bottom of the screen exists **only on localhost** — it is never
built on any deployed site.

| Control | What it does |
|---|---|
| **View as department** | Drops you into the department experience as an ordinary user, so the guided flow can be reviewed by someone who is an admin. Click **← Back to admin** to return; the admin session is not re-challenged. |
| **Load demo data** / **Clear demo** | Sample entries for reviewing the dashboard. |

"View as department" lowers the *role*, so the chrome, routing, department-only
CSS and the assistant's department scoping all behave exactly as they will for
a real department user. It is scoped to the tab, so closing the tab ends it.

## Settings an admin should fill in first

Under **Money & Pricing**:

| Setting | Why it matters |
|---|---|
| **Blended hourly rate (USD)** | Without it the hours the team saves are reported as hours only. With it, every briefing also states what those hours are worth. |

Under **Settings → Company Settings**:

| Setting | Why it matters |
|---|---|
| **Swangz Google Drive folder** | Where the team uploads project media. The "Upload to Swangz Drive" button in the project tile opens this folder; without it, that button just says to ask an admin. Only Google Drive links are accepted anywhere in the app. Set once, it reaches every department — but only once `supabase/schema.sql` has been re-run, since it is stored in the shared `app_config` table. |

Under **Settings → Notifications & Documents**:

| Setting | Why it matters |
|---|---|
| **Mail endpoint** | An Apps Script web app that receives `{to, cc, bcc, subject, body, attachmentName, attachmentHtml}` and calls `MailApp.sendEmail`. Until it is set, every message waits in the outbox and can be opened in your own mail client — nothing is lost, but nothing goes out by itself. |
| **Also copy, without telling the submitter** | Goes in **BCC**, so nobody on the To or CC line can see it. This is how the GM gets a copy of everything without the person who filed it knowing. |
| **When to write** | Filed / reviewed / approved / declined, each switchable. |

The person who filed something always gets their own copy unless that is
switched off.

The team never enters money. They report the work and the hours; every figure
in money — what the old way cost, the licence, extra credits, revenue — is set
by an admin under **Money & Pricing**, where anything still uncosted appears
under **Waiting on you**.

## Going live

**The live URL is <https://swangz-ai-tracker.netlify.app/>** — that is where the company
reaches the tracker. Everything else in this file is a preview host.

- ✅ **The sign-in bypass is gone.** `PREVIEW_BYPASS_HOSTS` / `PREVIEW_BYPASS_SUFFIXES` are
  empty and `isLocalDev()` is localhost-only, so nothing that is deployed can skip sign-in.
  The two lists stay declared and empty on purpose — `npm run audit` fails if a host is put
  back. There is no preview toolbar on any deployed host any more.
- ✅ **`supabase/schema.sql` has been re-run** (14 Aug 2026). `public.app_config` exists, so
  the Drive folder now reaches the whole company, and every policy on `entries` and
  `app_config` goes through `public.is_swangz_staff()` instead of admitting any signed-in
  account. Re-run it again after any change to that file; it is always safe to re-run.
- ✅ **The Supabase redirect configuration needs nothing.** The build that ran here before the
  redesign already signed in against the same project with the same
  `redirectTo: window.location.origin + '/'`, so this URL is already trusted.
- ✅ **The admin email code is deliberately not shipped.** Sign-in is Google + the allowlist
  + the admin password, and the gate says so. See below.

Run `cd test && npm run audit` to be told which of these are still outstanding.

## The admin's second factor

The admin gate can be three steps — Google, then a 6-digit code emailed to you,
then the admin password. The middle step needs a server: a browser cannot send
email. `OTP_ENDPOINT` at the top of the script is where that server goes; it
receives `{email, code}` and sends the message.

**Until it is set, the email step does not run on the live site.** Sign-in is
your Google account plus the admin password, and the gate says so. It is not
skipped quietly, and the code is never printed on screen on a real host — a
code shown to whoever is already looking at the screen proves nothing about who
they are, and a step that proves nothing is worse than no step, because it
looks like security.

On **localhost** the step still runs and shows the code, so the flow can be
demonstrated without a backend. It no longer does that on any deployed host —
a code printed on the screen of whoever is already reading it proves nothing.

To turn it on for real: deploy an Apps Script or Supabase Edge Function that
takes `{email, code}` and mails it, then set `OTP_ENDPOINT` to its URL.
