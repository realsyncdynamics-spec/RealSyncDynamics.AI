/**
 * website-maintenance-agent: Autorisierung vor Wirkung — und die Projekt-Bindung.
 *
 * ## Warum es diesen Test gibt
 *
 * Die Function hat sechs Aktionen. `run-daily-maintenance` war korrekt per
 * Service-Role-Bearer gesichert; die fuenf Einzelaktionen (scan-performance,
 * scan-seo, scan-links, scan-security, generate-suggestions) prueften **keine
 * Mitgliedschaft**. Autoritaet war allein `project_id` aus dem Body, gearbeitet
 * wurde mit einem Service-Role-Client, also an RLS vorbei.
 *
 * Der Kommentar im Code sagte "Einzelscans bleiben JWT-gated (Default)". Diese
 * Annahme traegt nicht: Der oeffentliche Anon-Key liegt im Frontend-Bundle und
 * ist ein gueltiges JWT, passiert das Plattform-verify_jwt also. Am 2026-09-26
 * gegen die deployte Function gemessen — mit diesem Key erreichte ein fremder
 * Aufrufer die Validierung (HTTP 400 "unknown action"), nicht ein 401.
 * Dieselbe falsche Annahme hatte schon website-operations-agent (#1392) und
 * optimize-analyze (#1615) verwundbar gemacht.
 *
 * ## Warum ZWEI Pruefungen, nicht eine
 *
 * `requireAuthAndTenant` allein genuegt hier **nicht** — und das ist der Kern
 * dieses Tests. Ein Mitglied von Mandant A koennte A's `tenant_id` nennen (die
 * Mitgliedschaftspruefung besteht!) und dazu eine `project_id` aus Mandant B.
 * Ohne zweite Pruefung liefe der Scan weiter gegen B und schriebe
 * `deployment_logs` unter B. Die Projektzugehoerigkeit muss deshalb gegen den
 * VERIFIZIERTEN Mandanten geprueft werden, nicht gegen den genannten.
 *
 * ## Was dieser Test belegt — und was nicht
 *
 * Die Entscheidungslogik (401 / 400 / 403) liegt in `_shared/auth.ts` und ist
 * hier nicht neu gebaut. Ihr Laufzeitverhalten ist aus Vitest nicht pruefbar:
 * `auth.ts` importiert `jsr:@supabase/supabase-js`, und `vitest.config.ts` loest
 * `jsr:`-Spezifier nicht auf. Dieselbe Einschraenkung wie in
 * `website-operations-agent-auth.test.ts` und `optimize-analyze-auth.test.ts`.
 *
 * Geprueft wird am Quelltext, was zuvor verletzt war: dass die Autorisierung
 * stattfindet, dass sie VOR dem switch und damit vor jeder Aktion steht, dass
 * die Projekt-Bindung gegen `auth.tenantId` laeuft, und dass das Cron-Tor
 * unberuehrt bleibt. Die Bestaetigung von 403 und 404 im Betrieb braucht echte
 * Sitzungen und gehoert nicht in diese Datei.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const QUELLE = readFileSync(
  resolve(ROOT, 'supabase/functions/website-maintenance-agent/index.ts'),
  'utf8',
);

/** Kommentarfrei — die Zusicherungen gelten dem Code, nicht der Prosa. */
const code = QUELLE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('website-maintenance-agent: Autorisierung findet statt', () => {
  it('nutzt den kanonischen Resolver aus _shared/auth.ts', () => {
    expect(code).toMatch(/from ['"]\.\.\/_shared\/auth\.ts['"]/);
    expect(code).toContain('requireAuthAndTenant');
  });

  it('reicht die Ablehnung unveraendert durch', () => {
    expect(code).toContain('const auth = await requireAuthAndTenant(req, body.tenant_id)');
    expect(code).toContain('if (auth instanceof Response) return auth');
  });

  it('gilt fuer alle Aktionen ausser dem Cron-Lauf', () => {
    // Ein Positiv-Filter je Aktion waere bruechig: eine neue Aktion faellt
    // dann stillschweigend durch. Der Negativ-Filter deckt jede kuenftige
    // Aktion automatisch mit ab.
    expect(code).toContain("if (body.action !== 'run-daily-maintenance')");
  });
});

describe('website-maintenance-agent: Autorisierung steht vor jeder Wirkung', () => {
  // Fehlt die Autorisierung ganz, liefert indexOf -1 — und -1 liegt vor allem.
  // Jede Reihenfolge-Zusicherung muss deshalb ZUERST belegen, dass es sie
  // ueberhaupt gibt, sonst ist sie leer wahr und besteht auch auf dem
  // verwundbaren Stand.
  function autorisierungAn(): number {
    const i = code.indexOf('requireAuthAndTenant(req,');
    expect(i, 'Autorisierung fehlt vollstaendig').toBeGreaterThan(-1);
    return i;
  }

  it('vor dem switch — also vor jeder einzelnen Aktion', () => {
    const auth = autorisierungAn();
    const sw = code.indexOf('switch (body.action)');
    expect(sw, 'switch nicht gefunden').toBeGreaterThan(-1);
    expect(auth, 'switch vor der Autorisierung').toBeLessThan(sw);
  });

  it('vor der Projekt-Bindung, und die vor dem switch', () => {
    const auth = autorisierungAn();
    const bindung = code.indexOf('PROJECT_NOT_FOUND');
    const sw = code.indexOf('switch (body.action)');
    expect(bindung, 'Projekt-Bindung nicht gefunden').toBeGreaterThan(-1);
    expect(auth).toBeLessThan(bindung);
    expect(bindung, 'Projekt-Bindung erst nach dem switch').toBeLessThan(sw);
  });
});

describe('website-maintenance-agent: die Projekt-Bindung laeuft gegen den geprueften Mandanten', () => {
  it('filtert website_projects auf auth.tenantId', () => {
    // DIE zentrale Zusicherung dieses PRs. Ohne diesen Filter bestuende die
    // Luecke weiter: eigener Mandant genannt, fremdes Projekt gescannt.
    expect(code).toMatch(/\.eq\('tenant_id',\s*auth\.tenantId\)/);
  });

  it('bindet dabei genau die genannte project_id', () => {
    expect(code).toMatch(/\.eq\('id',\s*body\.project_id\)/);
  });

  it('nimmt fuer die Bindung NICHT den Body-Mandanten', () => {
    expect(code).not.toMatch(/\.eq\('tenant_id',\s*body\.tenant_id\)/);
  });
});

describe('website-maintenance-agent: das Cron-Tor bleibt unberuehrt', () => {
  it('run-daily-maintenance verlangt weiterhin den Service-Role-Bearer', () => {
    // Diese Aktion kennt keine einzelne project_id und darf nicht durch die
    // neue Pruefung laufen — sie hatte bereits das richtige, eigene Tor.
    expect(code).toContain('`Bearer ${SRK}`');
    expect(code).toContain("jsonError(401, 'UNAUTHORIZED', 'cron only')");
  });
});

describe('website-maintenance-agent: Plattform-Gate bleibt konsistent', () => {
  const toml = readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8');

  it('steht nicht auf verify_jwt = false', () => {
    // Kein Eintrag = Default true. Ein `false` waere ein Rueckfall: der
    // Resolver verlangt eine Sitzung, und ohne Plattform-Gate erreichten auch
    // voellig tokenlose Aufrufe erst den Handler.
    const kopf = '[functions.website-maintenance-agent]';
    const i = toml.indexOf(kopf);
    if (i === -1) return; // kein Eintrag, Default gilt
    const block = toml.slice(i, i + 400);
    expect(block).not.toMatch(/verify_jwt\s*=\s*false/);
  });
});
