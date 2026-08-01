import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CI_FORBIDDEN_CTA } from '../../src/content/runtimeVocab';

/**
 * CTA-Disziplin als Unit-Test — lokaler Spiegel des Grep-Gates in
 * `.github/workflows/cta-enforcement.yml`.
 *
 * Hintergrund: RealSyncDynamics.AI positioniert sich als „Tools statt
 * Beratung" (siehe /about → „Was uns unterscheidet"). Ein Termin-/Sales-CTA
 * im öffentlichen Frontend widerspricht dieser Positionierung direkt und
 * verwirrt die Zielgruppe (Self-Service-App oder Account-Manager?).
 * Einzige erlaubte kontaktbasierte CTA: `CTA.enterprise`.
 *
 * Der Test läuft in `npm test` und fängt Drift, bevor der PR-Gate greift.
 */

const REPO_ROOT     = resolve(__dirname, '../..');
const SCAN_DIRS     = ['src/pages', 'src/components'];
const WORKFLOW_PATH = join(REPO_ROOT, '.github/workflows/cta-enforcement.yml');
const ABOUT_PATH    = join(REPO_ROOT, 'src/pages/About.tsx');

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    // Tests dürfen die verbotenen Phrasen als Fixture enthalten.
    if (!/\.(ts|tsx)$/.test(entry) || entry.includes('.test.')) continue;
    out.push(full);
  }
  return out;
}

describe('CTA-Disziplin im öffentlichen Frontend', () => {
  it('kein verbotener Sales-/Termin-CTA in src/pages und src/components', () => {
    const files = SCAN_DIRS.flatMap((d) => collectSourceFiles(join(REPO_ROOT, d)));
    expect(files.length).toBeGreaterThan(0);

    const hits: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const phrase of CI_FORBIDDEN_CTA) {
          if (line.toLowerCase().includes(phrase.toLowerCase())) {
            hits.push(`${file.slice(REPO_ROOT.length + 1)}:${i + 1} → „${phrase}"`);
          }
        }
      });
    }

    expect(hits, `Verbotene CTA-Phrasen gefunden:\n${hits.join('\n')}`).toEqual([]);
  });

  it('Workflow-Pattern bleibt synchron zu CI_FORBIDDEN_CTA', () => {
    const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
    for (const phrase of CI_FORBIDDEN_CTA) {
      expect(workflow, `„${phrase}" fehlt im Grep-Pattern des CI-Gates`).toContain(phrase);
    }
  });
});

describe('/about — Self-Service-First-Positionierung', () => {
  const about = readFileSync(ABOUT_PATH, 'utf8');

  // Der Abschluss-Block der Seite; davor steht im Founder-Absatz ein
  // Prosa-Link auf /contact-sales (Presse/Investoren) — der ist kein CTA.
  const ctaBlockStart = about.indexOf('Mit uns starten');
  // Guard vor dem slice: bei -1 würde slice(-1) das letzte Zeichen der Datei
  // liefern statt eines leeren Strings und die Folgetests irreführend brechen.
  if (ctaBlockStart === -1) {
    throw new Error('CTA-Block „Mit uns starten" fehlt in About.tsx');
  }
  const ctaBlock = about.slice(ctaBlockStart);

  it('primärer CTA ist der Free Audit, nicht der Kontakt-Kanal', () => {
    const audit   = ctaBlock.indexOf('/audit?source=about');
    const contact = ctaBlock.indexOf('/contact-sales');

    expect(audit,   '/audit-CTA fehlt im CTA-Block').toBeGreaterThan(-1);
    expect(contact, '/contact-sales-Link fehlt im CTA-Block').toBeGreaterThan(-1);
    // Reihenfolge im JSX = Reihenfolge im DOM: Self-Service zuerst.
    expect(audit).toBeLessThan(contact);
  });

  it('verlinkt die kostenlosen Tools als Einstieg', () => {
    expect(ctaBlock).toContain('/tools?source=about');
  });

  it('nutzt die kanonischen CTA-Strings aus runtimeVocab', () => {
    expect(about).toContain('CTA.startFreeAudit');
    expect(about).toContain('CTA.enterprise');
  });

  it('Enterprise-CTA trägt intent + source für die Lead-Qualifizierung', () => {
    // `intent` qualifiziert den Lead, `source` attribuiert die Herkunft —
    // beide werden von ContactSales gelesen und an sales-lead gesendet.
    expect(ctaBlock).toContain('/contact-sales?intent=enterprise&source=about');
  });
});
