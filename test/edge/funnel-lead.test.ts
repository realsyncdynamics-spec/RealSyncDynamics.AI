/**
 * Lead-Erfassung im Governance-Scan (gdpr-audit/funnel-lead.ts).
 *
 * Deckt die Pflichtfälle ab, die ohne Datenbank prüfbar sind: Quelle,
 * Domain-Normalisierung, Honeypot, Deduplizierungs-Antwort der RPC,
 * Altpfad bei fehlender Migration, keine E-Mail in Logs/Events, und die
 * Reihenfolge „Lead speichern → Scan“ in index.ts.
 * Die Datenbank-Seite (Dedup, Tenant-Isolation, Rechte) prüft
 * test/runtime/db/funnel-lead-capture.db.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  captureFunnelLead,
  isHoneypotTripped,
  isMissingRpcError,
  markFunnelLeadScan,
  normalizeLeadDomain,
  recordFunnelEvent,
  resolveFunnelSource,
  sanitizeEntryTag,
  type CaptureInput,
  type FunnelDbClient,
} from '../../supabase/functions/gdpr-audit/funnel-lead';

const ROOT = resolve(__dirname, '../..');
const gdprAudit = readFileSync(resolve(ROOT, 'supabase/functions/gdpr-audit/index.ts'), 'utf8');
const migration = readFileSync(
  resolve(ROOT, 'supabase/migrations/20261015120000_funnel_lead_capture.sql'),
  'utf8',
);

function mockDb(rpcResult: { data: unknown; error: { code?: string; message?: string } | null }) {
  const rpc = vi.fn(async () => rpcResult);
  const insert = vi.fn(async () => ({ error: null }));
  const db: FunnelDbClient = { rpc, from: vi.fn(() => ({ insert })) };
  return { db, rpc, insert };
}

const INPUT: CaptureInput = {
  email: 'lead@kunde.example',
  domain: 'kunde.example',
  company: 'Kunde GmbH',
  source: 'governance_scan',
  entryTag: 'landing-v6',
  path: '/audit',
  ipHash: 'hash',
  userAgent: 'ua',
  marketingConsent: false,
  consentVersion: null,
};

describe('resolveFunnelSource', () => {
  it('maps page tags to the canonical sources', () => {
    expect(resolveFunnelSource('landing-v6')).toBe('landing');
    expect(resolveFunnelSource('landing-v6-classifier')).toBe('landing');
    expect(resolveFunnelSource('pricing')).toBe('pricing');
    expect(resolveFunnelSource('agency')).toBe('agency');
    expect(resolveFunnelSource('voice_agent')).toBe('voice_agent');
    expect(resolveFunnelSource('siteos_builder')).toBe('siteos_builder');
  });
  it('falls back to governance_scan for unknown or missing tags', () => {
    expect(resolveFunnelSource(undefined)).toBe('governance_scan');
    expect(resolveFunnelSource('')).toBe('governance_scan');
    expect(resolveFunnelSource('<script>')).toBe('governance_scan');
    expect(resolveFunnelSource(42)).toBe('governance_scan');
  });
  it('only emits sources the database allowlist accepts', () => {
    for (const s of ['landing', 'governance_scan', 'pricing', 'agency', 'voice_agent', 'siteos_builder']) {
      expect(migration).toContain(`'${s}'`);
    }
  });
});

describe('sanitizeEntryTag / normalizeLeadDomain', () => {
  it('keeps only a short slug of the raw tag', () => {
    expect(sanitizeEntryTag('Landing-V6')).toBe('landing-v6');
    expect(sanitizeEntryTag('<img src=x onerror=alert(1)>')).toBe('imgsrcxonerroralert1');
    expect(sanitizeEntryTag('a'.repeat(200))).toHaveLength(64);
    expect(sanitizeEntryTag('   ')).toBeNull();
  });
  it('normalizes hosts deterministically', () => {
    expect(normalizeLeadDomain('WWW.Kunde.Example.')).toBe('kunde.example');
    expect(normalizeLeadDomain('kunde.example')).toBe('kunde.example');
  });
});

describe('isHoneypotTripped (Spam-Schutz)', () => {
  it('flags a filled honeypot only', () => {
    expect(isHoneypotTripped({ company_website: 'http://spam.example' })).toBe(true);
    expect(isHoneypotTripped({ company_website: '' })).toBe(false);
    expect(isHoneypotTripped({ company_website: '   ' })).toBe(false);
    expect(isHoneypotTripped({})).toBe(false);
  });
  it('is checked in gdpr-audit before rate limit, lead and fetch', () => {
    const honeypot = gdprAudit.indexOf('isHoneypotTripped(body)');
    expect(honeypot).toBeGreaterThan(0);
    expect(honeypot).toBeLessThan(gdprAudit.indexOf("from('gdpr_audits').select('*', { count: 'exact', head: true })"));
    expect(honeypot).toBeLessThan(gdprAudit.indexOf('captureFunnelLead(funnelDb'));
  });
});

describe('captureFunnelLead', () => {
  it('returns the lead id and whether it is new (gültige Domain + E-Mail)', async () => {
    const { db, rpc } = mockDb({ data: [{ lead_id: 'L1', is_new: true }], error: null });
    await expect(captureFunnelLead(db, INPUT)).resolves.toEqual({ ok: true, leadId: 'L1', isNew: true });
    expect(rpc).toHaveBeenCalledWith('capture_funnel_lead', expect.objectContaining({
      p_email: 'lead@kunde.example',
      p_domain: 'kunde.example',
      p_source: 'governance_scan',
      p_stage: 'scan_started',
      p_marketing_consent: false,
      p_consent_version: null,
      p_metadata: { entry: 'landing-v6' },
    }));
  });

  it('reports duplicates as not new (doppelte Einsendung)', async () => {
    const { db } = mockDb({ data: [{ lead_id: 'L1', is_new: false }], error: null });
    await expect(captureFunnelLead(db, INPUT)).resolves.toEqual({ ok: true, leadId: 'L1', isNew: false });
  });

  it('never forwards a consent version without consent', async () => {
    const { db, rpc } = mockDb({ data: [{ lead_id: 'L1', is_new: true }], error: null });
    await captureFunnelLead(db, { ...INPUT, marketingConsent: false, consentVersion: 'audit_followup_v1_de' });
    expect((rpc.mock.calls[0] as unknown[])[1]).toMatchObject({ p_marketing_consent: false, p_consent_version: null });
  });

  it('signals rpc_missing so gdpr-audit can use the legacy insert', async () => {
    const { db } = mockDb({ data: null, error: { code: 'PGRST202', message: 'not found' } });
    await expect(captureFunnelLead(db, INPUT)).resolves.toMatchObject({ ok: false, reason: 'rpc_missing' });
    expect(isMissingRpcError({ code: '42883' })).toBe(true);
    expect(isMissingRpcError({ code: '23505' })).toBe(false);
  });

  it('maps server-side validation errors to rejected (ungültige Domain/E-Mail)', async () => {
    const { db } = mockDb({ data: null, error: { code: '22023', message: 'invalid domain' } });
    await expect(captureFunnelLead(db, INPUT)).resolves.toMatchObject({ ok: false, reason: 'rejected' });
  });
});

describe('markFunnelLeadScan / recordFunnelEvent', () => {
  it('never throws — a failed status write must not cost the report', async () => {
    const db: FunnelDbClient = {
      rpc: vi.fn(async () => { throw new Error('network'); }),
      from: vi.fn(() => ({ insert: vi.fn(async () => { throw new Error('network'); }) })),
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(markFunnelLeadScan(db, 'L1', 'failed')).resolves.toBeUndefined();
    await expect(recordFunnelEvent(db, 'scan_failed', { source: 'landing' })).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it('writes funnel events without e-mail, domain or IP', async () => {
    const { db, insert } = mockDb({ data: null, error: null });
    await recordFunnelEvent(db, 'lead_saved', { source: 'landing', is_new_lead: true });
    const row = (insert.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(row).toEqual({
      event_name: 'lead_saved',
      currency: 'EUR',
      metadata: { origin: 'gdpr-audit', source: 'landing', is_new_lead: true },
    });
    expect(JSON.stringify(row)).not.toMatch(/@|kunde\.example|hash/);
  });

  it('logs only error codes, never e-mail addresses', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db: FunnelDbClient = {
      rpc: vi.fn(async () => ({ data: null, error: { code: 'XX000', message: 'lead@kunde.example broke' } })),
      from: vi.fn(() => ({ insert: vi.fn(async () => ({ error: { code: 'XX000', message: 'lead@kunde.example' } })) })),
    };
    await markFunnelLeadScan(db, 'L1', 'completed', 'A1');
    await recordFunnelEvent(db, 'scan_completed', { source: 'governance_scan' });
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/lead@kunde\.example/);
    spy.mockRestore();
  });
});

describe('gdpr-audit: Lead vor Scan, Scan überschreibt Lead nicht', () => {
  it('captures the lead before fetching the target page', () => {
    const capture = gdprAudit.indexOf('captureFunnelLead(funnelDb');
    const fetch = gdprAudit.indexOf('await fetchWithTimeout(url, 10_000)');
    expect(capture).toBeGreaterThan(0);
    expect(fetch).toBeGreaterThan(0);
    expect(capture).toBeLessThan(fetch);
  });

  it('links the audit to the lead and marks completion after the audit insert', () => {
    expect(gdprAudit).toMatch(/sales_lead_id: leadId/);
    const insert = gdprAudit.indexOf("admin.from('gdpr_audits').insert(row)");
    const completed = gdprAudit.indexOf("markFunnelLeadScan(funnelDb, leadId, 'completed', auditRow!.id)");
    expect(completed).toBeGreaterThan(insert);
  });

  it('marks failures instead of deleting the lead (Scan-Fehler, Lead bleibt)', () => {
    expect(gdprAudit).toMatch(/markFunnelLeadScan\(funnelDb, leadId, 'failed'\)/);
    expect(gdprAudit).toMatch(/markFunnelLeadScan\(admin, state\.leadId, 'failed'\)/);
    expect(gdprAudit).toMatch(/SCAN_FAILED_LEAD_SAVED/);
    expect(gdprAudit).not.toMatch(/from\('sales_leads'\)\s*\.delete/);
    expect(migration).not.toMatch(/DELETE FROM public\.sales_leads[^;]*funnel_stage = 'scan_failed'/);
  });

  it('keeps PII out of the public response and of error logs', () => {
    expect(gdprAudit).toMatch(/P0 Privacy: never return raw email on the public response/);
    const response = gdprAudit.slice(gdprAudit.indexOf('return jsonResponse({\n    ok: true,\n    audit_id'));
    expect(response.slice(0, response.indexOf('});'))).not.toMatch(/email|lead_id|leadId/);
    expect(gdprAudit).not.toMatch(/console\.error\('gdpr-audit: unhandled error', e\)/);
    expect(gdprAudit).not.toMatch(/jsonError\(500, 'INTERNAL', auditErr\.message\)/);
  });

  it('does not create leads for optimizer or tenant scans', () => {
    expect(gdprAudit).toMatch(/if \(!isOptimizerScan && !isTenantScan\) \{\n    const captured = await captureFunnelLead/);
  });
});
