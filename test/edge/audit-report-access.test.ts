/**
 * `audit-report-pdf`: kein Bericht allein gegen die `audit_id`.
 *
 * Vorher lief die Besitzprüfung nur, wenn ein Token mitkam. Ohne
 * `Authorization` lieferte die Function mit der Service-Role den Bericht
 * samt E-Mail und Firma des Anforderers und eine 24-h-Signed-URL — für jede
 * `audit_id`, die im teilbaren Ergebnis-Link steht.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  decideReportAccess,
  type ReportCaller,
} from '../../supabase/functions/_shared/audit-report-access';

const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';

const caller = (over: Partial<ReportCaller> = {}): ReportCaller => ({
  userId: 'u1', email: 'inhaber@firma.de', emailConfirmed: true,
  isSuperAdmin: false, tenantIds: [], ...over,
});

describe('decideReportAccess', () => {
  it('lehnt einen anonymen Aufruf ab, auch bei bekannter audit_id', () => {
    expect(decideReportAccess(false, null, { email: 'inhaber@firma.de', tenant_id: null }))
      .toEqual({ allowed: false, reason: 'unauthenticated' });
  });

  it('lässt plattform-interne Aufrufe zu', () => {
    expect(decideReportAccess(true, null, { email: null, tenant_id: null }))
      .toEqual({ allowed: true, basis: 'internal' });
  });

  it('gibt den Bericht an die bestätigte Audit-E-Mail (Groß-/Kleinschreibung egal)', () => {
    expect(decideReportAccess(false, caller({ email: ' Inhaber@Firma.de ' }), { email: 'inhaber@firma.de', tenant_id: null }))
      .toEqual({ allowed: true, basis: 'verified_email' });
  });

  it('verlangt eine bestätigte E-Mail', () => {
    expect(decideReportAccess(false, caller({ emailConfirmed: false }), { email: 'inhaber@firma.de', tenant_id: null }))
      .toEqual({ allowed: false, reason: 'forbidden' });
  });

  it('lehnt eine fremde E-Mail ab', () => {
    expect(decideReportAccess(false, caller({ email: 'fremd@other.de' }), { email: 'inhaber@firma.de', tenant_id: null }))
      .toEqual({ allowed: false, reason: 'forbidden' });
  });

  it('wertet fehlende E-Mails nicht als Treffer', () => {
    expect(decideReportAccess(false, caller({ email: null }), { email: null, tenant_id: null }))
      .toEqual({ allowed: false, reason: 'forbidden' });
    expect(decideReportAccess(false, caller({ email: '' }), { email: '', tenant_id: null }))
      .toEqual({ allowed: false, reason: 'forbidden' });
  });

  it('gibt den Bericht an Mitglieder des übernehmenden Mandanten', () => {
    expect(decideReportAccess(false, caller({ email: 'kollege@firma.de', tenantIds: [T1] }), { email: 'inhaber@firma.de', tenant_id: T1 }))
      .toEqual({ allowed: true, basis: 'tenant_member' });
  });

  it('nicht an Mitglieder eines anderen Mandanten', () => {
    expect(decideReportAccess(false, caller({ email: 'x@other.de', tenantIds: [T2] }), { email: 'inhaber@firma.de', tenant_id: T1 }))
      .toEqual({ allowed: false, reason: 'forbidden' });
  });

  it('lässt Super-Admins zu', () => {
    expect(decideReportAccess(false, caller({ email: 'ops@rsd.de', isSuperAdmin: true }), { email: 'inhaber@firma.de', tenant_id: null }))
      .toEqual({ allowed: true, basis: 'super_admin' });
  });
});

describe('audit-report-pdf (Quelltext)', () => {
  const code = readFileSync('supabase/functions/audit-report-pdf/index.ts', 'utf8');

  it('prüft die Identität, bevor das Audit gelesen wird', () => {
    const reject = code.indexOf("jsonError(401, 'UNAUTHENTICATED'");
    const read = code.indexOf("from('gdpr_audits')");
    expect(reject).toBeGreaterThan(-1);
    expect(reject).toBeLessThan(read);
  });

  it('entscheidet über die gemeinsame Regel, nicht über eine optionale Prüfung', () => {
    expect(code).toMatch(/decideReportAccess\(internal, caller,/);
    expect(code).not.toMatch(/if \(callerEmail &&/);
  });

  it('erkennt den Plattform-Schlüssel nur konstantzeitig', () => {
    expect(code).toMatch(/timingSafeEqual\(token, SRK\)/);
  });

  it('nennt das Format ehrlich (HTML, kein PDF)', () => {
    expect(code).toMatch(/format: 'html'/);
  });
});
