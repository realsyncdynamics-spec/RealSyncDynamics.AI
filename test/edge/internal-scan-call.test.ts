/**
 * Gate 2 — interner Scan-Aufruf tenant-audit → gdpr-audit.
 *
 * Vorher: tenant-audit rief gdpr-audit wie ein anonymer Besucher auf. Das
 * IP-Rate-Limit (5/ip_hash/Stunde) traf die Egress-IP der Edge-Runtime —
 * ein Topf für ALLE Mandanten — und jeder Mandanten-Scan legte mit der
 * E-Mail des Nutzers eine sales_leads-Zeile an.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  INTERNAL_CALLER_HEADER,
  TENANT_AUDIT_CALLER,
  internalScanHeaders,
  isTrustedInternalScanCall,
  TENANT_SCAN_LIMIT_PER_HOUR,
} from '../../supabase/functions/_shared/internal-scan-call';

const KEY = 'service-role-key-for-tests-0123456789';

describe('isTrustedInternalScanCall', () => {
  it('Header aus internalScanHeaders ⇒ vertrauenswürdig', async () => {
    expect(await isTrustedInternalScanCall(new Headers(internalScanHeaders(KEY)), KEY)).toBe(true);
  });

  it('falscher Key ⇒ nicht vertrauenswürdig', async () => {
    const h = new Headers(internalScanHeaders('another-key'));
    expect(await isTrustedInternalScanCall(h, KEY)).toBe(false);
  });

  it('richtiger Key ohne Caller-Header ⇒ nicht vertrauenswürdig', async () => {
    const h = new Headers({ Authorization: `Bearer ${KEY}` });
    expect(await isTrustedInternalScanCall(h, KEY)).toBe(false);
  });

  it('Caller-Header ohne Key (öffentlicher Aufrufer) ⇒ nicht vertrauenswürdig', async () => {
    const h = new Headers({ [INTERNAL_CALLER_HEADER]: TENANT_AUDIT_CALLER });
    expect(await isTrustedInternalScanCall(h, KEY)).toBe(false);
  });

  it('fehlender Key in der Env ⇒ nie vertrauenswürdig, auch nicht bei leerem Bearer', async () => {
    const h = new Headers({ Authorization: 'Bearer ', [INTERNAL_CALLER_HEADER]: TENANT_AUDIT_CALLER });
    expect(await isTrustedInternalScanCall(h, undefined)).toBe(false);
    expect(await isTrustedInternalScanCall(h, '')).toBe(false);
  });
});

describe('gdpr-audit: Mandanten-Scan ohne IP-Limit und ohne Lead', () => {
  const src = readFileSync('supabase/functions/gdpr-audit/index.ts', 'utf8');

  it('erkennt den internen Aufruf nur über Header + Service-Role-Key, nicht über body.source', () => {
    expect(src).toContain('const isTenantScan = await isTrustedInternalScanCall(req.headers, SRK);');
    expect(src).not.toMatch(/isTenantScan\s*=\s*body\.source/);
  });

  it('IP-Rate-Limit gilt nur für öffentliche Aufrufer', () => {
    expect(src).toMatch(/if \(!isTenantScan\) \{\s*const oneHourAgo[\s\S]*?RATE_LIMITED/);
  });

  it('keine sales_leads-Zeile und keine E-Mail für Mandanten-Scans', () => {
    expect(src).toContain('if (!isOptimizerScan && !isTenantScan) {');
    expect(src).toContain("const email = isTenantScan ? '' : ");
  });
});

describe('tenant-audit: interner Aufruf + Limit pro Mandant', () => {
  const src = readFileSync('supabase/functions/tenant-audit/index.ts', 'utf8');

  it('ruft gdpr-audit mit internalScanHeaders und ohne Nutzer-E-Mail auf', () => {
    expect(src).toContain('headers: internalScanHeaders(SRK)');
    expect(src).not.toContain('userResult.user.email');
    expect(src).not.toContain('no-email@tenant-audit');
  });

  it('begrenzt Scans pro Mandant und Stunde, fail-closed bei Zählfehler', () => {
    expect(src).toMatch(/from\('scan_runs'\)[\s\S]*?\.eq\('tenant_id', tenantId\)[\s\S]*?gte\('created_at', oneHourAgo\)/);
    expect(src).toContain("if (countErr) return jsonError(500, 'INTERNAL', countErr.message);");
    expect(src).toContain('>= TENANT_SCAN_LIMIT_PER_HOUR');
  });

  it('das Limit greift vor dem Pipeline-Start', () => {
    expect(src.indexOf('TENANT_SCAN_LIMIT_PER_HOUR)')).toBeLessThan(src.indexOf('runTenantAuditPipeline({'));
  });

  it('Trigger-Abweisung paralleler Anfragen wird als 429 gemeldet, nicht als 500', () => {
    expect(src).toMatch(/result\.code === 'PIPELINE_START_FAILED' && result\.message\.includes\('TENANT_SCAN_LIMIT_EXCEEDED'\)\)\s*\{\s*return jsonError\(429, 'RATE_LIMITED'/);
  });

  it('das verbindliche Limit liegt atomar in der Datenbank und entspricht der Konstante', () => {
    const sql = readFileSync('supabase/migrations/20260928181700_tenant_audit_scan_quota.sql', 'utf8');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toMatch(/BEFORE INSERT ON public\.scan_runs/);
    expect(sql).toContain(`v_limit CONSTANT integer := ${TENANT_SCAN_LIMIT_PER_HOUR};`);
  });
});
