import { beforeEach, describe, expect, it } from 'vitest';

import {
  TRACK_PARAM,
  readModuleSelection,
  readTrack,
  resolveTrack,
  withTrack,
  writeModuleSelection,
  writeTrack,
} from '../../src/unified-entry/productTrack';

/**
 * Der Produktpfad wird vor der Registrierung gewählt — also zu einem
 * Zeitpunkt, an dem es noch keinen Mandanten gibt, unter dem er gespeichert
 * werden könnte. Er reist deshalb durch `sessionStorage` und die URL. Beides
 * ist Nutzereingabe: Diese Tests sichern ab, dass beschädigte oder
 * manipulierte Werte den Trichter nicht in einen ungültigen Zustand bringen.
 */
beforeEach(() => {
  window.sessionStorage.clear();
});

describe('Produktpfad merken', () => {
  it('liefert ohne Auswahl keinen Pfad', () => {
    expect(readTrack()).toBeNull();
  });

  it('gibt einen geschriebenen Pfad unverändert zurück', () => {
    writeTrack('keep_frontend');
    expect(readTrack()).toBe('keep_frontend');
  });

  it('verwirft einen manipulierten Wert im Speicher', () => {
    window.sessionStorage.setItem('rsd.funnel.track', 'admin');
    expect(readTrack()).toBeNull();
  });
});

describe('Produktpfad auflösen', () => {
  it('lässt die URL gewinnen, damit ein geteilter Link reproduzierbar bleibt', () => {
    writeTrack('keep_frontend');
    expect(resolveTrack(`${TRACK_PARAM}=modernize_frontend`)).toBe('modernize_frontend');
  });

  it('fällt auf die Sitzung zurück, wenn die URL nichts sagt', () => {
    writeTrack('modernize_frontend');
    expect(resolveTrack('domain=example.de')).toBe('modernize_frontend');
  });

  it('ignoriert einen ungültigen Pfad in der URL', () => {
    writeTrack('keep_frontend');
    expect(resolveTrack(`${TRACK_PARAM}=enterprise`)).toBe('keep_frontend');
  });
});

describe('Scan-Parameter beim Pfadwechsel erhalten', () => {
  it('ergänzt den Pfad, ohne das Scan-Ergebnis zu verlieren', () => {
    const result = new URLSearchParams(withTrack('domain=example.de&score=62', 'keep_frontend'));
    expect(result.get('domain')).toBe('example.de');
    expect(result.get('score')).toBe('62');
    expect(result.get(TRACK_PARAM)).toBe('keep_frontend');
  });

  it('überschreibt einen bereits gesetzten Pfad', () => {
    const result = new URLSearchParams(withTrack(`${TRACK_PARAM}=modernize_frontend`, 'keep_frontend'));
    expect(result.getAll(TRACK_PARAM)).toEqual(['keep_frontend']);
  });
});

describe('Modulauswahl merken', () => {
  it('enthält ohne Auswahl nur das Pflichtmodul', () => {
    expect(readModuleSelection()).toEqual(['governance_core']);
  });

  it('gibt eine gespeicherte Auswahl normalisiert zurück', () => {
    writeModuleSelection(['booking']);
    expect(readModuleSelection()).toEqual(['governance_core', 'booking']);
  });

  it('überlebt beschädigten JSON im Speicher', () => {
    window.sessionStorage.setItem('rsd.funnel.modules', '{kaputt');
    expect(readModuleSelection()).toEqual(['governance_core']);
  });

  it('verwirft unbekannte Modul-IDs aus dem Speicher', () => {
    window.sessionStorage.setItem('rsd.funnel.modules', JSON.stringify(['booking', 'root_access']));
    expect(readModuleSelection()).toEqual(['governance_core', 'booking']);
  });
});
