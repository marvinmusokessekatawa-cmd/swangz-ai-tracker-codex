# Swangz AI Tracker — Build Plan (agreed 2026-08-08)

**Deadline:** hand to Marvin **Sun 2026-08-09 before 1pm**. Must be flawless for preview.
**Decision:** backend security DEFERRED to Phase 2 (user chose "Defer backend to Phase 2"). Sunday = polished client-side prototype + ready-to-run backend artifacts.

## Security truth (must not misrepresent)
Static SPA → all code + public anon key ship to every browser. JS-only gates (admin password, dept filters) are COSMETIC / bypassable. Real enforcement = Supabase RLS + Supabase Auth. Admin currently reachable by any signed-in user who sets the password = the loophole the user flagged. Remove the staging sign-in bypass before any real launch.

## Sunday scope (Tier 1 — client-side, no external deps)
- **P3 Visual completeness:** redesign sign-in, add-tool wizard, tool detail, admin accordions; FULL mobile responsive matching desktop (per phone reference).
- **P4 Safe features:** one-time per-department tour; department-aware scripted help assistant (no API key → no leak/cost); "system-generated report" summary view.
- **P5 Role & department UX (labeled "enforcement pending backend"):** super-admin (arnoldkigozi0@ + marvinmusokessekatawa@) / admin / department-user dashboards; department tool-scoping; request-access-to-other-dept flow; tool usage-tracking fields.
- **P6 QA:** responsive 375/768/1024/1440; contrast/focus/touch≥44px; functionality regression; Celeron perf.

## Phase 2 artifacts (prepare now, activate with Marvin later)
- `supabase/schema.sql` rewrite with real RLS (admin=2 supers, dept isolation, no cross-dept leaks).
- Auth flow: Google + password + email-OTP (Supabase Auth native, needs project config).
- Persistent "add admin via dashboard" (backend table + RLS).
- Weekly automated Google-Sheets reports (Apps Script + time trigger) — extend `apps-script/Code.gs`.
- LLM chatbot behind a proxy (Supabase Edge Function / Apps Script) — never embed the key.

## Method (unchanged): CSS-first reskin, additive JS only. Never touch existing IDs/onclicks. All redesign CSS in the appended "REDESIGN LAYER"; all new JS in appended additive `<script>` blocks. Keep gold (#f5c542), Inter + JetBrains Mono, desktop sidebar + mobile bar.

## Commits so far: 7c105af(P1) 92362d1(P2a) 9589b40(P2b) 6cb1662(P2c greeting).
## GATE: staging deploy must be visually confirmed by user before P3 (repo just linked; not yet verified rendering).
