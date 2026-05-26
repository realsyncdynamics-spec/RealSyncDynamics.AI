/**
 * Legal-RAG domain types — shared between Frontend, Edge Function
 * adapter, and (Phase 2+) the public Legal Knowledge API.
 *
 * Storage: public.legal_documents / legal_chunks / legal_ingest_runs
 *   / legal_retrieval_log  (migration 20260614000000).
 *
 * Pure types only — no Supabase client, no fetch helpers.
 *
 * Phase 1: internal-only. tenant_id is allowed everywhere for
 * PaaS-readiness; the retrieval helper rejects tenant != null in
 * Phase 1 to keep the surface internal.
 */

export type LegalJurisdiction =
  | 'eu' | 'de' | 'at' | 'ch' | 'fr' | 'us' | 'uk' | 'other';

export type LegalFramework =
  | 'gdpr'        // DSGVO
  | 'ai_act'      // EU AI Act
  | 'nis2'        // NIS2 Directive
  | 'dsa'         // Digital Services Act
  | 'data_act'    // EU Data Act
  | 'eidas'       // eIDAS 2.0
  | 'ttdsg' | 'tmg' | 'tdsg'   // DE telecommunications / telemedia law
  | 'c2pa'        // Content Credentials
  | 'cloud_act'   // US Cloud Act risk context
  | 'edpb'        // European Data Protection Board guidelines
  | 'bfdi'        // German Federal Data Protection Authority
  | 'cnil'        // French Data Protection Authority
  | 'other';

export type LegalDocumentType =
  | 'regulation' | 'directive' | 'guideline' | 'opinion'
  | 'caselaw' | 'standard' | 'recommendation' | 'other';

export interface LegalDocument {
  id:                string;
  tenant_id:         string | null;
  jurisdiction:      LegalJurisdiction;
  framework:         LegalFramework;
  document_type:     LegalDocumentType;
  source_authority:  string;
  source_url:        string;
  source_identifier: string | null;
  language:          string;
  title:             string;
  published_at:      string | null;   // ISO date
  effective_at:      string | null;
  disclaimer:        string;          // never null — enforced by DB
  version:           string | null;
  superseded_by:     string | null;
  raw_payload:       Record<string, unknown> | null;
  created_at:        string;
  updated_at:        string;
}

export interface LegalChunk {
  id:               string;
  document_id:      string;
  chunk_index:      number;
  chunk_text:       string;
  chunk_tokens:     number | null;
  embedding:        number[] | null;   // vector(1024); deserialized
  embedding_model:  string | null;
  heading_path:     string | null;
  citation_anchor:  string | null;
  created_at:       string;
}

export interface LegalIngestRun {
  id:                  string;
  tenant_id:           string | null;
  source_authority:    string;
  status:              'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at:          string | null;
  completed_at:        string | null;
  documents_ingested:  number;
  chunks_ingested:     number;
  error_code:          string | null;
  error_message:       string | null;
  raw_payload:         Record<string, unknown> | null;
  correlation_id:      string | null;
  created_at:          string;
  updated_at:          string;
}

export type LegalCallerType = 'internal' | 'tenant' | 'api';

export interface LegalRetrievalLogEntry {
  id:               string;
  tenant_id:        string | null;
  query_text:       string;
  query_filters:    Record<string, unknown> | null;
  top_k:            number;
  result_count:     number;
  result_chunk_ids: string[];
  caller_type:      LegalCallerType;
  caller_ref:       string | null;
  latency_ms:       number | null;
  correlation_id:   string | null;
  retrieved_at:     string;
}

/**
 * Retrieval request shape. Used by the internal helper and (Phase 2)
 * by the tenant API endpoint. Phase 1 enforces caller_type='internal'
 * + tenant_id=null at the helper layer.
 */
export interface LegalRetrievalRequest {
  query:           string;
  top_k?:          number;          // 1..50, default 5
  framework?:      LegalFramework;
  jurisdiction?:   LegalJurisdiction;
  language?:       string;
  caller_type:     LegalCallerType;
  caller_ref?:     string;
  tenant_id?:      string | null;
  correlation_id?: string | null;
}

/**
 * Single retrieved chunk with its source citation. The retrieval
 * helper enforces that every result carries:
 *   - the chunk_text (so the LLM can ground its answer)
 *   - the parent document's source_url (clickable citation)
 *   - the parent document's disclaimer (surface verbatim)
 *
 * Drop any of these three and the helper throws — anti-hallucination
 * + anti-legal-advice guardrails at the boundary.
 */
export interface LegalRetrievalResultItem {
  chunk_id:         string;
  document_id:      string;
  chunk_text:       string;
  heading_path:     string | null;
  citation_anchor:  string | null;
  source_url:       string;
  source_identifier: string | null;
  framework:        LegalFramework;
  jurisdiction:     LegalJurisdiction;
  title:            string;
  published_at:     string | null;
  disclaimer:       string;
  rank_score:       number;
}

export interface LegalRetrievalResult {
  query:        string;
  results:      LegalRetrievalResultItem[];
  caller_type:  LegalCallerType;
  retrieved_at: string;
  log_id:       string;            // legal_retrieval_log row id
  disclaimer:   string;            // canonical platform disclaimer
}

/**
 * Canonical platform-level disclaimer, attached to every retrieval
 * result. Per-document disclaimer is ADDITIONAL, not a replacement.
 */
export const LEGAL_PLATFORM_DISCLAIMER =
  'Diese Information stammt aus öffentlichen Quellen und ersetzt keine ' +
  'individuelle Rechtsberatung. Verbindliche Bewertung erfolgt durch ' +
  'qualifizierten Rechtsbeistand oder Datenschutzbeauftragte. ' +
  'RealSyncDynamics.AI erbringt keine Rechtsdienstleistung im Sinne ' +
  'des RDG.';
