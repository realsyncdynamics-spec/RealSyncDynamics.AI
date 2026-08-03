/**
 * Contract für die Lead-Qualifizierung über `?intent=`.
 *
 * Die Kette spannt drei Ebenen, die übereinstimmen müssen:
 *   - CTAs in src/pages + src/components setzen `?intent=<wert>`
 *   - src/pages/ContactSales.tsx liest den Param und sendet ihn im POST-Body
 *   - supabase/functions/sales-lead/index.ts schreibt ihn in metadata (JSONB)
 *
 * Vorher endete die Kette nach dem ersten Glied: ContactSales las `intent`
 * nur für das Vorbelegen von use_case und verwarf ihn dann — jeder
 * Enterprise-Lead kam im Backend ununterscheidbar an.
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
    expect(salesLead).toMatch(/metadata:\s*\{[\s\S]*?intent[\s\S]*?\}/);
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
    expect(salesLead).toMatch(/metadata:\s*\{\s*\.\.\.\(intent[\s\S]*?\.\.\.\(tier/);
  });
});
