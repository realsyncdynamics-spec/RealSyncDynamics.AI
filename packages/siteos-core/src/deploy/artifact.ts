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
  options: RenderOptions = {},
): Promise<DeploymentArtifact> {
  const rendered = renderSite(blueprint, options);

  const files: ArtifactFile[] = [];
  for (const page of rendered) {
    files.push({
      path: filePathForRoute(page.path),
      content: page.html,
      sha256: await sha256Hex(page.html),
      bytes: new TextEncoder().encode(page.html).length,
    });
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
