/**
 * Audit Claim — den anonymen Scan dem Mandanten zuordnen.
 *
 * Die RPC `claim_gdpr_audit` ist der Writer. Diese Datei findet nur die
 * Kennung (Sitzung + Trichter-Kontext) und ruft die RPC auf. Kein
 * tenant_id vom Client, keine zweite Claim-Logik.
 */

import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { readFunnelContext } from './funnelContext';

export const PENDING_AUDIT_KEY = 'rsd_pending_audit';

/**
 * Zweiter Merkplatz — nur die Kennung, in `localStorage`, geschrieben vom
 * Permalink `/audit/result/:auditId` (`features/audit/pendingAudit.ts`).
 *
 * Bis 2026-09-01 kannten sich beide Merkplätze nicht: Wer den Bericht als
 * Permalink öffnete und sich dann über `/welcome` anmeldete, dessen Audit
 * wurde nie übernommen — der eine Pfad schrieb nach localStorage, der andere
 * las nur sessionStorage. Jetzt liest diese Datei beide und leert beide.
 */
export const PENDING_AUDIT_ID_KEY = 'rsd.pending_audit_id';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PendingAudit {
  audit_id: string;
  domain?: string;
  analytics_consent?: boolean;
  consent_version?: string;
  consent_type?: string;
}

export interface ClaimResult {
  ok: boolean;
  already_claimed: boolean;
  audit_id: string;
  tenant_id: string;
  domain: string;
}

export function readPendingAudit(): PendingAudit | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(PENDING_AUDIT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PendingAudit;
      if (typeof parsed?.audit_id === 'string' && parsed.audit_id) return parsed;
    }
  } catch {
    /* sessionStorage blockiert */
  }
  try {
    if (typeof window !== 'undefined') {
      const id = window.localStorage.getItem(PENDING_AUDIT_ID_KEY);
      if (id && UUID_RE.test(id)) return { audit_id: id };
    }
  } catch {
    /* localStorage blockiert */
  }
  const funnel = readFunnelContext();
  if (funnel?.auditId) {
    return { audit_id: funnel.auditId, domain: funnel.domain };
  }
  return null;
}

export function clearPendingAudit(): void {
  try {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(PENDING_AUDIT_KEY);
  } catch {
    /* ignore */
  }
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(PENDING_AUDIT_ID_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Beanspruchung nach Login. Fire-and-forget-tauglich, aber awaitbar.
 * Gibt `null` zurück, wenn nichts zu beanspruchen ist oder Auth fehlt.
 */
export async function claimPendingAudit(): Promise<ClaimResult | null> {
  const pending = readPendingAudit();
  if (!pending || !isSupabaseConfigured()) return null;

  const sb = getSupabase();
  const { data: userData } = await sb.auth.getUser();
  if (!userData.user) return null;

  if (pending.analytics_consent) {
    await sb.from('user_consents').insert({
      user_id: userData.user.id,
      scan_result_id: pending.audit_id,
      consent_type: pending.consent_type ?? 'platform_improvement_analytics',
      consent_version: pending.consent_version ?? '1.0',
      granted: true,
    });
  }

  const { data, error } = await sb.rpc('claim_gdpr_audit', {
    p_audit_id: pending.audit_id,
  });

  if (error) {
    throw error;
  }

  clearPendingAudit();

  const row = (data ?? {}) as Partial<ClaimResult>;
  if (!row.audit_id) return null;
  return {
    ok: row.ok !== false,
    already_claimed: Boolean(row.already_claimed),
    audit_id: String(row.audit_id),
    tenant_id: String(row.tenant_id ?? ''),
    domain: String(row.domain ?? pending.domain ?? ''),
  };
}
