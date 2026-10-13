/**
 * siteos Rebuild-Workflow: Autorisierung vor Wirkung (Quelltext-Vertrag).
 *
 * ## Warum (auch) am Quelltext
 *
 * Das Verhalten der Handler prüft `test/edge/siteos-rebuild-handlers.test.ts`
 * mit gestelltem Resolver. Was dort nicht zu sehen ist: dass in Produktion
 * genau der kanonische Resolver (`_shared/auth.ts`, importiert
 * `jsr:@supabase/supabase-js` und ist in Vitest nicht ladbar) eingesetzt
 * wird. Das und die Reihenfolge im Code stehen hier fest:
 *
 *   • Die Verdrahtung (`rebuild-deps.ts`) setzt den kanonischen Resolver
 *     und die SiteOS-Plan-Schranken ein; der Router bindet jeden
 *     Rebuild-Pfad daran.
 *   • Jeder Rebuild-Pfad löst Mandant und Rolle über diesen Resolver auf —
 *     **bevor** er fremde Adressen abruft (Kosten, SSRF), Läufe liest,
 *     Nachweise oder Versionen schreibt.
 *   • Danach wird der Mandant aus der Auflösung benutzt, nie mehr aus dem
 *     Body. Eine Adresse aus der Anfrage ist nie Autorität für Mandant oder
 *     Richtlinie.
 *   • Die Rollen sind so eng wie die Wirkung.
 *   • Die Bindung an den Lauf kommt aus dem Blueprint (`origin.rebuild`),
 *     mandantengebunden geladen und gegen den Snapshot-Hash geprüft.
 *   • Der Abruf folgt Weiterleitungen von Hand, prüft jeden Schritt und ruft
 *     nur ab, was nachweislich öffentlich auflöst (fail-closed).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
const read = (path: string) => strip(readFileSync(resolve(ROOT, path), 'utf8'));

const rebuild = read('supabase/functions/siteos/handlers/rebuild.ts');
const wiring = read('supabase/functions/siteos/rebuild-deps.ts');
const router = read('supabase/functions/siteos/index.ts');
const fetcher = read('supabase/functions/siteos/rebuild-fetch.ts');
const context = read('supabase/functions/siteos/rebuild-context.ts');
const evidence = read('supabase/functions/siteos/evidence.ts');

function body(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  expect(start, `${name} nicht gefunden`).toBeGreaterThan(-1);
  const next = source.indexOf('\nexport async function ', start + 10);
  return source.slice(start, next === -1 ? undefined : next);
}

const HANDLERS: [string, string[]][] = [
  ['handleAnalyze', ['gateSiteEdit(', "from('governance_admin_log')", 'crawlSite(', 'appendSiteosEvidence(', "from('siteos_rebuild_runs')"]],
  ['handleSelect', ['gateSiteEdit(', "from('siteos_rebuild_runs')", "from('siteos_blueprints')", 'gateSiteCreate(', 'persistBlueprintVersion(']],
  ['handleRefine', ['gateSiteEdit(', "from('siteos_blueprints')", 'persistBlueprintVersion(']],
  ['handleStatus', ["from('siteos_blueprints')", 'resolveRebuildContext(', "from('connector_registry')"]],
];

describe('Rebuild — Autorisierung vor Wirkung', () => {
  it('setzt in Produktion den kanonischen Resolver und die Plan-Schranken ein', () => {
    expect(wiring).toContain("import { requireAuthAndTenant } from '../_shared/auth.ts';");
    expect(wiring).toContain("import { gateSiteCreate, gateSiteEdit } from './site-entitlements.ts';");
    expect(wiring).toContain('Object.freeze({ requireAuthAndTenant, gateSiteEdit, gateSiteCreate })');
    for (const [route, handler] of [
      ['rebuild-analyze', 'rebuildAnalyze'], ['rebuild-select', 'rebuildSelect'],
      ['rebuild-refine', 'rebuildRefine'], ['rebuild-status', 'rebuildStatus'],
    ]) {
      expect(router).toContain(`'${route}': (req) => ${handler}(req, REBUILD_DEPS),`);
    }
    expect(router).toContain("import { REBUILD_DEPS } from './rebuild-deps.ts';");
  });

  it('prüft selbst keine Mitgliedschaft und baut keinen eigenen Service-Role-Client', () => {
    expect(rebuild).not.toContain('_shared/auth.ts\'');
    expect(rebuild).not.toContain("from('memberships')");
    expect(rebuild).not.toContain('createClient(');
    expect(rebuild).not.toContain('Deno.env');
  });

  it.each(HANDLERS)('%s prüft Mandant und Rolle vor jedem Zugriff', (name, effects) => {
    const fn = body(rebuild, name);
    const authAt = fn.indexOf('await deps.requireAuthAndTenant(req, stringOrNull(body.tenant_id)');
    expect(authAt, 'Resolver-Aufruf fehlt').toBeGreaterThan(-1);
    expect(fn).toContain('if (auth instanceof Response) return auth;');
    for (const effect of effects) {
      const at = fn.indexOf(effect);
      expect(at, `${effect} fehlt`).toBeGreaterThan(-1);
      expect(at, `${effect} steht vor der Autorisierung`).toBeGreaterThan(authAt);
    }
    // Nach der Auflösung zählt nur noch der geprüfte Mandant.
    const afterAuth = fn.slice(authAt + 60);
    expect(afterAuth).not.toMatch(/body\.tenant_id/);
    expect(fn).toMatch(/const \{ admin, tenantId(, user)? \} = auth;/);
  });

  it('hält die Rollen so eng wie die Wirkung', () => {
    expect(rebuild).toContain("const ANALYZE_ROLES = ['owner', 'admin', 'editor', 'dpo'];");
    expect(rebuild).toContain("const WRITE_ROLES = ['owner', 'admin', 'editor'];");
    expect(body(rebuild, 'handleAnalyze')).toContain('ANALYZE_ROLES)');
    expect(body(rebuild, 'handleSelect')).toContain('WRITE_ROLES)');
    expect(body(rebuild, 'handleRefine')).toContain('WRITE_ROLES)');
    // Lesen: jedes Mitglied — ohne Rollenliste, aber mit Mitgliedschaft.
    expect(body(rebuild, 'handleStatus')).toContain('await deps.requireAuthAndTenant(req, stringOrNull(body.tenant_id));');
  });

  it('zählt Versuche für die Kostenbremse und protokolliert jeden Abruf vorher', () => {
    const fn = body(rebuild, 'handleAnalyze');
    const countAt = fn.indexOf(".from('governance_admin_log').select('id', { count: 'exact', head: true })");
    const attemptAt = fn.indexOf('action: ATTEMPT_ACTION');
    const crawlAt = fn.indexOf('crawlSite(');
    expect(countAt).toBeGreaterThan(-1);
    expect(attemptAt).toBeGreaterThan(countAt);
    expect(crawlAt).toBeGreaterThan(attemptAt);
    expect(fn).toContain('if (!attempt.ok) return jsonError(503');
    expect(fn).toContain('if (countError) return jsonError(503');
  });

  it('prüft die Adresse vor dem Abruf gegen die SSRF-Schranke des Kerns', () => {
    const fn = body(rebuild, 'handleAnalyze');
    expect(fn.indexOf('isPublicHttpUrl(start)')).toBeGreaterThan(-1);
    expect(fn.indexOf('isPublicHttpUrl(start)')).toBeLessThan(fn.indexOf('crawlSite('));
  });

  it('bindet die Richtungen an den Lauf (Kennung + Snapshot-Hash)', () => {
    const fn = body(rebuild, 'handleAnalyze');
    expect(fn.indexOf('const runId = crypto.randomUUID();')).toBeLessThan(fn.indexOf('buildDirections('));
    expect(fn).toContain('buildDirections(snapshot, positioning, assessment, { createdAt: nowIso, run: { id: runId, snapshotSha256 } })');
  });

  it('schreibt den Lauf erst nach dem Nachweis (fail-closed)', () => {
    const fn = body(rebuild, 'handleAnalyze');
    const evidenceAt = fn.indexOf('appendSiteosEvidence(');
    const insertAt = fn.indexOf('.insert({');
    expect(evidenceAt).toBeGreaterThan(-1);
    expect(insertAt).toBeGreaterThan(evidenceAt);
    expect(fn).toContain("if ('error' in evidence) return jsonError(");
  });

  it('leitet die Richtung beim Auswählen neu ab, statt einen Blueprint anzunehmen', () => {
    const fn = body(rebuild, 'handleSelect');
    expect(fn).toContain('buildDirection(snapshot, positioning, assessment, direction as DirectionKey, { createdAt: derivedAt, run: { id: run.id, snapshotSha256 } })');
    expect(fn).not.toMatch(/body\.blueprint/);
    expect(fn).toContain("originSource: 'import'");
  });

  it('übernimmt nur, was genau so angeboten und belegt wurde — sonst 409', () => {
    const fn = body(rebuild, 'handleSelect');
    const persistAt = fn.indexOf('persistBlueprintVersion(');
    const integrityAt = fn.indexOf('if (await canonicalHash(snapshot) !== snapshotSha256)');
    const staleAt = fn.indexOf('if (offered.blueprint_sha256 !== blueprintSha256)');
    expect(integrityAt).toBeGreaterThan(-1);
    expect(staleAt).toBeGreaterThan(integrityAt);
    expect(persistAt).toBeGreaterThan(staleAt);
    expect(fn).toContain("jsonError(409, 'STALE_DERIVATION'");
  });

  it('tauscht die Ausgangsseite einer bestehenden Site nicht aus', () => {
    const fn = body(rebuild, 'handleSelect');
    const persistAt = fn.indexOf('persistBlueprintVersion(');
    const otherSource = [...fn.matchAll(/jsonError\(409, 'OTHER_SOURCE'/g)].map((m) => m.index ?? -1);
    // Ohne belegte Ausgangsseite, ohne auffindbaren Lauf und bei anderem Host.
    expect(otherSource).toHaveLength(3);
    for (const at of otherSource) expect(at).toBeLessThan(persistAt);
    expect(fn.indexOf("jsonError(409, 'SLUG_TAKEN'")).toBeLessThan(persistAt);
    expect(fn).toContain('siteHost(String(boundRun.host)) !== siteHost(String(run.host))');
  });

  it('überarbeitet nur den Stand, den der Nutzer gesehen hat', () => {
    const fn = body(rebuild, 'handleRefine');
    expect(fn).toContain("if (!SHA256.test(base)) return jsonError(400");
    const staleAt = fn.indexOf("jsonError(409, 'STALE_BASE'");
    expect(staleAt).toBeGreaterThan(-1);
    expect(staleAt).toBeLessThan(fn.indexOf('reviseBlueprint('));
    expect(fn).toContain('blueprint_id: persisted.unchanged ? row.id : persisted.blueprintId');
  });

  it('liest den Verbindungsstand aus der Registratur, nicht aus der Anfrage', () => {
    const fn = body(rebuild, 'handleStatus');
    expect(fn).toContain(".from('connector_registry')");
    expect(fn).not.toMatch(/body\.connectors/);
  });
});

describe('Bindung — der Lauf kommt aus dem Blueprint', () => {
  it('lädt den gebundenen Lauf mandantengebunden und hashgeprüft', () => {
    expect(context).toContain(".from('siteos_rebuild_runs')");
    expect(context).toContain(".eq('tenant_id', tenantId)");
    expect(context).toContain(".eq('id', binding.runId)");
    expect(context).toContain('await canonicalHash(data.snapshot) !== binding.snapshotSha256');
    // Nie „der zuletzt bearbeitete Lauf zu diesem Slug".
    expect(context).not.toContain(".order('updated_at'");
  });
});

describe('Nachweis — Kette des Mandanten, fail-closed', () => {
  it('hängt nur über append_governance_evidence an und prüft den Kettenkopf', () => {
    expect(evidence).toContain("admin.rpc('append_governance_evidence'");
    expect(evidence).toContain('p_expected_previous_hash: previousHash');
    expect(evidence).not.toMatch(/from\('governance_evidence'\)\s*\.insert/);
    expect(evidence).toContain("return { status: 503, code: 'EVIDENCE_CHAIN_CONFLICT'");
  });
});

describe('Abruf — SSRF-Schranke je Schritt', () => {
  it('folgt Weiterleitungen von Hand und prüft jede Adresse', () => {
    expect(fetcher).toContain("redirect: 'manual'");
    const loop = fetcher.slice(fetcher.indexOf('export async function safeFetch'));
    const checkAt = loop.indexOf('isPublicHttpUrl(current)');
    const fetchAt = loop.indexOf('await fetch(current');
    expect(checkAt).toBeGreaterThan(-1);
    expect(fetchAt).toBeGreaterThan(checkAt);
    // Fail-closed: nur, was nachweislich öffentlich auflöst — „nicht prüfbar"
    // sperrt wie „privat".
    expect(loop).toContain("if (dns !== 'public') return { ok: false, reason: DNS_REFUSAL[dns] };");
    expect(loop.indexOf("if (dns !== 'public')")).toBeLessThan(loop.indexOf('await fetch(current'));
    expect(fetcher).toContain('signal: AbortSignal.timeout(');
    expect(fetcher).toContain("credentials: 'omit'");
  });
});
