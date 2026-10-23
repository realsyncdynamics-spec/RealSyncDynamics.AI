/**
 * Öffentliche Lead-/Scan-Endpunkte: keine Werbung ohne bestätigte Einwilligung,
 * keine Mails an frei wählbare Adressen, keine DB-Fehlertexte an anonyme Aufrufer.
 *
 * - sales-lead: Der öffentliche Endpunkt sendet keine Mail an die übergebene
 *   Adresse. Der frühere Starter-Angebotspfad war ohne Frontend-Aufrufer, und
 *   ein Boolean im Request kann nicht belegen, dass die Adresse dem Absender
 *   gehört. Werbung braucht den Double-Opt-in (gdpr-audit/followup-doi.ts).
 * - audit-drip-cron: Drip-Mails (mit Upsell) nur mit Einwilligung am Audit UND
 *   bestätigtem Double-Opt-in am Lead — dieselbe Regel wie audit_email_drip_due
 *   seit 20261015120000, im Cron noch einmal geprüft. Gesperrte Zeilen bleiben
 *   unverändert.
 *
 * Die Edge Functions sind Deno-Quelle außerhalb des tsc-Projekts; die reine
 * Logik liegt deshalb in eigenen Modulen, der Rest wird als Text geprüft.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dripAllowed, partitionByConsent } from '../../supabase/functions/audit-drip-cron/consent-gate';

const ROOT = resolve(__dirname, '../..');
const salesLead = readFileSync(resolve(ROOT, 'supabase/functions/sales-lead/index.ts'), 'utf8');
const dripCron = readFileSync(resolve(ROOT, 'supabase/functions/audit-drip-cron/index.ts'), 'utf8');
const gdprAudit = readFileSync(resolve(ROOT, 'supabase/functions/gdpr-audit/index.ts'), 'utf8');

describe('sales-lead: keine Mail an die übergebene Adresse', () => {
  it('hat keinen Versandpfad mehr', () => {
    expect(salesLead).not.toMatch(/RESEND_API_(KEY|URL)/);
    expect(salesLead).not.toMatch(/sendStarterOffer/);
    expect(salesLead).not.toMatch(/offer_email_queued/);
    expect(existsSync(resolve(ROOT, 'supabase/functions/sales-lead/offer.ts'))).toBe(false);
  });

  it('übernimmt keine Einwilligung vom Client', () => {
    expect(salesLead).not.toMatch(/marketing_consent/);
  });

  it('gibt keine DB-Fehlertexte an Aufrufer zurück', () => {
    expect(salesLead).not.toMatch(/jsonError\(500, 'INTERNAL', \w+\.message/);
    expect(gdprAudit).not.toMatch(/jsonError\(500, 'INTERNAL', \w+\.message/);
  });
});

describe('audit-drip-cron: Einwilligung + Double-Opt-in', () => {
  const audit = (id: string, consent: boolean | null, revoked: string | null, lead: string | null) => ({
    id,
    marketing_consent: consent,
    marketing_consent_revoked_at: revoked,
    sales_lead_id: lead,
  });
  const lead = (id: string, confirmed: string | null, revoked: string | null = null) => ({
    id,
    followup_doi_confirmed_at: confirmed,
    marketing_consent_revoked_at: revoked,
  });
  const T = '2026-10-01T00:00:00Z';

  it('verlangt Einwilligung am Audit und bestätigten Double-Opt-in am Lead', () => {
    expect(dripAllowed(audit('a', true, null, 'l'), lead('l', T))).toBe(true);
    expect(dripAllowed(audit('a', true, null, 'l'), lead('l', null))).toBe(false);
    expect(dripAllowed(audit('a', true, null, 'l'), lead('l', T, T))).toBe(false);
    expect(dripAllowed(audit('a', true, T, 'l'), lead('l', T))).toBe(false);
    expect(dripAllowed(audit('a', false, null, 'l'), lead('l', T))).toBe(false);
    expect(dripAllowed(audit('a', null, null, 'l'), lead('l', T))).toBe(false);
    expect(dripAllowed(audit('a', true, null, null), undefined)).toBe(false);
    expect(dripAllowed(undefined, lead('l', T))).toBe(false);
  });

  it('teilt fällige Zeilen auf; fehlendes Audit oder fehlender Lead ist gesperrt', () => {
    const audits = [
      audit('a-ok', true, null, 'l-ok'),
      audit('a-nodoi', true, null, 'l-nodoi'),
      audit('a-noconsent', false, null, 'l-ok'),
      audit('a-nolead', true, null, null),
    ];
    const leads = [lead('l-ok', T), lead('l-nodoi', null)];
    const rows = [
      { id: 'd1', audit_id: 'a-ok' },
      { id: 'd2', audit_id: 'a-nodoi' },
      { id: 'd3', audit_id: 'a-noconsent' },
      { id: 'd4', audit_id: 'a-nolead' },
      { id: 'd5', audit_id: 'a-missing' },
      { id: 'd6', audit_id: null },
    ];
    const { allowed, blocked } = partitionByConsent(rows, audits, leads);
    expect(allowed.map((r) => r.id)).toEqual(['d1']);
    expect(blocked.map((r) => r.id)).toEqual(['d2', 'd3', 'd4', 'd5', 'd6']);
  });

  it('prüft vor dem Versand, bricht ohne lesbare Einwilligung ab und lässt gesperrte Zeilen unverändert', () => {
    expect(dripCron).toMatch(/\.select\('id, marketing_consent, marketing_consent_revoked_at, sales_lead_id'\)/);
    expect(dripCron).toMatch(/\.select\('id, followup_doi_confirmed_at, marketing_consent_revoked_at'\)/);
    expect(dripCron).toMatch(/partitionByConsent\(dueRows, audits, leads\)/);
    expect(dripCron).toMatch(/consent lookup failed/);
    // Die Sende-Schleife läuft nur über die freigegebenen Zeilen.
    expect(dripCron).toMatch(/const \{ allowed: rows, blocked \}/);
    expect(dripCron).toMatch(/for \(const row of rows\)/);
    // Keine Stilllegung: eine spätere Bestätigung soll noch wirken.
    expect(dripCron).not.toMatch(/from\('audit_email_drip'\)[\s\S]*?\.update\(/);
  });

  it('schreibt keine E-Mail-Adresse in Links', () => {
    expect(dripCron).not.toMatch(/email=\$\{encodeURIComponent\(ctx\.email\)\}/);
  });
});
