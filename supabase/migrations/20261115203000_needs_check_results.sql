-- Bedarfs-Check: gespeicherte Antworten je Nutzer.
--
-- Additiv. Keine bestehende Tabelle, Policy oder Berechtigung wird geändert.
-- Gespeichert werden nur drei Auswahlwerte; das Ergebnis leitet die Anwendung
-- daraus ab (shared/needs-check.ts). Die erlaubten Werte müssen mit
-- NEEDS_GOALS / NEEDS_AREAS / NEEDS_WEBSITE dort übereinstimmen.
--
-- Zugriff: nur die eigene Zeile (user_id = auth.uid()). Kein UPDATE, kein
-- Zugriff für anon. Höchstens 20 Zeilen je Nutzer.

create or replace function public.needs_check_answers_valid(a jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- CASE erzwingt die Reihenfolge: jsonb_object_keys wirft bei Nicht-Objekten.
  select case
    when a is null or jsonb_typeof(a) <> 'object' then false
    else coalesce(
      (select count(*) from jsonb_object_keys(a)) = 3
      and (a ->> 'goal') in ('more_inquiries', 'answer_customers', 'new_website', 'ai_rules')
      and (a ->> 'area') in ('trade', 'practice', 'office', 'retail', 'agency', 'other')
      and (a ->> 'website') in ('yes', 'no'),
      false
    )
  end;
$$;

create table if not exists public.needs_check_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  version smallint not null default 1,
  answers jsonb not null,
  created_at timestamptz not null default now(),
  constraint needs_check_results_version_known check (version = 1),
  constraint needs_check_results_answers_valid check (public.needs_check_answers_valid(answers))
);

create index if not exists needs_check_results_user_created_idx
  on public.needs_check_results (user_id, created_at desc);

create or replace function public.needs_check_results_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.needs_check_results r where r.user_id = new.user_id) >= 20 then
    raise exception 'needs_check_limit' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists needs_check_results_limit_trg on public.needs_check_results;
create trigger needs_check_results_limit_trg
  before insert on public.needs_check_results
  for each row execute function public.needs_check_results_limit();

alter table public.needs_check_results enable row level security;

revoke all on public.needs_check_results from anon;
revoke all on public.needs_check_results from authenticated;
grant select, insert, delete on public.needs_check_results to authenticated;

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

comment on table public.needs_check_results is
  'Bedarfs-Check (/check): Antworten je Nutzer. Ergebnis wird in der Anwendung abgeleitet. RLS: nur eigene Zeilen.';
