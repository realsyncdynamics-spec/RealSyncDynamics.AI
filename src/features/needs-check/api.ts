/**
 * Bedarfs-Check — Backend-Anbindung.
 *
 * Speichern/Lesen läuft über den Supabase-Client des angemeldeten Nutzers.
 * Zugriffskontrolle macht die Datenbank (RLS: nur eigene Zeilen), nicht dieser
 * Code. Der öffentliche Client-Schlüssel gibt keinen Zugriff auf fremde Daten.
 *
 * Die technische Website-Prüfung nutzt die bestehende Edge Function
 * `gdpr-audit` im Optimizer-Modus (ohne Lead, ohne E-Mail, 5/h je IP).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import type { Answers, RecommendationId } from './model';
import { isArea, isGoal } from './model';

export type ApiError =
  | { kind: 'unavailable' }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'not_found' }
  | { kind: 'rate_limited' }
  | { kind: 'invalid'; message: string }
  | { kind: 'failed'; message: string };

export type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export interface SavedCheck {
  id: string;
  createdAt: string;
  answers: Answers;
  recommendationIds: string[];
  auditId: string | null;
  basis: 'answers' | 'answers_and_scan';
}

export interface ScanSummary {
  auditId: string;
  domain: string;
  score: number;
  issues: Array<{ title: string; severity: string; ref: string }>;
  coverageNotice: string | null;
}

type Deps = { client?: SupabaseClient | null; configured?: boolean };

function clientOrNull(deps?: Deps): SupabaseClient | null {
  if (deps && 'client' in deps) return deps.client ?? null;
  const configured = deps?.configured ?? isSupabaseConfigured();
  return configured ? getSupabase() : null;
}

function mapDbError(err: { code?: string; message?: string } | null | undefined): ApiError {
  const msg = err?.message ?? '';
  if (/needs_check_rate_limited/.test(msg)) return { kind: 'rate_limited' };
  if (err?.code === '42501' || /row-level security|permission denied/i.test(msg)) return { kind: 'forbidden' };
  if (err?.code === '23514') return { kind: 'invalid', message: 'Die Angaben wurden vom Server abgelehnt.' };
  if (err?.code === 'PGRST301' || /JWT|not authenticated/i.test(msg)) return { kind: 'unauthenticated' };
  return { kind: 'failed', message: msg || 'Unbekannter Fehler' };
}

interface Row {
  id: string;
  created_at: string;
  goal: string;
  area: string;
  has_website: boolean;
  website_url: string | null;
  recommendation_ids: string[];
  audit_id: string | null;
  result_basis: string;
}

function fromRow(r: Row): SavedCheck | null {
  if (!isGoal(r.goal) || !isArea(r.area)) return null;
  return {
    id: r.id,
    createdAt: r.created_at,
    answers: { goal: r.goal, area: r.area, hasWebsite: r.has_website, websiteUrl: r.website_url },
    recommendationIds: r.recommendation_ids ?? [],
    auditId: r.audit_id,
    basis: r.result_basis === 'answers_and_scan' ? 'answers_and_scan' : 'answers',
  };
}

const COLUMNS = 'id, created_at, goal, area, has_website, website_url, recommendation_ids, audit_id, result_basis';

export async function saveCheck(
  answers: Answers,
  recommendationIds: RecommendationId[],
  auditId: string | null,
  deps?: Deps,
): Promise<Result<{ id: string }>> {
  const sb = clientOrNull(deps);
  if (!sb) return { ok: false, error: { kind: 'unavailable' } };
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return { ok: false, error: { kind: 'unauthenticated' } };
  const { data, error } = await sb
    .from('needs_check_results')
    .insert({
      goal: answers.goal,
      area: answers.area,
      has_website: answers.hasWebsite,
      website_url: answers.hasWebsite ? answers.websiteUrl : null,
      recommendation_ids: recommendationIds,
      audit_id: auditId,
      result_basis: auditId ? 'answers_and_scan' : 'answers',
    })
    .select('id')
    .single();
  if (error || !data?.id) return { ok: false, error: mapDbError(error) };
  return { ok: true, data: { id: data.id as string } };
}

export async function listChecks(deps?: Deps): Promise<Result<SavedCheck[]>> {
  const sb = clientOrNull(deps);
  if (!sb) return { ok: false, error: { kind: 'unavailable' } };
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return { ok: false, error: { kind: 'unauthenticated' } };
  const { data, error } = await sb
    .from('needs_check_results')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return { ok: false, error: mapDbError(error) };
  return { ok: true, data: ((data ?? []) as Row[]).map(fromRow).filter((x): x is SavedCheck => x !== null) };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getCheck(id: string, deps?: Deps): Promise<Result<SavedCheck>> {
  if (!UUID_RE.test(id)) return { ok: false, error: { kind: 'not_found' } };
  const sb = clientOrNull(deps);
  if (!sb) return { ok: false, error: { kind: 'unavailable' } };
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return { ok: false, error: { kind: 'unauthenticated' } };
  const { data, error } = await sb.from('needs_check_results').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) return { ok: false, error: mapDbError(error) };
  // RLS liefert fremde Zeilen gar nicht aus: fremd und nicht vorhanden sehen gleich aus.
  const row = data ? fromRow(data as Row) : null;
  if (!row) return { ok: false, error: { kind: 'not_found' } };
  return { ok: true, data: row };
}

const SEVERITY_DE: Record<string, string> = { critical: 'Kritisch', high: 'Hoch', medium: 'Mittel', low: 'Niedrig', info: 'Hinweis' };
const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export async function runWebsiteScan(url: string, deps?: Deps): Promise<Result<ScanSummary>> {
  const sb = clientOrNull(deps);
  if (!sb) return { ok: false, error: { kind: 'unavailable' } };
  const { data, error } = await sb.functions.invoke('gdpr-audit', {
    body: { url, source: 'optimizer', consent_locale: 'de' },
  });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429) return { ok: false, error: { kind: 'rate_limited' } };
    if (status === 400) return { ok: false, error: { kind: 'invalid', message: 'Diese Adresse kann nicht geprüft werden.' } };
    return { ok: false, error: { kind: 'failed', message: 'Die Prüfung ist gerade nicht erreichbar.' } };
  }
  const d = data as {
    ok?: boolean; audit_id?: string; domain?: string; score?: number; coverage_notice?: string | null;
    issues?: Array<{ title?: string; severity?: string; paragraph_ref?: string }>;
  } | null;
  if (!d?.ok || !d.audit_id || typeof d.score !== 'number') {
    return { ok: false, error: { kind: 'failed', message: 'Die Prüfung hat kein Ergebnis geliefert.' } };
  }
  const issues = (d.issues ?? [])
    .slice()
    .sort((a, b) => (SEVERITY_RANK[a.severity ?? ''] ?? 5) - (SEVERITY_RANK[b.severity ?? ''] ?? 5))
    .slice(0, 3)
    .map((i) => ({ title: i.title ?? '', severity: SEVERITY_DE[i.severity ?? ''] ?? (i.severity ?? ''), ref: i.paragraph_ref ?? '' }));
  return {
    ok: true,
    data: { auditId: d.audit_id, domain: d.domain ?? '', score: d.score, issues, coverageNotice: d.coverage_notice ?? null },
  };
}

export function errorText(e: ApiError): string {
  switch (e.kind) {
    case 'unavailable': return 'Speichern ist hier gerade nicht verfügbar: Die Verbindung zur Plattform ist nicht eingerichtet.';
    case 'unauthenticated': return 'Bitte melden Sie sich an, um Ergebnisse zu speichern.';
    case 'forbidden': return 'Dafür fehlt die Berechtigung.';
    case 'not_found': return 'Dieses Ergebnis gibt es nicht oder es gehört zu einem anderen Konto.';
    case 'rate_limited': return 'Zu viele Anfragen in kurzer Zeit. Bitte später erneut versuchen.';
    case 'invalid': return e.message;
    case 'failed': return `Das hat nicht geklappt: ${e.message}`;
  }
}
