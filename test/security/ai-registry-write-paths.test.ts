/**
 * KI-Register-Schreibpfade: Mandant nur aus geprüfter Quelle.
 *
 * ## Warum es diesen Test gibt
 *
 * - telemetry-ai-event nahm die rohe Mandanten-UUID aus `x-rsd-tenant-key`
 *   als „Schlüssel“. Wer eine UUID kannte, schrieb Laufzeitereignisse und —
 *   bei hohem Risiko oder Policy-Treffer — unlöschbare Einträge in die
 *   Evidence-Kette eines fremden Mandanten.
 * - enterprise-ai-os-discovery-intake lief ohne jede Prüfung (verify_jwt =
 *   false); `tenantId` und `actor` kamen aus dem Body und flossen in einen
 *   Service-Role-Client.
 * - ai_act_risk_inventory: Schreiben für jedes Mitglied direkt per PostgREST
 *   (Wirkung unter echten Rollen: test/runtime/db/ai-act-risk-inventory-rls.db.test.ts).
 *
 * ## Was dieser Test belegt — und was nicht
 *
 * Die Schlüssellogik ist in test/edge/ingest-key-auth.test.ts zur Laufzeit
 * geprüft. Die Handler importieren `jsr:`-Spezifier und laufen nicht unter
 * Vitest; hier wird am (kommentarfreien) Quelltext belegt, dass die Prüfung
 * benutzt wird, vor jeder Wirkung steht und der Mandant danach nur aus ihr
 * kommt.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const toml = readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8');

function codeOf(fn: string): string {
  return readFileSync(resolve(ROOT, `supabase/functions/${fn}/index.ts`), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function stanza(fn: string): string | null {
  const kopf = `[functions.${fn}]`;
  const start = toml.indexOf(kopf);
  if (start === -1) return null;
  const rest = toml.slice(start + kopf.length);
  const next = rest.search(/\n\[/);
  return rest.slice(0, next === -1 ? rest.length : next);
}

/** Position von `needle`; belegt zuerst, dass es sie gibt (sonst wäre jede Reihenfolge leer wahr). */
function at(code: string, needle: string): number {
  const i = code.indexOf(needle);
  expect(i, `nicht gefunden: ${needle}`).toBeGreaterThan(-1);
  return i;
}

