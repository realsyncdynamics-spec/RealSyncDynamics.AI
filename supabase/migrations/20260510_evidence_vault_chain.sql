-- Enterprise Evidence Vault — Hash-Chain + Retention-Tracking.
--
-- Erweitert ai_evidence_events um:
--   1. event_hash, prev_hash, chain_index — Tamper-Evident-Chain
--   2. Trigger der die Chain pro Tenant beim INSERT serialisiert + hashed
--
-- Ergaenzt eine separate Retention-Tabelle (ai_evidence_retention) mit
-- konfigurierbaren Aufbewahrungs- und Hard-Delete-Fristen pro Tenant.
-- Auto-Cleanup-Job kommt in Folge-PR; diese Migration legt nur die
-- Datenstruktur an.
--
-- Die HMAC-Signing passiert in der edge function evidence-vault-export
-- beim Bundle-Erzeugen (Single-Source-Signing-Key in Env-Var). Die DB
-- speichert nur die unverschluesselten Hashes — Signaturen sind jederzeit
-- aus dem Hash + Signing-Key reproduzierbar.

create extension if not exists pgcrypto;

-- Chain-Spalten anhaengen (idempotent)
alter table ai_evidence_events
  add column if not exists event_hash bytea,
  add column if not exists prev_hash bytea,
  add column if not exists chain_index bigint;

-- Index fuer schnelle Tip-Lookups (groesster chain_index pro Tenant)
create index if not exists ai_evidence_events_chain_tip_idx
  on ai_evidence_events (tenant_id, chain_index desc)
  where event_hash is not null;

-- Trigger-Funktion: Chain pro Tenant serialisieren + Hash setzen
create or replace function tg_evidence_event_chain()
returns trigger
language plpgsql
as $$
declare
  prev_record record;
  payload bytea;
  tenant_lock_key text;
begin
  -- Wenn ein User explizit Hash setzt, NICHT ueberschreiben (z.B.
  -- Backfill / Migration). Nur fuer NEUE Events ohne event_hash chainen.
  if new.event_hash is not null then
    return new;
  end if;

  -- Per-Tenant-Advisory-Lock damit konkurrente Inserts seriell chainen.
  -- Tenant-NULL bekommt eigenen "global"-Lock-Key.
  tenant_lock_key := 'evidence_chain:' || coalesce(new.tenant_id::text, 'global');
  perform pg_advisory_xact_lock(hashtextextended(tenant_lock_key, 0));

  -- Vorigen Tip fuer diesen Tenant finden
  select event_hash, chain_index
  into prev_record
  from ai_evidence_events
  where (tenant_id is not distinct from new.tenant_id)
    and event_hash is not null
  order by chain_index desc
  limit 1;

  new.prev_hash := prev_record.event_hash; -- null beim ersten Event
  new.chain_index := coalesce(prev_record.chain_index, 0) + 1;

  -- event_hash = SHA256(prev_hash || id || created_at || event_type ||
  --                     event_summary || evidence_jsonb)
  payload :=
       coalesce(new.prev_hash, ''::bytea)
    || convert_to(new.id::text, 'UTF8')
    || convert_to(coalesce(new.created_at::text, now()::text), 'UTF8')
    || convert_to(new.event_type, 'UTF8')
    || convert_to(new.event_summary, 'UTF8')
    || convert_to(coalesce(new.evidence::text, '{}'), 'UTF8');

  new.event_hash := digest(payload, 'sha256');

  return new;
end;
$$;

drop trigger if exists ai_evidence_events_chain_tg on ai_evidence_events;
create trigger ai_evidence_events_chain_tg
  before insert on ai_evidence_events
  for each row
  execute function tg_evidence_event_chain();

-- ─── Retention-Konfig pro Tenant ─────────────────────────────────────────────

create table if not exists ai_evidence_retention (
  tenant_id uuid primary key,
  -- Aufbewahrungsdauer fuer aktiven Zugriff (ohne soft-delete)
  retention_days int not null default 2555  -- ~7 Jahre, EU-AI-Act-typisch
    check (retention_days >= 30),
  -- Spaetestens nach hard_delete_after_days physisch loeschen
  hard_delete_after_days int not null default 3650  -- 10 Jahre
    check (hard_delete_after_days >= 90),
  -- Operator-Hinweis (z.B. "Konzern-Vorgabe", "Anwalt-Memo")
  policy_note text,
  updated_at timestamptz not null default now()
);

alter table ai_evidence_retention enable row level security;

-- Helper-View: gibt fuer jeden Tenant + Event den geplanten Loesch-Termin aus.
-- Audit-Frontend kann das Live darstellen ("Wird in X Tagen geloescht").
create or replace view ai_evidence_retention_status as
select
  e.id,
  e.tenant_id,
  e.created_at,
  coalesce(r.retention_days, 2555) as retention_days,
  coalesce(r.hard_delete_after_days, 3650) as hard_delete_after_days,
  e.created_at + (coalesce(r.retention_days, 2555) || ' days')::interval as soft_delete_at,
  e.created_at + (coalesce(r.hard_delete_after_days, 3650) || ' days')::interval as hard_delete_at
from ai_evidence_events e
left join ai_evidence_retention r on r.tenant_id = e.tenant_id;
