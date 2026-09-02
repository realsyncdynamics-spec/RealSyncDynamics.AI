/**
 * Ein Audit anhand seiner Kennung laden — derselbe Weg wie der Permalink
 * `/audit/result/:auditId` (RPC `audit_share_get`, non-PII: Domain, Score,
 * Befunde, Datum).
 *
 * Gebraucht von `/onboarding/:scanId` und `/recommendation/:scanId`: Beide
 * bekamen ihre Befunde bisher ausschließlich über den Router-State, und der
 * überlebt weder Reload noch geteilten Link noch die Rückkehr von Stripe.
 * Ein Kunde, der die Empfehlung ein zweites Mal öffnete, sah „Keine
 * Empfehlung verfügbar" — obwohl der Datensatz serverseitig liegt
 * (canonical-funnel-decision.md: `gdpr_audits` ist der kanonische Datensatz).
 */
import { useEffect, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import type { ScanFinding } from '../../core/onboarding/types';
import type { AuditResultFinding } from './AuditResultView';

export interface SharedAudit {
  id: string;
  domain: string;
  score: number;
  createdAt: string;
  issues: AuditResultFinding[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadSharedAudit(auditId: string): Promise<SharedAudit> {
  if (!UUID_RE.test(auditId)) throw new Error('Ungültige Audit-Kennung.');
  if (!isSupabaseConfigured()) throw new Error('Audit-Daten können aktuell nicht geladen werden.');
  const { data, error } = await getSupabase().rpc('audit_share_get', { p_id: auditId });
  if (error) throw new Error(error.message);
  const rows = (Array.isArray(data) ? data : []) as Array<{
    domain?: string; score?: number; created_at?: string; issues?: unknown;
  }>;
  const row = rows[0];
  if (!row) throw new Error('Dieser Audit ist nicht (mehr) verfügbar.');
  return {
    id: auditId,
    domain: String(row.domain ?? ''),
    score: Number(row.score ?? 0),
    createdAt: String(row.created_at ?? ''),
    issues: Array.isArray(row.issues) ? (row.issues as AuditResultFinding[]) : [],
  };
}

/**
 * Befunde des Berichts in die Form des Onboardings — dieselbe Abbildung wie
 * `AuditResultView.handleGovernanceOnboarding`, damit ein nachgeladener
 * Bericht dieselbe Empfehlung ergibt wie ein frisch erstellter.
 */
export function toScanFindings(issues: readonly AuditResultFinding[]): ScanFinding[] {
  return issues
    .filter((f) => f.severity !== 'pass')
    .map((f) => ({
      id: f.id,
      severity: f.severity as ScanFinding['severity'],
      title: f.title,
      detail: f.detail || '',
      paragraph_ref: f.paragraph_ref,
    }));
}

export interface SharedAuditState {
  audit: SharedAudit | null;
  loading: boolean;
  error: string | null;
}

/** Lädt nur, wenn `enabled` — sonst bleibt der Router-State die Quelle. */
export function useSharedAudit(auditId: string, enabled = true): SharedAuditState {
  const [state, setState] = useState<SharedAuditState>({ audit: null, loading: enabled && !!auditId, error: null });

  useEffect(() => {
    if (!enabled || !auditId) { setState({ audit: null, loading: false, error: null }); return; }
    let cancelled = false;
    setState({ audit: null, loading: true, error: null });
    loadSharedAudit(auditId)
      .then((audit) => { if (!cancelled) setState({ audit, loading: false, error: null }); })
      .catch((e: unknown) => {
        if (!cancelled) setState({ audit: null, loading: false, error: e instanceof Error ? e.message : 'Unbekannter Fehler.' });
      });
    return () => { cancelled = true; };
  }, [auditId, enabled]);

  return state;
}
