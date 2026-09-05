/**
 * Bewertung der Banner-Gestaltung — die Regel, nicht der Browser.
 *
 * Geprüft wird `assessConsentBanner`, weil dort die Aussage entsteht, die
 * am Ende im Bericht des Kunden steht. Das Einsammeln der Schaltflächen aus
 * dem DOM (`collectConsentButtons` in `scanner.ts`) braucht Chromium und ist
 * hier bewusst nicht mitgetestet: Es misst nur, es entscheidet nichts.
 *
 * Rechtlicher Bezug: § 25 Abs. 1 TDDDG, Art. 4 Nr. 11 und Art. 7 Abs. 3
 * DSGVO, BfDI-Empfehlungen zu Einwilligungsbannern vom 13.08.2026.
 */

import { describe, it, expect } from 'vitest';
import {
  assessConsentBanner,
  classifyConsentButton,
  PROMINENCE_THRESHOLD,
  type ConsentButtonDescriptor,
} from '../../services/playwright-scanner/src/consent-banner.js';

/** Ein gefüllter Knopf in typischer Bannergröße. */
function button(
  text: string,
  overrides: Partial<ConsentButtonDescriptor> = {},
): ConsentButtonDescriptor {
  return {
    text,
    width: 160,
    height: 40,
    fontSizePx: 14,
    fontWeight: 700,
    backgroundColor: 'rgb(0, 82, 255)',
    visible: true,
    ...overrides,
  };
}

describe('classifyConsentButton', () => {
  it('erkennt Zustimmung, Ablehnung und Einstellungen in beiden Sprachen', () => {
    expect(classifyConsentButton('Alles akzeptieren')).toBe('accept');
    expect(classifyConsentButton('Accept all')).toBe('accept');
    expect(classifyConsentButton('Alle ablehnen')).toBe('reject');
    expect(classifyConsentButton('Reject all')).toBe('reject');
    expect(classifyConsentButton('Einstellungen')).toBe('settings');
    expect(classifyConsentButton('Manage preferences')).toBe('settings');
    expect(classifyConsentButton('Zur Startseite')).toBe('other');
  });

  it('liest „Nur notwendige akzeptieren" als Ablehnung, nicht als Zustimmung', () => {
    // Der Fall, an dem eine naive Reihenfolge scheitert: Die Beschriftung
    // enthält „akzeptieren", ist aber die Verweigerung. Klassifiziert man sie
    // als Zustimmung, meldet der Scan „kein Ablehnen vorhanden" — ein
    // Falschbefund genau bei den Bannern, die es richtig machen.
    expect(classifyConsentButton('Nur notwendige Cookies akzeptieren')).toBe('reject');
    expect(classifyConsentButton('Only necessary cookies')).toBe('reject');
    expect(classifyConsentButton('Weiter ohne Einwilligung')).toBe('reject');
  });

  it('ignoriert Groß-/Kleinschreibung und überflüssige Leerzeichen', () => {
    expect(classifyConsentButton('  ALLE   ABLEHNEN \n')).toBe('reject');
    expect(classifyConsentButton('')).toBe('other');
  });
});

