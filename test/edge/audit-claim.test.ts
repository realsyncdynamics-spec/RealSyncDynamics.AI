/**
 * Audit-Übernahme: ein Schreiber, stabile Fehlercodes.
 *
 * Bis 2026-10-13 übernahm die Edge Function `audit-claim` mit der
 * Service-Role und prüfte nur, ob der Aufrufer die `audit_id` kannte. Die
 * steht im teilbaren Ergebnis-Link — ein frisch registriertes Konto konnte
 * damit ein fremdes Audit dauerhaft in den eigenen Mandanten ziehen. Jetzt
 * ruft die Function die RPC `claim_gdpr_audit` mit dem Nutzer-Token auf.
 * Diese Datei hält beides fest: die Fehlerzuordnung und dass der zweite
 * Schreibweg nicht zurückkommt.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  claimErrorInfo,
  claimRpcArgs,
  classifyClaimError,
  isUuid,
  parseClaimRpcResult,
  type ClaimErrorCode,
} from '../../supabase/functions/_shared/audit-claim';

const T1 = '11111111-1111-4111-8111-111111111111';
const A1 = '33333333-3333-4333-8333-333333333333';

describe('classifyClaimError — beide RPC-Fassungen', () => {
  it.each<[string, ClaimErrorCode]>([
    // Fassung 20260830091500
    ['unauthenticated', 'UNAUTHENTICATED'],
    ['email unverified', 'EMAIL_UNVERIFIED'],
    ['no tenant', 'TENANT_NOT_FOUND'],
    ['audit not found', 'NOT_FOUND'],
    ['email mismatch', 'OWNERSHIP_NOT_VERIFIED'],
    ['already claimed', 'ALREADY_CLAIMED'],
    ['claim raced', 'CONFLICT_RETRY'],
    // Gehärtete Fassung aus #1867
    ['verified account email required', 'EMAIL_UNVERIFIED'],
    ['no tenant membership', 'TENANT_NOT_FOUND'],
    ['explicit tenant selection required', 'TENANT_SELECTION_REQUIRED'],
    ['tenant claim not authorized', 'TENANT_FORBIDDEN'],
    ['audit ownership not verified', 'OWNERSHIP_NOT_VERIFIED'],
    ['audit ownership inconsistent', 'OWNERSHIP_INCONSISTENT'],
  ])('%s → %s', (message, code) => {
    expect(classifyClaimError({ message })).toBe(code);
  });

  it('erkennt die fehlende Überladung mit Mandantenauswahl (PGRST202)', () => {
    expect(classifyClaimError({ code: 'PGRST202', message: 'Could not find the function public.claim_gdpr_audit(p_audit_id, p_tenant_id)' }))
      .toBe('TENANT_SELECTION_UNAVAILABLE');
  });

  it('macht aus Unbekanntem einen Wiederholungsfall, keine Freigabe', () => {
    expect(classifyClaimError({ message: 'connection reset' })).toBe('INTERNAL');
    expect(classifyClaimError(null)).toBe('INTERNAL');
    expect(classifyClaimError({ message: 42 })).toBe('INTERNAL');
  });
});

describe('claimErrorInfo', () => {
  it('beendet nur Fälle, die mit diesem Konto nie gelingen', () => {
    const terminal = (['NOT_FOUND', 'ALREADY_CLAIMED', 'OWNERSHIP_NOT_VERIFIED', 'OWNERSHIP_INCONSISTENT'] as const)
      .map((c) => claimErrorInfo(c).retryable);
    expect(terminal).toEqual([false, false, false, false]);
    for (const c of ['EMAIL_UNVERIFIED', 'TENANT_SELECTION_REQUIRED', 'CONFLICT_RETRY', 'INTERNAL'] as const) {
      expect(claimErrorInfo(c).retryable, c).toBe(true);
    }
  });

  it('liefert passende HTTP-Status', () => {
    expect(claimErrorInfo('UNAUTHENTICATED').httpStatus).toBe(401);
    expect(claimErrorInfo('OWNERSHIP_NOT_VERIFIED').httpStatus).toBe(403);
    expect(claimErrorInfo('NOT_FOUND').httpStatus).toBe(404);
    expect(claimErrorInfo('ALREADY_CLAIMED').httpStatus).toBe(409);
  });
});

describe('claimRpcArgs', () => {
  it('ohne Mandant die einstellige Fassung — in beiden RPC-Ständen vorhanden', () => {
    expect(claimRpcArgs(A1, null)).toEqual({ p_audit_id: A1 });
  });
  it('mit Mandant die zweistellige Fassung', () => {
    expect(claimRpcArgs(A1, T1)).toEqual({ p_audit_id: A1, p_tenant_id: T1 });
  });
});

describe('parseClaimRpcResult', () => {
  it('nimmt eine vollständige Antwort an', () => {
    expect(parseClaimRpcResult({ ok: true, already_claimed: false, audit_id: A1, tenant_id: T1, domain: 'firma.de' }))
      .toEqual({ ok: true, already_claimed: false, audit_id: A1, tenant_id: T1, domain: 'firma.de' });
  });

  it('meldet keinen Erfolg ohne belegte Kennungen', () => {
    expect(parseClaimRpcResult(null)).toBeNull();
    expect(parseClaimRpcResult({ ok: true, audit_id: A1 })).toBeNull();
    expect(parseClaimRpcResult({ ok: false, audit_id: A1, tenant_id: T1 })).toBeNull();
    expect(parseClaimRpcResult({ ok: true, audit_id: 'x', tenant_id: T1 })).toBeNull();
  });
});

describe('isUuid', () => {
  it('weist alles außer UUIDs ab, bevor es in eine Abfrage geht', () => {
    expect(isUuid(T1)).toBe(true);
    for (const bad of ['', 'abc', 12, null, undefined, {}, `${T1} or 1=1`, `${T1}\n`]) {
      expect(isUuid(bad), String(bad)).toBe(false);
    }
  });
});

describe('Edge Function audit-claim (Quelltext)', () => {
  const code = readFileSync('supabase/functions/audit-claim/index.ts', 'utf8');

  it('übernimmt über die RPC mit dem Nutzer-Token', () => {
    expect(code).toMatch(/userClient\.rpc\('claim_gdpr_audit', claimRpcArgs\(/);
  });

  it('schreibt gdpr_audits nicht selbst — kein zweiter Schreibweg', () => {
    expect(code).not.toMatch(/from\('gdpr_audits'\)/);
    expect(code).not.toMatch(/\.update\(/);
  });

  it('nutzt die Service-Role nur für den Prüfpfad nach erfolgreicher Übernahme', () => {
    const adminIdx = code.indexOf('createClient(SUPABASE_URL, SERVICE_ROLE');
    const rpcIdx = code.indexOf("userClient.rpc('claim_gdpr_audit'");
    expect(adminIdx).toBeGreaterThan(rpcIdx);
    expect(code).toMatch(/action: 'audit\.claim'/);
  });
});
