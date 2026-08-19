import { describe, expect, it } from 'vitest';

import {
  BUDGET_GUIDANCE,
  DSGVO_TOOLS,
  LANDSCAPE_AS_OF_LABEL,
  MATRIX_TOOLS,
  PRICING_DISCLAIMER,
  SELECTION_CRITERIA,
  TOOL_CATEGORIES,
  TRANSFER_LABEL,
  toolsByCategory,
} from '../../src/config/dsgvo-tool-landscape';

describe('DSGVO-Tool-Landschaft', () => {
  it('vergibt jeden Tool-Namen nur einmal', () => {
    // Namen sind React-Keys in Tabelle und Kategorie-Liste — Duplikate
    // fuehren zu Key-Kollisionen und verschluckten Zeilen.
    const names = DSGVO_TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('ordnet jedes Tool einer existierenden Kategorie zu', () => {
    // Ein Tool mit unbekannter Kategorie wird von toolsByCategory() nie
    // gefunden und verschwindet lautlos aus der Seite (§14: nichts
    // Unsichtbares stehen lassen).
    const known = new Set(TOOL_CATEGORIES.map((c) => c.key));
    const orphans = DSGVO_TOOLS.filter((t) => !known.has(t.category));
    expect(orphans.map((t) => t.name)).toEqual([]);
  });

  it('rendert keine leere Kategorie-Karte', () => {
    for (const cat of TOOL_CATEGORIES) {
      expect(toolsByCategory(cat.key).length, `Kategorie ${cat.key} ist leer`).toBeGreaterThan(0);
    }
  });

  it('verteilt die Tools ueberschneidungsfrei auf die Kategorien', () => {
    const summed = TOOL_CATEGORIES.reduce((n, c) => n + toolsByCategory(c.key).length, 0);
    expect(summed).toBe(DSGVO_TOOLS.length);
  });

  it('haelt die Detail-Matrix bei 7 Anbietern', () => {
    // H1 und JSON-LD-Headline nennen "7 Anbieter" als festen Text. Waechst
    // die Matrix, muessen beide mitgezogen werden — dieser Test erzwingt das.
    expect(MATRIX_TOOLS.length).toBe(7);
    expect(MATRIX_TOOLS.every((t) => t.matrix !== undefined)).toBe(true);
  });

  it('nimmt in MATRIX_TOOLS genau die Tools mit Matrix auf', () => {
    const withMatrix = DSGVO_TOOLS.filter((t) => t.matrix !== undefined).map((t) => t.name);
    expect(MATRIX_TOOLS.map((t) => t.name)).toEqual(withMatrix);
  });

  it('begruendet die Transfer-Stufe konsistent mit dem Anbietersitz', () => {
    // Falsche Schrems-II-Einordnung auf einer Compliance-Seite ist ein
    // inhaltlicher Fehler, kein Darstellungsdetail.
    for (const t of DSGVO_TOOLS) {
      if (t.origin === 'EU') {
        expect(t.transfer, `${t.name}: EU-Sitz muss EU-intern sein`).toBe('eu-intern');
      } else {
        expect(t.transfer, `${t.name}: Drittland darf nicht EU-intern sein`).not.toBe('eu-intern');
      }
      if (t.origin === 'US') {
        // Die USA haben keinen Angemessenheitsbeschluss im Sinne von Art. 45
        // DSGVO fuer beliebige Empfaenger — es braucht Garantien.
        expect(t.transfer, `${t.name}: US-Sitz braucht Garantien`).toBe('drittland-garantien');
      }
    }
  });

  it('hat fuer jede vorkommende Transfer-Stufe ein Label', () => {
    for (const t of DSGVO_TOOLS) {
      expect(TRANSFER_LABEL[t.transfer], `Label fehlt fuer ${t.transfer}`).toBeTruthy();
    }
  });

  it('fuellt alle Felder, die die Seite ungeprueft rendert', () => {
    for (const t of DSGVO_TOOLS) {
      expect(t.vendor.trim(), `${t.name}: vendor leer`).not.toBe('');
      expect(t.pricingFrom.trim(), `${t.name}: pricingFrom leer`).not.toBe('');
      expect(t.strengths.trim(), `${t.name}: strengths leer`).not.toBe('');
      expect(t.bestFor.trim(), `${t.name}: bestFor leer`).not.toBe('');
      expect(t.capabilities.length, `${t.name}: keine capabilities`).toBeGreaterThan(0);
    }
  });

  it('verlinkt Anbieter ausschliesslich ueber HTTPS', () => {
    const insecure = DSGVO_TOOLS.filter((t) => !t.url.startsWith('https://'));
    expect(insecure.map((t) => t.url)).toEqual([]);
  });

  it('datiert den Preis-Disclaimer', () => {
    // Vergleichende Werbung nach § 6 UWG muss nachpruefbar und aktuell sein —
    // ohne Stand ist die Preisangabe angreifbar.
    expect(PRICING_DISCLAIMER).toContain(LANDSCAPE_AS_OF_LABEL);
  });

  it('haelt Budget-Tabelle und Auswahlkriterien befuellt', () => {
    expect(BUDGET_GUIDANCE.length).toBeGreaterThan(0);
    for (const b of BUDGET_GUIDANCE) {
      expect(b.recommendation.trim(), `${b.size}: keine Empfehlung`).not.toBe('');
    }
    // Die Ueberschrift der Sektion nennt "Sechs Kriterien" als festen Text.
    expect(SELECTION_CRITERIA.length).toBe(6);
    for (const c of SELECTION_CRITERIA) {
      expect(c.why.trim(), `${c.title}: keine Begruendung`).not.toBe('');
    }
  });
});
