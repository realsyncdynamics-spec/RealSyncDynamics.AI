// Baustein A (G2, 25.10.2026) — Quelltext-Verträge für die Handler.
//
// Grenze wie in `publish-approval-evidence.test.ts`: Die Handler sind
// Deno-Code (jsr-Imports) und lassen sich in Vitest nicht laden. Geprüft
// wird deshalb die Reihenfolge im Quelltext; das Verhalten der Regel prüft
// `approval-policy.test.ts`, die Durchsetzung in der Datenbank
// `test/runtime/db/siteos-four-eyes.db.test.ts`.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

const agents = read('supabase/functions/siteos/handlers/agents.ts');
const publishGate = read('supabase/functions/siteos/handlers/publish-gate.ts');
const migration = read('supabase/migrations/20261025100000_siteos_four_eyes_approval.sql');

function between(src: string, start: string, end: string): string {
  const s = src.indexOf(start);
  const e = src.indexOf(end, s + start.length);
  if (s < 0 || e < 0) throw new Error(`section ${start} not found`);
  return src.slice(s, e);
}

describe('SiteOS / Schreibpfade verlangen eine Bearbeiter-Rolle', () => {
  for (const file of ['builder.ts', 'edit.ts', 'anonymous.ts']) {
    it(`${file}: canEditSite nach der Mitgliedschaft, vor jedem Schreiben`, () => {
      const src = read(`supabase/functions/siteos/handlers/${file}`);
      const member = src.indexOf("from('memberships').select('role')");
      const check = src.indexOf('canEditSite(member.role)');
      expect(member).toBeGreaterThanOrEqual(0);
      expect(check).toBeGreaterThan(member);
      const firstWrite = Math.min(
        ...['persistBlueprintVersion(', ".from('siteos_blueprints')"]
          .map((m) => src.indexOf(m, check))
          .filter((i) => i >= 0),
      );
      expect(firstWrite).toBeGreaterThan(check);
    });
  }
});

describe('SiteOS / Agentenlauf-Freigabe', () => {
  const approve = () => between(agents, "if (op === 'approve')", '// ── op === \'run\'');

  it('prüft Rolle und Vier-Augen vor dem Update', () => {
    const src = approve();
    const role = src.indexOf('SITE_APPROVER_ROLES.has(member.role)');
    const check = src.indexOf('checkApproval(');
    const update = src.indexOf('.update(');
    expect(role).toBeGreaterThanOrEqual(0);
    expect(check).toBeGreaterThan(role);
    expect(update).toBeGreaterThan(check);
    expect(src).toContain('authorId: run.requested_by');
  });

  it('schreibt approved_by aus dem JWT, nie aus dem Body', () => {
    const src = approve();
    expect(src).toContain('approved_by: userId');
    expect(src).not.toMatch(/approved_by:\s*body/);
    expect(src).toContain('self_approval: check.selfApproval');
  });
});

describe('SiteOS / Publish-Freigabe', () => {
  const approve = () => between(publishGate, 'export async function handleApprove', 'export async function handleExport');

  it('Vier-Augen-Prüfung gegen den Autor, vor Anspruch und Nachweis', () => {
    const src = approve();
    const check = src.indexOf('checkApproval(');
    const claim = src.indexOf('approval_claimed_at: nowIso');
    const custody = src.indexOf('appendCustodyEvent');
    expect(src).toContain('authorId: blueprint.created_by');
    expect(check).toBeGreaterThanOrEqual(0);
    expect(claim).toBeGreaterThan(check);
    expect(custody).toBeGreaterThan(check);
    expect(src).toContain('self_approval: fourEyes.selfApproval');
  });
});

describe('SiteOS / Agentenläufe tragen ihren Auslöser', () => {
  it('persist.ts und runtime-scan.ts setzen requested_by beim Einreihen', () => {
    expect(read('supabase/functions/siteos/persist.ts')).toContain('requested_by: input.userId');
    expect(read('supabase/functions/siteos/handlers/runtime-scan.ts')).toContain('requested_by: userId');
  });
});

describe('SiteOS / Migration 20261025100000', () => {
  it('ist additiv: keine DROP TABLE/COLUMN, keine Typänderung, keine Datenänderung', () => {
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).not.toMatch(/ALTER\s+COLUMN/i);
    expect(migration).not.toMatch(/^\s*(UPDATE|DELETE)\s/im);
    expect(migration).not.toMatch(/CREATE\s+POLICY|DROP\s+POLICY/i);
  });

  it('erzwingt die Regel per Trigger an beiden Tabellen', () => {
    expect(migration).toContain('BEFORE UPDATE ON public.siteos_publish_evaluations');
    expect(migration).toContain('BEFORE UPDATE ON public.siteos_agent_runs');
    expect(migration).toContain("role IN ('owner', 'admin', 'dpo')");
  });
});
