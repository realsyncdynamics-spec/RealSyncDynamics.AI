// @vitest-environment node
/**
 * Mitgliedschaftsprüfung vor Service-Role-Zugriff — drei Functions (P0.3).
 *
 * ## Befund (Audit main @ 11b5e4cf, 22.10.2026)
 *
 * - optimize-execute: tenantId und userId kamen aus dem Body, keine
 *   Mitgliedschaftsprüfung; jeder eingeloggte Nutzer konnte für einen fremden
 *   Mandanten Policies/Mitigations und Ausführungsprotokolle schreiben.
 * - governance-gap-analyzer: tenant_id aus dem Body, kein Auth-Check im Code;
 *   jeder JWT-Inhaber (auch der öffentliche Anon-Key) konnte compliance_gaps
 *   für beliebige Mandanten anlegen.
 * - share-dashboard: `jwtDecode` ohne Signaturprüfung, Mandant aus
 *   `user_metadata.tenant_id` (vom Nutzer selbst änderbar) → Service-Role-Query
 *   gegen fremde Dashboards.
 *
 * ## Was hier geprüft wird
 *
 * Quelltext-Verträge: jede Function nutzt den kanonischen Resolver aus
 * _shared/auth.ts, leitet den Mandanten nicht mehr aus unverifizierten
 * Quellen ab und hat die alten Lücken nicht mehr im Code. Das
 * Laufzeitverhalten von _shared/auth.ts ist aus Vitest nicht prüfbar
 * (jsr:-Import), siehe test/security/agents-run-canonical-auth.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fn = (name: string) =>
  readFileSync(resolve(__dirname, `../../supabase/functions/${name}/index.ts`), 'utf8');

describe('optimize-execute — Mandant und Nutzer aus verifiziertem JWT', () => {
  const src = fn('optimize-execute');

  it('prüft owner/admin-Mitgliedschaft über requireAuthAndTenant', () => {
    expect(src).toContain("from \"../_shared/auth.ts\"");
    expect(src).toMatch(/requireAuthAndTenant\(req, tenantId, \["owner", "admin"\]\)/);
    expect(src).toContain('if (auth instanceof Response) return auth;');
  });

  it('nimmt die Nutzer-ID aus dem JWT, nie aus dem Body', () => {
    expect(src).toContain('const userId = auth.user.id;');
    expect(src).not.toMatch(/const \{ recommendationId, tenantId, userId/);
  });

  it('führt nichts vor der Autorisierung aus', () => {
    const authIdx = src.indexOf('await requireAuthAndTenant(');
    const execIdx = src.indexOf('await executeOptimization(');
    expect(authIdx).toBeGreaterThan(0);
    expect(execIdx).toBeGreaterThan(authIdx);
  });
});

describe('governance-gap-analyzer — Service-Role oder owner/admin', () => {
  const src = fn('governance-gap-analyzer');

  it('verlangt Service-Role-Key oder owner/admin-Mitgliedschaft im tenant_id', () => {
    expect(src).toContain("from '../_shared/auth.ts'");
    expect(src).toContain('if (requireServiceRole(req) !== null) {');
    expect(src).toMatch(/requireAuthAndTenant\(req, body\.tenant_id, \['owner', 'admin'\]\)/);
    expect(src).toContain('if (auth instanceof Response) return auth;');
  });

  it('autorisiert, bevor der Service-Role-Client angelegt wird', () => {
    const authIdx = src.indexOf('await requireAuthAndTenant(');
    const adminIdx = src.indexOf('createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    expect(adminIdx).toBeGreaterThan(authIdx);
  });
});

describe('share-dashboard — verifiziertes JWT, Mandant aus der Ansicht', () => {
  const src = fn('share-dashboard');

  it('verwendet kein jwtDecode und kein user_metadata.tenant_id mehr', () => {
    expect(src).not.toContain('jwt-decode');
    expect(src).not.toContain('jwtDecode');
    expect(src).not.toContain('user_metadata');
  });

  it('verifiziert den Nutzer über requireUser und prüft die Mitgliedschaft im Mandanten der Ansicht', () => {
    expect(src).toContain("from '../_shared/auth.ts'");
    expect(src).toContain('const authCtx = await requireUser(req)');
    expect(src).toContain('if (authCtx instanceof Response) return withCors(authCtx)');
    expect(src).toContain('const tenantId: string | null = view?.tenant_id ?? null');
    expect(src).toMatch(/requireTenantMembership\(supabase, userId, tenantId\)/);
    expect(src).toMatch(/requireTenantMembership\(supabase, userId, tenantId, \['owner', 'admin'\]\)/);
  });

  it('legt keinen eigenen Service-Role-Client mehr an', () => {
    expect(src).not.toMatch(/createClient\(\s*Deno\.env\.get/);
    expect(src).toContain('const supabase = authCtx.admin');
  });
});
