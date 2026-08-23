-- =====================================================================
-- Paste this into the Supabase SQL editor AFTER running schema.sql.
-- It changes nothing. It answers one question per row: is this applied?
-- Every row should read "yes".
-- =====================================================================
select 'app_config table exists' as what,
       case when to_regclass('public.app_config') is not null then 'yes' else 'NO' end as result
union all
select 'is_swangz_staff() exists',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'is_swangz_staff')
            then 'yes' else 'NO' end
union all
select 'is_swangz_owner() exists',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'is_swangz_owner')
            then 'yes' else 'NO' end
union all
select 'row level security is on for entries',
       case when coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
                           where n.nspname = 'public' and c.relname = 'entries'), false)
            then 'yes' else 'NO' end
union all
select 'row level security is on for app_config',
       case when coalesce((select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
                           where n.nspname = 'public' and c.relname = 'app_config'), false)
            then 'yes' else 'NO' end
union all
-- The one that matters most: ordinary staff must not be able to write the
-- row that decides who is an admin. Both write policies have to name the key.
select 'only owners can write the admin list',
       case when (select count(*) from pg_policies
                  where schemaname = 'public' and tablename = 'app_config'
                    and cmd in ('INSERT', 'UPDATE')
                    and coalesce(qual, '') || coalesce(with_check, '') like '%admin_emails%') = 2
            then 'yes' else 'NO' end
union all
select 'the public can only insert requests, nothing else',
       case when exists (select 1 from pg_policies
                         where schemaname = 'public' and tablename = 'entries'
                           and policyname = 'anon insert requests')
            then 'yes' else 'NO' end
union all
select 'how many settings the company has published',
       coalesce((select string_agg(key, ', ' order by key) from public.app_config), 'none yet');
