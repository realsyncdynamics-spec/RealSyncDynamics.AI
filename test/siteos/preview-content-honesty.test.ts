// Die Vorschau behauptet nichts, was der Scan nicht hergibt.
//
// ## Hergang
//
// Gemeldet am 2026-09-01 mit Screenshot: Die Live-Vorschau einer
// AI-Governance-Plattform warb mit „Termin anfragen" und versprach unter
// „Warum wir" eine „Persoenliche Betreuung — Feste Ansprechpartner statt
// Warteschleife."
//
// Beides stammte nicht aus der gescannten Website. Es stand fest in
// `synthesize.ts` und ging so an jeden Kunden jeder Branche. Fuer nahezu
// jeden Empfaenger war es damit falsch — eine Governance-Plattform hat keine
// Warteschleife, und ob die Wege kurz sind, weiss ein Scanner nicht.
//
// Freigabe des Eigentuemers vom 2026-09-01 nach CLAUDE.md §10.3: „aus dem
// Scan speisen", ausdruecklich mit der Massgabe „wo der Scan nichts hergibt,
// bleibt der Block leer statt falsch".
//
// ## Warum das eine eigene Pruefung braucht
//
// Der Fehler war nicht zu sehen: Der Blueprint war gueltig, das HTML
// fehlerfrei, alle Tests gruen. Erfundener Text sieht technisch genauso aus
// wie belegter. Nur eine Pruefung, die *nach der Herkunft* fragt, faengt ihn.

import { describe, it, expect } from 'vitest';
import { parseBrief, mergeBrief } from '../../packages/siteos-core/src/blueprint/brief';
import { synthesizeBlueprint } from '../../packages/siteos-core/src/blueprint/synthesize';
import { briefFromBlueprint } from '../../packages/siteos-core/src/blueprint/refine';
import { analyzeBlueprint } from '../../packages/siteos-core/src/analysis/blueprint';
import type { SiteBlueprint } from '../../packages/siteos-core/src/types';

function homeBlock(bp: SiteBlueprint, kind: string) {
  return bp.pages.find((page) => page.path === '/')?.blocks.find((block) => block.kind === kind);
}

function allText(bp: SiteBlueprint): string {
  return JSON.stringify(bp);
}

