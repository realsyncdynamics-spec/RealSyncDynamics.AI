/**
 * Prüft die Handlungs-Abbildung gegen den gemessenen Scanner-Vertrag.
 *
 * Der Produktgrundsatz lautet „keine generischen Upsells": Eine Empfehlung
 * darf nur aus dem folgen, was der Scan beobachtet hat. Diese Datei nagelt
 * das in **beide** Richtungen fest:
 *
 *   1. Kein Befund ohne Handlung — sonst endet der Bericht wieder in einer
 *      Mängelliste.
 *   2. Keine Handlung ohne Befund — sonst steht hier eine Empfehlung, die
 *      der Scanner nie auslöst, und aus einer Abbildung wird ein Katalog
 *      von Verkaufsanlässen.
 *
 * Die Referenz ist `test/fixtures/gdpr-audit-production-contract.json` —
 * gemessen an 159 Produktions-Audits, nicht aus dem Code erzeugt.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ACTION_MAP,
  AUTOMATE_EVIDENCE_GAP,
  buildActionPlan,
  horizonFor,
  moduleHref,
  primaryCta,
  type DecisionInput,
  type FindingSeverity,
} from '../../shared/reality-decision';
import { BOOKABLE_MODULES } from '../../shared/pricing';

const contract = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/gdpr-audit-production-contract.json'), 'utf-8'),
) as { id_severity: Record<string, FindingSeverity> };

const CONTRACT_CODES = Object.keys(contract.id_severity);
const allFindings: DecisionInput[] = CONTRACT_CODES.map((id) => ({ id, severity: contract.id_severity[id] }));

describe('Vertragstreue der Abbildung', () => {
  it('bildet jeden Befund ab, den der Scanner liefert', () => {
    const missing = CONTRACT_CODES.filter((c) => !(c in ACTION_MAP));
    expect(missing, `Befunde ohne Handlung: ${missing.join(', ')}`).toEqual([]);
  });

  it('kennt keinen Befund, den der Scanner nie liefert', () => {
    // Die Gegenrichtung. Ohne sie waere hier Platz fuer Empfehlungen, die
    // aus nichts folgen — genau der generische Upsell.
    const invented = Object.keys(ACTION_MAP).filter((c) => !CONTRACT_CODES.includes(c));
    expect(invented, `Handlungen ohne Befund: ${invented.join(', ')}`).toEqual([]);
  });

  it('verweist nur auf Module, die es im Katalog gibt', () => {
    const known = new Set(BOOKABLE_MODULES.map((m) => m.id));
    for (const [code, m] of Object.entries(ACTION_MAP)) {
      if (m.module === null) continue;
      expect(known.has(m.module), `${code} → ${m.module}`).toBe(true);
    }
  });

  it('gibt jeder Handlung Auswirkung und Massnahme in Klartext', () => {
    for (const [code, m] of Object.entries(ACTION_MAP)) {
      expect(m.impact.length, code).toBeGreaterThan(30);
      expect(m.action.length, code).toBeGreaterThan(20);
      // Keine Platzhalter, keine offenen Enden.
      expect(m.action, code).not.toMatch(/TODO|demnächst|coming soon/i);
    }
  });

  it('sichert nirgends Konformität zu', () => {
    const prose = Object.values(ACTION_MAP).map((m) => `${m.impact} ${m.action}`).join(' ');
    expect(prose).not.toMatch(/ist DSGVO-konform|rechtskonform|garantiert|sichert zu/i);
  });
});

describe('Priorisierung', () => {
  it('ordnet nach Risiko, nicht nach Spur', () => {
    expect(horizonFor('critical')).toBe('now');
    expect(horizonFor('high')).toBe('now');
    expect(horizonFor('medium')).toBe('soon');
    expect(horizonFor('low')).toBe('ongoing');
    expect(horizonFor('info')).toBe('ongoing');
  });

  it('stellt das Schwerste nach oben', () => {
    const plan = buildActionPlan([
      { id: 'no_hsts', severity: 'medium' },
      { id: 'no_privacy_link', severity: 'critical' },
      { id: 'ga_no_ip_anon', severity: 'high' },
    ]);
    expect(plan.now.map((i) => i.findingCode)).toEqual(['no_privacy_link', 'ga_no_ip_anon']);
    expect(plan.soon.map((i) => i.findingCode)).toEqual(['no_hsts']);
  });

  it('laesst nichts unter den Tisch fallen', () => {
    const plan = buildActionPlan(allFindings);
    const total = plan.now.length + plan.soon.length + plan.ongoing.length;
    expect(total).toBe(CONTRACT_CODES.length);
    expect(plan.unmapped).toEqual([]);
  });

  it('gewichtet Module nach dem, was sie tatsaechlich adressieren', () => {
    const plan = buildActionPlan(allFindings);
    // Governance Core traegt die meisten Befunde — es steht deshalb vorn,
    // nicht weil es das teuerste oder das erste im Katalog waere.
    expect(plan.recommendedModules[0]).toBe('governance_core');
  });

  it('empfiehlt kein Modul, wenn nichts gefunden wurde', () => {
    const plan = buildActionPlan([]);
    expect(plan.recommendedModules).toEqual([]);
    expect(plan.now).toEqual([]);
  });

  it('meldet unbekannte Codes, statt sie stillschweigend zu verschlucken', () => {
    const plan = buildActionPlan([{ id: 'voellig_neuer_code', severity: 'high' }]);
    expect(plan.unmapped).toEqual(['voellig_neuer_code']);
    expect(plan.now).toEqual([]);
  });
});

describe('Ehrlichkeit der Empfehlung', () => {
  it('haengt kein Produkt an Befunde, die keines brauchen', () => {
    // TLS und Security-Header sind Sache des Hostings. Ein Modul daran
    // waere ein erfundener Bedarf.
    for (const code of ['no_https', 'no_hsts', 'no_csp', 'no_xframe', 'mixed_content']) {
      expect(ACTION_MAP[code].module, code).toBeNull();
    }
  });

  it('haelt die AUTOMATE-Spur leer, solange nichts sie belegt', () => {
    const plan = buildActionPlan(allFindings);
    const automate = [...plan.now, ...plan.soon, ...plan.ongoing].filter((i) => i.track === 'automate');
    expect(automate).toEqual([]);
  });

  it('benennt, welche Signale fuer AUTOMATE fehlen', () => {
    // Eine leere Spur ohne Begruendung waere eine Luecke; mit Begruendung
    // ist sie ein Messergebnis ueber den Scan.
    expect(AUTOMATE_EVIDENCE_GAP.length).toBeGreaterThanOrEqual(3);
  });

  it('fuehrt Modul-CTAs dorthin, wo es sie wirklich gibt', () => {
    // Es gibt keinen Kaufweg je Modul — stripe-checkout nimmt nur plan_key.
    expect(moduleHref(true)).toBe('/app/marketplace');
    expect(moduleHref(false)).toBe('/pricing');
  });

  it('macht die Scan-Uebernahme zum primaeren Schritt', () => {
    const cta = primaryCta('abc-123');
    expect(cta.href).toBe('/onboarding/abc-123');
    expect(cta.label.length).toBeGreaterThan(10);
  });
});

describe('Spuren des Produktbilds', () => {
  it('ordnet Pflichtangaben und Tracking der GOVERN-Spur zu', () => {
    for (const code of ['no_privacy_link', 'no_imprint_link', 'tracker_no_consent', 'cookies_pre_consent']) {
      expect(ACTION_MAP[code].track, code).toBe('govern');
    }
  });

  it('ordnet Auslieferung und Auffindbarkeit der BUILD-Spur zu', () => {
    for (const code of ['no_https', 'mixed_content', 'no_og_tags', 'meta_refresh']) {
      expect(ACTION_MAP[code].track, code).toBe('build');
    }
  });

  it('fuehrt einen erkannten KI-Chatbot zur KI-Governance, nicht zum Bot-Verkauf', () => {
    // Der Befund belegt, dass ein KI-System laeuft — nicht, dass eines fehlt.
    const m = ACTION_MAP['rule:AI_ACT_LIMITED_RISK_CHATBOT'];
    expect(m.track).toBe('govern');
    expect(m.module).toBe('advanced_ai_governance');
  });
});
