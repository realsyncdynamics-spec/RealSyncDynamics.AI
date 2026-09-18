/**
 * Contract für die Lead-Qualifizierung über `?intent=` / `plan_key` / domains.
 *
 * FE (ContactSales, bereits auf main via #1453):
 *   - Read plan | plan_key | tier; normalize via shared pricing (scale→partner)
 *   - POST plan_key for inquiry; optional tier alias
 *   - POST company_domain / domains
 *   - Generic contact without inquiry signal does not force plan_key
 *
 * Backend (dieses PR #1452):
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
    expect(salesLead).toMatch(/cap\(body\.intent,\s*\d+\)/);
  });

  it('metadata existiert im Schema — der Fix braucht keine Migration', () => {
    expect(schema).toMatch(/metadata\s+JSONB\s+NOT NULL\s+DEFAULT/i);
  });
});

describe('ContactSales: inquiry plan_key contract', () => {
  it('akzeptiert plan, plan_key und tier als Query-Params', () => {
    expect(contactSales).toMatch(/params\.get\(['"]plan['"]\)/);
    expect(contactSales).toMatch(/params\.get\(['"]plan_key['"]\)/);
    expect(contactSales).toMatch(/params\.get\(['"]tier['"]\)/);
  });

  it('normalisiert über normalizePlanKey', () => {
    expect(contactSales).toMatch(/normalizePlanKey/);
  });

  it('sendet plan_key im POST-Body wenn gesetzt', () => {
    expect(contactSales).toMatch(/plan_key:\s*planKey/);
  });

  it('sendet tier nur als optionalen Alias neben plan_key', () => {
    expect(contactSales).toMatch(/tier:\s*planKey/);
  });

  it('sendet company_domain und domains', () => {
    expect(contactSales).toMatch(/company_domain:\s*companyDomain/);
    expect(contactSales).toMatch(/\bdomains:\s*domainsPayload/);
  });

  it('setzt path auf /contact-sales', () => {
    expect(contactSales).toMatch(/path:\s*['"]\/contact-sales['"]/);
  });

  it('blockiert Inquiry-Submit ohne plan_key (PLAN_KEY_REQUIRED)', () => {
    expect(contactSales).toMatch(/PLAN_KEY_REQUIRED/);
    expect(contactSales).toMatch(/isInquiry && !planKey/);
  });

  it('leitet plan_key aus intent=enterprise|partner ab wenn Query fehlt', () => {
    expect(contactSales).toMatch(/defaultInquiryPlanFromIntent/);
  });
});

describe('sales-lead: tier-Weitergabe (bestehend)', () => {
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
