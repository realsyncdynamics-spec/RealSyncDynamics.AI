-- WIEDERHERGESTELLT aus der Prod-Migrations-History (2026-08-02).
-- Diese Migration wurde direkt auf die Prod-DB angewendet, aber nie ins Repo
-- committet — genau der Drift-Fall aus docs/runtime/SYSTEMCHECK-2026-05-28.md.
-- Inhalt ist 1:1 aus supabase_migrations.schema_migrations (Version 20260701121059)
-- uebernommen, damit `supabase db push` wieder laeuft und die Repo-History
-- den tatsaechlichen DB-Zustand abbildet.

drop trigger if exists on_auth_user_created_creatorseal on auth.users;
