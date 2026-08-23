/**
 * Der Scan zwischen Ergebnisseite und Registrierung.
 *
 * Speicher und Adresszeile sind Nutzereingabe. Was hier durchrutscht, landet
 * im Übernahme-Aufruf — deshalb prüfen die Fälle unten vor allem, was
 * **nicht** durchkommt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearScanSession,
  isValidScanId,
  readScanSession,
  rememberScanSession,
  resolveScanId,
} from '../../src/lib/scanSession';

const GUELTIG = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const ANDERE = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isValidScanId', () => {
  it('erkennt eine UUID', () => {
    expect(isValidScanId(GUELTIG)).toBe(true);
  });

  it.each([
    ['nicht-eine-uuid', 'freier Text'],
    ['', 'leer'],
    ['3f2504e0-4f89-41d3-9a0c', 'zu kurz'],
    ["' OR 1=1 --", 'Einschleusungsversuch'],
  ])('lehnt %s ab (%s)', (eingabe) => {
    expect(isValidScanId(eingabe)).toBe(false);
  });

  it('lehnt Werte ab, die gar keine Zeichenkette sind', () => {
    expect(isValidScanId(null)).toBe(false);
    expect(isValidScanId(undefined)).toBe(false);
    expect(isValidScanId({ scanId: GUELTIG })).toBe(false);
  });
});

describe('merken und lesen', () => {
  it('gibt zurück, was gemerkt wurde', () => {
    rememberScanSession({ scanId: GUELTIG, domain: 'firma.de' });
    expect(readScanSession()).toEqual({ scanId: GUELTIG, domain: 'firma.de' });
  });

  it('merkt sich eine ungültige Kennung gar nicht erst', () => {
    rememberScanSession({ scanId: 'unsinn', domain: 'firma.de' });
    expect(readScanSession()).toBeNull();
  });

  it('liefert ohne Eintrag null', () => {
    expect(readScanSession()).toBeNull();
  });

  it('verwirft beschädigten Inhalt, statt ihn zu reparieren', () => {
    window.sessionStorage.setItem('rsd.scan.session', '{kein gültiges json');
    expect(readScanSession()).toBeNull();
  });

  it('verwirft einen Eintrag mit manipulierter Kennung', () => {
    window.sessionStorage.setItem(
      'rsd.scan.session',
      JSON.stringify({ scanId: '../../andere', domain: 'firma.de' }),
    );
    expect(readScanSession()).toBeNull();
  });

  it('erträgt eine fehlende Domain', () => {
    window.sessionStorage.setItem('rsd.scan.session', JSON.stringify({ scanId: GUELTIG }));
    expect(readScanSession()).toEqual({ scanId: GUELTIG, domain: '' });
  });

  it('räumt auf', () => {
    rememberScanSession({ scanId: GUELTIG, domain: 'firma.de' });
    clearScanSession();
    expect(readScanSession()).toBeNull();
  });
});

describe('gesperrter Speicher', () => {
  it('bricht nicht ab, wenn das Schreiben verweigert wird', () => {
    // Privater Modus mancher Browser wirft beim Schreiben. Der Trichter
    // funktioniert auch ohne Speicher — er darf nur nicht abstürzen.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => rememberScanSession({ scanId: GUELTIG, domain: 'firma.de' })).not.toThrow();
  });

  it('bricht nicht ab, wenn das Lesen verweigert wird', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readScanSession()).toBeNull();
  });
});

describe('resolveScanId', () => {
  it('nimmt die Kennung aus der Adresszeile', () => {
    expect(resolveScanId(new URLSearchParams(`scan=${GUELTIG}`))).toBe(GUELTIG);
  });

  it('gibt der Adresszeile Vorrang vor der Sitzung', () => {
    // Wer einem Ergebnis-Link folgt, meint den Scan aus dem Link — auch wenn
    // im selben Tab vorher ein anderer lief.
    rememberScanSession({ scanId: ANDERE, domain: 'alt.de' });
    expect(resolveScanId(new URLSearchParams(`scan=${GUELTIG}`))).toBe(GUELTIG);
  });

  it('fällt auf die Sitzung zurück, wenn die Adresszeile nichts trägt', () => {
    rememberScanSession({ scanId: GUELTIG, domain: 'firma.de' });
    expect(resolveScanId(new URLSearchParams())).toBe(GUELTIG);
  });

  it('übergeht eine manipulierte Kennung in der Adresszeile', () => {
    rememberScanSession({ scanId: GUELTIG, domain: 'firma.de' });
    expect(resolveScanId(new URLSearchParams('scan=beliebig'))).toBe(GUELTIG);
  });

  it('liefert null, wenn es nichts zu holen gibt', () => {
    expect(resolveScanId(new URLSearchParams())).toBeNull();
  });
});
