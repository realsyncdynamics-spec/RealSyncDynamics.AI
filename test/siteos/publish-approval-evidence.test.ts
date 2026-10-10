// O-WP6 — Governance-Kette am Publish: Request → Approval → Evidence.
//
// Akzeptanz aus dem Oktober-Plan:
//   1. Ein Publish ohne Approval ist nachweislich abgelehnt.
//   2. Jede Freigabe hat einen Evidence-Eintrag.
//
// (1) prüft die Kernregel an `evaluatePublishGate` und die Reihenfolge im
// Export-Handler: Die Ablehnung fällt, bevor GO-Evidence oder Audit
// geschrieben werden. (2) prüft den Approve-Handler: Der Custody-Eintrag
// entsteht vor der Freigabe und sperrt fail-closed.
//
// Grenze: Der Handler ist Deno-Code (jsr-Imports) und lässt sich in Vitest
// nicht laden. Die Handler-Teile sind deshalb Quelltext-Verträge wie in
// `publish-export-contract.test.ts`, keine Verhaltenstests.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  evaluatePublishGate,
  parseBrief,
  synthesizeBlueprint,
  type PublishGateInput,
} from '../../packages/siteos-core/src/index';

const ROOT = resolve(__dirname, '../..');
const handler = readFileSync(
  resolve(ROOT, 'supabase/functions/siteos/handlers/publish-gate.ts'),
  'utf8',
);

function section(startMarker: string, endMarker: string): string {
  const start = handler.indexOf(startMarker);
  const end = handler.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`section ${startMarker} not found`);
  return handler.slice(start, end);
}

const approveSrc = () => section('export async function handleApprove', 'export async function handleExport');
const exportSrc = () => section(
  'export async function handleExport',
  '// ─────────────────────────────────────────────────────────────────────\n// Auswertung',
);

const HASH = 'c'.repeat(64);

function needsApproval(over: Partial<PublishGateInput> = {}): PublishGateInput {
  return {
    // DSFA-indiziert (Art.-9-Bezug) → Freigabepflicht aus dem Profil.
    blueprint: synthesizeBlueprint(parseBrief('Zahnarztpraxis in Hamburg mit Terminbuchung.'), { model: null }),
    findings: [],
    artifactSha256: HASH,
    evidence: { snapshotWritten: true, custodyLinked: true },
    backend: { kind: 'greenfield' },
    approval: { grantedForArtifactSha256: null, grantedBy: null, reason: null },
    policyEngine: { engine: 'not_enforcing', reason: 'Test ohne Richtlinienpruefung' },
    evaluationId: 'eval-owp6',
    evaluatedAt: '2026-10-10T12:00:00.000Z',
    ...over,
  };
}

describe('O-WP6 (1) — Publish ohne Approval ist abgelehnt', () => {
  it('ein freigabepflichtiger Stand ohne Freigabe ist nicht veröffentlichbar', () => {
    const result = evaluatePublishGate(needsApproval());
    expect(result.human_approval_required).toBe(true);
    expect(result.publishable).toBe(false);
  });

  it('dieselbe Bewertung mit zugeordneter Freigabe ist veröffentlichbar', () => {
    const result = evaluatePublishGate(needsApproval({
      approval: { grantedForArtifactSha256: HASH, grantedBy: 'user-1', reason: 'DSFA liegt vor und ist geprüft.' },
    }));
    expect(result.publishable).toBe(true);
  });

  it('der Export lehnt ab, bevor GO-Evidence oder GO-Audit geschrieben werden', () => {
    const src = exportSrc();
    const reject = src.indexOf('if (!evaluation.publishable)');
    const custody = src.indexOf('appendCustodyEvent');
    const goAudit = src.indexOf("action: 'siteos.publish.go'");
    expect(reject).toBeGreaterThanOrEqual(0);
    expect(custody).toBeGreaterThan(reject);
    expect(goAudit).toBeGreaterThan(reject);
    expect(src).toContain("'NOT_PUBLISHABLE'");
    expect(src).toContain('Für diesen Stand steht eine Freigabe aus.');
  });
});

describe('O-WP6 (2) — jede Freigabe hat einen Evidence-Eintrag', () => {
  it('schreibt einen Custody-Eintrag, bevor die Freigabe gespeichert wird', () => {
    const src = approveSrc();
    const custody = src.indexOf('appendCustodyEvent');
    const update = src.indexOf('.update({ approved_by: ctx.userId');
    const audit = src.indexOf("action: 'siteos.publish.approve'");
    expect(custody).toBeGreaterThanOrEqual(0);
    expect(update).toBeGreaterThan(custody);
    expect(audit).toBeGreaterThan(update);
  });

  it('sperrt fail-closed, wenn der Nachweis nicht geschrieben werden kann', () => {
    const src = approveSrc();
    expect(src).toContain("'siteos_publish_approval_custody_failed'");
    expect(src).toContain("return jsonError(500, 'INTERNAL', 'approval could not be linked to custody evidence')");
  });

  it('liegt in derselben Kette und mit demselben Actor wie das GO', () => {
    const approve = approveSrc();
    const exp = exportSrc();
    const chain = 'assetRef: `siteos:artifact:${ctx.tenantId}:';
    const issuer = 'issuer: `tenant:${ctx.tenantId}`';
    expect(approve).toContain(chain);
    expect(exp).toContain(chain);
    // Die Provenance-Prüfung wertet einen Actor-Wechsel in der Kette als
    // strittige Eigentümerschaft — Freigabe und GO müssen gleich zeichnen.
    expect(approve).toContain(issuer);
    expect(exp).toContain(issuer);
    expect(approve).not.toContain('issuer: `user:');
    expect(approve).toContain("action: 'audited'");
    expect(approve).toContain('contentSha256: evaluation.artifact_sha256');
  });

  it('die freigebende Person bleibt in approved_by und im Audit-Log zugerechnet', () => {
    const src = approveSrc();
    expect(src).toContain('approved_by: ctx.userId');
    expect(src).toContain('actor_user_id: ctx.userId');
  });

  it('eine wiederholte Freigabe erzeugt keinen zweiten Nachweis', () => {
    const src = approveSrc();
    const alreadyApproved = src.indexOf('if (evaluation.approved_by)');
    const custody = src.indexOf('appendCustodyEvent');
    expect(alreadyApproved).toBeGreaterThanOrEqual(0);
    expect(custody).toBeGreaterThan(alreadyApproved);
    expect(src).toContain(".is('approved_by', null)");
    expect(src).toContain('updated.length === 0');
  });

  it('Freigabe bleibt auf berechtigte Rollen und eine Begründung beschränkt', () => {
    const src = approveSrc();
    const role = src.indexOf('APPROVER_ROLES.has(ctx.role)');
    const custody = src.indexOf('appendCustodyEvent');
    expect(role).toBeGreaterThanOrEqual(0);
    expect(custody).toBeGreaterThan(role);
    expect(src).toContain('reason.length < 10');
  });
});
