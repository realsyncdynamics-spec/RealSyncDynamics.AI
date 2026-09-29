// Rebuild-Kontext einer Site — für Publish Gate, Status, Verzicht und Export.
//
// Eine übernommene Site (`origin_source = 'import'`) wird gegen den
// gespeicherten Snapshot ihrer Ausgangsseite geprüft. Dieser Kontext wird
// **serverseitig** aus `siteos_rebuild_runs` gelesen, nie aus der Anfrage:
// Wer den Vergleich behaupten könnte, könnte ihn leer behaupten.
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
// keinen Kontext — der Vergleich bleibt `unknown`, und der Publish Gate
// sperrt (fail-closed). `problem` sagt, warum.
//
// `artifactOptionsFor` ist die eine Stelle, die festlegt, wie das Bündel
// einer Site gebaut wird. Bewertung (Publish Gate), Status und Export
// benutzen sie gemeinsam — sonst bewertete das Gate ein anderes Bündel als
// das, das ausgeliefert wird (G6).

import {
  canonicalHash,
  redirectsForBlueprint,
  type ArtifactOptions,
  type BackendWaiver,
  type SiteBlueprint,
  type SourceSnapshot,
} from '../../../packages/siteos-core/src/index.ts';

// deno-lint-ignore no-explicit-any
type AdminClient = any;

export interface RebuildContext {
  runId: string;
  host: string;
  snapshot: SourceSnapshot;
  waivers: BackendWaiver[];
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
 * `problem: null` heißt: keine übernommene Site, kein Vergleich erwartet.
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
    .select('id, host, site_slug, snapshot, snapshot_sha256, backend_waivers')
    .eq('tenant_id', tenantId)
    .eq('id', binding.runId)
    .maybeSingle();
  if (!data?.snapshot) return { context: null, problem: 'Die Analyse, aus der diese Site stammt, ist nicht mehr vorhanden.' };
  if (data.site_slug !== site.slug) return { context: null, problem: 'Die Analyse gehört zu einer anderen Site.' };
  if (String(data.snapshot_sha256) !== binding.snapshotSha256 || await canonicalHash(data.snapshot) !== binding.snapshotSha256) {
    return { context: null, problem: 'Der gespeicherte Snapshot stimmt nicht mit dem Hash überein, an den die Site gebunden ist.' };
  }
  return {
    context: {
      runId: data.id as string,
      host: String(data.host ?? ''),
      snapshot: data.snapshot as SourceSnapshot,
      waivers: sanitizeWaivers(data.backend_waivers),
    },
    problem: null,
  };
}

export function sanitizeWaivers(value: unknown): BackendWaiver[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((w): w is Record<string, unknown> => typeof w === 'object' && w !== null)
    .filter((w) => typeof w.key === 'string' && typeof w.reason === 'string' && typeof w.by === 'string' && typeof w.at === 'string')
    .map((w) => ({ key: w.key as string, reason: w.reason as string, by: w.by as string, at: w.at as string }));
}

/**
 * Bündel-Optionen einer Site. Übernommene Sites bekommen die Begleitdateien
 * der statischen Auslieferung (Weiterleitungen der alten Pfade, robots,
 * Sitemap, Header) — im Hash, nicht daneben.
 */
export function artifactOptionsFor(
  originSource: string | null,
  context: RebuildContext | null,
  blueprint: SiteBlueprint,
  baseUrl: string | undefined,
): ArtifactOptions {
  const base: ArtifactOptions = { baseUrl, presentation: 'showcase' };
  if (originSource !== 'import' || !context) return base;
  return { ...base, siteFiles: { redirects: redirectsForBlueprint(context.snapshot, blueprint) } };
}

/** Zieladresse für Canonical und Sitemap: nur https, nur Origin. */
export function sanitizeBaseUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !url.hostname.includes('.')) return undefined;
    return `https://${url.host}`;
  } catch {
    return undefined;
  }
}

/**
 * Zieladresse je Herkunft. Übernommene Sites: https-Origin — ihre
 * Begleitdateien (Sitemap, robots.txt) brauchen eine saubere Wurzel. Alle
 * anderen: wie bisher unverändert übernommen, damit Bündel-Hashes — und die
 * daran gebundenen Freigaben — bestehender Sites gleich bleiben.
 */
export function baseUrlFor(originSource: string | null, raw: unknown): string | undefined {
  if (originSource === 'import') return sanitizeBaseUrl(raw);
  return typeof raw === 'string' ? raw : undefined;
}
