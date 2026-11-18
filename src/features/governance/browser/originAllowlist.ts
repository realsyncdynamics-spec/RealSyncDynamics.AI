// Domain-Freigaben der Browser-Runtime: Lesesicht für das Dashboard.
//
// Rechnet mit derselben Logik wie browser-execute (_shared/browser-origin-policy.ts),
// damit die Anzeige zeigt, was der Server tatsächlich erlaubt. Geschrieben wird
// ausschließlich über governance-resources (op: 'set_browser_origins').

import { buildOriginPolicy, ORIGIN_SCOPE, POLICY_ENVIRONMENT } from '../../../../supabase/functions/_shared/browser-origin-policy';
import { MANAGED_BY, normalizeOriginInput } from '../../../../supabase/functions/governance-resources/browserOrigins';

export { normalizeOriginInput };

export interface PolicyRowLike {
  id: string;
  policy_type?: string;
  action?: string;
  enabled?: boolean;
  mode?: string | null;
  environment?: string | null;
  condition?: unknown;
  created_at?: string;
}

export interface OriginAllowlistView {
  /** Vom Dashboard verwaltete Freigaben (editierbar). */
  managedAllow: string[];
  /** Vom Dashboard verwaltete Sperren (editierbar). */
  managedBlock: string[];
  /** Freigaben aus anderen Regeln (z. B. Policy Packs), hier nur lesbar. */
  otherAllow: string[];
  /** Sperren aus anderen Regeln, hier nur lesbar. */
  otherBlock: string[];
  /** Was browser-execute tatsächlich erlaubt (Freigabe ohne Sperre). */
  effective: string[];
}

function conditionOf(row: PolicyRowLike): Record<string, unknown> | null {
  return row.condition && typeof row.condition === 'object' ? row.condition as Record<string, unknown> : null;
}

function originsOf(row: PolicyRowLike): string[] {
  const c = conditionOf(row);
  return Array.isArray(c?.origins) ? (c!.origins as unknown[]).filter((o): o is string => typeof o === 'string') : [];
}

/** Nur Zeilen, die browser-execute lädt: data_transfer, aktiv, Produktion, scope browser_origin. */
export function relevantRows(rows: PolicyRowLike[]): PolicyRowLike[] {
  return (rows ?? []).filter((r) =>
    r.policy_type === 'data_transfer'
    && r.enabled === true
    && (r.environment ?? POLICY_ENVIRONMENT) === POLICY_ENVIRONMENT
    && conditionOf(r)?.scope === ORIGIN_SCOPE);
}

export function summarizeOriginPolicies(rows: PolicyRowLike[]): OriginAllowlistView {
  const relevant = relevantRows(rows);
  const byAge = [...relevant].sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));
  const managedRow = (action: 'allow' | 'block') =>
    byAge.find((r) => r.action === action && conditionOf(r)?.managed_by === MANAGED_BY) ?? null;
  const mAllow = managedRow('allow');
  const mBlock = managedRow('block');

  const otherAllow = new Set<string>();
  const otherBlock = new Set<string>();
  for (const r of relevant) {
    if (r === mAllow || r === mBlock) continue;
    if (r.action === 'block') originsOf(r).forEach((o) => otherBlock.add(o));
    else if (r.action === 'allow' && (r.mode ?? 'enforce') === 'enforce') originsOf(r).forEach((o) => otherAllow.add(o));
  }

  const policy = buildOriginPolicy(relevant as never);
  const effective = [...policy.allow].filter((o) => !policy.block.has(o)).sort();

  return {
    managedAllow: mAllow ? [...originsOf(mAllow)].sort() : [],
    managedBlock: mBlock ? [...originsOf(mBlock)].sort() : [],
    otherAllow: [...otherAllow].sort(),
    otherBlock: [...otherBlock].sort(),
    effective,
  };
}

/** Fehlertexte von governance-resources für das Panel. */
export function originSaveErrorMessage(error: { code?: string; message?: string; details?: unknown } | undefined): string {
  if (!error) return 'Speichern fehlgeschlagen.';
  if (error.code === 'FORBIDDEN' || error.code === 'HTTP_403') return 'Nur Owner oder Admin können Domain-Freigaben ändern.';
  if (error.code === 'INVALID_ORIGINS' && Array.isArray(error.details)) {
    const first = error.details[0] as { input?: string; reason?: string } | undefined;
    return first ? `Ungültig: ${first.input || 'Eingabe'} (${first.reason}). Nichts gespeichert.` : 'Ungültige Domain. Nichts gespeichert.';
  }
  if (error.code === 'HTTP_401' || error.code === 'UNAUTHORIZED') return 'Bitte erneut anmelden.';
  return 'Speichern fehlgeschlagen. Bitte später erneut versuchen.';
}