describe('assessConsentBanner', () => {
  it('meldet kein Banner, wenn keine Consent-Schaltfläche sichtbar ist', () => {
    const result = assessConsentBanner([button('Zur Startseite'), button('Kontakt')]);

    expect(result.banner_detected).toBe(false);
    expect(result.findings.map((f) => f.code)).toEqual(['CB_NO_BANNER_DETECTED']);
    // Niedrig, nicht hoch: Ohne einwilligungspflichtige Cookies ist ein
    // fehlendes Banner richtig. Den Widerspruch stiftet erst der übrige Scan.
    expect(result.findings[0]?.severity).toBe('low');
  });

  it('lässt ein gleichwertiges Banner ohne Befund durch', () => {
    // Nachgebaut nach unserem eigenen Banner (src/components/CookieConsent.tsx):
    // beide Schaltflächen teilen sich Klassen und `flex-1`.
    const result = assessConsentBanner([
      button('Alles akzeptieren'),
      button('Alle ablehnen'),
      button('Einstellungen', { width: 110, backgroundColor: 'rgb(10, 10, 11)' }),
    ]);

    expect(result.banner_detected).toBe(true);
    expect(result.reject_on_first_layer).toBe(true);
    expect(result.equal_prominence).toBe(true);
    expect(result.prominence_ratio).toBe(1);
    expect(result.findings).toEqual([]);
  });

  it('meldet fehlende Ablehnung auf der ersten Ebene als schweren Befund', () => {
    const result = assessConsentBanner([
      button('Alles akzeptieren'),
      button('Einstellungen'),
    ]);

    expect(result.reject_on_first_layer).toBe(false);
    const finding = result.findings.find((f) => f.code === 'CB_NO_REJECT_ON_FIRST_LAYER');
    expect(finding?.severity).toBe('high');
    // Der Hinweis auf die zweite Ebene erscheint nur, wenn es sie gibt.
    expect(finding?.detail).toContain('Einstellungen');
    expect(result.prominence_ratio).toBeNull();
  });

  it('nennt die zweite Ebene nicht, wenn es gar keine Einstellungen gibt', () => {
    const result = assessConsentBanner([button('Accept all')]);

    const finding = result.findings.find((f) => f.code === 'CB_NO_REJECT_ON_FIRST_LAYER');
    expect(finding).toBeDefined();
    expect(finding?.detail).not.toContain('Einstellungen');
  });

  it('meldet eine kleinere Ablehnung als weniger deutlich', () => {
    const result = assessConsentBanner([
      button('Alles akzeptieren'),
      button('Alle ablehnen', { width: 60, height: 24 }),
    ]);

    expect(result.reject_on_first_layer).toBe(true);
    expect(result.equal_prominence).toBe(false);
    expect(result.prominence_ratio).toBeLessThan(PROMINENCE_THRESHOLD);
    const finding = result.findings.find((f) => f.code === 'CB_REJECT_LESS_PROMINENT');
    expect(finding?.severity).toBe('medium');
    expect(finding?.detail).toContain('%');
  });

  it('erkennt den Link-statt-Knopf-Trick auch bei gleicher Fläche', () => {
    // Der häufigste Fall in der Praxis: Ablehnen ist genauso groß, hat aber
    // keine Fläche — es liest sich als Fußnote neben einem gefüllten Knopf.
    const result = assessConsentBanner([
      button('Alles akzeptieren'),
      button('Alle ablehnen', { backgroundColor: 'rgba(0, 0, 0, 0)' }),
    ]);

    expect(result.prominence_ratio).toBe(1);
    expect(result.equal_prominence).toBe(false);
    expect(result.findings.map((f) => f.code)).toContain('CB_REJECT_LESS_PROMINENT');
  });

  it('zählt unsichtbare Schaltflächen nicht mit', () => {
    // Viele CMPs halten die zweite Ebene im DOM bereit, bevor sie geöffnet
    // wird. Zählte man sie mit, bestünde jedes Banner die Prüfung.
    const result = assessConsentBanner([
      button('Alles akzeptieren'),
      button('Alle ablehnen', { visible: false }),
    ]);

    expect(result.reject_on_first_layer).toBe(false);
    expect(result.findings.map((f) => f.code)).toContain('CB_NO_REJECT_ON_FIRST_LAYER');
  });

  it('nimmt bei doppelten Schaltflächen die größte je Rolle', () => {
    // Desktop- und Mobil-Variante im selben DOM: Der Vergleich muss die
    // tatsächlich ausgelieferte Größe nehmen, nicht die erste gefundene.
    const result = assessConsentBanner([
      button('Alles akzeptieren', { width: 40, height: 12 }),
      button('Alles akzeptieren'),
      button('Alle ablehnen', { width: 40, height: 12 }),
      button('Alle ablehnen'),
    ]);

    expect(result.prominence_ratio).toBe(1);
    expect(result.findings).toEqual([]);
  });

  it('führt jeden Befund auf eine Norm zurück', () => {
    // Ein Compliance-Befund ohne Rechtsgrundlage ist im Bericht wertlos —
    // der Kunde muss nachlesen können, woran er gemessen wurde.
    const result = assessConsentBanner([button('Accept all')]);

    for (const finding of result.findings) {
      expect(finding.legal_basis).toMatch(/TDDDG|DSGVO/);
      expect(finding.title.length).toBeGreaterThan(0);
    }
  });
});
