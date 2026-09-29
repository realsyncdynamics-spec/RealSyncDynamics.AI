// Deployment-Artefakt: Blueprint → Dateibündel mit eigenem Hash.
//
// Bis hierher endete die Nachweiskette am Blueprint. Das genügt nicht: ein
// Prüfer sieht nicht den Blueprint, sondern die ausgelieferten Dateien.
// Zwischen beidem steht der Renderer — und eine Kette, die vor dem letzten
// Schritt aufhört, belegt nicht, was tatsächlich im Netz stand.
//
// Deshalb bekommt das Bündel einen eigenen, kanonischen Hash über alle
// Dateipfade und ihre Inhalte. Damit gilt:
//
//     Blueprint-Hash → Artefakt-Hash → veröffentlichte Site
//
// Beide Hashes wandern in den Evidence Vault; der Artefakt-Hash ist der,
// mit dem sich später beweisen lässt, welche Bytes ausgeliefert wurden.

import { canonicalHash, sha256Hex } from '../canonical.ts';
import { renderSite, type RenderOptions } from '../render/renderer.ts';
import type { SiteBlueprint } from '../types.ts';
import { buildSiteFiles, type SiteFilesOptions } from './site-files.ts';

export interface ArtifactOptions extends RenderOptions {
  /**
   * Begleitdateien der statischen Auslieferung (robots.txt, sitemap.xml,
   * `_redirects`, `_headers`). Nur auf Anforderung: Bestehende Bündel
   * bleiben ohne sie bytegleich, und ihre Hashes gültig.
   */
  siteFiles?: SiteFilesOptions;
}

export interface ArtifactFile {
  /** Pfad im Bündel, immer mit führendem Slash, z. B. `/kontakt/index.html`. */
  path: string;
  content: string;
  /** SHA-256 des Inhalts, hex. */
  sha256: string;
  bytes: number;
}

export interface DeploymentArtifact {
  files: ArtifactFile[];
  /**
   * Kanonischer Hash über das gesamte Bündel (Pfade + Inhaltshashes).
   * Ändert sich, sobald sich irgendeine Datei oder ein Pfad ändert.
   */
  artifactSha256: string;
  /** Hash des Blueprints, aus dem das Bündel entstand. */
  blueprintSha256: string;
  totalBytes: number;
}

/**
 * Übersetzt einen Seitenpfad in den Dateipfad im Bündel.
 *
 * `/` → `/index.html`, `/kontakt` → `/kontakt/index.html`. Die
 * Verzeichnisform hält die URLs sauber (`/kontakt` statt `/kontakt.html`)
 * und funktioniert bei jedem statischen Hoster ohne Rewrite-Regeln.
 */
export function filePathForRoute(route: string): string {
  const normalized = route.startsWith('/') ? route : `/${route}`;
  if (normalized === '/') return '/index.html';
  return `${normalized.replace(/\/+$/, '')}/index.html`;
}

/**
 * Baut das vollständige Deployment-Bündel.
 *
 * Deterministisch: gleicher Blueprint ⇒ gleiches Bündel ⇒ gleicher
 * `artifactSha256`. Die Dateiliste ist nach Pfad sortiert, damit die
 * Reihenfolge nicht von der Blueprint-Reihenfolge abhängt — sonst würde
 * eine reine Umsortierung der Seiten den Hash ändern, ohne dass sich an
 * der ausgelieferten Site etwas ändert.
 */
export async function buildDeploymentArtifact(
  blueprint: SiteBlueprint,
  options: ArtifactOptions = {},
): Promise<DeploymentArtifact> {
  const { siteFiles, ...renderOptions } = options;
  const rendered = renderSite(blueprint, renderOptions);

  const files: ArtifactFile[] = [];
  for (const page of rendered) {
    files.push({
      path: filePathForRoute(page.path),
      content: page.html,
      sha256: await sha256Hex(page.html),
      bytes: new TextEncoder().encode(page.html).length,
    });
  }
  if (siteFiles) {
    for (const file of buildSiteFiles(blueprint, { ...siteFiles, baseUrl: siteFiles.baseUrl ?? renderOptions.baseUrl })) {
      files.push({
        path: file.path,
        content: file.content,
        sha256: await sha256Hex(file.content),
        bytes: new TextEncoder().encode(file.content).length,
      });
    }
  }

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // Der Bündel-Hash deckt Pfade UND Inhalte ab. Nur die Inhalte zu hashen
  // würde ein Umbenennen von Seiten verschweigen.
  const artifactSha256 = await canonicalHash(
    files.map((f) => ({ path: f.path, sha256: f.sha256 })),
  );

  return {
    files,
    artifactSha256,
    blueprintSha256: await canonicalHash(blueprint),
    totalBytes: files.reduce((sum, f) => sum + f.bytes, 0),
  };
}

export type ArtifactVerification = { ok: true } | { ok: false; problem: string };

/**
 * Prüft ein empfangenes Bündel, bevor es weitergegeben wird (Export-ZIP):
 * jede Datei gegen ihren Hash, die Dateiliste gegen das Manifest und das
 * Ganze gegen den Bündel-Hash — derselbe Rechenweg wie beim Bauen. Was
 * unterwegs verändert wurde, geht so nicht als „geprüftes Bündel" hinaus.
 */
export async function verifyArtifactFiles(
  files: readonly { path: string; content: string; sha256: string }[],
  expected: { artifactSha256: string; files?: readonly { path: string; sha256: string }[] },
): Promise<ArtifactVerification> {
  for (const file of files) {
    if (await sha256Hex(file.content) !== file.sha256) return { ok: false, problem: `Inhalt von ${file.path} passt nicht zu seinem Hash` };
  }
  const listed = [...files].map((f) => ({ path: f.path, sha256: f.sha256 })).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (expected.files) {
    const manifest = [...expected.files].map((f) => `${f.path}\u0000${f.sha256}`).sort();
    const received = listed.map((f) => `${f.path}\u0000${f.sha256}`);
    if (manifest.length !== received.length || manifest.some((entry, index) => entry !== received[index])) {
      return { ok: false, problem: 'Dateiliste weicht vom Manifest ab' };
    }
  }
  if (await canonicalHash(listed) !== expected.artifactSha256) return { ok: false, problem: 'Bündel-Hash stimmt nicht' };
  return { ok: true };
}
