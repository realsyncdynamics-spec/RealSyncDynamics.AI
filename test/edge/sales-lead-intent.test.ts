/**
 * Contract für die Lead-Qualifizierung über `?intent=` / `plan_key` / domains.
 *
 * Die Kette spannt drei Ebenen, die übereinstimmen müssen:
 *   - CTAs in src/pages + src/components setzen `?intent=<wert>`
 *   - src/pages/ContactSales.tsx liest den Param und sendet ihn im POST-Body
 *   - supabase/functions/sales-lead/index.ts schreibt ihn in metadata (JSONB)
 *
 * Inquiry-Funnel (Enterprise/Partner):
 *   - plan_key via normalizePlanKey (scale→partner)
 *   - domains / company_domain → first-class columns + metadata mirror
 *   - inquiry purchaseMode → source normalized to contact-sales
 *
 * Die Edge Function ist Deno-Quelle außerhalb des tsc-Projekts, deshalb wird
 * der Contract als Text geprüft (gleiche Technik wie agent-runs-metering).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

const contactSales = readFileSync(resolve(ROOT, 'src/pages/ContactSales.tsx'), 'utf8');
const salesLead    = readFileSync(resolve(ROOT, 'supabase/functions/sales-lead/index.ts'), 'utf8');
const schema       = readFileSync(
  resolve(ROOT, 'supabase/migrations/20260505100000_sales_leads.sql'),
  'utf8',
);
const domainsMigration = readFileSync(
  resolve(ROOT, 'supabase/migrations/20260918123700_sales_leads_inquiry_domains.sql'),
  'utf8',
);
const pricingShared = readFileSync(
  resolve(ROOT, 'supabase/functions/_shared/pricing.generated.ts'),
  'utf8',
);

describe('sales-lead: intent-Weitergabe', () => {
  it('ContactSales liest den intent-Param', () => {
    expect(contactSales).toMatch(/params\.get\(['"]intent['"]\)/);
  });

  it('ContactSales sendet intent im POST-Body', () => {
    expect(contactSales).toMatch(/\bintent:\s*intent\s*\?\?\s*undefined/);
  });

  it('sales-lead akzeptiert intent im Body-Typ', () => {
    expect(salesLead).toMatch(/intent\?:\s*string/);
  });

  it('sales-lead schreibt intent nach metadata', () => {
    expect(salesLead).toMatch(/metadata[\s\S]*?intent/);
  });

  it('intent wird wie alle Freitext-Felder gekappt', () => {
    // Kein Overflow über den public, unauthentifizierten Endpoint.
    expect(salesLead).toMatch(/cap\(body\.intent,\s*\d+\)/);
  });

  it('metadata existiert im Schema — der Fix braucht keine Migration', () => {
    expect(schema).toMatch(/metadata\s+JSONB\s+NOT NULL\s+DEFAULT/i);
  });
});

/**
 * `tier` kam über den Merge von main dazu (Founding-Access-Tarif-Links) und
 * hatte dieselbe Lücke: ContactSales sendet ihn, die Function verwarf ihn.
 * Er teilt sich jetzt die metadata-Spalte mit intent.
 */
describe('sales-lead: tier-Weitergabe', () => {
  it('ContactSales sendet tier im POST-Body', () => {
    expect(contactSales).toMatch(/\btier:\s*tier\s*\|\|\s*undefined/);
  });

  it('sales-lead akzeptiert tier im Body-Typ und kappt ihn', () => {
    expect(salesLead).toMatch(/tier\?:\s*string/);
    expect(salesLead).toMatch(/cap\(body\.tier,\s*\d+\)/);
  });

  it('metadata trägt intent und tier gemeinsam, ohne sich zu überschreiben', () => {
    expect(salesLead).toMatch(/\(intent\s*\?\s*\{\s*intent/);
    expect(salesLead).toMatch(/\(tier\s*\?\s*\{\s*tier/);
  });
});

describe('sales-lead: inquiry plan_key + domains', () => {
  it('imports normalizePlanKey + planByKey from pricing SSoT', () => {
    expect(salesLead).toMatch(
      /import\s*\{[^}]*normalizePlanKey[^}]*planByKey[^}]*\}\s*from\s*['"]\.\.\/_shared\/pricing\.generated\.ts['"]/,
    );
  });

  it('pricing SSoT maps scale → partner and marks enterprise/partner as inquiry', () => {
    expect(pricingShared).toMatch(/scale:\s*['"]partner['"]/);
    expect(pricingShared).toMatch(/purchaseMode:\s*['"]inquiry['"]/);
  });

  it('accepts plan_key in the body type and caps it', () => {
    expect(salesLead).toMatch(/plan_key\?:\s*string/);
    expect(salesLead).toMatch(/cap\(body\.plan_key,\s*\d+\)/);
  });

  it('persists plan_key into metadata and keeps tier as optional alias', () => {
    expect(salesLead).toMatch(/plan_key:\s*planKey/);
    expect(salesLead).toMatch(/\(tier\s*\?\s*\{\s*tier/);
  });

  it('returns PLAN_KEY_REQUIRED and INVALID_PLAN_KEY for inquiry gaps', () => {
    expect(salesLead).toMatch(/['"]PLAN_KEY_REQUIRED['"]/);
    expect(salesLead).toMatch(/['"]INVALID_PLAN_KEY['"]/);
  });

  it('normalizes inquiry source to contact-sales', () => {
    expect(salesLead).toMatch(/['"]contact-sales['"]/);
    expect(salesLead).toMatch(/purchaseMode\s*===\s*['"]inquiry['"]/);
  });

  it('accepts domains (string | string[]) and company_domain', () => {
    expect(salesLead).toMatch(/domains\?:\s*string\s*\|\s*string\[\]/);
    expect(salesLead).toMatch(/company_domain\?:\s*string/);
    expect(salesLead).toMatch(/normalizeDomains\(/);
  });

  it('migration adds first-class company_domain + domains without breaking rows', () => {
    expect(domainsMigration).toMatch(/ADD COLUMN IF NOT EXISTS company_domain TEXT/i);
    expect(domainsMigration).toMatch(/ADD COLUMN IF NOT EXISTS domains TEXT\[\]/i);
    expect(domainsMigration).toMatch(/DEFAULT '\{\}'::text\[\]/);
  });

  it('insert writes first-class domain columns', () => {
    expect(salesLead).toMatch(/company_domain:\s*companyDomain/);
    expect(salesLead).toMatch(/domains:\s*domainsPersisted/);
  });

  it('does not touch stripe-checkout inquiry hard-reject', () => {
    const checkout = readFileSync(
      resolve(ROOT, 'supabase/functions/stripe-checkout/index.ts'),
      'utf8',
    );
    expect(checkout).toMatch(/['"]INQUIRY_ONLY['"]/);
    expect(checkout).toMatch(/purchaseMode\s*===\s*['"]inquiry['"]/);
  });
});