describe('Vorschau-Inhalte — nichts Erfundenes', () => {
  describe('Hero-CTA folgt dem tatsaechlichen Ziel', () => {
    // Der gemeldete Fall: Ohne Branchentreffer faellt der Brief auf
    // `sonstiges`, dessen Seitenplan nur /kontakt fuehrt. „Termin anfragen"
    // war dort eine Zusage, die das Ziel nicht einloest.
    it('sagt "Kontakt aufnehmen", wenn es keine Terminseite gibt', () => {
      const bp = synthesizeBlueprint(parseBrief('AI Governance Runtime fuer Unternehmen'));
      const cta = homeBlock(bp, 'hero')?.content as { primaryCta: { label: string; href: string } };

      expect(bp.industry).toBe('sonstiges');
      expect(cta.primaryCta.href).toBe('/kontakt');
      expect(cta.primaryCta.label).toBe('Kontakt aufnehmen');
    });

    it('sagt "Termin anfragen" nur, wo eine Terminseite existiert', () => {
      const bp = synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'));
      const cta = homeBlock(bp, 'hero')?.content as { primaryCta: { label: string; href: string } };

      expect(cta.primaryCta.href).toBe('/termin');
      expect(cta.primaryCta.label).toBe('Termin anfragen');
    });

    it('benennt bei Gastronomie die Reservierung', () => {
      const bp = synthesizeBlueprint(parseBrief('Restaurant in Leipzig'));
      const cta = homeBlock(bp, 'hero')?.content as { primaryCta: { label: string; href: string } };

      expect(cta.primaryCta.href).toBe('/reservierung');
      expect(cta.primaryCta.label).toBe('Tisch reservieren');
    });
  });

  describe('"Warum wir" — belegt oder leer', () => {
    it('bleibt leer, solange der Scan nichts hergibt', () => {
      const bp = synthesizeBlueprint(parseBrief('AI Governance Runtime fuer Unternehmen'));
      const features = homeBlock(bp, 'features')?.content as { items: unknown[]; requiresRealContent: boolean };

      expect(features.items).toEqual([]);
      // Leer allein genuegt nicht — der Zustand muss auch gemeldet werden,
      // sonst geht eine Platzhalterhuelle still live.
      expect(features.requiresRealContent).toBe(true);
    });

    it('meldet den leeren Block als content.awaiting-real-content', () => {
      const bp = synthesizeBlueprint(parseBrief('AI Governance Runtime fuer Unternehmen'));
      const codes = analyzeBlueprint(bp).map((finding) => finding.code);

      expect(codes).toContain('content.awaiting-real-content');
    });

    it('uebernimmt echte Vorzuege, wenn der Scan welche liefert', () => {
      const brief = mergeBrief(parseBrief('AI Governance Runtime fuer Unternehmen'), {
        highlights: ['EU-souveraen gehostet', 'Pruefpfad je Entscheidung'],
      });
      const features = homeBlock(synthesizeBlueprint(brief), 'features')?.content as {
        items: { label: string }[];
      };

      expect(features.items.map((item) => item.label)).toEqual([
        'EU-souveraen gehostet',
        'Pruefpfad je Entscheidung',
      ]);
    });
  });

  describe('Die konkreten Saetze aus dem Befund', () => {
    // Namentlich, nicht nur strukturell: Diese Formulierungen standen in
    // Produktion und sollen nicht ueber einen anderen Weg zurueckkommen.
    const ERFUNDEN = [
      'Warteschleife',
      'Feste Ansprechpartner',
      'Persoenliche Betreuung',
      'Persönliche Betreuung',
      'Transparente Leistungen',
      'Kurze Wege',
      // Aus `parseBrief` — dieselbe Behauptung, andere Stelle.
      'persönliche Beratung',
      'transparente Leistungen',
      'kurze Wege',
    ];

    it.each(['AI Governance Runtime fuer Unternehmen', 'Zahnarzt in Hamburg', 'Restaurant in Leipzig'])(
      'kein erfundener Vorzug im Blueprint zu "%s"',
      (prompt) => {
        const text = allText(synthesizeBlueprint(parseBrief(prompt)));
        for (const satz of ERFUNDEN) expect(text).not.toContain(satz);
      },
    );
  });

  describe('Zusammenfassung — sachlich statt werbend', () => {
    // Freigabe des Eigentuemers vom 2026-09-01, zweite Frage nach §10.3:
    // „Ja — nur Zusammenfassung". `defaultServices` bleibt ausdruecklich
    // unangetastet.
    it('nennt Branche und Ort, ohne etwas zu versprechen', () => {
      expect(parseBrief('Zahnarzt in Hamburg').summary).toBe('Zahnarztpraxis in Hamburg.');
      expect(parseBrief('Restaurant').summary).toBe('Gastronomie.');
    });

    it('bleibt gefuellt, damit seo.missing-description nicht greift', () => {
      const bp = synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'));

      expect(bp.seo.defaultDescription.length).toBeGreaterThan(0);
      expect(analyzeBlueprint(bp).map((f) => f.code)).not.toContain('seo.missing-description');
    });

    it('zieht einen echten Namen weiterhin in die Zusammenfassung nach', () => {
      // `renameInSummary` ersetzt den fuehrenden Katalogbegriff. Das muss
      // auch mit der verkuerzten Form noch greifen — sonst stuende im Hero
      // „Praxis Vogt" und darunter „Zahnarztpraxis in Hamburg."
      const brief = mergeBrief(parseBrief('Zahnarzt in Hamburg'), { name: 'Praxis Vogt' });
      expect(brief.summary).toBe('Praxis Vogt in Hamburg.');
    });

    it('laesst die echte Beschreibung aus dem Scan gewinnen', () => {
      const brief = mergeBrief(parseBrief('Zahnarzt in Hamburg'), {
        summary: 'Zahnmedizin am Hafen seit 1998.',
      });
      expect(brief.summary).toBe('Zahnmedizin am Hafen seit 1998.');
    });
  });

  describe('Verfeinern verliert keine echten Inhalte', () => {
    it('liest eingepflegte Vorzuege in den Brief zurueck', () => {
      const brief = mergeBrief(parseBrief('Zahnarzt in Hamburg'), {
        highlights: ['Eigenes Meisterlabor im Haus'],
      });
      const bp = synthesizeBlueprint(brief);

      // Ohne diese Rueckgewinnung wuerde der naechste buildBlock-Aufruf im
      // Refine-Pfad den Block mit `highlights: []` neu bauen und die
      // redaktionelle Arbeit still ueberschreiben.
      expect(briefFromBlueprint(bp).highlights).toEqual(['Eigenes Meisterlabor im Haus']);
    });

    it('bleibt bei einem leeren Block leer, statt etwas zu erfinden', () => {
      const bp = synthesizeBlueprint(parseBrief('AI Governance Runtime fuer Unternehmen'));
      expect(briefFromBlueprint(bp).highlights).toEqual([]);
    });
  });

  describe('Determinismus bleibt', () => {
    it('gleicher Brief ergibt byte-gleichen Blueprint', () => {
      const a = synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'));
      const b = synthesizeBlueprint(parseBrief('Zahnarzt in Hamburg'));
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
  });
});
