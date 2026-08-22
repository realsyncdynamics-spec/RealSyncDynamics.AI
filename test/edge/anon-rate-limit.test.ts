import { describe, expect, it } from 'vitest';

import {
  ANON_BUILD_BURST,
  ANON_BUILD_DAILY,
  consumeRateLimit,
  pruneRateWindows,
  type RateWindow,
} from '../../supabase/functions/_shared/anonRateLimit';

/**
 * Das Kontingent ist die einzige Schranke zwischen einem offenen Endpunkt
 * und unbegrenzten Modellkosten. Es wird deshalb an den Rändern geprüft,
 * nicht nur im Normalfall.
 */
const OPTS = { max: 3, windowMs: 1000 };
const NOW = 1_000_000;

function fresh(): Map<string, RateWindow> {
  return new Map();
}

describe('Kontingent', () => {
  it('lässt genau `max` Aufrufe zu und den nächsten nicht', () => {
    const state = fresh();
    for (let i = 0; i < OPTS.max; i++) {
      expect(consumeRateLimit(state, 'a', NOW, OPTS).allowed, `Aufruf ${i + 1}`).toBe(true);
    }
    expect(consumeRateLimit(state, 'a', NOW, OPTS).allowed).toBe(false);
  });

  it('zählt die verbleibenden Aufrufe herunter', () => {
    const state = fresh();
    expect(consumeRateLimit(state, 'a', NOW, OPTS).remaining).toBe(2);
    expect(consumeRateLimit(state, 'a', NOW, OPTS).remaining).toBe(1);
    expect(consumeRateLimit(state, 'a', NOW, OPTS).remaining).toBe(0);
    expect(consumeRateLimit(state, 'a', NOW, OPTS).remaining).toBe(0);
  });

  it('beginnt nach Ablauf des Fensters von vorn', () => {
    const state = fresh();
    for (let i = 0; i < OPTS.max; i++) consumeRateLimit(state, 'a', NOW, OPTS);
    expect(consumeRateLimit(state, 'a', NOW, OPTS).allowed).toBe(false);
    expect(consumeRateLimit(state, 'a', NOW + OPTS.windowMs + 1, OPTS).allowed).toBe(true);
  });

  it('hält Herkünfte auseinander', () => {
    const state = fresh();
    for (let i = 0; i < OPTS.max; i++) consumeRateLimit(state, 'a', NOW, OPTS);
    expect(consumeRateLimit(state, 'a', NOW, OPTS).allowed).toBe(false);
    expect(consumeRateLimit(state, 'b', NOW, OPTS).allowed).toBe(true);
  });

  it('schreibt nur die erste Ablehnung im Fenster in den Prüfpfad', () => {
    // Sonst würde die Ablehnung selbst zur Last, gegen die sie schützt.
    const state = fresh();
    for (let i = 0; i < OPTS.max; i++) consumeRateLimit(state, 'a', NOW, OPTS);
    expect(consumeRateLimit(state, 'a', NOW, OPTS).shouldAuditDeny).toBe(true);
    expect(consumeRateLimit(state, 'a', NOW, OPTS).shouldAuditDeny).toBe(false);
    expect(consumeRateLimit(state, 'a', NOW, OPTS).shouldAuditDeny).toBe(false);
  });

  it('meldet im neuen Fenster wieder eine erste Ablehnung', () => {
    const state = fresh();
    for (let i = 0; i < OPTS.max; i++) consumeRateLimit(state, 'a', NOW, OPTS);
    consumeRateLimit(state, 'a', NOW, OPTS);

    const later = NOW + OPTS.windowMs + 1;
    for (let i = 0; i < OPTS.max; i++) consumeRateLimit(state, 'a', later, OPTS);
    expect(consumeRateLimit(state, 'a', later, OPTS).shouldAuditDeny).toBe(true);
  });

  it('zählt den Aufruf, bevor feststeht, ob er gelingt', () => {
    // Wer erst nach Erfolg zählt, lädt dazu ein, Fehler zu erzeugen, um das
    // Kontingent zu schonen.
    const state = fresh();
    consumeRateLimit(state, 'a', NOW, OPTS);
    expect(state.get('a')?.count).toBe(1);
  });

  it('lässt bei max = 0 gar nichts durch', () => {
    const state = fresh();
    // Erster Aufruf legt das Fenster an; der zweite trifft auf count >= 0.
    consumeRateLimit(state, 'a', NOW, { max: 0, windowMs: 1000 });
    expect(consumeRateLimit(state, 'a', NOW, { max: 0, windowMs: 1000 }).allowed).toBe(false);
  });
});

describe('Aufräumen', () => {
  it('entfernt abgelaufene Fenster und lässt laufende stehen', () => {
    const state = fresh();
    consumeRateLimit(state, 'alt', NOW, OPTS);
    consumeRateLimit(state, 'neu', NOW + 900, OPTS);

    const removed = pruneRateWindows(state, NOW + OPTS.windowMs + 1);
    expect(removed).toBe(1);
    expect(state.has('alt')).toBe(false);
    expect(state.has('neu')).toBe(true);
  });

  it('kommt mit einem leeren Zustand zurecht', () => {
    expect(pruneRateWindows(fresh(), NOW)).toBe(0);
  });
});

describe('Die gewählten Grenzen', () => {
  it('ist im Speicher enger als über den Tag', () => {
    // Der Speicher fängt Automatisierung ab, die Datenbank zieht die Grenze.
    expect(ANON_BUILD_BURST.max).toBeLessThan(ANON_BUILD_DAILY.max);
    expect(ANON_BUILD_BURST.windowMs).toBeLessThan(ANON_BUILD_DAILY.windowMs);
  });

  it('lässt echtes Ausprobieren zu', () => {
    // Ein Interessent probiert mehrfach und bessert nach. Eine Grenze, die
    // das verhindert, schützt nicht, sondern vertreibt.
    expect(ANON_BUILD_DAILY.max).toBeGreaterThanOrEqual(10);
  });

  it('lässt nicht unbegrenzt zu', () => {
    expect(ANON_BUILD_DAILY.max).toBeLessThanOrEqual(100);
  });
});
