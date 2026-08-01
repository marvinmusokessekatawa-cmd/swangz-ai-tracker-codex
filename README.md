# Swangz Avenue — AI Adoption Tracker

A single-file web app for tracking AI-tool adoption across Swangz Avenue's departments, doubling
as a **tool-request platform**. Departments log the AI tools they use (or want) — with impact,
time/cost comparison, projects, and revenue — so leadership can justify AI investment. Admins
compile the business case and triage new-tool requests.

**Live:** https://swangz-ai-tracker.netlify.app

## Highlights

- **Zero build.** Everything is in [`index.html`](index.html) — inline CSS + vanilla JS. Open it
  over HTTP and it runs.
- **Multi-step glass wizard** for entering a tool (Identity → Why & Impact → Projects →
  Time & Cost → AI Cost → Revenue), gated step-by-step.
- **Report vs Request:** log a tool you use, or request one you don't have yet. Anyone can file a
  request without signing in.
- **Admin Requests Inbox** with a New → Reviewed → Approved / Declined workflow.
- **Supabase backend** (Google OAuth, `@swangzavenue.com`-gated) with a local-only fallback.

## Run locally

```bash
npx http-server . -p 5180 -c-1 --silent
# then open http://localhost:5180
```

Real Google sign-in only works on the deployed domain, so on `localhost` the sign-in screen shows
a **"🔧 Continue as Local Dev"** button that skips OAuth (inert on any real host).

## Deploy

Static hosting — configs for Netlify ([`netlify.toml`](netlify.toml)) and Vercel
([`vercel.json`](vercel.json)) are included. Full setup (hosting + Google Sheets / Supabase
backends) is in [`DEPLOY.md`](DEPLOY.md).

## For AI agents

See [`AGENTS.md`](AGENTS.md) for architecture, conventions, the data model, backend/RLS details,
and known limitations.

## Layout

| Path | What |
|------|------|
| `index.html` | The entire app (HTML + CSS + JS) |
| `supabase/schema.sql` | DB schema + row-level-security policies (already applied to the live DB) |
| `apps-script/Code.gs` | Optional Google Sheets backend |
| `DEPLOY.md` | Hosting + backend setup guide |
| `AGENTS.md` | Context/instructions for AI coding agents |
