/**
 * siteos Rebuild-Workflow + Export: Autorisierung vor Wirkung.
 *
 * ## Warum am Quelltext
 *
 * Dieselbe Einschränkung wie in `optimize-analyze-auth.test.ts`: Die
 * Handler importieren `jsr:@supabase/supabase-js`, das Vitest nicht auflöst.
 * Geprüft wird deshalb, was sich am Code festmachen lässt und was bei einer
 * Verletzung teuer wäre:
 *
 *   • Jeder Rebuild-Pfad löst Mandant und Rolle über den kanonischen
 *     Resolver auf — **bevor** er fremde Adressen abruft (Kosten, SSRF),
 *     Läufe liest, Nachweise oder Versionen schreibt.
 *   • Danach wird der Mandant aus der Auflösung benutzt, nie mehr aus dem
 *     Body. Eine Adresse aus der Anfrage ist nie Autorität für Mandant oder
 *     Richtlinie.
 *   • Die Rollen sind so eng wie die Wirkung: Verzicht wie Freigabe
 *     (owner/admin/dpo), GO nur owner/admin.
 *   • Der Export bewertet genau das auszuliefernde Bündel frisch (nicht
 *     „irgendeine frühere bestandene Bewertung") und schreibt das GO in die
 *     Nachweiskette, bevor Dateien herausgehen.
 *   • Der Vergleich kommt aus dem Lauf, an den die Site gebunden ist
 *     (`origin.rebuild`), geprüft gegen den Snapshot-Hash.
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
const gate = read('supabase/functions/siteos/handlers/publish-gate.ts');
const fetcher = read('supabase/functions/siteos/rebuild-fetch.ts');
const context = read('supabase/functions/siteos/rebuild-context.ts');

function body(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  expect(start, `${name} nicht gefunden`).toBeGreaterThan(-1);
  const next = source.indexOf('\nexport async function ', start + 10);
  return source.slice(start, next === -1 ? undefined : next);
}

const HANDLERS: [string, string[]][] = [
  ['handleAnalyze', ['crawlSite(', "from('siteos_rebuild_runs')", 'appendSiteosEvidence(', 'gateBuilder(']],
  ['handleSelect', ["from('siteos_rebuild_runs')", 'persistBlueprintVersion(', 'gateBuilder(']],
  ['handleRefine', ["from('siteos_blueprints')", 'persistBlueprintVersion(', 'gateBuilder(']],
  ['handleStatus', ["from('siteos_blueprints')", "from('connector_registry')"]],
  ['handleWaive', ["from('siteos_rebuild_runs')", 'appendSiteosEvidence(']],
];

describe('Rebuild — Autorisierung vor Wirkung', () => {
  it('nutzt den kanonischen Resolver aus _shared/auth.ts', () => {
    expect(rebuild).toMatch(/from '\.\.\/\.\.\/_shared\/auth\.ts'/);
    expect(rebuild).not.toContain("from('memberships')");
  });

  it.each(HANDLERS)('%s prüft Mandant und Rolle vor jedem Zugriff', (name, effects) => {
    const fn = body(rebuild, name);
    const authAt = fn.indexOf('await requireAuthAndTenant(req, stringOrNull(body.tenant_id)');
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
    expect(rebuild).toContain("const WAIVE_ROLES = ['owner', 'admin', 'dpo'];");
    expect(body(rebuild, 'handleAnalyze')).toContain('ANALYZE_ROLES)');
    expect(body(rebuild, 'handleSelect')).toContain('WRITE_ROLES)');
    expect(body(rebuild, 'handleRefine')).toContain('WRITE_ROLES)');
    expect(body(rebuild, 'handleWaive')).toContain('WAIVE_ROLES)');
  });

  it('zählt Versuche für die Kostenbremse und protokolliert jeden Abruf vorher', () => {
    const fn = body(rebuild, 'handleAnalyze');
    const countAt = fn.indexOf(".from('governance_admin_log').select('id', { count: 'exact', head: true })");
    const attemptAt = fn.indexOf('action: ATTEMPT_ACTION');
    const crawlAt = fn.indexOf('crawlSite(');
    expect(countAt).toBeGreaterThan(-1);
    expect(attemptAt).toBeGreaterThan(countAt);
    expect(crawlAt).toBeGreaterThan(attemptAt);
    expect(fn).toContain("if (!attempt.ok) return jsonError(503");
    expect(fn).toContain("if (countError) return jsonError(503");
  });

  it('bindet die Richtungen an den Lauf (Kennung + Snapshot-Hash)', () => {
    const fn = body(rebuild, 'handleAnalyze');
    expect(fn.indexOf('const runId = crypto.randomUUID();')).toBeLessThan(fn.indexOf('buildDirections('));
    expect(fn).toContain('buildDirections(snapshot, positioning, assessment, { createdAt: nowIso, run: { id: runId, snapshotSha256 } })');
  });

  it('schreibt den Lauf erst nach dem Nachweis (fail-closed)', () => {
    const fn = body(rebuild, 'handleAnalyze');
    const evidenceAt = fn.indexOf('appendSiteosEvidence(');
    const insertAt = fn.indexOf(".insert({");
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
    expect(staleAt).toBeGreaterThan(-1);
    expect(persistAt).toBeGreaterThan(staleAt);
    expect(fn).toContain("jsonError(409, 'STALE_DERIVATION'");
  });

  it('tauscht die Ausgangsseite einer bestehenden Site nicht aus', () => {
    const fn = body(rebuild, 'handleSelect');
    const persistAt = fn.indexOf('persistBlueprintVersion(');
    expect(fn.indexOf("jsonError(409, 'OTHER_SOURCE'")).toBeGreaterThan(-1);
    expect(fn.indexOf("jsonError(409, 'OTHER_SOURCE'")).toBeLessThan(persistAt);
    expect(fn.indexOf("jsonError(409, 'SLUG_TAKEN'")).toBeLessThan(persistAt);
    expect(fn).toContain('siteHost(String(boundRun.host)) !== siteHost(String(run.host))');
  });

  it('verzichtet nur auf dem Lauf, an den die Site gebunden ist', () => {
    const fn = body(rebuild, 'handleWaive');
    const boundAt = fn.indexOf('rebuildBinding(row.blueprint as SiteBlueprint)?.runId !== runId');
    const evidenceAt = fn.indexOf('appendSiteosEvidence(');
    expect(boundAt).toBeGreaterThan(-1);
    expect(evidenceAt).toBeGreaterThan(boundAt);
  });

  it('meldet die Zeile einer Überarbeitung zurück', () => {
    expect(body(rebuild, 'handleRefine')).toContain('blueprint_id: persisted.unchanged ? row.id : persisted.blueprintId');
  });

  it('lässt nur auf serverseitig festgestellte Verluste verzichten', () => {
    const fn = body(rebuild, 'handleWaive');
    expect(fn).toContain('compareBackend(snapshot, blueprint, waivers)');
    expect(fn).toContain("item.status !== 'lost'");
    expect(fn).toContain('reason.length < 10');
  });

  it('liest den Verbindungsstand aus der Registratur, nicht aus der Anfrage', () => {
    const fn = body(rebuild, 'handleStatus');
    expect(fn).toContain(".from('connector_registry')");
    expect(fn).not.toMatch(/body\.connectors/);
  });
});

describe('Export — GO nur für ein bestandenes Bündel', () => {
  const fn = body(gate, 'handleExport');

  it('autorisiert, prüft das Recht zur Veröffentlichung und die GO-Rolle', () => {
    const authAt = fn.indexOf('await authorize(req)');
    const entitlementAt = fn.indexOf('gateSitePublish(ctx.admin, ctx.tenantId)');
    const roleAt = fn.indexOf('PUBLISHER_ROLES.has(ctx.role)');
    expect(authAt).toBeGreaterThan(-1);
    expect(entitlementAt).toBeGreaterThan(authAt);
    expect(roleAt).toBeGreaterThan(authAt);
    expect(gate).toContain("const PUBLISHER_ROLES = new Set(['owner', 'admin']);");
  });

  it('verlangt ausdrückliches GO und bestätigte Vorschau', () => {
    expect(fn).toContain('body.confirm_go !== true || body.confirm_preview !== true');
  });

  it('bewertet genau dieses Bündel zum Zeitpunkt des GO frisch — und belegt das GO vorher', () => {
    // Keine Suche nach „irgendeiner" früheren bestandenen Bewertung: Verzichte,
    // Lauf und Richtlinien stehen nicht im Bündel-Hash.
    expect(fn).not.toContain(".eq('publishable', true)");
    const evaluateAt = fn.indexOf('await evaluatePrepared(ctx, prepared)');
    const refuseAt = fn.indexOf('if (!evaluation.publishable || evaluation.artifact_sha256 !== artifact.artifactSha256)');
    const evidenceAt = fn.indexOf('appendSiteosEvidence(');
    const filesAt = fn.indexOf('files: artifact.files.map((f) => ({ path: f.path, content: f.content');
    expect(evaluateAt).toBeGreaterThan(-1);
    expect(refuseAt).toBeGreaterThan(evaluateAt);
    expect(evidenceAt).toBeGreaterThan(refuseAt);
    expect(filesAt).toBeGreaterThan(evidenceAt);
    expect(fn).toContain('evaluation_id: evaluation.evaluation_id');
  });

  it('liefert kein unvollständiges Bündel aus (Rechtstexte, Formularziel) — geprüft vor Bewertung und GO-Nachweis', () => {
    const incompleteAt = fn.indexOf("jsonError(409, 'INCOMPLETE'");
    const evaluateAt = fn.indexOf('await evaluatePrepared(ctx, prepared)');
    const evidenceAt = fn.indexOf('appendSiteosEvidence(');
    expect(incompleteAt).toBeGreaterThan(-1);
    expect(evaluateAt).toBeGreaterThan(incompleteAt);
    expect(evidenceAt).toBeGreaterThan(incompleteAt);
    expect(fn).toContain('buildPublishChecklist({');
  });

  it('baut das Bündel auf demselben Weg wie die Bewertung (G6)', () => {
    expect(fn).toContain('const prepared = await prepareRelease(ctx, blueprintId, body.base_url);');
    const prepare = gate.slice(gate.indexOf('async function prepareRelease('), gate.indexOf('async function runEvaluation('));
    expect(prepare).toContain('artifactOptionsFor(row.origin_source, rebuild, row.blueprint, baseUrl)');
    expect(prepare).toContain('resolveRebuildContext(ctx.admin, ctx.tenantId, row)');
    expect(gate).toMatch(/async function runEvaluation[\s\S]*prepareRelease\(ctx, blueprintId, rawBaseUrl\)[\s\S]*evaluatePrepared\(ctx, prepared\)/);
  });

  it('bindet eine Freigabe übernommener Sites an den Backend-Vergleich, den sie gesehen hat', () => {
    expect(gate).toContain('backendDigest(rebuild.runId, comparison)');
    expect(gate).toContain('approvalRow.backend_sha256 === backendSha256');
    expect(gate).toContain('...(backendSha256 ? { backend_sha256: backendSha256 } : {})');
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

  it('der Rebuild-Kontext kommt aus dem gebundenen Lauf, mandantengebunden und hashgeprüft', () => {
    expect(context).toContain(".from('siteos_rebuild_runs')");
    expect(context).toContain(".eq('tenant_id', tenantId)");
    expect(context).toContain(".eq('id', binding.runId)");
    expect(context).toContain('await canonicalHash(data.snapshot) !== binding.snapshotSha256');
    // Nie mehr „der zuletzt bearbeitete Lauf zu diesem Slug".
    expect(context).not.toContain(".order('updated_at'");
  });
});
