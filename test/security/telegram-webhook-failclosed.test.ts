/**
 * telegram-webhook: das Secret ist Pflicht, nicht Kür.
 *
 * ## Warum es diesen Test gibt
 *
 * Die Function trägt in `config.toml` `verify_jwt = false`. Die Plattform
 * prüft also nichts; die einzige Authentisierung ist der Header
 * `X-Telegram-Bot-Api-Secret-Token`. Genau diese Prüfung stand bis zum
 * 2026-09-19 in einer Bedingung:
 *
 *     if (WEBHOOK_SECRET) {
 *       if (incoming !== WEBHOOK_SECRET) return …;
 *     }
 *
 * Fehlte `TELEGRAM_WEBHOOK_SECRET`, entfiel damit die Prüfung — nicht der
 * Zugriff. Jeder POST lief durch in einen Handler, der
 * `SUPABASE_SERVICE_ROLE_KEY` hält. Der Startup-Log warnte, verweigerte
 * aber nicht: fail-open an der einzigen Schranke.
 *
 * ## Was dieser Test belegt — und was nicht
 *
 * Die Function laeuft in Deno und laesst sich hier nicht ausfuehren
 * (`jsr:`-Spezifier loest `vitest.config.ts` nicht auf). Geprueft wird
 * deshalb die Quelle, und zwar die eine Eigenschaft, die zuvor verletzt
 * war: Die Secret-Pruefung steht nicht in einer Bedingung ueber ihr eigenes
 * Secret, und sie steht vor jeder Verarbeitung.
 *
 * Nicht geprueft: dass Telegram weiterhin 200 bekommt. Das ist Verhalten
 * zur Laufzeit; der Vertrag steht als Kommentar im Kopf der Function.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const QUELLE = readFileSync('supabase/functions/telegram-webhook/index.ts', 'utf8');

/** Kommentarfrei — die Zusicherungen gelten dem Code, nicht der Prosa. */
const code = QUELLE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('telegram-webhook: fail-closed am Webhook-Secret', () => {
  it('lehnt ab, wenn das Secret fehlt — nicht nur, wenn es falsch ist', () => {
    // Der Kern: `!WEBHOOK_SECRET` gehoert in die Ablehnungsbedingung.
    expect(code).toMatch(/if\s*\(\s*!WEBHOOK_SECRET\s*\|\|/);
  });

  it('haengt die Pruefung nicht mehr an `if (WEBHOOK_SECRET)`', () => {
    // Genau diese Form war der Befund. Sie darf nicht zurueckkehren.
    expect(code).not.toMatch(/if\s*\(\s*WEBHOOK_SECRET\s*\)\s*\{/);
  });

  // Reihenfolge nur INNERHALB des Handlers messen. Oberhalb von
  // `Deno.serve` stehen Hilfsfunktionen, die ebenfalls `.from(` enthalten;
  // ihre Textposition sagt nichts darueber, wann sie laufen. Der erste
  // Entwurf dieses Tests hat genau daran fehlgeschlagen.
  const handler = code.slice(code.indexOf('Deno.serve('));

  it('prueft, bevor der Update-Koerper gelesen wird', () => {
    expect(handler, 'Handler nicht gefunden').not.toHaveLength(0);
    const pruefung = handler.indexOf('x-telegram-bot-api-secret-token');
    const body = handler.indexOf('await req.json()');
    expect(pruefung, 'Secret-Pruefung nicht im Handler').toBeGreaterThan(-1);
    expect(body, 'req.json() nicht im Handler').toBeGreaterThan(-1);
    expect(pruefung, 'Der Koerper wird vor der Pruefung gelesen').toBeLessThan(body);
  });

  it('prueft vor jedem Datenbankzugriff im Handler', () => {
    const pruefung = handler.indexOf('x-telegram-bot-api-secret-token');
    const zugriff = handler.search(/\.from\(/);
    expect(pruefung, 'Secret-Pruefung nicht im Handler').toBeGreaterThan(-1);
    expect(zugriff, 'kein Datenbankzugriff im Handler gefunden').toBeGreaterThan(-1);
    expect(pruefung, 'Datenbankzugriff vor der Pruefung').toBeLessThan(zugriff);
  });
});

describe('telegram-webhook: der Plattform-Zustand, der das noetig macht', () => {
  const toml = readFileSync('supabase/config.toml', 'utf8');

  it('steht weiterhin auf verify_jwt = false — deshalb traegt das Secret allein', () => {
    // Kein Auftrag, das zu aendern: Telegram schickt kein Supabase-JWT.
    // Der Test haelt nur fest, warum die Pruefung oben fail-closed sein muss.
    // Zieht jemand die Function unter `verify_jwt = true`, faellt er und die
    // Begruendung gehoert neu geschrieben.
    const kopf = '[functions.telegram-webhook]';
    const start = toml.indexOf(kopf);
    expect(start, 'Eintrag in config.toml nicht gefunden').toBeGreaterThan(-1);
    const rest = toml.slice(start + kopf.length);
    const naechster = rest.search(/\n\[/);
    const stanza = rest.slice(0, naechster === -1 ? rest.length : naechster);
    expect(stanza).toMatch(/verify_jwt\s*=\s*false/);
  });
});
