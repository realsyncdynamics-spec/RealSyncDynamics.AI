-- Bedarfs-Check (/check): gespeicherte Ergebnisse angemeldeter Nutzer.
--
-- Ersetzt die nie angewendeten Entwürfe 20261115200000_needs_check_results.sql
-- (PR #2262) und 20261115203000_needs_check_results.sql (PR #2260). Geprüft am
-- 15.11.2026 gegen supabase_migrations im Live-Projekt: keine der beiden ist
-- angewendet, darum ersetzt diese Datei sie, statt auf ihnen aufzubauen.
--
-- Additiv. Keine bestehende Tabelle, Policy oder Berechtigung wird geändert.
--
-- Was der Server festlegt, nicht der Client:
--   • user_id        = auth.uid()                  (Trigger, Spalte nicht beschreibbar)
--   • created_at     = now()                       (Trigger, Spalte nicht beschreibbar)
--   • model_version  = aktuelle Modellversion      (Trigger, Spalte nicht beschreibbar)
--   • recommendation_ids = needs_check_recommend() (Trigger + CHECK, Spalte nicht beschreibbar)
-- Der Client darf nur goal, area, has_website und website_url schreiben
-- (Spalten-GRANT). Wer mehr mitschickt, bekommt „permission denied“.
--
-- Historischer Stand: gespeichert werden Antworten, Modellversion und die
-- vom Server berechneten Empfehlungs-IDs. Die Texte liefert der eingefrorene
-- Katalog der jeweiligen Version (shared/needs-check.ts). Preise und
-- Verfügbarkeit werden nicht gespeichert.
--
-- Technische Prüfung: nicht Teil dieses Ergebnisses. Öffentliche Scans
-- (gdpr_audits) haben keine Nutzerzuordnung; der Server könnte die
-- Zugehörigkeit eines Scans nicht bestätigen. Es gibt deshalb bewusst keine
-- Spalte audit_id. Die Oberfläche verweist für den Scan auf /audit.
--
-- Kontingent: höchstens 20 erfolgreiche Speicherungen je Nutzer in
-- rollierenden 24 Stunden. Gezählt wird in einem eigenen Protokoll, nicht in
-- den Ergebnissen — Löschen gibt nichts frei. Parallele Speicherungen werden
-- über eine Sperrzeile je Nutzer serialisiert.
--
-- Rechte (Begründung je Funktion unten):
--   needs_check_recommend                 IMMUTABLE, ohne Tabellenzugriff
--   needs_check_results_10_set_fields     SECURITY INVOKER — braucht keine Zusatzrechte
--   needs_check_results_20_quota          SECURITY DEFINER — schreibt Protokoll und
--                                         Sperrzeile, die der Nutzer weder lesen noch
--                                         schreiben darf. Trigger-Funktion: nicht per
--                                         RPC aufrufbar.

-- ── 1. Empfehlungslogik (Spiegel von recommendIds() in shared/needs-check.ts) ──

create or replace function public.needs_check_recommend(
  p_version smallint,
  p_goal text,
  p_has_website boolean
)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  ids text[] := '{}';
begin
  -- Unbekannte Version: Fehler statt NULL. Ein NULL würde den CHECK unten
  -- stillschweigend passieren lassen.
  if p_version is distinct from 1::smallint then
    raise exception 'needs_check_unknown_model_version' using errcode = '22023';
  end if;
  if p_goal is null or p_has_website is null then
    raise exception 'needs_check_missing_answer' using errcode = '22023';
  end if;

  -- Version 1 — eingefroren, siehe VERSIONSREGEL in shared/needs-check.ts.
  if p_goal = 'website' then
    ids := ids || case when p_has_website then 'build.modernize' else 'build.new_site' end;
  elsif p_goal = 'inquiries' then
    ids := ids || 'automate.chat'::text;
  elsif p_goal = 'rules' then
    ids := ids || 'govern.runtime'::text;
  elsif p_goal = 'unsure' then
    ids := ids || case when p_has_website then 'govern.website_scan' else 'build.new_site' end;
  end if;

  if p_has_website then
    if not ('govern.website_scan' = any (ids)) then ids := ids || 'govern.website_scan'::text; end if;
  elsif p_goal <> 'website' then
    if not ('build.new_site' = any (ids)) then ids := ids || 'build.new_site'::text; end if;
  end if;

  if p_goal in ('inquiries', 'unsure') and not ('govern.runtime' = any (ids)) then
    ids := ids || 'govern.runtime'::text;
  end if;
  if p_goal in ('website', 'rules') and not ('automate.chat' = any (ids)) then
    ids := ids || 'automate.chat'::text;
  end if;

  return ids[1:3];
end;
$$;

comment on function public.needs_check_recommend(smallint, text, boolean) is
  'Bedarfs-Check: Empfehlungs-IDs je Modellversion. Spiegel von recommendIds() in shared/needs-check.ts; Parität per DB-Test.';

-- ── 2. Ergebnisse ───────────────────────────────────────────────────────────

create table if not exists public.needs_check_results (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  model_version      smallint not null,
  goal               text not null,
  area               text not null,
  has_website        boolean not null,
  website_url        text null,
  recommendation_ids text[] not null,
  created_at         timestamptz not null default now(),

  constraint needs_check_results_version_chk check (model_version in (1)),
  constraint needs_check_results_goal_chk check (goal in ('website', 'inquiries', 'rules', 'unsure')),
  constraint needs_check_results_area_chk check (
    area in ('handwerk', 'praxis', 'kanzlei', 'handel', 'dienstleistung', 'agentur', 'sonstiges')
  ),
  -- Muster identisch mit WEBSITE_URL_PATTERN in shared/needs-check.ts.
  constraint needs_check_results_url_chk check (
    website_url is null
    or (has_website and char_length(website_url) <= 300 and website_url ~* '^https?://[^\s/@]+\.[^\s]+$')
  ),
  -- Zweite Linie hinter dem Trigger: Die gespeicherten IDs MÜSSEN das sein,
  -- was die Logik der gespeicherten Version aus den Angaben ableitet.
  constraint needs_check_results_recs_chk check (
    recommendation_ids = public.needs_check_recommend(model_version, goal, has_website)
  )
);

create index if not exists needs_check_results_user_created_idx
  on public.needs_check_results (user_id, created_at desc);

comment on table public.needs_check_results is
  'Bedarfs-Check (/check): Angaben, Modellversion und serverseitig berechnete Empfehlungs-IDs je Nutzer. RLS: nur eigene Zeilen. Kein UPDATE.';

-- ── 3. Kontingent: Protokoll und Sperrzeile (für Nutzer unsichtbar) ─────────

create table if not exists public.needs_check_save_log (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users (id) on delete cascade,
  saved_at timestamptz not null default now()
);

create index if not exists needs_check_save_log_user_saved_idx
  on public.needs_check_save_log (user_id, saved_at desc);

comment on table public.needs_check_save_log is
  'Bedarfs-Check: je erfolgreicher Speicherung eine Zeile. Grundlage des 24-h-Kontingents. Unabhängig vom Löschen eines Ergebnisses. Kein Zugriff für anon/authenticated.';

create table if not exists public.needs_check_save_quota (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  last_saved_at timestamptz not null
);

comment on table public.needs_check_save_quota is
  'Bedarfs-Check: Sperrzeile je Nutzer. Serialisiert parallele Speicherungen. Kein Zugriff für anon/authenticated.';

-- ── 4. Trigger ──────────────────────────────────────────────────────────────

-- SECURITY INVOKER: setzt nur Felder der neuen Zeile, braucht keine Rechte,
-- die der Aufrufer nicht ohnehin hat.
create or replace function public.needs_check_results_10_set_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'needs_check_unauthenticated' using errcode = '42501';
  end if;
  new.id := gen_random_uuid();
  new.user_id := v_uid;
  new.created_at := now();
  new.model_version := 1;
  new.recommendation_ids := public.needs_check_recommend(new.model_version, new.goal, new.has_website);
  return new;
end;
$$;

-- SECURITY DEFINER: schreibt needs_check_save_log und needs_check_save_quota,
-- auf die der Aufrufer bewusst keinerlei Recht hat (sonst könnte er sein
-- Protokoll lesen, löschen oder fälschen). Liest die Identität ausschließlich
-- aus auth.uid(), nimmt keine Parameter. Eine Trigger-Funktion kann nicht per
-- RPC oder SELECT aufgerufen werden.
create or replace function public.needs_check_results_20_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null or new.user_id is distinct from v_uid then
    raise exception 'needs_check_unauthenticated' using errcode = '42501';
  end if;

  -- Sperrzeile je Nutzer. Eine zweite, parallele Speicherung desselben
  -- Nutzers wartet hier, bis die erste abgeschlossen ist (READ COMMITTED),
  -- oder scheitert mit einem Serialisierungsfehler (REPEATABLE READ /
  -- SERIALIZABLE). In keinem Fall zählen beide gegen denselben alten Stand.
  insert into public.needs_check_save_quota as q (user_id, last_saved_at)
  values (v_uid, now())
  on conflict (user_id) do update set last_saved_at = excluded.last_saved_at;

  -- Protokoll klein halten: Einträge außerhalb des Fensters zählen nie mehr.
  delete from public.needs_check_save_log
  where user_id = v_uid and saved_at <= now() - interval '24 hours';

  select count(*) into v_count
  from public.needs_check_save_log
  where user_id = v_uid and saved_at > now() - interval '24 hours';

  if v_count >= 20 then
    raise exception 'needs_check_rate_limited' using errcode = 'P0001';
  end if;

  -- Scheitert danach die eigentliche Zeile (CHECK, RLS), rollt dieser Eintrag
  -- mit zurück: Gezählt werden nur erfolgreiche Speicherungen.
  insert into public.needs_check_save_log (user_id, saved_at) values (v_uid, now());
  return new;
end;
$$;

-- Postgres feuert gleichartige Trigger in Namensreihenfolge: erst Felder, dann Kontingent.
drop trigger if exists needs_check_results_10_set_fields on public.needs_check_results;
create trigger needs_check_results_10_set_fields
  before insert on public.needs_check_results
  for each row execute function public.needs_check_results_10_set_fields();

drop trigger if exists needs_check_results_20_quota on public.needs_check_results;
create trigger needs_check_results_20_quota
  before insert on public.needs_check_results
  for each row execute function public.needs_check_results_20_quota();

revoke all on function public.needs_check_results_10_set_fields() from public;
revoke all on function public.needs_check_results_20_quota() from public;
revoke all on function public.needs_check_recommend(smallint, text, boolean) from public;
grant execute on function public.needs_check_recommend(smallint, text, boolean) to authenticated, service_role;

-- ── 5. Rechte und RLS ───────────────────────────────────────────────────────

alter table public.needs_check_results enable row level security;
alter table public.needs_check_save_log enable row level security;
alter table public.needs_check_save_quota enable row level security;

revoke all on public.needs_check_results from public, anon, authenticated;
revoke all on public.needs_check_save_log from public, anon, authenticated;
revoke all on public.needs_check_save_quota from public, anon, authenticated;
revoke all on sequence public.needs_check_save_log_id_seq from public, anon, authenticated;

-- Lesen und Löschen der eigenen Zeilen; Schreiben nur der vier Angaben.
grant select, delete on public.needs_check_results to authenticated;
grant insert (goal, area, has_website, website_url) on public.needs_check_results to authenticated;

-- Serverweg (Support, DSR): lesen und löschen. Schreiben läuft nur über den Nutzer.
grant select, delete on public.needs_check_results to service_role;
grant select, delete on public.needs_check_save_log to service_role;
grant select, delete on public.needs_check_save_quota to service_role;

drop policy if exists needs_check_results_select_own on public.needs_check_results;
create policy needs_check_results_select_own
  on public.needs_check_results for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists needs_check_results_insert_own on public.needs_check_results;
create policy needs_check_results_insert_own
  on public.needs_check_results for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists needs_check_results_delete_own on public.needs_check_results;
create policy needs_check_results_delete_own
  on public.needs_check_results for delete to authenticated
  using (user_id = (select auth.uid()));

-- Kein UPDATE: ein gespeichertes Ergebnis bleibt, wie es war.
-- needs_check_save_log / needs_check_save_quota: RLS an, keine Policy für
-- anon/authenticated. Zugriff nur über den Trigger (Eigentümer) und service_role.
