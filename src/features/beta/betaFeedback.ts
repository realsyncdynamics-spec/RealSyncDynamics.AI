// Beta-Feedback aus der App (WP-4, docs/claude/BETA_V5_WORKPLAN.md).
//
// Schreibt direkt in `beta_feedback` (Migration 20261025140000). Die
// Datenbank prüft per RLS, dass der Nutzer Mitglied des Mandanten ist und nur
// als er selbst schreibt; `user_id` setzt der Spalten-Default `auth.uid()`.
// Diese Datei ist der einzige Zugriffspunkt der App auf die Tabelle.

import type { SupabaseClient } from '@supabase/supabase-js';

export const FEEDBACK_MAX_LENGTH = 2000;
const ROUTE_MAX_LENGTH = 200;

export interface BetaFeedbackRow {
  id: string;
  tenant_id: string;
  user_id: string;
  route: string;
  text: string;
  created_at: string;
}

export type FeedbackDraft =
  | { ok: true; text: string; route: string }
  | { ok: false; reason: 'empty' | 'too_long' };

/**
 * Prüft den Entwurf wie die CHECK-Constraints der Tabelle, damit der Nutzer
 * die Meldung vor dem Absenden sieht. Die Route verliert Query und Hash:
 * Dort können Tokens oder E-Mail-Adressen stehen.
 */
export function prepareFeedback(rawText: string, rawRoute: string): FeedbackDraft {
  const text = rawText.trim();
  if (text.length === 0) return { ok: false, reason: 'empty' };
  if (text.length > FEEDBACK_MAX_LENGTH) return { ok: false, reason: 'too_long' };
  return { ok: true, text, route: normalizeRoute(rawRoute) };
}

export function normalizeRoute(raw: string): string {
  const path = raw.split(/[?#]/, 1)[0]?.trim() ?? '';
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return withSlash.slice(0, ROUTE_MAX_LENGTH);
}

export async function submitBetaFeedback(
  sb: SupabaseClient,
  input: { tenantId: string; text: string; route: string },
): Promise<void> {
  const { error } = await sb
    .from('beta_feedback')
    .insert({ tenant_id: input.tenantId, text: input.text, route: input.route });
  if (error) throw new Error(error.message);
}

/** Für /admin/beta-feedback. RLS liefert alle Einträge nur Plattform-Betreibern. */
export async function listBetaFeedback(sb: SupabaseClient, limit = 200): Promise<BetaFeedbackRow[]> {
  const { data, error } = await sb
    .from('beta_feedback')
    .select('id, tenant_id, user_id, route, text, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as BetaFeedbackRow[];
}

/** Dieselbe Prüfung wie die RLS-Policy der Tabelle. */
export async function isPlatformOperator(sb: SupabaseClient): Promise<boolean> {
  const { data, error } = await sb.rpc('is_platform_operator');
  if (error) throw new Error(error.message);
  return data === true;
}
