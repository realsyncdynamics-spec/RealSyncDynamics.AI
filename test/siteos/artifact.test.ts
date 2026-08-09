import { describe, it, expect } from 'vitest';
import {
  buildDeploymentArtifact,
  canonicalHash,
  filePathForRoute,
  parseBrief,
  synthesizeBlueprint,
  type SiteBlueprint,
} from '../../packages/siteos-core/src/index';

function blueprint(): SiteBlueprint {
  return synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'), { model: 'm' });
}

describe('filePathForRoute', () => {
  it('bildet die Startseite auf index.html ab', () => {
    expect(filePathForRoute('/')).toBe('/index.html');
  });

  it('nutzt die Verzeichnisform für saubere URLs', () => {
    expect(filePathForRoute('/kontakt')).toBe('/kontakt/index.html');
    expect(filePathForRoute('/impressum')).toBe('/impressum/index.html');
  });

  it('normalisiert fehlende und doppelte Slashes', () => {
    expect(filePathForRoute('kontakt')).toBe('/kontakt/index.html');
    expect(filePathForRoute('/kontakt/')).toBe('/kontakt/index.html');
  });
});

describe('buildDeploymentArtifact', () => {
  it('erzeugt eine Datei je Seite', async () => {
    const bp = blueprint();
    const artifact = await buildDeploymentArtifact(bp);
    expect(artifact.files).toHaveLength(bp.pages.length);
  });

  it('enthält index.html und die Pflichtseiten', async () => {
    const paths = (await buildDeploymentArtifact(blueprint())).files.map((f) => f.path);
    expect(paths).toContain('/index.html');
    expect(paths).toContain('/impressum/index.html');
    expect(paths).toContain('/datenschutz/index.html');
  });

  it('sortiert die Dateien nach Pfad', async () => {
    const paths = (await buildDeploymentArtifact(blueprint())).files.map((f) => f.path);
    expect(paths).toEqual([...paths].sort());
  });

  it('hängt nicht an der Reihenfolge der Seiten im Blueprint', async () => {
    // Eine reine Umsortierung ändert nichts an der ausgelieferten Site —
    // also darf sie auch den Artefakt-Hash nicht ändern.
    const bp = blueprint();
    const reordered: SiteBlueprint = { ...bp, pages: [...bp.pages].reverse() };

    const a = await buildDeploymentArtifact(bp);
    const b = await buildDeploymentArtifact(reordered);
    expect(b.artifactSha256).toBe(a.artifactSha256);
  });

  it('ist deterministisch', async () => {
    const bp = blueprint();
    const a = await buildDeploymentArtifact(bp);
    const b = await buildDeploymentArtifact(bp);
    expect(b.artifactSha256).toBe(a.artifactSha256);
  });

  it('ändert den Hash, sobald sich ein Inhalt ändert', async () => {
    const bp = blueprint();
    const before = await buildDeploymentArtifact(bp);

    const hero = bp.pages[0].blocks.find((b) => b.kind === 'hero')!;
    (hero.content as Record<string, unknown>).headline = 'Anderer Text';

    const after = await buildDeploymentArtifact(bp);
    expect(after.artifactSha256).not.toBe(before.artifactSha256);
  });

  it('ändert den Hash, sobald sich ein Pfad ändert', async () => {
    // Nur die Inhalte zu hashen würde ein Umbenennen verschweigen.
    const bp = blueprint();
    const before = await buildDeploymentArtifact(bp);

    bp.pages[1].path = '/umbenannt';

    const after = await buildDeploymentArtifact(bp);
    expect(after.artifactSha256).not.toBe(before.artifactSha256);
  });

  it('verankert das Bündel am Blueprint, aus dem es entstand', async () => {
    const bp = blueprint();
    const artifact = await buildDeploymentArtifact(bp);
    expect(artifact.blueprintSha256).toBe(await canonicalHash(bp));
  });

  it('hält Blueprint- und Artefakt-Hash auseinander', async () => {
    // Zwei verschiedene Dinge: die Beschreibung und die Bytes. Wären sie
    // gleich, könnte man nicht zeigen, welche Fassung ausgeliefert wurde.
    const artifact = await buildDeploymentArtifact(blueprint());
    expect(artifact.artifactSha256).not.toBe(artifact.blueprintSha256);
  });

  it('liefert je Datei einen prüfbaren Inhaltshash', async () => {
    const artifact = await buildDeploymentArtifact(blueprint());
    for (const file of artifact.files) {
      expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(file.bytes).toBeGreaterThan(0);
      expect(file.content.startsWith('<!doctype html>')).toBe(true);
    }
  });

  it('zählt die Gesamtgröße korrekt', async () => {
    const artifact = await buildDeploymentArtifact(blueprint());
    const sum = artifact.files.reduce((s, f) => s + f.bytes, 0);
    expect(artifact.totalBytes).toBe(sum);
  });

  it('reicht die baseUrl an den Renderer durch', async () => {
    const artifact = await buildDeploymentArtifact(blueprint(), { baseUrl: 'https://praxis.de' });
    const home = artifact.files.find((f) => f.path === '/index.html')!;
    expect(home.content).toContain('<link rel="canonical" href="https://praxis.de/">');
  });
});
