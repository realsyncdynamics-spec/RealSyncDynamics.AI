/**
 * Öffentliche Lead-/Scan-Endpunkte: Werbung nur mit ausdrücklicher Einwilligung,
 * kein fremdes HTML in Mails, keine DB-Fehlertexte an anonyme Aufrufer.
 *
 * - sales-lead: Starter-Angebotsmail nur bei `marketing_consent === true`,
 *   name/company werden escaped, Einwilligung wird nicht aus `source` abgeleitet.
 * - audit-drip-cron: Drip-Mails (mit Upsell) nur für Audits mit nicht
 *   widerrufener Einwilligung; ohne Einwilligung wird die Zeile stillgelegt.
 *
 * Die Edge Functions sind Deno-Quelle außerhalb des tsc-Projekts; die reine
 * Logik liegt deshalb in eigenen Modulen, der Rest wird als Text geprüft.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  escapeHtml,
  hasExplicitMarketingConsent,
  shouldSendStarterOffer,
  starterOfferHtml,
} from '../../supabase/functions/sales-lead/offer';
import {
  NO_CONSENT_REASON,
  dripAllowed,
  partitionByConsent,
} from '../../supabase/functions/audit-drip-cron/consent-gate';

const ROOT = resolve(__dirname, '../..');
const salesLead = readFileSync(resolve(ROOT, 'supabase/functions/sales-lead/index.ts'), 'utf8');
const dripCron = readFileSync(resolve(ROOT, 'supabase/functions/audit-drip-cron/index.ts'), 'utf8');
const gdprAudit = readFileSync(resolve(ROOT, 'supabase/functions/gdpr-audit/index.ts'), 'utf8');

describe('sales-lead: Starter-Angebot', () => {
  const base = { source: 'unified-entry', intent: 'starter_3_months_free', tier: 'starter' };

  it('sendet nur mit ausdrücklicher Einwilligung', () => {
    expect(shouldSendStarterOffer({ ...base, marketing_consent: true })).toBe(true);
    expect(shouldSendStarterOffer(base)).toBe(false);
    expect(shouldSendStarterOffer({ ...base, marketing_consent: 'true' })).toBe(false);
    expect(shouldSendStarterOffer({ ...base, marketing_consent: 1 })).toBe(false);
    expect(shouldSendStarterOffer({ ...base, tier: 'growth', marketing_consent: true })).toBe(false);
    expect(shouldSendStarterOffer({ ...base, source: 'landing', marketing_consent: true })).toBe(false);
  });

  it('akzeptiert nur das boolesche true als Einwilligung', () => {
    expect(hasExplicitMarketingConsent({ marketing_consent: true })).toBe(true);
    expect(hasExplicitMarketingConsent({ marketing_consent: 'yes' })).toBe(false);
    expect(hasExplicitMarketingConsent({})).toBe(false);
  });

  it('escaped name und company im Mail-HTML', () => {
    const html = starterOfferHtml('<a href="https://evil.example">Klick</a>', 'ACME "&" <b>Co</b>');
    expect(html).not.toContain('<a href="https://evil.example">');
    expect(html).toContain('&lt;a href=&quot;https://evil.example&quot;&gt;Klick&lt;/a&gt;');
    expect(html).toContain('ACME &quot;&amp;&quot; &lt;b&gt;Co&lt;/b&gt;');
    expect(starterOfferHtml(null, null)).toContain('<p>Hallo,</p>');
  });

  it('escapeHtml deckt die fünf HTML-Sonderzeichen ab', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('leitet keine Einwilligung mehr aus source ab und nutzt das Gate', () => {
    expect(salesLead).not.toMatch(/body\.source === 'unified-entry' \? \{ marketing_consent: true \}/);
    expect(salesLead).toMatch(/hasExplicitMarketingConsent\(body\)/);
    expect(salesLead).toMatch(/shouldSendStarterOffer\(/);
    expect(salesLead).toMatch(/offer_email_queued: offerQueued/);
    expect(salesLead).not.toMatch(/Hallo \$\{name\}/);
  });

  it('gibt keine DB-Fehlertexte an Aufrufer zurück', () => {
    expect(salesLead).not.toMatch(/jsonError\(500, 'INTERNAL', \w+\.message/);
    expect(gdprAudit).not.toMatch(/jsonError\(500, 'INTERNAL', \w+\.message/);
    // Provider-Antwort (kann die Empfängeradresse enthalten) nicht ins Log.
    expect(salesLead).not.toMatch(/Resend API error: \$\{response\.status\} - \$\{await response\.text\(\)\}/);
  });
});

describe('audit-drip-cron: Einwilligungs-Gate', () => {
  const audits = [
    { id: 'a-yes', marketing_consent: true, marketing_consent_revoked_at: null },
    { id: 'a-no', marketing_consent: false, marketing_consent_revoked_at: null },
    { id: 'a-revoked', marketing_consent: true, marketing_consent_revoked_at: '2026-10-01T00:00:00Z' },
    { id: 'a-null', marketing_consent: null, marketing_consent_revoked_at: null },
  ];

  it('erlaubt nur ausdrückliche, nicht widerrufene Einwilligung', () => {
    expect(dripAllowed(audits[0])).toBe(true);
    expect(dripAllowed(audits[1])).toBe(false);
    expect(dripAllowed(audits[2])).toBe(false);
    expect(dripAllowed(audits[3])).toBe(false);
    expect(dripAllowed(undefined)).toBe(false);
  });

  it('teilt fällige Zeilen auf; fehlendes Audit ist gesperrt', () => {
    const rows = [
      { id: 'd1', audit_id: 'a-yes' },
      { id: 'd2', audit_id: 'a-no' },
      { id: 'd3', audit_id: 'a-revoked' },
      { id: 'd4', audit_id: 'a-missing' },
      { id: 'd5', audit_id: null },
    ];
    const { allowed, blocked } = partitionByConsent(rows, audits);
    expect(allowed.map((r) => r.id)).toEqual(['d1']);
    expect(blocked.map((r) => r.id)).toEqual(['d2', 'd3', 'd4', 'd5']);
  });

  it('prüft die Einwilligung vor dem Versand, legt gesperrte Zeilen still und bricht ohne Lesbarkeit ab', () => {
    expect(dripCron).toMatch(/\.select\('id, marketing_consent, marketing_consent_revoked_at'\)/);
    expect(dripCron).toMatch(/partitionByConsent\(dueRows, audits\)/);
    expect(dripCron).toMatch(/unsubscribed: true, next_send_at: null, last_error: NO_CONSENT_REASON/);
    expect(dripCron).toMatch(/consent lookup failed/);
    // Die Sende-Schleife läuft nur über die freigegebenen Zeilen.
    expect(dripCron).toMatch(/const \{ allowed: rows, blocked \}/);
    expect(dripCron).toMatch(/for \(const row of rows\)/);
    expect(NO_CONSENT_REASON).toBe('no_marketing_consent');
  });

  it('schreibt keine E-Mail-Adresse in Links', () => {
    expect(dripCron).not.toMatch(/email=\$\{encodeURIComponent\(ctx\.email\)\}/);
  });
});
