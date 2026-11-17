/**
 * Bedarfs-Check — Backend-Anbindung.
 *
 * Speichern und Lesen laufen über den Supabase-Client des angemeldeten
 * Nutzers. Die Zugriffskontrolle macht die Datenbank, nicht dieser Code
 * (supabase/migrations/20261117190000_needs_check_results_hardening.sql):
 *   - Der Client schickt nur die vier Angaben. user_id, Zeitstempel,
 *     Modellversion und Empfehlungen setzt der Server; mitgeschickte Werte
 *     lehnt er ab.
 *   - RLS: nur eigene Zeilen lesen und löschen, kein UPDATE.
 *   - Kontingent: 20 erfolgreiche Speicherungen in 24 Stunden.
 *
 * Angezeigt wird, was der Server gespeichert hat — auch direkt nach dem
 * Speichern. „Gespeichert“ erscheint erst, wenn eine Zeile zurückkommt.
 *
 * Eine technische Prüfung der Website ist nicht Teil des Ergebnisses: Öffentliche
 * Scans lassen sich keinem Nutzer zuordnen. Der Check verweist dafür auf /audit.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  isArea, isGoal, isModelVersion,
  type Answers, type NeedsCheckModelVersion,
} from '../../../shared/needs-check';

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
  modelVersion: NeedsCheckModelVersion;
  answers: Answers;
  /** Vom Server berechnet und gespeichert. */
  recommendationIds: string[];
}

type Deps = { client?: SupabaseClient | null; configured?: boolean };

function clientOrNull(deps?: Deps): SupabaseClient | null {
  if (deps && 'client' in deps) return deps.client ?? null;
  const configured = deps?.configured ?? isSupabaseConfigured();
  return configured ? getSupabase() : null;
}

export function mapDbError(err: { code?: string; message?: string } | null | undefined): ApiError {
  const msg = err?.message ?? '';
  if (/needs_check_rate_limited/.test(msg)) return { kind: 'rate_limited' };
  if (/needs_check_unauthenticated/.test(msg)) return { kind: 'unauthenticated' };
  if (err?.code === '42501' || /row-level security|permission denied/i.test(msg)) return { kind: 'forbidden' };
  if (err?.code === '23514') return { kind: 'invalid', message: 'Die Angaben wurden vom Server abgelehnt.' };
  if (err?.code === 'PGRST301' || /JWT|not authenticated/i.test(msg)) return { kind: 'unauthenticated' };
  return { kind: 'failed', message: msg || 'Unbekannter Fehler' };
}

interface Row {
  id: string;
  created_at: string;
  model_version: number;
  goal: string;
  area: string;
  has_website: boolean;
  website_url: string | null;
  recommendation_ids: string[];
}

export function fromRow(r: Row): SavedCheck | null {
  if (!isGoal(r.goal) || !isArea(r.area) || !isModelVersion(r.model_version)) return null;
  return {
    id: r.id,
    createdAt: r.created_at,
    modelVersion: r.model_version,
    answers: { goal: r.goal, area: r.area, hasWebsite: r.has_website, websiteUrl: r.website_url },
    recommendationIds: r.recommendation_ids ?? [],
  };
}

const COLUMNS = 'id, created_at, model_version, goal, area, has_website, website_url, recommendation_ids';

export async function saveCheck(answers: Answers, deps?: Deps): Promise<Result<SavedCheck>> {
  const sb = clientOrNull(deps);
  if (!sb) return { ok: false, error: { kind: 'unavailable' } };
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return { ok: false, error: { kind: 'unauthenticated' } };
  // Nur die vier Angaben. Alles Weitere bestimmt der Server.
  const { data, error } = await sb
    .from('needs_check_results')
    .insert({
      goal: answers.goal,
      area: answers.area,
      has_website: answers.hasWebsite,
      website_url: answers.hasWebsite ? answers.websiteUrl : null,
    })
    .select(COLUMNS)
    .single();
  if (error || !data) return { ok: false, error: mapDbError(error) };
  const saved = fromRow(data as Row);
  if (!saved) return { ok: false, error: { kind: 'failed', message: 'Unerwartete Antwort des Servers.' } };
  return { ok: true, data: saved };
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
    .limit(50);
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

export async function deleteCheck(id: string, deps?: Deps): Promise<Result<null>> {
  if (!UUID_RE.test(id)) return { ok: false, error: { kind: 'not_found' } };
  const sb = clientOrNull(deps);
  if (!sb) return { ok: false, error: { kind: 'unavailable' } };
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return { ok: false, error: { kind: 'unauthenticated' } };
  const { data, error } = await sb.from('needs_check_results').delete().eq('id', id).select('id');
  if (error) return { ok: false, error: mapDbError(error) };
  if (!data || data.length === 0) return { ok: false, error: { kind: 'not_found' } };
  return { ok: true, data: null };
}

export function errorText(e: ApiError): string {
  switch (e.kind) {
    case 'unavailable': return 'Speichern ist hier gerade nicht verfügbar: Die Verbindung zur Plattform ist nicht eingerichtet.';
    case 'unauthenticated': return 'Bitte melden Sie sich an, um Ergebnisse zu speichern.';
    case 'forbidden': return 'Dafür fehlt die Berechtigung.';
    case 'not_found': return 'Dieses Ergebnis gibt es nicht oder es gehört zu einem anderen Konto.';
    case 'rate_limited': return 'Sie haben in den letzten 24 Stunden bereits 20 Ergebnisse gespeichert. Bitte später erneut versuchen.';
    case 'invalid': return e.message;
    case 'failed': return `Das hat nicht geklappt: ${e.message}`;
  }
}