describe('telemetry-ai-event: Ingest-Schlüssel statt Mandanten-UUID', () => {
  const code = codeOf('telemetry-ai-event');

  it('bleibt öffentlich erreichbar (SDK/Konnektoren), prüft aber selbst', () => {
    expect(stanza('telemetry-ai-event')).toMatch(/verify_jwt\s*=\s*false/);
    expect(code).toContain("from '../_shared/ingestKeyAuth.ts'");
    expect(code).toContain('await authenticateIngestKey(');
  });

  it('nimmt die UUID aus dem Header nicht mehr als Mandanten', () => {
    expect(code).not.toMatch(/tenantKey\.match\(/);
    expect(code).not.toMatch(/headers\.get\(\s*['"]x-rsd-tenant-key['"]\s*\)/);
    expect(code).toContain('const tenantId = auth.tenantId');
  });

  it('prüft vor dem Lesen des Bodys und vor jedem Schreiben', () => {
    const pruefung = at(code, 'await authenticateIngestKey(');
    const ablehnung = at(code, 'if (!auth.ok) return');
    expect(ablehnung).toBeGreaterThan(pruefung);
    expect(at(code, 'await readCappedText(req, MAX_BODY_BYTES)')).toBeGreaterThan(ablehnung);
    expect(code).not.toContain('await req.text()');
    expect(at(code, ".from('ai_runtime_events')")).toBeGreaterThan(ablehnung);
    expect(at(code, ".from('ai_evidence_events')")).toBeGreaterThan(ablehnung);
    expect(at(code, ".from('ai_policies')")).toBeGreaterThan(ablehnung);
  });

  it('System- und Policy-Verweise werden vor dem Schreiben dem Mandanten zugeordnet', () => {
    const refs = at(code, 'if (refError) return');
    expect(code).toMatch(/checkTenantRef\(p\.ai_system_id,/);
    expect(code).toMatch(/checkTenantRef\(p\.policy_id,/);
    expect(at(code, ".from('ai_runtime_events')")).toBeGreaterThan(refs);
    expect(at(code, ".from('ai_evidence_events')")).toBeGreaterThan(refs);
  });

  it('Client-Metadaten überschreiben im Nachweis keine Pflichtfelder', () => {
    expect(code).not.toContain('...p.metadata');
    expect(code).toContain('reported_metadata: p.metadata ?? {}');
  });

  it('gibt keine Datenbankmeldung an den Aufrufer', () => {
    expect(code).not.toMatch(/insertErr\?\.message/);
  });
});

describe('enterprise-ai-os-discovery-intake: kanonischer Resolver mit Schreibrolle', () => {
  const FN = 'enterprise-ai-os-discovery-intake';
  const code = codeOf(FN);

  it('Absicht in config.toml dokumentiert — die Prüfung liegt im Handler, nicht im Plattform-Gate', () => {
    // verify_jwt bleibt false wie deployt (Drift-Guard: live false ≠ Repo true
    // wäre rot bis zum Deploy); das Gate ließe den Anon-Key ohnehin durch.
    expect(stanza(FN)).not.toBeNull();
    expect(toml).toContain('enterprise-ai-os-discovery-intake: braucht eine echte Nutzersitzung');
    expect(toml).toContain('requireAuthAndTenant aus\n# _shared/auth.ts');
  });

  it('genau ein Resolver, kein eigener Service-Role-Client, keine eigene Mitgliedsabfrage', () => {
    expect(code).toContain("import { requireAuthAndTenant } from '../_shared/auth.ts'");
    expect(code).toMatch(/await requireAuthAndTenant\(req, body\?\.tenantId, WRITER_ROLES\)/);
    expect(code).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(code).not.toMatch(/\bcreateClient\(/);
    expect(code).not.toMatch(/from\(\s*['"]memberships['"]\s*\)/);
    expect(existsSync(resolve(ROOT, `supabase/functions/${FN}/auth.ts`))).toBe(false);
  });

  it('nur schreibende Rollen — nicht viewer_auditor', () => {
    const m = code.match(/const WRITER_ROLES = \[([^\]]*)\]/);
    expect(m, 'WRITER_ROLES fehlt').not.toBeNull();
    const roles = m![1]!.split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean).sort();
    expect(roles).toEqual(['admin', 'dpo', 'editor', 'owner']);
  });

  it('Autorisierung vor jeder Wirkung; danach Mandant und Actor nur aus ihr', () => {
    const ablehnung = at(code, 'if (auth instanceof Response) return auth');
    const handler = at(code, 'Deno.serve(');
    expect(ablehnung).toBeGreaterThan(handler);
    const erstesSchreiben = at(code, ".from('enterprise_ai_system_registry')");
    expect(erstesSchreiben).toBeGreaterThan(ablehnung);
    expect(code).toContain('const tenantId = auth.tenantId');
    expect(code).toContain('const sb = auth.admin');
    expect(code).toContain('const actor = `user:${auth.user.id}`');
    expect(code).not.toMatch(/body\.actor/);
    expect(code).not.toMatch(/tenant_id:\s*tenantId\s*\?\?\s*null/);
  });

  it('gibt keine Datenbankmeldung an den Aufrufer', () => {
    expect(code).not.toMatch(/regErr\.message/);
  });
});

describe('ai-act-risk-inventory: Ändern nur mit schreibender Rolle', () => {
  const code = codeOf('ai-act-risk-inventory');

  it('liest die Rolle und sperrt create/update/delete für Leserollen', () => {
    expect(code).toMatch(/\.from\('memberships'\)\s*\.select\('role'\)/);
    expect(code).toMatch(/new Set\(\['owner', 'admin', 'dpo', 'editor'\]\)/);
    const sperre = at(code, 'if (mutating && !WRITER_ROLES.has(');
    expect(at(code, "case 'create': return await opCreate(")).toBeGreaterThan(sperre);
  });

  it('die Migration entzieht Mitgliedern das direkte Schreiben', () => {
    const sql = readFileSync(
      resolve(ROOT, 'supabase/migrations/20261005120000_ai_act_risk_inventory_writes_via_function.sql'),
      'utf8',
    );
    for (const op of ['insert', 'update', 'delete']) {
      expect(sql).toContain(`DROP POLICY IF EXISTS "ai_act_risk_inventory tenant-${op}"`);
      expect(sql).not.toMatch(new RegExp(`CREATE POLICY "ai_act_risk_inventory tenant-${op}"`));
    }
  });
});
