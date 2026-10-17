/**
 * Audit Claim — den anonymen Scan dem Mandanten zuordnen.
 *
 * Die RPC `claim_gdpr_audit` ist der Writer. Diese Datei findet nur die
 * Kennung (Sitzung + Trichter-Kontext) und ruft die RPC auf. Keine zweite
 * Claim-Logik: Fehlercodes und Antwortprüfung teilt sie mit der Edge
 * Function (`supabase/functions/_shared/audit-claim.ts`).
 */

import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { readFunnelContext } from './funnelContext';
import {
  claimErrorInfo,
  claimRpcArgs,
  classifyClaimError,
  isUuid,
  parseClaimRpcResult,
  type ClaimErrorCode,
} from '../../../supabase/functions/_shared/audit-claim';

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
 * Gescheiterte Übernahme mit stabilem Code (`_shared/audit-claim.ts`).
 * `retryable: false` heißt: Mit diesem Konto wird es nie gelingen — die
 * gemerkte Kennung ist dann bereits entfernt.
 */
export class AuditClaimError extends Error {
  readonly code: ClaimErrorCode;
  readonly retryable: boolean;

  constructor(code: ClaimErrorCode) {
    const info = claimErrorInfo(code);
    super(info.message);
    this.name = 'AuditClaimError';
    this.code = code;
    this.retryable = info.retryable;
  }
}

/**
 * Beanspruchung nach Login. Fire-and-forget-tauglich, aber awaitbar.
 * Gibt `null` zurück, wenn nichts zu beanspruchen ist oder Auth fehlt;
 * wirft `AuditClaimError`, wenn die Übernahme scheitert.
 *
 * `tenantId` ist der Arbeitsbereich, den der Nutzer gerade aktiv gewählt
 * hat. Er wird nur gebraucht, wenn die RPC ohne Auswahl ablehnt, weil der
 * Nutzer zu mehreren gehört (#1865). Ob der Nutzer dort übernehmen darf,
 * entscheidet die RPC — eine Kennung aus dem Browser ist eine Auswahl, keine
 * Berechtigung.
 */
export async function claimPendingAudit(tenantId?: string | null): Promise<ClaimResult | null> {
  const pending = readPendingAudit();
  if (!pending || !isSupabaseConfigured()) return null;
  if (!isUuid(pending.audit_id)) {
    clearPendingAudit();
    return null;
  }

  const sb = getSupabase();
  const { data: userData } = await sb.auth.getUser();
  if (!userData.user) return null;

  let { data, error } = await sb.rpc('claim_gdpr_audit', claimRpcArgs(pending.audit_id, null));
  if (error && classifyClaimError(error) === 'TENANT_SELECTION_REQUIRED' && isUuid(tenantId)) {
    ({ data, error } = await sb.rpc('claim_gdpr_audit', claimRpcArgs(pending.audit_id, tenantId)));
  }

  if (error) {
    const failure = new AuditClaimError(classifyClaimError(error));
    if (!failure.retryable) clearPendingAudit();
    throw failure;
  }

  const row = parseClaimRpcResult(data);
  if (!row) throw new AuditClaimError('INTERNAL');

  clearPendingAudit();

  // Die Einwilligung gehört zu einem Scan, der jetzt nachweislich diesem
  // Konto gehört — und wird nur bei der ersten Übernahme festgehalten, nicht
  // bei jedem Reload erneut.
  if (pending.analytics_consent && !row.already_claimed) {
    await sb.from('user_consents').insert({
      user_id: userData.user.id,
      scan_result_id: pending.audit_id,
      consent_type: pending.consent_type ?? 'platform_improvement_analytics',
      consent_version: pending.consent_version ?? '1.0',
      granted: true,
    });
  }

  return {
    ok: true,
    already_claimed: row.already_claimed,
    audit_id: row.audit_id,
    tenant_id: row.tenant_id,
    domain: row.domain ?? pending.domain ?? '',
  };
}
