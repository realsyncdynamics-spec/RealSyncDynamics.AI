import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * COMMERCIAL-SSOT: temporary production hotfix.
 * Canonical source migration tracked in Phase 2.
 *
 * `check:offer-prices` ist die maschinelle Fassung des Grundsatzes, an dem
 * sich Spur A dreimal abgearbeitet hat: Ein öffentlich zugesicherter Preis
 * ist ein Angebot und darf nur dort stehen, wo der Kaufpfad ihn einlösen
 * kann.
 *
 * Ein Guard, den niemand prüft, verrottet — er kann stillschweigend nichts
 * mehr finden (falscher Betragssatz, kaputter Parser, zu grosszuegige
 * Kommentar-Erkennung), und niemandem faellt es auf, weil er gruen bleibt.
 * Dieser Test prüft deshalb, dass er ANSCHLAEGT, nicht nur dass er läuft.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SCRIPT = join(ROOT, 'scripts', 'check-offer-prices.mjs');

function run(): { code: number; out: string } {
  try {
    const out = execFileSync('node', [SCRIPT], { cwd: ROOT, encoding: 'utf8' });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

// Jeder Test startet den Guard als eigenen Prozess; der laeuft einmal ueber
// den gesamten `src`-Baum und braucht dafuer mehrere Sekunden. Unter der
// Parallellast der Gesamtsuite reicht Vitests Standard von 5 s nicht — die
// Tests schlugen dann mit Timeout fehl, ohne dass am Guard etwas falsch war.
const GUARD_TIMEOUT_MS = 60_000;

describe('check:offer-prices', () => {
  it('ist auf dem aktuellen Stand grün', () => {
    const { code, out } = run();
    expect(out).toContain('Kein öffentlicher Betrag ohne einlösbaren Kaufpfad');
    expect(code).toBe(0);
  }, GUARD_TIMEOUT_MS);

  it('leitet die Beträge aus der SSoT ab, nicht aus einer eigenen Liste', () => {
    const { out } = run();
    // Enterprise (contract) sowie Agency und Partner (legacy) — monatlich und jährlich.
    for (const amount of ['1249', '12490', '699', '6900', '1999', '19000']) {
      expect(out, `Betrag ${amount} fehlt im geprüften Satz`).toContain(amount);
    }
    // Verkaufbare Pläne gehören ausdrücklich NICHT dazu: ihr Preis ist einlösbar.
    expect(out).not.toContain('79 € (starter)');
    expect(out).not.toContain('249 € (growth)');
  }, GUARD_TIMEOUT_MS);

  it('schlägt an, wenn ein neuer Betrag ohne Kaufpfad öffentlich auftaucht', () => {
    // Mutationsprobe: Ein Guard, der nichts findet, ist wertlos. Die Datei
    // wird unveraendert zurueckgeschrieben, egal wie der Lauf ausgeht.
    const victim = join(ROOT, 'src', 'pages', 'Press.tsx');
    const original = readFileSync(victim, 'utf8');
    try {
      writeFileSync(victim, `${original}\nexport const PRICE_LEAK_PROBE = 'Partner 1.999 €/Monat';\n`);
      const { code, out } = run();
      expect(code, 'Guard blieb grün, obwohl ein Betrag ohne Kaufpfad eingefügt wurde').toBe(1);
      expect(out).toContain('NEUE öffentliche Beträge');
      expect(out).toContain('Press.tsx');
    } finally {
      writeFileSync(victim, original);
    }
  }, GUARD_TIMEOUT_MS);

  it('meldet eine verwaiste Grundlinie, statt sie still zu dulden', () => {
    const baselinePath = join(ROOT, 'scripts', 'offer-price-baseline.json');
    const original = readFileSync(baselinePath, 'utf8');
    try {
      const withGhost = JSON.parse(original);
      withGhost.known['src/pages/DoesNotExist.tsx:1'] = 'erfundener Eintrag';
      writeFileSync(baselinePath, JSON.stringify(withGhost, null, 2) + '\n');
      const { code, out } = run();
      expect(code, 'verwaiste Grundlinien-Einträge müssen auffallen').toBe(1);
      expect(out).toContain('Aus der Grundlinie verschwunden');
    } finally {
      writeFileSync(baselinePath, original);
    }
  }, GUARD_TIMEOUT_MS);

  it('zählt Beträge in Kommentaren nicht als Angebot', () => {
    // Die Erklärtexte dieses Branches nennen 1.249 € mehrfach — in
    // mehrzeiligen Kommentaren, deren Folgezeilen wie Code aussehen.
    const { code } = run();
    expect(code).toBe(0);
  }, GUARD_TIMEOUT_MS);
});
