// AI-OS-Register gegen das Repository: Skill-Dateien, Workflow-Dateien und
// deren Rechte, Grenzen und Auslöser stimmen mit dem Register überein.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AGENTS, ROUTINES, SKILLS, TOOL_ACTIONS, validateRegistry } from '../../packages/ai-os-core/src/index';

const ROOT = join(__dirname, '..', '..');
const exists = (p: string) => existsSync(join(ROOT, p));
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/** Liest den Top-Level-Block `permissions:` einer Workflow-Datei. */
function workflowPermissions(yaml: string): Record<string, string> {
  const lines = yaml.split('\n');
  const start = lines.findIndex((l) => /^permissions:\s*$/.test(l));
  if (start < 0) return {};
  const out: Record<string, string> = {};
  for (const line of lines.slice(start + 1)) {
    if (!/^\s+/.test(line) || line.trim() === '') break;
    const m = /^\s+([a-z-]+):\s*(read|write|none)\s*$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

describe('validateRegistry', () => {
  it('meldet keine Fehler gegen das Repository', () => {
    expect(validateRegistry(exists)).toEqual([]);
  });

  it('findet fehlende Dateien', () => {
    const errors = validateRegistry(() => false);
    expect(errors.some((e) => e.includes('SKILL.md fehlt'))).toBe(true);
    expect(errors.some((e) => e.includes('Workflow'))).toBe(true);
  });
});

describe('Skills', () => {
  it('umfasst die zehn beauftragten Skills', () => {
    expect(SKILLS.map((s) => s.name)).toEqual([
      'GitHub PR Review',
      'CI Failure Analysis',
      'Code Quality Audit',
      'Security Audit',
      'Compliance Feature Verification',
      'Dashboard Quality Review',
      'Business Report Generation',
      'Documentation Update',
      'Release Readiness Check',
      'Knowledge Base Update',
    ]);
  });

  it.each(SKILLS.map((s) => [s.id, s.skillFile]))('%s hat eine SKILL.md mit passendem Namen', (id, file) => {
    const text = read(file);
    expect(text).toMatch(new RegExp(`^---\\nname: ${id}\\ndescription: .+\\n---`, 'm'));
    expect(text).toMatch(/## Eingaben/);
    expect(text).toMatch(/## Ausgaben/);
    expect(text).toMatch(/## Qualität/);
  });
});

describe('Routinen-Workflows', () => {
  it.each(ROUTINES.map((r) => [r.id, r]))('%s: Datei, Rechte, Grenzen, Auslöser', (_id, r) => {
    const file = `.github/workflows/${r.workflowFile}`;
    const yaml = read(file);
    expect(workflowPermissions(yaml)).toEqual(r.permissions);
    expect(yaml).toMatch(new RegExp(`timeout-minutes: ${r.limits.timeoutMinutes}\\b`));
    expect(yaml).toMatch(/^concurrency:/m);
    expect(yaml).toMatch(/^\s+workflow_dispatch:/m);
    expect(yaml).toContain(`node scripts/ai-os/routine.mjs ${r.command}`);
    expect(yaml).toContain(`retention-days: ${r.limits.artifactRetentionDays}`);
    expect(yaml).toContain('persist-credentials: false');
    for (const t of r.triggers) {
      if (t.kind === 'schedule') expect(yaml).toContain(`cron: '${t.cron}'`);
    }
    // Kein Modell-Key, kein fremdes Secret in Routinen.
    const secrets = [...yaml.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]);
    expect(secrets.every((s) => s === 'GITHUB_TOKEN')).toBe(true);
  });

  it('der Routine-Runner kennt jeden Befehl aus dem Register', () => {
    const runner = read('scripts/ai-os/routine.mjs');
    for (const r of ROUTINES) expect(runner).toContain(`'${r.command}': '${r.id}'`);
  });
});

describe('Agenten', () => {
  it('umfasst die fünf beauftragten Agenten', () => {
    expect(AGENTS.map((a) => a.id)).toEqual(['development', 'compliance', 'infrastructure', 'business-ops', 'knowledge']);
  });

  it('kein Agent darf eine kritische Aktion auslösen', () => {
    const critical = new Set(TOOL_ACTIONS.filter((a) => a.class === 'critical').map((a) => a.id));
    for (const a of AGENTS) for (const id of a.allowedActions) expect(critical.has(id), `${a.id} → ${id}`).toBe(false);
  });

  it('Secrets erscheinen nur als Name, nie als Wert', () => {
    const json = JSON.stringify(TOOL_ACTIONS);
    expect(json).not.toMatch(/ghp_|github_pat_|sk_live_|sk-ant-|eyJ[A-Za-z0-9_-]{10,}\./);
  });
});

describe('Edge Function ai-os-control', () => {
  it('ist mit verify_jwt = true deklariert', () => {
    expect(read('supabase/config.toml')).toMatch(/\[functions\.ai-os-control\]\nverify_jwt = true/);
  });

  it('protokolliert Schreibaktionen vor der Ausführung (fail-closed)', () => {
    const src = read('supabase/functions/ai-os-control/index.ts');
    const logIdx = src.indexOf("phase: 'requested'");
    const runIdx = src.indexOf('await spec.run(ctx)');
    expect(logIdx).toBeGreaterThan(0);
    expect(runIdx).toBeGreaterThan(logIdx);
    expect(src).toContain("'audit_unavailable'");
  });

  it('prüft die Rolle über is_platform_operator() mit dem Nutzer-Client', () => {
    const src = read('supabase/functions/ai-os-control/index.ts');
    expect(src).toContain("user.rpc('is_platform_operator')");
    expect(src).not.toMatch(/admin\.rpc\('is_platform_operator'\)/);
  });

  it('jede Operation verweist auf eine registrierte Aktion', () => {
    const ops = read('supabase/functions/ai-os-control/ops.ts');
    const ids = [...ops.matchAll(/actionId: '([a-z.]+)'/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(5);
    const known = new Set(TOOL_ACTIONS.map((a) => a.id));
    for (const id of ids) expect(known.has(id), id).toBe(true);
  });
});

describe('Migration ai_os_action_log', () => {
  const sql = read('supabase/migrations/20261029092000_ai_os_action_log.sql');
  it('ist rein additiv', () => {
    expect(sql).not.toMatch(/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\b|\bALTER\s+TABLE\s+\S+\s+DROP\b/i);
  });
  it('liest nur über is_platform_operator() und blockiert UPDATE/DELETE', () => {
    expect(sql).toContain('USING ((SELECT public.is_platform_operator()))');
    expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON public\.ai_os_action_log/);
    expect(sql).toMatch(/REVOKE ALL ON public\.ai_os_action_log FROM PUBLIC, anon, authenticated/);
  });
});
