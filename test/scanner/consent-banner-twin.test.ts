/**
 * Die Bewertung der Banner-Gestaltung liegt zweimal im Repo — bewusst.
 *
 * `services/playwright-scanner` und `deploy/playwright-scanner` sind zwei
 * eigenständig gebaute Container mit getrenntem Build-Kontext: Das Dockerfile
 * des einen kopiert nur Dateien aus seinem eigenen Verzeichnis. Ein Import
 * über die Verzeichnisgrenze hinweg wäre lokal grün und im Image kaputt.
 *
 * Deshalb ein byte-gleicher Zwilling, nach demselben Muster wie
 * `src/rules/ai-act.json` und `supabase/functions/_shared/rules/ai-act.json`.
 * Und deshalb dieser Test: Ein Zwilling ohne Gleichheitsprüfung ist keine
 * Kopie, sondern eine Abweichung mit Anlaufzeit — die Befund-Codes und der
 * Schwellwert würden auseinanderlaufen, ohne dass etwas bricht.
 *
 * Wer eine Seite ändert, ändert beide: `cp services/playwright-scanner/src/consent-banner.ts \
 * deploy/playwright-scanner/consent-banner.ts`
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const SERVICES = resolve(ROOT, 'services/playwright-scanner/src/consent-banner.ts');
const DEPLOY = resolve(ROOT, 'deploy/playwright-scanner/consent-banner.ts');

describe('consent-banner.ts — Zwillinge', () => {
  it('sind byte-gleich', () => {
    const a = readFileSync(SERVICES);
    const b = readFileSync(DEPLOY);
    expect(b.equals(a)).toBe(true);
  });

  it('liegt im Dienst, der tatsächlich gerufen wird', () => {
    // Der Grund für den Zwilling steht im Endpunkt: `cookie-scan-deep` und
    // `audit-monitor-cron` rufen `/scan/full`, und das bedient allein
    // `deploy/playwright-scanner`. Läge die Messung nur in `services/`, wäre
    // sie gebaut, getestet — und auf keinem Produktionspfad erreichbar.
    const server = readFileSync(resolve(ROOT, 'deploy/playwright-scanner/server.ts'), 'utf8');
    expect(server).toContain("from './consent-banner'");
    expect(server).toContain('assessConsentBanner(await collectConsentButtons(page))');
    // In beiden Endpunkten, die ein Banner sehen können.
    expect(server.match(/consent_banner:/g)?.length).toBe(2);
  });

  it('wird im Docker-Image mitkopiert', () => {
    // Der Zwilling nützt nichts, wenn das Image ihn nicht enthält — dann
    // scheitert der Build am fehlenden Modul statt still zu laufen.
    const dockerfile = readFileSync(resolve(ROOT, 'deploy/playwright-scanner/Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/COPY .*consent-banner\.ts/);
  });
  it('kopiert im Dockerfile nur Dateien, die es gibt', () => {
    // Der Fehler, der hier zwei Wochen lag: `COPY server.ts tsconfig.json ./`
    // bei einem Verzeichnis ohne tsconfig.json. Docker bricht bei einer
    // fehlenden COPY-Quelle hart ab — das Image liess sich aus dem Repo nie
    // bauen, und niemand hat es gemerkt, weil der Container schon lief.
    const dir = resolve(ROOT, 'deploy/playwright-scanner');
    const dockerfile = readFileSync(resolve(dir, 'Dockerfile'), 'utf8');

    const sources = dockerfile
      .split('\n')
      .filter((line) => /^COPY /.test(line.trim()))
      .flatMap((line) => line.trim().replace(/^COPY /, '').split(/\s+/).slice(0, -1))
      .filter((src) => !src.includes('*') && !src.startsWith('--'));

    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) {
      expect(existsSync(resolve(dir, src)), `COPY-Quelle fehlt: ${src}`).toBe(true);
    }
  });
});
