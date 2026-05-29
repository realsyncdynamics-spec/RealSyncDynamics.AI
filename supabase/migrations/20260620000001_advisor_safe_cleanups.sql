-- Sichere, bounded Advisor-Bereinigungen (Systemcheck 2026-05-28,
-- docs/runtime/SYSTEMCHECK-2026-05-28.md). Idempotent.

-- 1) BUGFIX set_app_secret: der UPDATE-Zweig nutzte `UPDATE vault.secrets ...`
--    und scheiterte mit "permission denied for table secrets" → bestehende
--    Secrets konnten nicht rotiert werden. Ersetzt durch die offizielle
--    SECURITY-DEFINER-API vault.update_secret().
create or replace function public.set_app_secret(secret_name text, secret_value text)
returns void language plpgsql security definer set search_path to '' as $fn$
declare existing_id uuid;
begin
  select id into existing_id from vault.secrets where name = secret_name;
  if existing_id is null then
    perform vault.create_secret(secret_value, secret_name, 'set via set_app_secret RPC');
  else
    perform vault.update_secret(existing_id, secret_value);
  end if;
end;
$fn$;

-- 2) Doppelte Permissive-Policies (Advisor multiple_permissive_policies):
--    ae/ä-Mojibake-Duplikate aus frueheren Migrationen. Inhaltlich identisch zur
--    korrekt kodierten UTF-8-Variante → die ASCII-Variante entfernen.
drop policy if exists "Nutzer koennen ihren eigenen Pruefpfad einsehen"   on public.audit_logs;
drop policy if exists "Besitzer koennen ihre eigenen Assets verwalten"     on public.c2pa_assets;
drop policy if exists "Nutzer koennen ihr eigenes Profil lesen"            on public.profiles;
drop policy if exists "Nutzer koennen ihr eigenes Profil aktualisieren"    on public.profiles;
drop policy if exists "Besitzer koennen ihre eigenen Workflows verwalten"  on public.workflows;

-- 3) Duplikat-Index (Advisor duplicate_index): identisch zu plans_stripe_lookup_key_key.
drop index if exists creatorseal.plans_stripe_lookup_key_uniq;
