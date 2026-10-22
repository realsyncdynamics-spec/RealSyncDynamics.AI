/**
 * Beta-Feedback (WP-4, docs/claude/BETA_V5_WORKPLAN.md).
 *
 * Schreiben: direkt in `beta_feedback` — RLS erzwingt eigene `user_id` und
 * Mitgliedschaft im Mandanten (Migration 20261022090000). Kein Edge-Umweg,
 * keine Service-Role im Browser.
 *
 * Lesen (Team): RPC `admin_beta_feedback` — prüft `is_platform_operator()`
 * in der Datenbank. Die Browser-Prüfung ist nur Anzeige-Logik.
 */
import { getSupabase } from '../../lib/supabase';

export const FEEDBACK_MIN = 3;
export const FEEDBACK_MAX = 4000;

export interface BetaFeedbackInput {
  tenantId: string;
  userId: string;
  route: string;
  text: string;
}

export interface BetaFeedbackRow {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  user_id: string;
  user_email: string | null;
  route: string;
  text: string;
  created_at: string;
}

/** Reine Prüfung — spiegelt die CHECK-Constraints der Tabelle. */
export function validateFeedbackText(raw: string): { ok: true; text: string } | { ok: false; reason: string } {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (text.length < FEEDBACK_MIN) return { ok: false, reason: 'Bitte beschreiben Sie kurz, was Ihnen aufgefallen ist.' };
  if (text.length > FEEDBACK_MAX) return { ok: false, reason: `Maximal ${FEEDBACK_MAX} Zeichen.` };
  return { ok: true, text };
}

/** Route ohne Query/Hash, damit keine Tokens oder Suchbegriffe mitgeschrieben werden. */
export function feedbackRoute(pathname: string): string {
  const clean = pathname.split('?')[0].split('#')[0];
  const path = clean.startsWith('/') ? clean : `/${clean}`;
  return path.slice(0, 512);
}

export async function submitBetaFeedback(input: BetaFeedbackInput): Promise<void> {
  const checked = validateFeedbackText(input.text);
  if (!checked.ok) throw new Error(checked.reason);
  const { error } = await getSupabase().from('beta_feedback').insert({
    tenant_id: input.tenantId,
    user_id: input.userId,
    route: feedbackRoute(input.route),
    text: checked.text,
  });
  if (error) throw new Error(error.message);
}

/** Team-Ansicht: jüngste Einträge über alle Mandanten (nur Plattform-Operatoren). */
export async function listBetaFeedbackAdmin(opts?: { limit?: number; tenantId?: string | null }): Promise<BetaFeedbackRow[]> {
  const { data, error } = await getSupabase().rpc('admin_beta_feedback', {
    p_limit: opts?.limit ?? 200,
    p_tenant_id: opts?.tenantId ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as BetaFeedbackRow[];
}

/** Eigene Meldungen des Mandanten (RLS: Mitglieder lesen ihren Mandanten). */
export async function listBetaFeedbackForTenant(tenantId: string, limit = 50): Promise<Pick<BetaFeedbackRow, 'id' | 'route' | 'text' | 'created_at'>[]> {
  const { data, error } = await getSupabase()
    .from('beta_feedback')
    .select('id, route, text, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<BetaFeedbackRow, 'id' | 'route' | 'text' | 'created_at'>[];
}

/** 42501 = `forbidden` aus admin_beta_feedback — kein Operator. */
export function isForbiddenError(message: string): boolean {
  return /forbidden|42501|permission denied/i.test(message);
}
