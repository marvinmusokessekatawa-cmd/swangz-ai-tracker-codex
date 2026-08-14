-- =================================================================
-- Swangz Avenue — AI Adoption Tracker
-- Supabase schema (Option 3 in DEPLOY.md)
-- =================================================================
-- Run this in Supabase Dashboard → SQL Editor → New query → RUN
-- It creates one table that stores each tracker entry as a JSON blob,
-- keyed by the entry's id.
--
-- After running this, get your project's URL and anon key from
-- Project Settings → API, paste them into the tracker app's
-- Admin → Backend & Sync, choose "Supabase", Save, then "Push".
--
-- Row level security is ON and closed: reading or writing requires a
-- signed-in Google account whose address passes public.is_swangz_staff()
-- below. The one exception is an anonymous tool *request*, which the
-- public may INSERT and nothing else. Re-running this file is safe.
-- =================================================================

create table if not exists public.entries (
  id           text primary key,                       -- the entry's client-generated id
  payload      jsonb not null,                         -- the full entry object
  updated_at   timestamptz not null default now(),
  inserted_at  timestamptz not null default now()
);

-- Index for ordering and filtering
create index if not exists entries_updated_at_idx on public.entries (updated_at desc);

-- Enable Row Level Security
alter table public.entries enable row level security;

-- =====================================================================
-- Phase 2: AUTH-GATED policies
-- After this migration, only signed-in (Supabase Auth) users can read or
-- write the entries table. Visitors who aren't logged in can no longer
-- see the data even if they have the project URL + anon key, because we
-- now require auth.role() = 'authenticated' on every operation.
--
-- We intentionally do NOT restrict update/delete to the original
-- submitter (auth.email() = payload->>'submittedByEmail') because:
--   1. Admin needs to edit anyone's entry through the Tool Registry Manager.
--   2. Some legacy entries don't have submittedByEmail at all.
-- The application layer enforces "edit your own" UX. If you later need
-- a hard ownership rule, swap the update/delete policies for
-- using ((auth.email() = (payload->>'submittedByEmail'))).
-- =====================================================================

drop policy if exists "anon read entries"   on public.entries;
drop policy if exists "anon insert entries" on public.entries;
drop policy if exists "anon update entries" on public.entries;
drop policy if exists "anon delete entries" on public.entries;
drop policy if exists "auth read entries"   on public.entries;
drop policy if exists "auth insert entries" on public.entries;
drop policy if exists "auth update entries" on public.entries;
drop policy if exists "auth delete entries" on public.entries;
-- the allowlisted replacements, so this file stays safe to run again
drop policy if exists "staff read entries"   on public.entries;
drop policy if exists "staff insert entries" on public.entries;
drop policy if exists "staff update entries" on public.entries;
drop policy if exists "staff delete entries" on public.entries;

-- =====================================================================
-- WHO COUNTS AS STAFF — the same allowlist the app screens sign-in with,
-- but enforced here, where it cannot be edited by whoever is reading.
--
-- Google will hand a session to ANY Google account. The app checks the
-- address and signs a stranger straight back out, but that check lives in
-- JavaScript on the visitor's own machine: a stranger who authenticates
-- and keeps their access token could read, change and delete every row
-- through the REST API without the app being involved at all. These
-- policies are what actually stops that.
--
-- Kept deliberately identical to the app's rule: the org domain, plus the
-- two system owners on their personal addresses. Admins granted from the
-- dashboard must already be @swangzavenue.com, so they need no entry here.
-- Add an owner in ONE place only — if this list and SUPER_ADMINS in
-- index.html ever disagree, somebody gets a silent, confusing denial.
-- =====================================================================
create or replace function public.is_swangz_staff()
returns boolean
language sql
stable
-- deliberately NOT security definer: it reads the caller's own JWT claim and
-- touches no table, so running it as the owner would buy nothing and hand out
-- privilege for free.
as $$
  select coalesce(
    -- exact domain match: split_part avoids `like '%@swangzavenue.com'`,
    -- which would also welcome anyone from notswangzavenue.com
    split_part(lower(coalesce(auth.jwt() ->> 'email', '')), '@', 2) = 'swangzavenue.com'
    or lower(coalesce(auth.jwt() ->> 'email', '')) in (
      'marvinmusokessekatawa@gmail.com',
      'arnoldkigozi0@gmail.com'
    ),
  false);
$$;

create policy "staff read entries"   on public.entries for select to authenticated using      (public.is_swangz_staff());
create policy "staff insert entries" on public.entries for insert to authenticated with check (public.is_swangz_staff());
create policy "staff update entries" on public.entries for update to authenticated using      (public.is_swangz_staff())
                                                                                   with check (public.is_swangz_staff());
create policy "staff delete entries" on public.entries for delete to authenticated using      (public.is_swangz_staff());

