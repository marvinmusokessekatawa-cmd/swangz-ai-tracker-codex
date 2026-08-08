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

## Two settings an admin should fill in first

Both live under **Money & Pricing** in the admin portal.

| Setting | Why it matters |
|---|---|
| **Blended hourly rate (USD)** | Without it the hours the team saves are reported as hours only. With it, every briefing also states what those hours are worth. |
| **Swangz Google Drive folder** | Where the team uploads project media. The "Upload to Swangz Drive" button in the project tile opens this folder; without it, that button just says to ask an admin. Only Google Drive links are accepted anywhere in the app. |

The team never enters money. They report the work and the hours; every figure
in money — what the old way cost, the licence, extra credits, revenue — is set
by an admin under **Money & Pricing**, where anything still uncosted appears
under **Waiting on you**.

## Before the real launch
- Remove the `PREVIEW_BYPASS_HOSTS` / `PREVIEW_BYPASS_SUFFIXES` block in
  `index.html` so the sign-in bypass cannot reach any deployed host.
- Ask Marvin to add the final URL to Supabase → **Authentication → URL
  Configuration → Redirect URLs**, or Google sign-in will not complete.
