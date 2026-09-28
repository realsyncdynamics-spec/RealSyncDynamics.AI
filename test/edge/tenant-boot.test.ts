// @vitest-environment node
/**
 * Tenant-Boot (Release 1): reine Logik aus _shared/tenant-boot.ts plus
 * Quelltext-Vertraege fuer provision-tenant und die Migration.
 *
 * Die Quelltext-Pruefungen halten die Sicherheits-Eigenschaften fest, die
 * sich in vitest nicht ausfuehren lassen (Deno-Function): tenant_id nie
 * ungeprueft, Klartext-Key nie persistiert, Policies starten in observe.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BASELINE_PACKS,
  BOOT_STEPS,
  CONNECTOR_STALE_AFTER_MS,
  aggregateRunStatus,
  buildVerifyCommand,
  buildWorkerScript,
  connectorStatus,
  isBootTrigger,
  lifecycleSnapshot,
  normalizeDomain,
  observeAction,
  policyRowFromTemplate,
  timingSafeEqualString,
  type BootStepResult,
  type PolicyTemplate,
} from '../../supabase/functions/_shared/tenant-boot';
import { evaluatePolicies } from '../../supabase/functions/_shared/policyEngine';
import { evidenceContentHash } from '../../supabase/functions/_shared/evidence-hash';

const root = (p: string) => resolve(__dirname, '../..', p);
const FN = readFileSync(root('supabase/functions/provision-tenant/index.ts'), 'utf8');
const SQL = readFileSync(root('supabase/migrations/20260928150000_tenant_boot_provisioning.sql'), 'utf8');
const INGEST = readFileSync(root('supabase/functions/governance-ingest/index.ts'), 'utf8');

const done = (step: BootStepResult['step']): BootStepResult => ({ step, status: 'done' });

describe('aggregateRunStatus', () => {
  it('ist completed nur, wenn jeder Schritt done ist', () => {
    expect(aggregateRunStatus(BOOT_STEPS.map(done))).toBe('completed');
  });
  it('ist partial bei offenem Connector', () => {
    const steps = BOOT_STEPS.map(done);
    steps[BOOT_STEPS.indexOf('installer')] = { step: 'installer', status: 'pending', reason: 'awaiting_first_event' };
    expect(aggregateRunStatus(steps)).toBe('partial');
  });
  it('ist failed, sobald ein Schritt scheitert', () => {
    expect(aggregateRunStatus([done('identity'), { step: 'entitlements', status: 'failed' }])).toBe('failed');
  });
  it('fehlende Schritte zaehlen nicht als erledigt', () => {
    expect(aggregateRunStatus([done('identity')])).toBe('partial');
  });
});

describe('observe mode', () => {
  it('stuft blockierende Aktionen auf warn herab', () => {
    expect(observeAction('block')).toBe('warn');
    expect(observeAction('require_approval')).toBe('warn');
    expect(observeAction('log')).toBe('log');
    expect(observeAction('warn')).toBe('warn');
  });

  const tpl: PolicyTemplate = {
    id: 'tdddg.tracker-before-consent', pack_id: 'tdddg-consent', version: 1,
    name: 'Tracker', description: null, policy_type: 'gdpr', severity: 'high',
    enforce_action: 'block', condition: { event_type: ['tracker.detected'] },
  };

  it('klont ein Template mit Herkunft, Zielaktion und observe', () => {
    const row = policyRowFromTemplate('t1', tpl);
    expect(row).toMatchObject({
      tenant_id: 't1', action: 'warn', enforce_action: 'block', mode: 'observe',
      source_template_id: tpl.id, source_pack_id: 'tdddg-consent', template_version: 1, enabled: true,
    });
  });

  it('lehnt leere Bedingungen ab — {} matcht in der Engine jedes Event', () => {
    expect(() => policyRowFromTemplate('t1', { ...tpl, condition: {} })).toThrow(/empty condition/);
  });

  it('geklonte Regel entscheidet in der echten Engine — aber nur warn', () => {
    const row = policyRowFromTemplate('t1', tpl);
    const d = evaluatePolicies(
      { event_type: 'tracker.detected', event_source: 'website_scanner' },
      null,
      [{ id: 'p1', ...row }],
    );
    expect(d).toEqual({ policy_id: 'p1', action: 'warn' });
  });
});

describe('normalizeDomain', () => {
  it.each([
    ['https://www.Example.de/pfad', 'example.de'],
    ['example.de', 'example.de'],
    ['  shop.example.co.uk ', 'shop.example.co.uk'],
  ])('%s -> %s', (raw, want) => expect(normalizeDomain(raw)).toBe(want));
  it.each([null, '', 'localhost', '127.0.0.1', 'http://[::1]/', 42])('verwirft %s', (raw) => {
    expect(normalizeDomain(raw)).toBeNull();
  });
});

describe('connectorStatus', () => {
  const now = new Date('2026-09-28T12:00:00Z');
  it('issued ohne erstes Event', () => {
    expect(connectorStatus({ first_event_at: null, last_used_at: null, revoked_at: null }, now)).toBe('issued');
  });
  it('verified mit frischem Event', () => {
    const t = new Date(now.getTime() - 60_000).toISOString();
    expect(connectorStatus({ first_event_at: t, last_used_at: t, revoked_at: null }, now)).toBe('verified');
  });
  it('stale nach Ablauf', () => {
    const t = new Date(now.getTime() - CONNECTOR_STALE_AFTER_MS - 1).toISOString();
    expect(connectorStatus({ first_event_at: t, last_used_at: t, revoked_at: null }, now)).toBe('stale');
  });
  it('revoked schlaegt alles', () => {
    const t = now.toISOString();
    expect(connectorStatus({ first_event_at: t, last_used_at: t, revoked_at: t }, now)).toBe('revoked');
  });
});

describe('installer', () => {
  const input = { ingestUrl: 'https://x.supabase.co/functions/v1/governance-ingest', domain: 'example.de', assetId: 'a1', keyPrefix: 'rsd_gov_abcd' };
  it('Worker traegt den Key nur als Secret, nie als Literal', () => {
    const s = buildWorkerScript(input);
    expect(s).toContain('env.RSD_INGEST_KEY');
    expect(s).toContain('"connector.heartbeat"');
    expect(s).toContain('"a1"');
    expect(s).not.toMatch(/rsd_gov_[A-Za-z0-9_-]{20,}/);
  });
  it('Verify-Aufruf nutzt die Env-Variable und eine erlaubte Quelle', () => {
    const cmd = buildVerifyCommand(input);
    expect(cmd).toContain('$RSD_INGEST_KEY');
    expect(cmd).toContain('"event_source":"website_scanner"');
  });
});

describe('lifecycle evidence', () => {
  it('verkettet ueber previous_hash nach der evidence-hash-Konvention', async () => {
    const a = lifecycleSnapshot({ tenantId: 't1', step: 'catalog', action: 'asset_discovered', detail: {}, occurredAt: '2026-09-28T00:00:00Z', previousHash: null });
    const ha = await evidenceContentHash(a);
    const b = lifecycleSnapshot({ tenantId: 't1', step: 'policy_bundle', action: 'pack_applied', detail: {}, occurredAt: '2026-09-28T00:00:01Z', previousHash: ha });
    expect(b.previous_hash).toBe(ha);
    expect(await evidenceContentHash(b)).not.toBe(ha);
    expect(await evidenceContentHash(a)).toBe(ha);
  });
});

describe('triggers + auth helper', () => {
  it('kennt nur definierte Trigger', () => {
    expect(isBootTrigger('checkout')).toBe(true);
    expect(isBootTrigger('admin_override')).toBe(false);
  });
  it('timingSafeEqualString', async () => {
    expect(await timingSafeEqualString('abc', 'abc')).toBe(true);
    expect(await timingSafeEqualString('abc', 'abd')).toBe(false);
  });
});

describe('provision-tenant — Quelltext-Vertraege', () => {
  it('prueft Owner/Admin-Mitgliedschaft fuer Nutzeraufrufe', () => {
    expect(FN).toMatch(/from\('memberships'\)[\s\S]{0,120}\.in\('role', ADMIN_ROLES\)/);
    expect(FN).toContain('auth.getUser()');
  });
  it('reserviert interne Trigger fuer den Service-Role-Aufruf', () => {
    expect(FN).toContain("trigger reserved for server-side calls");
    expect(FN).toContain('timingSafeEqualString(bearer, SRK)');
  });
  it('persistiert den Klartext-Key nie in den Lauf-Schritten', () => {
    const persisted = FN.match(/tenant_provisioning_runs'\)\.update\(\{[\s\S]*?\}\)/g) ?? [];
    expect(persisted.length).toBeGreaterThan(0);
    for (const p of persisted) expect(p).not.toMatch(/rawToken|ingest_token/);
    expect(FN).toContain('key_hash: await sha256Hex(token)');
  });
  it('gated den Boot-Key wie governance-keys ueber api.access', () => {
    expect(FN).toContain("hasFeature(ent, 'api.access')");
    expect(FN).toContain("'not_entitled:api.access'");
  });
});

describe('Migration — additiv und passend zur Engine', () => {
  it('enthaelt keine destruktiven Anweisungen', () => {
    expect(SQL).not.toMatch(/\b(DROP\s+(TABLE|COLUMN)|TRUNCATE|DELETE\s+FROM)\b/i);
  });
  it('verbietet leere Template-Bedingungen auch in der Datenbank', () => {
    expect(SQL).toContain("condition <> '{}'::jsonb");
  });
  it('seedet Vorlagen fuer beide Baseline-Packs', () => {
    for (const p of BASELINE_PACKS) expect(SQL).toContain(`'${p}', 1,`);
  });
  it('nutzt nur Event-Quellen, die governance_events erlaubt', () => {
    const allowed = ['website_scanner', 'browser_extension', 'sdk', 'api', 'github', 'ci_cd', 'manual', 'agent_runtime'];
    const m = SQL.match(/"event_source":\[([^\]]*)\]/);
    expect(m).not.toBeNull();
    for (const s of m![1].split(',').map((x) => x.replace(/"/g, ''))) expect(allowed).toContain(s);
  });
});

describe('governance-ingest — Connector-Verifikation', () => {
  it('setzt first_event_at genau einmal', () => {
    expect(INGEST).toMatch(/update\(\{ first_event_at: usedAt \}\)[\s\S]{0,80}\.is\('first_event_at', null\)/);
  });
});