-- Check it before trusting it. Signed in as staff this returns true; it is the
-- one query that tells you whether the whole allowlist is working:
--   select auth.jwt() ->> 'email' as who, public.is_swangz_staff() as allowed;
--
-- IF IT LOCKS THE TEAM OUT — say the tokens carry no email claim — this puts
-- the old behaviour back in one paste, and the app keeps working exactly as it
-- did before, with the allowlist enforced in the page only:
--   drop policy if exists "staff read entries"   on public.entries;
--   drop policy if exists "staff insert entries" on public.entries;
--   drop policy if exists "staff update entries" on public.entries;
--   drop policy if exists "staff delete entries" on public.entries;
--   create policy "auth read entries"   on public.entries for select to authenticated using (true);
--   create policy "auth insert entries" on public.entries for insert to authenticated with check (true);
--   create policy "auth update entries" on public.entries for update to authenticated using (true) with check (true);
--   create policy "auth delete entries" on public.entries for delete to authenticated using (true);

-- =====================================================================
-- Public tool requests (no sign-in)
-- The app lets anyone submit a tool *request* without a Google account
-- (Departments view → "Submit a tool request without signing in", or the
-- auth screen). Those land here so the admin can triage them in the
-- Requests Inbox. We allow the anon role to INSERT, but ONLY rows whose
-- payload is tagged tag='request' — so the public can drop a request and
-- nothing else. anon still CANNOT read, update, or delete any row, so the
-- existing data stays private (auth-only) exactly as before.
-- =====================================================================
drop policy if exists "anon insert requests" on public.entries;
create policy "anon insert requests" on public.entries
  for insert to anon
  with check (
        (payload->>'tag') = 'request'
    and coalesce(payload->>'requestStatus', 'new') = 'new'   -- anon can't pre-approve their own request
    and (payload->>'isPublic') = 'true'                      -- mark anon rows so admins can tell them apart
  );

-- Bound the payload size so an anonymous caller can't push huge rows (one tool
-- entry is well under this). Applies to every insert/update, anon or authenticated.
alter table public.entries drop constraint if exists entries_payload_size;
alter table public.entries add constraint entries_payload_size
  check ( octet_length(payload::text) < 32768 );

-- Touch updated_at on every update
create or replace function public.entries_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch
  before update on public.entries
  for each row execute function public.entries_touch_updated_at();

-- =====================================================================
-- Site-wide configuration — one row per setting
--
-- The Swangz Drive folder is chosen by an admin and has to reach the whole
-- team. It used to live in the browser's localStorage, which meant the admin
-- set it on their own laptop and every department user still saw "no folder
-- has been set yet — ask an admin". One shared row fixes that.
--
-- Read and write are both limited to staff, the same as the entries table:
-- everybody in the company needs to read the folder, and only the admin
-- dashboard ever renders the field to write it. Restricting writes further,
-- to the two owners alone, is a one-line change — see the note underneath.
-- =====================================================================
create table if not exists public.app_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

alter table public.app_config enable row level security;

drop policy if exists "auth read config"    on public.app_config;
drop policy if exists "auth insert config"  on public.app_config;
drop policy if exists "auth update config"  on public.app_config;
drop policy if exists "staff read config"   on public.app_config;
drop policy if exists "staff insert config" on public.app_config;
drop policy if exists "staff update config" on public.app_config;

create policy "staff read config"   on public.app_config for select to authenticated using      (public.is_swangz_staff());
create policy "staff insert config" on public.app_config for insert to authenticated with check (public.is_swangz_staff());
create policy "staff update config" on public.app_config for update to authenticated using      (public.is_swangz_staff())
                                                                                      with check (public.is_swangz_staff());

-- Tighter still, if you would rather only the two owners could change a
-- site-wide setting. Replace the two write policies above with:
--
-- create policy "owners insert config" on public.app_config for insert to authenticated
--   with check ( lower(auth.jwt() ->> 'email') in ('marvinmusokessekatawa@gmail.com', 'arnoldkigozi0@gmail.com') );
-- create policy "owners update config" on public.app_config for update to authenticated
--   using      ( lower(auth.jwt() ->> 'email') in ('marvinmusokessekatawa@gmail.com', 'arnoldkigozi0@gmail.com') )
--   with check ( lower(auth.jwt() ->> 'email') in ('marvinmusokessekatawa@gmail.com', 'arnoldkigozi0@gmail.com') );

alter table public.app_config drop constraint if exists app_config_value_size;
alter table public.app_config add constraint app_config_value_size
  check ( octet_length(value::text) < 4096 );

drop trigger if exists app_config_touch on public.app_config;
create trigger app_config_touch
  before update on public.app_config
  for each row execute function public.entries_touch_updated_at();
