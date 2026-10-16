// O-WP9 — Publish-Rollback: Production zurück auf den vorherigen Live-Stand.
//
// Grenze wie in `cloudflare-production-contract.test.ts`: Handler und
// Transport sind Deno-Code (jsr-/npm-Imports) und lassen sich in Vitest nicht
// laden. Die Prüfungen sind Quelltext-Verträge, keine Verhaltenstests.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

const handler = read('supabase/functions/siteos/handlers/publish-rollback.ts');
const production = read('supabase/functions/siteos/handlers/publish-production.ts');
const transport = read('supabase/functions/siteos/cloudflare-pages.ts');
const router = read('supabase/functions/siteos/index.ts');
const api = read('src/features/siteos/siteOsApi.ts');

describe('O-WP9 — Publish-Rollback', () => {
  it('ist als eigener Endpunkt im SiteOS-Router erreichbar', () => {
    expect(router).toContain("import { handle as publishRollback } from './handlers/publish-rollback.ts'");
    expect(router).toContain("'publish-rollback': publishRollback");
    expect(api).toContain("sb.functions.invoke('siteos/publish-rollback'");
  });

  it('verlangt Owner/Admin, ausdrückliche Bestätigung und eine Begründung', () => {
    expect(handler).toContain("const PUBLISHER_ROLES = new Set(['owner', 'admin'])");
    expect(handler).toContain('body.confirm_rollback !== true');
    expect(handler).toContain('reason.length < MIN_REASON_LENGTH');
    const role = handler.indexOf('PUBLISHER_ROLES.has(member.role)');
    const transportCall = handler.indexOf('await rollbackPagesDeployment({');
    expect(role).toBeGreaterThanOrEqual(0);
    expect(transportCall).toBeGreaterThan(role);
  });

  it('das Ziel bestimmt der Server, nie der Browser', () => {
    expect(handler).not.toContain('body.deployment_id');
    expect(handler).not.toContain('body.project_id');
    expect(handler).not.toContain('body.artifact_sha256');
    expect(handler).not.toContain('body.files');
    expect(handler).toContain('readProductionState(configuration.siteos_previous_production)');
  });

  it('prüft das Ziel bei Cloudflare, bevor zurückgesetzt wird', () => {
    const missing = handler.indexOf("'ROLLBACK_TARGET_REQUIRED'");
    const remoteProject = handler.indexOf('getPagesProject({');
    const remoteTarget = handler.indexOf('getPagesDeployment({');
    const startAudit = handler.indexOf("action: 'siteos.publish.rollback.start'");
    const transportCall = handler.indexOf('await rollbackPagesDeployment({');
    expect(missing).toBeGreaterThanOrEqual(0);
    expect(remoteProject).toBeGreaterThan(missing);
    expect(remoteTarget).toBeGreaterThan(remoteProject);
    expect(startAudit).toBeGreaterThan(remoteTarget);
    expect(transportCall).toBeGreaterThan(startAudit);
    expect(handler).toContain("remoteTarget.environment !== 'production'");
    expect(handler).toContain("'ROLLBACK_TARGET_MISSING'");
  });

  it('protokolliert Erfolg und Fehlschlag in Audit-Log und Deployment-Log', () => {
    expect(handler).toContain("action: 'siteos.publish.rollback.completed'");
    expect(handler).toContain("action: 'siteos.publish.rollback.failed'");
    expect(handler).toContain('rollback: true');
    expect(handler).toContain('to_evaluation_id: target.evaluation_id');
    expect(handler).toContain('from_deployment_id: current.deployment_id');
  });

  it('tauscht aktuellen und vorherigen Stand nur ohne zwischenzeitliche Änderung', () => {
    expect(handler).toContain('nextConfiguration.siteos_previous_production = current');
    expect(handler).toContain("projectUpdate.eq('last_deployed_at', project.last_deployed_at)");
    expect(handler).toContain("'ROLLBACK_STATE_CONFLICT");
  });

  it('kennt weder Domain/DNS noch einen neuen Publish-GO', () => {
    expect(handler).not.toMatch(/\/domains|dns_records|custom_domain/);
    expect(handler).not.toContain('handleExport');
    expect(handler).not.toContain("action: 'siteos.publish.go'");
  });

  it('Production hält den vorherigen Live-Stand als Rollback-Ziel fest', () => {
    const keep = production.indexOf('nextConfiguration.siteos_previous_production = configuration.siteos_last_production');
    const overwrite = production.indexOf('nextConfiguration.siteos_last_production = {');
    expect(keep).toBeGreaterThanOrEqual(0);
    expect(overwrite).toBeGreaterThan(keep);
  });

  it('der Transport nutzt Cloudflares Rollback und verlangt Production', () => {
    expect(transport).toContain('export async function rollbackPagesDeployment(');
    expect(transport).toContain('/deployments/${encodeURIComponent(args.deploymentId)}/rollback`');
    expect(transport).toContain("'Cloudflare did not confirm the rollback as production'");
  });
});
