/**
 * Contract für ContactSales ↔ sales-lead Inquiry-Funnel (PR #1452 backend).
 *
 * FE duties (this PR):
 *   - Read plan | plan_key | tier; normalize via shared pricing (scale→partner)
 *   - POST plan_key for inquiry; optional tier alias
 *   - POST company_domain / domains
 *   - Generic contact without inquiry signal does not force plan_key
 *
 * Backend duties (PR #1452): PLAN_KEY_REQUIRED, domains columns — asserted
 * only when that code is already on the branch/main.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

const contactSales = readFileSync(resolve(ROOT, 'src/pages/ContactSales.tsx'), 'utf8');
const salesLead    = readFileSync(resolve(ROOT, 'supabase/functions/sales-lead/index.ts'), 'utf8');
const schema       = readFileSync(
  resolve(ROOT, 'supabase/migrations/20260505100000_sales_leads.sql'),
  'utf8',
);
const domainsMigrationPath = resolve(
  ROOT,
  'supabase/migrations/20260918123700_sales_leads_inquiry_domains.sql',
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
});

describe('sales-lead: inquiry backend (wenn PR #1452 merged)', () => {
  const backendReady = /PLAN_KEY_REQUIRED/.test(salesLead);

  it.skipIf(!backendReady)('returns PLAN_KEY_REQUIRED and INVALID_PLAN_KEY', () => {
    expect(salesLead).toMatch(/['"]PLAN_KEY_REQUIRED['"]/);
    expect(salesLead).toMatch(/['"]INVALID_PLAN_KEY['"]/);
  });

  it.skipIf(!backendReady)('accepts domains and company_domain', () => {
    expect(salesLead).toMatch(/domains\?:\s*string\s*\|\s*string\[\]/);
    expect(salesLead).toMatch(/company_domain\?:\s*string/);
  });

  it.skipIf(!existsSync(domainsMigrationPath))('migration adds domain columns', () => {
    const domainsMigration = readFileSync(domainsMigrationPath, 'utf8');
    expect(domainsMigration).toMatch(/ADD COLUMN IF NOT EXISTS company_domain TEXT/i);
    expect(domainsMigration).toMatch(/ADD COLUMN IF NOT EXISTS domains TEXT\[\]/i);
  });
});
