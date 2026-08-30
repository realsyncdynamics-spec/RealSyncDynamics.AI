import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AVAILABLE_FRONTEND_ENTRY_MODES,
  FRONTEND_DELIVERY_LIMIT_NOTE,
  FRONTEND_ENTRY_MODES,
  FRONTEND_INDIVIDUALITY_NOTE,
  PLANNED_FRONTEND_ENTRY_MODES,
  frontendEntryModeById,
} from '../../src/config/frontend-entry-modes';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Diese Datei sichert eine Produktregel ab, keine Textformatierung:
 * Es darf kein Einstiegsweg angeboten werden, den die Runtime nicht
 * ausführt. Ein Foto-Upload, der anschliessend nichts bewirkt, verspricht
 * eine Automation, die es nicht gibt.
 */
describe('Frontend-Einstiegswege — Struktur', () => {
  it('vergibt jede ID genau einmal', () => {
    const ids = FRONTEND_ENTRY_MODES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('teilt jeden Weg eindeutig in verfügbar oder geplant', () => {
    expect(AVAILABLE_FRONTEND_ENTRY_MODES.length + PLANNED_FRONTEND_ENTRY_MODES.length)
      .toBe(FRONTEND_ENTRY_MODES.length);
  });

  it('findet jeden Weg über seine ID', () => {
    for (const mode of FRONTEND_ENTRY_MODES) {
      expect(frontendEntryModeById(mode.id)).toBe(mode);
    }
  });

  it('beschreibt für jeden Weg eine Verarbeitungskette', () => {
    for (const mode of FRONTEND_ENTRY_MODES) {
      expect(mode.pipeline.length, mode.id).toBeGreaterThan(10);
      expect(mode.description.length, mode.id).toBeGreaterThan(10);
    }
  });
});

describe('Kein Weg ohne Runtime — die eigentliche Regel', () => {
  it('nennt für jeden nicht verfügbaren Weg Grund und Vorbedingung', () => {
    // Ohne diese beiden Angaben wäre „noch nicht verfügbar" eine Ausrede
    // statt einer Aussage. Der Kunde erfährt warum, das Team erfährt was fehlt.
    for (const mode of PLANNED_FRONTEND_ENTRY_MODES) {
      expect(mode.unavailableReason, mode.id).toBeTruthy();
      expect(mode.requires, mode.id).toBeTruthy();
    }
  });

  it('lässt bei verfügbaren Wegen keinen Grund und keine Vorbedingung stehen', () => {
    for (const mode of AVAILABLE_FRONTEND_ENTRY_MODES) {
      expect(mode.unavailableReason, mode.id).toBeNull();
      expect(mode.requires, mode.id).toBeNull();
    }
  });

  it('bietet Medien-Upload und Referenzbild nicht an, solange die Kette fehlt', () => {
    // Belegt am Code: supabase/functions/siteos/handlers/builder.ts nimmt
    // weder Bilder noch Screenshots entgegen. Wer diese Wege freischaltet,
    // muss vorher die Aufnahme dieser Eingaben gebaut haben.
    const builder = readFileSync(
      join(ROOT, 'supabase', 'functions', 'siteos', 'handlers', 'builder.ts'),
      'utf-8',
    );
    const acceptsMedia = /body\.(images?|media|logo|screenshot|assets)\b/.test(builder);
    if (!acceptsMedia) {
      expect(frontendEntryModeById('from_own_media')?.available).toBe(false);
      expect(frontendEntryModeById('from_reference')?.available).toBe(false);
    }
  });

  it('bietet „Frontend für bestehendes Backend" nicht an, solange Publish fehlt', () => {
    // siteos/handlers/ enthält discover, builder, runtime-scan, agents —
    // aber keinen Publish-Handler. Ohne Veröffentlichung gibt es keine
    // Präsentationsschicht, die ein fremdes Backend bedienen könnte.
    let hasPublishHandler = true;
    try {
      readFileSync(join(ROOT, 'supabase', 'functions', 'siteos', 'handlers', 'publish.ts'), 'utf-8');
    } catch {
      hasPublishHandler = false;
    }
    if (!hasPublishHandler) {
      expect(frontendEntryModeById('frontend_for_existing_backend')?.available).toBe(false);
    }
  });

  it('hält mindestens einen Weg offen — sonst wäre Option B eine leere Karte', () => {
    expect(AVAILABLE_FRONTEND_ENTRY_MODES.length).toBeGreaterThan(0);
  });
});

describe('Positionierung', () => {
  it('sagt zu, dass nicht mit starren Templates gearbeitet wird', () => {
    expect(FRONTEND_INDIVIDUALITY_NOTE).toMatch(/Template/i);
    expect(FRONTEND_INDIVIDUALITY_NOTE).toMatch(/individuell/i);
  });

  it('benennt, wo der Weg heute endet, statt eine Veröffentlichung zuzusagen', () => {
    expect(FRONTEND_DELIVERY_LIMIT_NOTE).toMatch(/Vorschau/i);
  });
});
