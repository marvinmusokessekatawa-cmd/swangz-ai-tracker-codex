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

## Before the real launch
- Remove the `PREVIEW_BYPASS_HOSTS` / `PREVIEW_BYPASS_SUFFIXES` block in
  `index.html` so the sign-in bypass cannot reach any deployed host.
- Ask Marvin to add the final URL to Supabase → **Authentication → URL
  Configuration → Redirect URLs**, or Google sign-in will not complete.
