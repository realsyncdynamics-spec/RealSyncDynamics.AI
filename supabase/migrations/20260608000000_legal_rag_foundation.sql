-- Legal RAG Foundation — Slice 1: Datenschicht.
--
-- Kontext: Erste Stufe einer dreiphasigen Roadmap zum
--   RealSync Legal Knowledge Layer.
--   Phase 1 (jetzt): interner RAG-Substrat für den governance-agent.
--   Phase 2 (später):  tenant-scoped POST /legal/* Edge-Function-Surface.
--   Phase 3 (PaaS):   öffentliche API mit Paketen + Mandantenfähigkeit.
--
-- Diese Migration legt nur die Tabellen + RLS an. Ingestion, Retrieval-Tool
-- und Guardrails folgen in Slice 2-4 (Edge Functions, keine DB-Änderungen).
--
-- PaaS-Readiness-Constraints (in jedem Slice eingehalten):
--   - tenant_id-Spalten überall, auch wo Phase 1 sie nicht nutzt
--     (NULL = globales EU-Recht, gesetzt = tenant-privater Overlay).
--   - legal_retrieval_log ist Billing- + Abuse-Grundlage ab Phase 2.
--   - Citations nicht in der DB erzwungen — das ist Aufgabe von Slice 3
--     (Tool-Output-Validation + System-Prompt). Hier nur Datenmodell.
--   - Keine öffentlichen Endpunkte; service-role-only Write, RLS-Read.
--
-- pgvector wird hier zum ersten Mal im Projekt aktiviert. Embedding-Dim
-- ist 1024 (bge-m3 default via ai-gateway model_profile=embedding-eu).
-- OpenAI text-embedding-3-large mit 1024 dim als Fallback kompatibel.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- =====================================================================
-- legal_sources — Registry der Quellsysteme (EUR-Lex, EDPB, BfDI, …)
-- =====================================================================
create table if not exists public.legal_sources (
  id                  uuid primary key default gen_random_uuid(),
  -- Stable slug for tool-output citations and config lookup.
  slug                text not null unique,
  display_name        text not null,
  -- Root URL für menschliche Quell-Links in Citations.
  base_url            text not null,
  -- 'eur_lex' | 'edpb' | 'bfdi' | 'lda_bayern' | 'data_protection_authority' | 'custom'
  source_type         text not null,
  -- Jurisdiktion zur Filterung im retrieve_legal_context-Tool.
  -- ISO 3166-1 alpha-2 (DE, FR, …) oder 'EU' für Unionsrecht.
  jurisdiction        text not null,
  -- Polling-Konfiguration. Schema ist quellspezifisch:
  --   eur_lex: { celex_filter, languages, sparql_endpoint }
  --   edpb:    { rss_url, doc_types[] }
  --   bfdi:    { sitemap_url, html_selector }
  poll_config         jsonb not null default '{}'::jsonb,
  -- Crawler-Frequenz in Minuten. 1440 = täglich.
  poll_interval_min   int not null default 1440,
  enabled             boolean not null default true,
  last_polled_at      timestamptz,
  last_success_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint legal_sources_source_type_check check (source_type in (
    'eur_lex', 'edpb', 'bfdi', 'lda_bayern', 'data_protection_authority', 'custom'
  ))
);

create index if not exists legal_sources_enabled_idx
  on public.legal_sources (enabled, last_polled_at)
  where enabled = true;

comment on table public.legal_sources is
  'Registry der Compliance-Wissensquellen. Slice 2 (legal-ingest) liest hier seine Crawl-Targets.';
comment on column public.legal_sources.poll_config is
  'Quellspezifische Crawler-Config. Schema dokumentiert in sources/<slug>.ts.';

-- =====================================================================
-- legal_documents — Versionierte Rechtsdokumente
-- =====================================================================
create table if not exists public.legal_documents (
  id                  uuid primary key default gen_random_uuid(),
  source_id           uuid not null references public.legal_sources(id) on delete restrict,
  -- CELEX-Identifier für EUR-Lex (z. B. 32016R0679 für DSGVO).
  -- Bei nicht-EUR-Lex-Quellen: source-spezifische stabile ID.
  external_id         text not null,
  -- Canonical URL — wird in Citations zurückgegeben.
  canonical_url       text not null,
  -- Mehrere Sprachfassungen pro CELEX möglich.
  language            text not null default 'de',
  -- Dokumenttyp: 'regulation' | 'directive' | 'guideline' | 'decision' | 'opinion' | 'ruling' | 'commentary'
  doc_type            text not null,
  title               text not null,
  -- Markdown-Volltext nach Normalisierung. Quelle für legal_chunks.
  content_markdown    text not null,
  -- SHA-256 über content_markdown — Idempotenz-Schlüssel beim Re-Crawl.
  content_hash        text not null,
  -- Veröffentlichungsdatum laut Quelle.
  published_at        date,
  -- Inkrafttreten — wichtig für temporale Anfragen ("ab wann gilt …").
  effective_from      date,
  effective_until     date,
  -- Versionierung: superseded_by zeigt auf die Nachfolge-Version.
  -- Phase-1-Diff-Anfragen ("was hat sich geändert") wandern diese Kette.
  version             int not null default 1,
  superseded_by       uuid references public.legal_documents(id) on delete set null,
  -- Tenant-Overlay-Vorbereitung (Phase 3 Enterprise-Tier).
  -- NULL = öffentliches EU-Recht; gesetzt = tenant-private Policy/SOP.
  tenant_id           uuid references public.tenants(id) on delete cascade,
  metadata            jsonb not null default '{}'::jsonb,
  ingested_at         timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint legal_documents_doc_type_check check (doc_type in (
    'regulation', 'directive', 'guideline', 'decision', 'opinion',
    'ruling', 'commentary', 'national_law', 'tenant_policy'
  )),
  constraint legal_documents_external_unique
    unique (source_id, external_id, language, version)
);

-- Hot-Path: Lookup-by-CELEX für Tool-Citations.
create index if not exists legal_documents_external_id_idx
  on public.legal_documents (external_id);

create index if not exists legal_documents_source_lang_idx
  on public.legal_documents (source_id, language);

-- Tenant-Overlay-Filter im retrieve_legal_context-Tool.
create index if not exists legal_documents_tenant_idx
  on public.legal_documents (tenant_id)
  where tenant_id is not null;

-- Nur aktive Dokumente (nicht superseded) sind im Standard-Retrieval-Scope.
create index if not exists legal_documents_active_idx
  on public.legal_documents (source_id, language)
  where superseded_by is null;

comment on table public.legal_documents is
  'Versionierte Rechtsdokumente. Eine Zeile pro (source, external_id, language, version). Phase-3 Enterprise-Overlay über tenant_id.';
comment on column public.legal_documents.content_hash is
  'SHA-256 über content_markdown. Re-Crawl mit gleichem Hash überspringt Re-Embedding.';
comment on column public.legal_documents.superseded_by is
  'Zeigt auf Nachfolge-Version. NULL = aktuell. Diff-Anfragen folgen dieser Kante.';

-- =====================================================================
-- legal_chunks — Embeddings für Vector-Retrieval
-- =====================================================================
create table if not exists public.legal_chunks (
  id                  uuid primary key default gen_random_uuid(),
  document_id         uuid not null references public.legal_documents(id) on delete cascade,
  -- Position im Dokument (0-indexed). Stabil bei Re-Embedding gleicher
  -- content_hash; bricht bei Schema-Änderung der Chunking-Strategie.
  chunk_index         int not null,
  -- Strukturreferenz aus dem Dokument:
  --   DSGVO: "Art. 6 Abs. 1 lit. f" → paragraph_ref
  --   AI Act: "Art. 14 Abs. 4" → paragraph_ref
  --   Erwägungsgründe: "EG 47" → section_ref
  section_ref         text,
  paragraph_ref       text,
  -- Roh-Chunk-Text wie an das Embedding-Modell gesendet.
  chunk_text          text not null,
  -- 1024-dim für bge-m3 (ai-gateway model_profile=embedding-eu).
  embedding           vector(1024),
  -- Welches Modell hat embedded — wichtig beim Modell-Wechsel.
  embedding_model     text not null,
  -- Token-Count zur Kostenbuchung.
  token_count         int,
  -- Tenant-Overlay aus dem Parent-Dokument denormalisiert.
  -- Spart einen Join im Hot-Path-Retrieval.
  tenant_id           uuid references public.tenants(id) on delete cascade,
  created_at          timestamptz not null default now(),
  constraint legal_chunks_unique
    unique (document_id, chunk_index, embedding_model)
);

-- HNSW-Index für approximative Cosine-Similarity-Suche.
-- Default-Parameter sind gut genug für <10M Chunks (Phase 1 Erwartung).
create index if not exists legal_chunks_embedding_hnsw_idx
  on public.legal_chunks
  using hnsw (embedding vector_cosine_ops);

-- Trigram-Index auf paragraph_ref für Hybrid-Search:
-- "DSGVO Art. 6" findet auch dann, wenn der Embedding-Recall schwach ist.
create extension if not exists pg_trgm;
create index if not exists legal_chunks_paragraph_trgm_idx
  on public.legal_chunks
  using gin (paragraph_ref gin_trgm_ops);

create index if not exists legal_chunks_document_idx
  on public.legal_chunks (document_id);

create index if not exists legal_chunks_tenant_idx
  on public.legal_chunks (tenant_id)
  where tenant_id is not null;

comment on table public.legal_chunks is
  'Embedded Chunks für Vector-Retrieval. Chunking per Artikel/EG, nicht per Token-Window — EU-Recht hat native Struktur.';
comment on column public.legal_chunks.tenant_id is
  'Aus legal_documents denormalisiert. Hot-Path im retrieve_legal_context-Tool.';

-- =====================================================================
-- legal_ingest_runs — Audit pro Crawler-Lauf
-- =====================================================================
create table if not exists public.legal_ingest_runs (
  id                  uuid primary key default gen_random_uuid(),
  source_id           uuid not null references public.legal_sources(id) on delete cascade,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  -- 'success' | 'partial' | 'error'
  outcome             text,
  documents_fetched   int not null default 0,
  documents_new       int not null default 0,
  documents_updated   int not null default 0,
  documents_skipped   int not null default 0,
  chunks_embedded     int not null default 0,
  -- Embedding-Kosten zur Kostenkontrolle.
  embedding_tokens    int not null default 0,
  embedding_cost_usd  numeric(10, 6),
  error_message       text,
  metadata            jsonb not null default '{}'::jsonb,
  constraint legal_ingest_runs_outcome_check check (outcome is null or outcome in (
    'success', 'partial', 'error'
  ))
);

create index if not exists legal_ingest_runs_source_time_idx
  on public.legal_ingest_runs (source_id, started_at desc);

create index if not exists legal_ingest_runs_outcome_idx
  on public.legal_ingest_runs (outcome, started_at desc)
  where outcome in ('error', 'partial');

comment on table public.legal_ingest_runs is
  'Audit pro Crawler-Lauf. Slice 2 (legal-ingest Edge Function) schreibt eine Zeile pro Source-Poll.';

-- =====================================================================
-- legal_retrieval_log — JEDE Retrieval-Anfrage
-- =====================================================================
-- Begründung für separate Tabelle (nicht ai_tool_runs):
--   - PaaS-Billing-Grundlage in Phase 3. Eigene Aggregations-Pfade.
--   - Schemastabilität: ai_tool_runs ist generischer Container,
--     legal_retrieval_log hat fixe Spalten für Citations/Sources.
--   - DSGVO Art. 30: dedizierter Eintrag pro Rechts-Anfrage erleichtert
--     Verzeichnis von Verarbeitungstätigkeiten.
create table if not exists public.legal_retrieval_log (
  id                  uuid primary key default gen_random_uuid(),
  occurred_at         timestamptz not null default now(),
  -- NULL = interner Aufruf vom governance-agent für nicht-tenant-scoped
  -- Anon-Pfad. Phase 2+: immer gesetzt.
  tenant_id           uuid references public.tenants(id) on delete set null,
  -- NULL für interne/automatisierte Calls (z. B. Eval-Suite).
  actor_user_id       uuid,
  -- API-Key-Referenz für Phase 3 PaaS. NULL in Phase 1.
  api_key_id          uuid,
  -- Aufruf-Quelle:
  --   'agent_tool'  — vom governance-agent über retrieve_legal_context
  --   'tenant_api'  — Phase 2 POST /legal/context
  --   'paas_api'    — Phase 3 öffentliche API
  --   'eval'        — Test-Suite
  invocation_source   text not null,
  -- SHA-256 über die Query — Pattern-Analyse ohne Roh-Query-Speicherung.
  -- Roh-Query NUR wenn tenant-policy explicit_query_logging = true.
  query_hash          text not null,
  query_raw           text,
  jurisdictions       text[],
  top_k               int not null,
  -- Welche Dokumente wurden in die LLM-Antwort eingespeist.
  cited_document_ids  uuid[],
  -- Modell, Tokens, Latenz für Kostenkontrolle.
  retrieval_model     text,
  retrieval_tokens    int,
  llm_input_tokens    int,
  llm_output_tokens   int,
  latency_ms          int,
  outcome             text not null,
  error_code          text,
  constraint legal_retrieval_log_invocation_source_check check (invocation_source in (
    'agent_tool', 'tenant_api', 'paas_api', 'eval'
  )),
  constraint legal_retrieval_log_outcome_check check (outcome in (
    'success', 'no_results', 'error', 'rate_limited', 'blocked'
  ))
);

create index if not exists legal_retrieval_log_time_idx
  on public.legal_retrieval_log (occurred_at desc);

create index if not exists legal_retrieval_log_tenant_time_idx
  on public.legal_retrieval_log (tenant_id, occurred_at desc)
  where tenant_id is not null;

create index if not exists legal_retrieval_log_api_key_idx
  on public.legal_retrieval_log (api_key_id, occurred_at desc)
  where api_key_id is not null;

-- Abuse/Incident-Surface.
create index if not exists legal_retrieval_log_outcome_idx
  on public.legal_retrieval_log (outcome, occurred_at desc)
  where outcome in ('error', 'rate_limited', 'blocked');

comment on table public.legal_retrieval_log is
  'Audit pro Retrieval-Anfrage. Billing-Grundlage ab Phase 2, Abuse-Detection ab Phase 1.';
comment on column public.legal_retrieval_log.query_hash is
  'SHA-256 über die Query. Roh-Query nur wenn tenant-policy explicit_query_logging=true.';
comment on column public.legal_retrieval_log.cited_document_ids is
  'IDs der in der LLM-Antwort tatsächlich zitierten Dokumente. Slice 3 erzwingt Citation-Pflicht.';

-- =====================================================================
-- RLS Policies
-- =====================================================================
alter table public.legal_sources       enable row level security;
alter table public.legal_documents     enable row level security;
alter table public.legal_chunks        enable row level security;
alter table public.legal_ingest_runs   enable row level security;
alter table public.legal_retrieval_log enable row level security;

-- legal_sources: lesbar für alle authentifizierten User (Quell-Registry ist
-- nicht sensibel), Write nur über service-role (Crawler).
drop policy if exists "legal_sources read authenticated" on public.legal_sources;
create policy "legal_sources read authenticated"
  on public.legal_sources for select
  to authenticated
  using (true);

-- legal_documents: globale Dokumente (tenant_id IS NULL) lesbar für alle
-- authentifizierten User. Tenant-Overlays nur für Mitglieder des Tenants.
drop policy if exists "legal_documents read public or tenant member" on public.legal_documents;
create policy "legal_documents read public or tenant member"
  on public.legal_documents for select
  to authenticated
  using (
    tenant_id is null
    or exists (
      select 1 from public.memberships m
      where m.tenant_id = legal_documents.tenant_id
        and m.user_id = auth.uid()
    )
  );

-- legal_chunks: spiegelt legal_documents-Policy.
drop policy if exists "legal_chunks read public or tenant member" on public.legal_chunks;
create policy "legal_chunks read public or tenant member"
  on public.legal_chunks for select
  to authenticated
  using (
    tenant_id is null
    or exists (
      select 1 from public.memberships m
      where m.tenant_id = legal_chunks.tenant_id
        and m.user_id = auth.uid()
    )
  );

-- legal_ingest_runs: kein User-Read in Phase 1. Operator-Sicht über
-- SECURITY DEFINER RPC später, analog zu anon_chat_runs.
drop policy if exists "legal_ingest_runs deny" on public.legal_ingest_runs;
create policy "legal_ingest_runs deny"
  on public.legal_ingest_runs for all
  using (false) with check (false);

-- legal_retrieval_log: Tenants sehen ihre eigenen Anfragen (Audit-Pflicht
-- nach DSGVO Art. 30), nicht die anderer Tenants und nicht NULL-tenant
-- (interne Calls).
drop policy if exists "legal_retrieval_log tenant read" on public.legal_retrieval_log;
create policy "legal_retrieval_log tenant read"
  on public.legal_retrieval_log for select
  to authenticated
  using (
    tenant_id is not null
    and exists (
      select 1 from public.memberships m
      where m.tenant_id = legal_retrieval_log.tenant_id
        and m.user_id = auth.uid()
    )
  );

-- =====================================================================
-- updated_at-Trigger für legal_sources + legal_documents
-- =====================================================================
create or replace function public.tg_legal_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_legal_sources_touch on public.legal_sources;
create trigger trg_legal_sources_touch
  before update on public.legal_sources
  for each row execute function public.tg_legal_touch_updated_at();

drop trigger if exists trg_legal_documents_touch on public.legal_documents;
create trigger trg_legal_documents_touch
  before update on public.legal_documents
  for each row execute function public.tg_legal_touch_updated_at();

-- =====================================================================
-- Seed: minimal Source-Registry für Slice 2.
-- Adapter-Implementierung folgt in supabase/functions/legal-ingest/sources/.
-- =====================================================================
insert into public.legal_sources (slug, display_name, base_url, source_type, jurisdiction, poll_config, poll_interval_min)
values
  ('eur_lex', 'EUR-Lex', 'https://eur-lex.europa.eu', 'eur_lex', 'EU',
   '{"sparql_endpoint":"https://publications.europa.eu/webapi/rdf/sparql","languages":["de","en"],"celex_filter":["32016R0679","32024R1689","32022R2065","32022R0868","32014R0910","32022L2555"]}'::jsonb,
   1440),
  ('edpb', 'European Data Protection Board', 'https://www.edpb.europa.eu', 'edpb', 'EU',
   '{"rss_url":"https://www.edpb.europa.eu/rss.xml","doc_types":["guideline","opinion","decision"]}'::jsonb,
   720),
  ('bfdi', 'Bundesbeauftragter für den Datenschutz', 'https://www.bfdi.bund.de', 'bfdi', 'DE',
   '{"sitemap_url":"https://www.bfdi.bund.de/sitemap.xml"}'::jsonb,
   1440)
on conflict (slug) do nothing;
