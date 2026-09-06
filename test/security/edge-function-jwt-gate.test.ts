import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * C-04 — Regressionsschutz fuer den Plattform-JWT-Gate einzelner Edge Functions.
 *
 * `supabase/config.toml` entscheidet pro Function, ob Supabase den Aufruf
 * ueberhaupt erst authentifiziert. Ein `verify_jwt = false` ist manchmal
 * zwingend (Stripe- und Shopify-Webhooks koennen keinen Supabase-JWT
 * schicken, OAuth-Callbacks ebensowenig) — und manchmal ein offenes Tor.
 *
 * `ai-gateway` war der zweite Fall: Die Function fuehrt keine eigene
 * Authentifizierung durch, haelt aber ueber ihre Fallback-Kette gueltige
 * Anthropic-/OpenAI-Schluessel des Betreibers. Ein Probe-Request ohne jeden
 * Header lieferte in Produktion HTTP 200.
 *
 * Weil eine Zeile in einer TOML-Datei leicht und unauffaellig zurueckkippt,
 * wird der Zustand hier festgehalten. Der Test prueft die echte Datei, nicht
 * eine Kopie der Absicht.
 */

const CONFIG = resolve(__dirname, '../../supabase/config.toml');
const toml = readFileSync(CONFIG, 'utf-8');

/**
 * Liest `verify_jwt` fuer eine Function aus dem TOML.
 * Rueckgabe `null`, wenn die Stanza fehlt — dann greift Supabases Default
 * (`true`), was ebenfalls sicher ist, aber vom expliziten Fall unterschieden
 * werden soll.
 */
function verifyJwt(fn: string): boolean | null {
  // Zeilenweise statt per Regex ueber die ganze Datei: TOML-Stanzas enden an
  // der naechsten `[...]`-Zeile oder am Dateiende. Eine Lookahead-Variante
  // braeuchte dafuer ein Ende-Anker wie `\Z`, das JavaScript nicht kennt —
  // sie wuerde die letzte Stanza der Datei still verfehlen.
  const zeilen = toml.split('\n');
  const kopf = `[functions.${fn}]`;
  let drin = false;
  for (const zeile of zeilen) {
    const t = zeile.trim();
    if (t === kopf) { drin = true; continue; }
    if (drin && t.startsWith('[')) break;        // naechste Stanza
    if (!drin) continue;
    const m = t.match(/^verify_jwt\s*=\s*(true|false)$/);
    if (m) return m[1] === 'true';
  }
  return null;
}

describe('C-04 — ai-gateway ist nicht mehr oeffentlich', () => {
  it('ai-gateway verlangt einen JWT', () => {
    expect(verifyJwt('ai-gateway')).toBe(true);
  });

  it('der veraltete "follow-up PR"-Vermerk steht nicht mehr in der Datei', () => {
    // Der Kommentar hat die fehlende Auth jahrelang als geplante Arbeit
    // ausgewiesen. Bleibt er stehen, liest ihn der Naechste wieder als
    // "ist bekannt, ist eingeplant" — und genau das war das Problem.
    expect(toml).not.toMatch(/checks live inside the function once it/);
  });
});

describe('Bereits remediierte Functions bleiben geschlossen', () => {
  // F-04 / F-05 vom 2026-08-11. Diese drei standen einmal auf `false` und
  // wurden bewusst geschlossen; ein stilles Zurueckkippen waere ein Rueckfall
  // in denselben Befund.
  const remediiert = [
    'governance-risk-score',
    'governance-agents-list',
    'enterprise-ai-os-discovery-pending',
  ];

  for (const fn of remediiert) {
    it(`${fn} verlangt einen JWT`, () => {
      expect(verifyJwt(fn)).toBe(true);
    });
  }
});

describe('Webhook-Empfaenger bleiben absichtlich ohne Plattform-Gate', () => {
  // Gegenprobe: Der Test darf nicht dazu verleiten, pauschal alles auf `true`
  // zu setzen. Externe Aufrufer koennen keinen Supabase-JWT schicken; diese
  // Functions pruefen stattdessen HMAC-Signaturen bzw. Shared Secrets selbst.
  // Stuende hier `true`, waere die Stripe-Integration tot.
  const muessenOffenBleiben = ['stripe-webhook', 'shopify-webhooks', 'shopify-callback'];

  for (const fn of muessenOffenBleiben) {
    it(`${fn} bleibt ohne Plattform-Gate (eigene Signaturpruefung)`, () => {
      expect(verifyJwt(fn)).toBe(false);
    });
  }
});
