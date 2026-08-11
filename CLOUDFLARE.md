# Deploying the preview to Cloudflare Pages

The repo stays **private** — Cloudflare Pages deploys from private repos on the free plan.

## One-time setup
1. Go to <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git**.
2. Authorise GitHub and pick **`arnoldkigozi0/swangz-ai-tracker-redesign`**.
3. Settings:
   - **Project name:** `swangz-ai-tracker`  ← must match exactly, the preview
     bypass is scoped to this hostname
   - **Production branch:** `main`
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
4. **Save and Deploy.**

Live at **https://swangz-ai-tracker.arnoldkigozi.workers.dev** — and every push to `main`
redeploys automatically.

## The preview toolbar

The bar at the bottom of the screen exists **only on preview hosts** (and
localhost) — it is never built on the live site.

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
| **Swangz Google Drive folder** | Where the team uploads project media. The "Upload to Swangz Drive" button in the project tile opens this folder; without it, that button just says to ask an admin. Only Google Drive links are accepted anywhere in the app. |

Under **Notifications & Documents**:

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

## Before the real launch
- Remove the `PREVIEW_BYPASS_HOSTS` / `PREVIEW_BYPASS_SUFFIXES` block in
  `index.html` so the sign-in bypass cannot reach any deployed host.
- Ask Marvin to add the final URL to Supabase → **Authentication → URL
  Configuration → Redirect URLs**, or Google sign-in will not complete.
- Decide about the admin email code — see below.

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

On a preview host the step still runs and shows the code, so the flow can be
demonstrated to Marvin without a backend.

To turn it on for real: deploy an Apps Script or Supabase Edge Function that
takes `{email, code}` and mails it, then set `OTP_ENDPOINT` to its URL.
