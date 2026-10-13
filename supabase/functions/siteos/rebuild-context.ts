// Rebuild-Kontext einer Site — welcher Analyse-Lauf zu ihr gehört.
//
// Eine übernommene Site (`origin_source = 'import'`) wird gegen den
// gespeicherten Snapshot ihrer Ausgangsseite geprüft. Dieser Kontext wird
// **serverseitig** aus `siteos_rebuild_runs` gelesen, nie aus der Anfrage:
// Wer die Ausgangsseite behaupten könnte, könnte auch den Vergleich mit ihr
// leer behaupten.
//
// ## Welcher Lauf
//
// Genau der, aus dem die Site abgeleitet wurde: `blueprint.origin.rebuild`
// nennt Lauf und Snapshot-Hash. Beides steht im Blueprint und damit im Hash
// jeder Version; Redaktion und Überarbeitung tragen es unverändert weiter.
// Der Lauf wird über seine Kennung geladen und gegen diesen Hash geprüft —
// nicht „der zuletzt bearbeitete Lauf zu dieser Adresse". Sonst könnte eine
// zweite Analyse (etwa einer Doppelgänger-Domain mit gleichem Slug) die
// Vergleichsgrundlage einer bestehenden Site austauschen.
//
// Passt etwas nicht (Lauf fehlt, Hash weicht ab, andere Site), gibt es
// keinen Kontext, und `problem` sagt, warum. Wer den Kontext braucht, sperrt
// dann (fail-closed) — heute `rebuild-status`, mit dem PUBLISH-Schnitt auch
// der Backend-Vergleich im Publish Gate.

import { canonicalHash, type SiteBlueprint, type SourceSnapshot } from '../../../packages/siteos-core/src/index.ts';

// deno-lint-ignore no-explicit-any
type AdminClient = any;

export interface RebuildContext {
  runId: string;
  host: string;
  snapshot: SourceSnapshot;
}

export type RebuildContextResult =
  | { context: RebuildContext; problem: null }
  | { context: null; problem: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

/** Die Bindung einer Site an ihren Analyse-Lauf — oder `null`. */
export function rebuildBinding(blueprint: SiteBlueprint | null | undefined): { runId: string; snapshotSha256: string } | null {
  const binding = blueprint?.origin?.rebuild;
  if (!binding || typeof binding.runId !== 'string' || typeof binding.snapshotSha256 !== 'string') return null;
  if (!UUID.test(binding.runId) || !SHA256.test(binding.snapshotSha256)) return null;
  return { runId: binding.runId, snapshotSha256: binding.snapshotSha256 };
}

/**
 * Lädt den Lauf, aus dem diese Site abgeleitet wurde — mandantengebunden,
 * über die Kennung aus dem Blueprint, geprüft gegen den Snapshot-Hash.
 * `problem: null` ohne Kontext heißt: keine übernommene Site, kein Lauf
 * erwartet.
 */
export async function resolveRebuildContext(
  admin: AdminClient,
  tenantId: string,
  site: { slug: string; origin_source: string | null; blueprint: SiteBlueprint },
): Promise<RebuildContextResult> {
  if (site.origin_source !== 'import') return { context: null, problem: null };
  const binding = rebuildBinding(site.blueprint);
  if (!binding) {
    return { context: null, problem: 'Diese Site wurde ohne Rebuild-Analyse übernommen — es gibt keinen Vergleich mit der Ausgangsseite.' };
  }
  const { data } = await admin
    .from('siteos_rebuild_runs')
    .select('id, host, site_slug, snapshot, snapshot_sha256')
    .eq('tenant_id', tenantId)
    .eq('id', binding.runId)
    .maybeSingle();
  if (!data?.snapshot) return { context: null, problem: 'Die Analyse, aus der diese Site stammt, ist nicht mehr vorhanden.' };
  if (data.site_slug !== site.slug) return { context: null, problem: 'Die Analyse gehört zu einer anderen Site.' };
  if (String(data.snapshot_sha256) !== binding.snapshotSha256 || await canonicalHash(data.snapshot) !== binding.snapshotSha256) {
    return { context: null, problem: 'Der gespeicherte Snapshot stimmt nicht mit dem Hash überein, an den die Site gebunden ist.' };
  }
  return {
    context: { runId: String(data.id), host: String(data.host ?? ''), snapshot: data.snapshot as SourceSnapshot },
    problem: null,
  };
}

/** Host ohne `www.` — zwei Analysen derselben Website gelten als dieselbe Quelle. */
export function siteHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}
