-- Bedarfs-Check (/check): Härtung der bestehenden Tabelle needs_check_results.
--
-- Folge-Migration zu 20261115200000_needs_check_results.sql (PR #2262, am
-- 16.11.2026 gemergt und in Produktion angewendet). Jene Datei bleibt
-- unverändert; diese hier ändert nur, was danach gilt. Stand Produktion vor
-- dieser Migration (gemessen 17.11.2026): 0 Zeilen in needs_check_results.
--
-- Nicht destruktiv: keine Tabelle, keine Spalte und keine Zeile wird
-- gelöscht. audit_id und result_basis bleiben als Spalten bestehen, sind
-- aber für Nutzer nicht mehr beschreibbar und per CHECK auf „keine Prüfung“
-- festgelegt. Ersetzt werden Trigger, Funktion, Grants und ein CHECK.
--
-- Behobene Schwächen der Erstfassung:
--   1. created_at und user_id konnte der Client setzen; das Tageslimit zählte
--      created_at → mit einem alten Zeitstempel beliebig viele Speicherungen.
--   2. Das Limit zählte gespeicherte Zeilen → Löschen gab Kontingent frei.
--   3. Parallele Speicherungen konnten die Zählung überholen.
--   4. recommendation_ids kamen vom Client.
--   5. audit_id + result_basis = 'answers_and_scan' erfüllten den CHECK mit
--      einer beliebigen UUID — ohne abgeschlossenen oder eigenen Scan.
--      Öffentliche Scans (gdpr_audits) haben keine Nutzerzuordnung; der
--      Server kann die Zugehörigkeit nicht bestätigen. Darum ist „technisch
--      geprüft“ bis auf Weiteres ausgeschlossen; die Oberfläche verweist auf /audit.
--
-- Was danach der Server festlegt, nicht der Client:
--   user_id = auth.uid(), created_at = now(), model_version = aktuelle Version,
--   recommendation_ids = needs_check_recommend(), audit_id = NULL, result_basis = 'answers'.
-- Der Client darf nur goal, area, has_website, website_url schreiben (Spalten-GRANT).
--
-- Rechte:
--   needs_check_recommend                 IMMUTABLE, ohne Tabellenzugriff
--   needs_check_results_10_set_fields     SECURITY INVOKER — setzt nur Felder der neuen Zeile,
--                                         liest keine Identität (kein auth.uid())
--   needs_check_results_20_quota          SECURITY DEFINER — setzt user_id aus auth.uid(),
--                                         schreibt Protokoll und Sperrzeile, auf die Nutzer
--                                         kein Recht haben. Trigger-Funktion, nicht per RPC
--                                         aufrufbar.

-- ── 1. Alte Kontingent-Logik entfernen (zählte Zeilen und created_at) ────────

drop trigger if exists needs_check_results_rate_limit_trg on public.needs_check_results;
drop function if exists public.needs_check_results_rate_limit();

-- ── 2. Empfehlungslogik (Spiegel von recommendIds() in shared/needs-check.ts) ──

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

-- ── 3. Tabelle ergänzen (additiv) ───────────────────────────────────────────

-- Default nur, um die (leere) Tabelle ohne Sonderfall zu erweitern; danach
-- setzt ausschließlich der Trigger den Wert.
alter table public.needs_check_results
  add column if not exists model_version smallint not null default 1;
alter table public.needs_check_results alter column model_version drop default;

alter table public.needs_check_results
  drop constraint if exists needs_check_results_version_chk;
alter table public.needs_check_results
  add constraint needs_check_results_version_chk check (model_version in (1));

-- Keine Scan-Referenz, bis der Server Abschluss und Zugehörigkeit eines Scans
-- bestätigen kann (siehe Kopf, Punkt 5).
alter table public.needs_check_results
  drop constraint if exists needs_check_results_no_scan_chk;
alter table public.needs_check_results
  add constraint needs_check_results_no_scan_chk check (audit_id is null and result_basis = 'answers');

