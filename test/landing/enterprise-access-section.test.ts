/**
 * Die Enterprise-Sektion der Startseite darf keine eigenen Konditionen führen.
 *
 * Der Abschnitt nennt Preis, Reaktionszeit, Mandantenzahl, Benutzerplätze und
 * Nachweisspeicher. Jede dieser Zahlen existiert bereits in
 * `shared/pricing.ts`. Stünde sie zusätzlich als Literal in der Komponente,
 * gäbe es zwei Wahrheiten — und die Startseite würde beim nächsten
 * Preiswechsel still falsch.
 *
 * Der Test liest deshalb den Quelltext und verbietet die konkreten Werte als
 * Literale, statt gerendertes Markup zu prüfen: Ein Snapshot ginge mit jeder
 * Preisänderung kaputt, ohne den eigentlichen Fehler zu benennen.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { tierById } from '../../src/config/pricing';
import { CTA, CI_FORBIDDEN_CTA } from '../../src/content/runtimeVocab';

const source = readFileSync(
  resolve(__dirname, '../../src/components/landing/EnterpriseAccessSection.tsx'),
  'utf8'
);

/**
 * Quelltext ohne Kommentare und ohne `className`-Inhalte.
 *
 * Beides ist für diese Prüfung Rauschen: In einem Kommentar ist eine Zahl
 * Erläuterung, kein Wert, und Tailwind-Klassen bestehen fast nur aus Zahlen
 * (`p-6`, `text-white/50`, `gap-2.5`). Ohne dieses Abziehen meldet der Test
 * Treffer, die niemanden interessieren — und wird deshalb abgeschaltet.
 */
const strippedCode = source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/className="[^"]*"/g, '')
  .replace(/className=\{`[^`]*`\}/g, '');

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('Enterprise-Sektion der Startseite', () => {
  const tier = tierById('enterprise');

  it('findet den Enterprise-Tarif in der Preis-Quelle', () => {
    expect(tier, 'Ohne Tarif rendert die Sektion nichts — dann ist sie sinnlos').toBeDefined();
  });

  it('führt keine Konditionen als Literal', () => {
    if (!tier) return;
    const { plan } = tier;

    const forbiddenLiterals = [
      tier.priceString,
      String(plan.price.monthlyEur),
      String(plan.limits.tenants),
      String(plan.limits.seats),
      String(plan.limits.evidenceStorageGb),
      String(plan.trialDays),
      ...plan.badges,
    ]
      // Einstellige Werte sind nicht prüfbar: Eine „5" steckt in jeder
      // zweiten Tailwind-Klasse und in `strokeWidth={1.5}`. Der Test würde
      // Rauschen melden statt Abschreibfehler.
      .filter((value) => value.length >= 2);

    for (const literal of forbiddenLiterals) {
      // Wortgrenzen ohne `.`, `-`, `/` und Ziffern: „50" darf nicht als
      // eigener Wert vorkommen, „250.000" oder „w-50" wären kein Treffer.
      const standalone = new RegExp(`(?<![\\w./-])${escapeRegExp(literal)}(?![\\w./-])`);
      expect(
        standalone.test(strippedCode),
        `„${literal}" steht als Literal in der Komponente. Wert aus ` +
          '`shared/pricing.ts` lesen, nicht abschreiben (CLAUDE.md §6).'
      ).toBe(false);
    }
  });

  it('nutzt die kanonische Enterprise-CTA statt eigener Sales-Sprache', () => {
    expect(source).toContain('CTA.enterprise');

    // Der Entwurf trug zuerst „Gespräch vereinbaren" — an der Sperrliste
    // vorbei, aber gegen deren Zweck. Deshalb wird hier gegen die Liste
    // selbst geprüft und nicht gegen eine Handvoll erinnerter Wörter.
    for (const forbidden of CI_FORBIDDEN_CTA) {
      expect(strippedCode, `Verbotene CTA-Sprache: „${forbidden}"`).not.toContain(forbidden);
    }
    // Gegen den eigenen Erstentwurf abgesichert. Geprüft wird der Code ohne
    // Kommentare — im Kommentar darf und soll stehen, warum es nicht dort steht.
    expect(strippedCode).not.toMatch(/Gespräch vereinbaren|Termin vereinbaren/);
  });

  it('verlinkt auf den Anker, den die Preisseite tatsächlich vergibt', () => {
    const pricingPage = readFileSync(
      resolve(__dirname, '../../src/features/billing/PricingPage.tsx'),
      'utf8'
    );
    // Die Preisseite vergibt `plan-<id>`; die Sektion leitet den Anker davon ab.
    expect(pricingPage).toContain('id={`plan-${tier.id}`}');
    expect(source).toContain('/pricing#plan-$');
  });

  it('kennzeichnet seine Karten für das gestaffelte Einblenden', () => {
    // Ohne `data-reveal` bleibt die Sektion beim Scrollen tot, ohne dass es
    // auffällt — die Karten sind ja sichtbar. Deshalb hier festgehalten.
    const revealCount = (source.match(/data-reveal\b/g) ?? []).length;
    expect(revealCount).toBeGreaterThanOrEqual(2);
    expect(source).toContain('data-reveal-group="enterprise"');
  });

  it('nennt die CTA-Konstante, die im Vokabular als Kontakt-CTA gilt', () => {
    expect(CTA.enterprise.length).toBeGreaterThan(3);
  });
});
