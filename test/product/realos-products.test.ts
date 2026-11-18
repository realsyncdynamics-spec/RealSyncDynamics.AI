import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getImplementation } from '../../src/product/implementation-status';
import {
  REALOS_PRODUCTS,
  REALOS_QUICK_ACTIONS,
  asWebAddress,
  matchProduct,
  realOsStatus,
} from '../../src/product/realos-products';

const APP_TSX = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8');
const hasRoute = (route: string) => APP_TSX.includes(`path="${route}"`);

describe('RealOS-Produkte — Konsistenz mit SSoT und Routen', () => {
  it('jeder statusId existiert in implementation-status.ts', () => {
    for (const p of REALOS_PRODUCTS) {
      expect(getImplementation(p.statusId), p.statusId).toBeDefined();
      if (p.subStatus) expect(getImplementation(p.subStatus.statusId), p.subStatus.statusId).toBeDefined();
    }
  });

  it('jedes Ziel ist eine Route in src/App.tsx', () => {
    for (const target of [...REALOS_PRODUCTS.map((p) => p.route), ...REALOS_QUICK_ACTIONS.map((a) => a.route)]) {
      expect(hasRoute(target), target).toBe(true);
    }
  });

  it('CTAs nennen nie Pilot, Demo, Call, Sales, Beratung oder Termin', () => {
    const forbidden = /\b(pilot|demo|call|sales|beratung|termin)/i;
    for (const label of [...REALOS_PRODUCTS.map((p) => p.cta), ...REALOS_QUICK_ACTIONS.map((a) => a.label)]) {
      expect(forbidden.test(label), label).toBe(false);
    }
  });

  it('genau drei Schritte pro Produkt, KI-Empfang zuerst (K4)', () => {
    for (const p of REALOS_PRODUCTS) expect(p.steps).toHaveLength(3);
    expect(REALOS_PRODUCTS[0].id).toBe('reception');
  });

  it('Status kommt aus der SSoT, unbekannt ⇒ fail-closed', () => {
    expect(realOsStatus('voice-telephony')).toBe(getImplementation('voice-telephony')?.status);
    expect(realOsStatus('gibt-es-nicht')).toBe('coming-soon');
  });
});

describe('matchProduct — deterministisches Intent-Routing', () => {
  it.each([
    ['Ich will Anfragen von Kunden per WhatsApp annehmen', 'reception'],
    ['Neue Homepage für meinen Betrieb bauen', 'builder'],
    ['Code-Fehler auf meiner Seite reparieren lassen', 'optimizer'],
    ['DSGVO-Nachweise für den Audit sammeln', 'governance'],
  ])('%s → %s', (text, id) => {
    expect(matchProduct(text)?.id).toBe(id);
  });

  it('„whatsapp“ trifft nicht den Stamm „app“ des Builders', () => {
    expect(matchProduct('whatsapp')?.id).toBe('reception');
  });

  it('ohne Treffer ⇒ null', () => {
    expect(matchProduct('Wetter morgen')).toBeNull();
    expect(matchProduct('   ')).toBeNull();
  });
});

describe('asWebAddress', () => {
  it('ergänzt https für nackte Domains', () => {
    expect(asWebAddress('example.de')).toBe('https://example.de');
    expect(asWebAddress('shop.example.de/kontakt')).toBe('https://shop.example.de/kontakt');
  });
  it('lässt http(s)-Adressen gelten', () => {
    expect(asWebAddress('https://example.com/a')).toBe('https://example.com/a');
  });
  it('Text mit Leerzeichen oder ohne TLD ist keine Adresse', () => {
    expect(asWebAddress('website bauen')).toBeNull();
    expect(asWebAddress('bot')).toBeNull();
  });
});
