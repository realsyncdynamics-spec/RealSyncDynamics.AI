/**
 * website-operations-agent: Autorisierung vor Wirkung.
 *
 * ## Warum es diesen Test gibt
 *
 * Die Function nahm `tenant_id` aus dem Body und pruefte davon nur die
 * Existenz — der Kommentar im Code lautete woertlich "1. Verify tenant
 * exists". Eine Mitgliedschaft wurde nie geprueft. Da die Function mit dem
 * Default `verify_jwt = true` laeuft und der Anon-Key ein gueltiges JWT ist,
 * das im Frontend-Bundle ausgeliefert wird, konnte damit jeder einen fremden
 * Mandanten benennen: Provider-Kosten auf Betreiberrechnung, und
 * `website_projects`- sowie `deployment_logs`-Zeilen unter fremdem Mandanten.
 *
 * Dasselbe Muster wie bei enterprise-ai-os-agents-run (PR #1383).
 *
 * ## Was dieser Test belegt — und was nicht
 *
 * Die Entscheidungslogik (401 ohne Sitzung, 403 bei fremdem Mandanten)
 * liegt in `_shared/auth.ts` und wird von sechs weiteren Functions genutzt.
 * Dieser PR implementiert sie NICHT neu, sondern schliesst die Function an
 * sie an. Ihr Laufzeitverhalten ist aus Vitest nicht pruefbar: `auth.ts`
 * importiert `jsr:@supabase/supabase-js`, und `vitest.config.ts` loest
 * `jsr:`-Spezifier nicht auf.
 *
 * Geprueft wird deshalb hier, was am Quelltext pruefbar IST und was zuvor
 * verletzt war: dass die Autorisierung ueberhaupt stattfindet, dass sie vor
 * jeder Wirkung steht, und dass der vom Aufrufer genannte Mandant nach der
 * Pruefung nicht mehr verwendet wird. Die Live-Bestaetigung der Statuscodes
 * gehoert in einen Durchlauf mit echten Sitzungen, nicht in diese Datei.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const QUELLE = readFileSync(
  resolve(ROOT, 'supabase/functions/website-operations-agent/index.ts'),
  'utf8',
);

/** Kommentarfrei — die Zusicherungen gelten dem Code, nicht der Prosa. */
const code = QUELLE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('website-operations-agent: Autorisierung findet statt', () => {
  it('nutzt den gemeinsamen Resolver aus _shared/auth.ts', () => {
    // Kein zweiter Auth-Pfad: dieselbe Funktion, die website-domain-manager,
    // evidence-anchor und integration-credentials schon verwenden.
    expect(code).toContain("from '../_shared/auth.ts'");
    expect(code).toContain('requireAuthAndTenant');
  });

  it('reicht die Ablehnung unveraendert durch', () => {
    expect(code).toContain('const auth = await requireAuthAndTenant(req, body.tenant_id)');
    expect(code).toContain('if (auth instanceof Response) return auth');
  });

  it('prueft die Existenz nicht mehr als Ersatz fuer die Berechtigung', () => {
    // Die alte Pruefung akzeptierte jeden existierenden Mandanten. Eine
    // Mitgliedschaft setzt den Mandanten ohnehin voraus, und 403 statt 404
    // verraet nicht, welche Mandanten es gibt.
    expect(code).not.toContain('TENANT_NOT_FOUND');
    expect(code).not.toMatch(/from\('tenants'\)/);
  });
});

describe('website-operations-agent: Autorisierung steht vor jeder Wirkung', () => {
  // Fehlt die Autorisierung ganz, liefert indexOf -1 — und -1 liegt vor
  // allem. Jede Reihenfolge-Zusicherung muss deshalb ZUERST belegen, dass es
  // sie ueberhaupt gibt, sonst ist sie leer wahr und besteht auch auf dem
  // verwundbaren Stand.
  function autorisierungAn(): number {
    const i = code.indexOf('requireAuthAndTenant(req,');
    expect(i, 'Autorisierung fehlt vollstaendig').toBeGreaterThan(-1);
    return i;
  }

  it('vor dem ersten Datenbankzugriff', () => {
    const auth = autorisierungAn();
    const ersterZugriff = code.search(/admin\s*\n?\s*\.from\(|admin\.from\(/);
    expect(ersterZugriff, 'kein Datenbankzugriff gefunden').toBeGreaterThan(-1);
    expect(auth, 'Datenbankzugriff vor der Autorisierung').toBeLessThan(ersterZugriff);
  });

  it('vor dem Provider-Aufruf', () => {
    // Ein abgelehnter Aufruf darf keine Provider-Kosten ausloesen.
    const auth = autorisierungAn();
    const provider = code.indexOf('generateWebsiteWithAI(');
    expect(provider, 'Provider-Aufruf nicht gefunden').toBeGreaterThan(-1);
    expect(auth, 'Provider-Aufruf vor der Autorisierung').toBeLessThan(provider);
  });

  it('vor jedem tenant-bezogenen Write', () => {
    const auth = autorisierungAn();
    const writes = [...code.matchAll(/tenant_id:\s*tenantId/g)];
    expect(writes.length, 'kein tenant-bezogener Write gefunden').toBeGreaterThan(0);
    for (const treffer of writes) {
      expect(auth, `Write an Position ${treffer.index} liegt vor der Autorisierung`)
        .toBeLessThan(treffer.index!);
    }
  });
});

describe('website-operations-agent: der genannte Mandant wird nicht weiterverwendet', () => {
  it('body.tenant_id kommt genau einmal vor — als Argument der Pruefung', () => {
    // Das ist die eigentliche Zusicherung: nach der Pruefung existiert nur
    // noch der verifizierte Wert. Jede weitere Verwendung waere ein Rueckfall.
    const treffer = code.match(/body\.tenant_id/g) ?? [];
    expect(treffer.length).toBe(1);
    expect(code).toContain('requireAuthAndTenant(req, body.tenant_id)');
  });

  it('kein Write nimmt den ungeprueften Wert', () => {
    expect(code).not.toMatch(/tenant_id:\s*body\.tenant_id/);
  });

  it('die Folgeschritte rechnen mit dem geprueften Mandanten', () => {
    expect(code).toContain('const tenantId = auth.tenantId');
    expect(code).toMatch(/tenant_id:\s*tenantId/);
  });
});

describe('website-operations-agent: Plattform-Gate bleibt konsistent', () => {
  const toml = readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8');

  it('steht nicht auf verify_jwt = false', () => {
    // Kein Eintrag = Default true, so wie die Datei es fuer authentifizierte
    // SPA-Aufrufer selbst dokumentiert. Ein `false` waere hier ein Rueckfall.
    const kopf = '[functions.website-operations-agent]';
    const start = toml.indexOf(kopf);
    if (start === -1) return; // kein Eintrag: Default true, korrekt
    const rest = toml.slice(start + kopf.length);
    const next = rest.search(/\n\[/);
    const stanza = rest.slice(0, next === -1 ? rest.length : next);
    expect(stanza).not.toMatch(/verify_jwt\s*=\s*false/);
  });

  it('die Absicht ist in der config dokumentiert', () => {
    expect(toml).toContain('website-operations-agent: braucht eine echte Nutzersitzung');
  });
});
