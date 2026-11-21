import crypto from 'crypto';
import { supabase } from '../services/supabase.js';
import { EvidenceSnapshot } from '../types/index.js';
import type { Database } from '../types/database.js';
import { verifyChain, type ChainIssue } from '../../../../packages/evidence-chain/src/index.js';
import { enforce } from '../services/rate-window.js';

/**
 * Lesezugriff auf Evidence.
 *
 * Der Prozess hält den Service-Role-Key, weil die Key-Prüfung eine RPC mit
 * `service_role` ist und ein API-Key kein Nutzer-JWT hat. RLS sieht diesen
 * Aufrufer deshalb nicht. Jede Abfrage hier muss den Tenant des Keys selbst
 * als Prädikat tragen — fehlt er, wird nicht gelesen.
 */
export interface EvidenceFilter {
  eq(column: string, value: unknown): EvidenceFilter;
  order(column: string, options: { ascending: boolean }): EvidenceFilter;
  limit(n: number): EvidenceFilter;
  ilike(column: string, pattern: string): EvidenceFilter;
  single(): Promise<{ data: EvidenceRow | null; error: QueryError | null }>;
  then<TResult1 = { data: EvidenceRow[] | null; error: QueryError | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: EvidenceRow[] | null; error: QueryError | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

export interface EvidenceDb {
  from(table: 'evidence_snapshots'): {
    select(columns: string): EvidenceFilter;
  };
}

interface QueryError {
  message: string;
  code?: string;
}

function requireTenant(tenantId: string): void {
  if (typeof tenantId !== 'string' || tenantId.trim() === '') {
    throw new Error('Tenant-Kontext fehlt — Abfrage abgelehnt.');
  }
}

function dbOf(db?: EvidenceDb): EvidenceDb {
  return db ?? (supabase as unknown as EvidenceDb);
}

/**
 * Kettenprüfungen je Tenant und Minute.
 *
 * Bewusst deutlich enger als die allgemeine Schranke: Der Aufruf skaliert mit
 * der Kettenlänge, während eine gewöhnliche Leseanfrage konstant bleibt.
 */
const VERIFY_LIMIT_PER_TENANT = parseInt(process.env.MCP_VERIFY_LIMIT_PER_MINUTE || '10', 10);

export async function listEvidence(
  tenantId: string,
  subjectRef?: string,
  limit: number = 50,
  db?: EvidenceDb,
): Promise<EvidenceSnapshot[]> {
  requireTenant(tenantId);
  let query = dbOf(db)
    .from('evidence_snapshots')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (subjectRef) {
    query = query.eq('subject_ref', subjectRef);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to list evidence:', error);
    throw new Error(`Evidence list failed: ${error.message}`);
  }

  return (data || []).map(mapEvidenceRow);
}

export async function getEvidence(
  tenantId: string,
  evidenceId: string,
  db?: EvidenceDb,
): Promise<EvidenceSnapshot | null> {
  requireTenant(tenantId);
  const { data, error } = await dbOf(db)
    .from('evidence_snapshots')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', evidenceId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Evidence get failed: ${error.message}`);
  }

  return data ? mapEvidenceRow(data) : null;
}

/** SHA-256 als Hex — injiziert in verifyChain, damit der Kern laufzeitfrei bleibt. */
async function sha256Hex(input: string): Promise<string> {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export interface ChainVerification {
  subjectRef: string;
  /** Alle Prüfungen bestanden. */
  valid: boolean;
  /** Anzahl Snapshots in der Kette. */
  chainLength: number;
  /** Snapshots, deren event_hash erfolgreich nachgerechnet wurde. */
  cryptoVerified: number;
  /** Snapshots ohne event_timestamp — nur strukturell prüfbar, keine Manipulation. */
  legacy: number;
  issues: ChainIssue[];
}

/**
 * Verifiziert die Hash-Kette des Subjects, zu dem der Snapshot gehört.
 *
 * Geprüft wird die gesamte Kette, nicht nur der angefragte Snapshot: Ein
 * einzelner Snapshot für sich sagt nichts aus, seine Unversehrtheit ergibt
 * sich erst aus der lückenlosen Verkettung ab Version 1.
 *
 * Die Prüflogik stammt aus `@realsync/evidence-chain` — demselben Modul, das
 * die SPA verwendet, mit derselben Kanonisierung wie die Edge Function, die
 * die Hashes erzeugt. Eine eigene Kopie hier würde irgendwann abweichen und
 * die Verifizierung still falsch beantworten.
 */
export async function verifyHashChain(
  tenantId: string,
  evidenceId: string,
  db?: EvidenceDb,
): Promise<ChainVerification> {
  // Engere Schranke als der allgemeine Ratenschutz: Dieser Aufruf lädt die
  // gesamte Kette und rechnet je Snapshot einen SHA-256 nach — eine billige
  // Anfrage erzeugt Arbeit in der Länge der Kette. Gezählt wird hier und nicht
  // an der Route, weil dieselbe Prüfung auch über das Werkzeug
  // `evidence_verify_chain` auf `/mcp` erreichbar ist.
  enforce(
    `verify:${tenantId}`,
    VERIFY_LIMIT_PER_TENANT,
    60_000,
    'Kettenprüfung',
  );

  const anchor = await getEvidence(tenantId, evidenceId, db);
  if (!anchor) {
    throw new Error('Evidence not found');
  }

  const { data, error } = await dbOf(db)
    .from('evidence_snapshots')
    .select('subject_ref, version, content_sha256, retention_class, prev_hash, event_hash, event_timestamp')
    .eq('tenant_id', tenantId)
    .eq('subject_ref', anchor.subjectRef)
    .order('version', { ascending: true });

  if (error) {
    throw new Error(`Chain load failed: ${error.message}`);
  }

  const report = await verifyChain(data ?? [], sha256Hex);

  return {
    subjectRef: report.subjectRef,
    valid: report.ok,
    chainLength: report.count,
    cryptoVerified: report.cryptoVerified,
    legacy: report.legacy,
    issues: report.issues,
  };
}

export async function searchEvidenceByControl(
  tenantId: string,
  controlId: string,
  db?: EvidenceDb,
): Promise<EvidenceSnapshot[]> {
  requireTenant(tenantId);
  // Phase 2: Semantic search via pgvector
  // For now: search by subject_ref pattern
  const { data, error } = await dbOf(db)
    .from('evidence_snapshots')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('subject_ref', `%${controlId}%`)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Evidence search failed: ${error.message}`);
  }

  return (data || []).map(mapEvidenceRow);
}

type EvidenceRow = Database['public']['Tables']['evidence_snapshots']['Row'];

function mapEvidenceRow(row: EvidenceRow): EvidenceSnapshot {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    subjectRef: row.subject_ref,
    label: row.label ?? undefined,
    version: row.version,
    contentSha256: row.content_sha256,
    prevHash: row.prev_hash ?? undefined,
    eventHash: row.event_hash,
    signature: row.signature ?? undefined,
    retentionClass: row.retention_class,
    retainedUntil: row.retained_until ? new Date(row.retained_until) : undefined,
    createdBy: row.created_by ?? undefined,
    createdAt: new Date(row.created_at),
  };
}