-- Adresse: zusätzlich kein „@“ im Host (keine Zugangsdaten). Muster identisch
-- mit WEBSITE_URL_PATTERN in shared/needs-check.ts.
alter table public.needs_check_results drop constraint if exists needs_check_url_chk;
alter table public.needs_check_results drop constraint if exists needs_check_results_url_chk;
alter table public.needs_check_results
  add constraint needs_check_results_url_chk check (
    website_url is null
    or (has_website and char_length(website_url) <= 300 and website_url ~* '^https?://[^\s/@]+\.[^\s]+$')
  );

-- Zweite Linie hinter dem Trigger: Die gespeicherten IDs MÜSSEN das sein,
-- was die Logik der gespeicherten Version aus den Angaben ableitet.
alter table public.needs_check_results drop constraint if exists needs_check_results_recs_chk;
alter table public.needs_check_results
  add constraint needs_check_results_recs_chk check (
    recommendation_ids = public.needs_check_recommend(model_version, goal, has_website)
  );

comment on table public.needs_check_results is
  'Bedarfs-Check (/check): Angaben, Modellversion und serverseitig berechnete Empfehlungs-IDs je Nutzer. RLS: nur eigene Zeilen. Kein UPDATE. Keine Scan-Referenz.';

-- ── 4. Kontingent: Protokoll und Sperrzeile (für Nutzer unsichtbar) ─────────

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

-- ── 5. Trigger ──────────────────────────────────────────────────────────────

-- SECURITY INVOKER: setzt nur Felder der neuen Zeile, braucht keine Rechte,
-- die der Aufrufer nicht ohnehin hat. Liest bewusst KEIN auth.uid(): Eine
-- INVOKER-Funktion löst den Namen zur Laufzeit mit den Rechten des Aufrufers
-- auf und bräuchte dafür USAGE auf das Schema auth. Die Identität setzt
-- ausschließlich needs_check_results_20_quota (DEFINER). Bis dahin wird
-- user_id geleert, damit kein Wert des Aufrufers durchrutschen kann.
create or replace function public.needs_check_results_10_set_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.id := gen_random_uuid();
  new.user_id := null;
  new.created_at := now();
  new.model_version := 1;
  new.audit_id := null;
  new.result_basis := 'answers';
  new.recommendation_ids := public.needs_check_recommend(new.model_version, new.goal, new.has_website);
  return new;
end;
$$;

-- SECURITY DEFINER: setzt user_id aus auth.uid() und schreibt
-- needs_check_save_log und needs_check_save_quota,
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
  if v_uid is null then
    raise exception 'needs_check_unauthenticated' using errcode = '42501';
  end if;
  -- Einzige Stelle, an der die Identität der Zeile festgelegt wird.
  new.user_id := v_uid;

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

-- ── 6. Rechte ───────────────────────────────────────────────────────────────

alter table public.needs_check_save_log enable row level security;
alter table public.needs_check_save_quota enable row level security;

-- Ergebnisse: tabellenweites INSERT der Erstfassung zurücknehmen; nur die vier
-- Angaben bleiben beschreibbar. SELECT/DELETE und die RLS-Policies der
-- Erstfassung (nur eigene Zeilen, kein UPDATE) bleiben unverändert.
revoke all on public.needs_check_results from public, anon, authenticated;
grant select, delete on public.needs_check_results to authenticated;
grant insert (goal, area, has_website, website_url) on public.needs_check_results to authenticated;

-- Serverweg (Support, DSR): lesen und löschen. Schreiben läuft nur über den Nutzer.
revoke all on public.needs_check_results from service_role;
grant select, delete on public.needs_check_results to service_role;

revoke all on public.needs_check_save_log from public, anon, authenticated;
revoke all on public.needs_check_save_quota from public, anon, authenticated;
revoke all on sequence public.needs_check_save_log_id_seq from public, anon, authenticated;
grant select, delete on public.needs_check_save_log to service_role;
grant select, delete on public.needs_check_save_quota to service_role;

-- needs_check_save_log / needs_check_save_quota: RLS an, keine Policy für
-- anon/authenticated. Zugriff nur über den Trigger (Eigentümer) und service_role.
