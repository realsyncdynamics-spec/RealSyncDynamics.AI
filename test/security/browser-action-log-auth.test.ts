/**
 * browser-action-log: Autorisierung vor dem Eintrag im Pruefpfad.
 *
 * ## Warum es diesen Test gibt
 *
 * Die Function stand in config.toml auf `verify_jwt = false`, mit dem
 * Kommentar, der Mandant werde „per RLS validiert". Der INSERT lief aber mit
 * dem Service-Role-Client, und Service Role umgeht RLS. Es gab keinerlei
 * Eingangspruefung: `tenantId`, `actorId` und `evidenceHash` kamen ungeprueft
 * aus dem Body. Wer die URL kannte, konnte Evidence-Zeilen mit frei gewaehltem
 * Hash unter beliebigem Mandanten und beliebigem Akteur anlegen — der
 * Pruefpfad war damit kein Nachweis.
 *
 * Dasselbe Muster wie website-operations-agent (#1392) und
 * enterprise-ai-os-agents-run (#1383).
 *
 * ## Was dieser Test belegt — und was nicht
 *
 * Die Entscheidungslogik (401 ohne Sitzung, 403 ohne Mitgliedschaft) liegt in
 * `_shared/auth.ts`. Dieser Fix implementiert sie NICHT neu, sondern schliesst
 * die Function an sie an. Ihr Laufzeitverhalten ist aus Vitest nicht pruefbar
 * (`jsr:`-Import). Geprueft wird, was am Quelltext pruefbar ist und zuvor
 * verletzt war: dass die Autorisierung stattfindet, dass sie vor dem Write
 * steht, dass Mandant und Akteur aus der Pruefung stammen und nicht aus dem
 * Body, und dass das Plattform-Gate nicht wieder auf false faellt.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

function ohneKommentare(quelle: string): string {
  return quelle
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const code = ohneKommentare(
  readFileSync(resolve(ROOT, 'supabase/functions/browser-action-log/index.ts'), 'utf8'),
);

describe('browser-action-log: Autorisierung findet statt', () => {
  it('nutzt den gemeinsamen Resolver aus _shared/auth.ts', () => {
    expect(code).toContain("from '../_shared/auth.ts'");
    expect(code).toContain('requireAuthAndTenant');
  });

  it('reicht die Ablehnung unveraendert durch', () => {
    expect(code).toContain('const auth = await requireAuthAndTenant(req, payload.tenantId)');
    expect(code).toContain('if (auth instanceof Response) return auth');
  });

  it('baut keinen eigenen Service-Role-Client mehr', () => {
    // Der Admin-Client kommt aus dem AuthContext — erst nach der Pruefung.
    expect(code).not.toMatch(/createClient\(/);
    expect(code).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(code).toContain('auth.admin');
  });
});

describe('browser-action-log: Autorisierung steht vor dem Write', () => {
  function autorisierungAn(): number {
    const i = code.indexOf('requireAuthAndTenant(req,');
    expect(i, 'Autorisierung fehlt vollstaendig').toBeGreaterThan(-1);
    return i;
  }

  it('vor dem Insert nach browser_actions', () => {
    const auth = autorisierungAn();
    const insert = code.indexOf("from('browser_actions')");
    expect(insert, 'kein Insert gefunden').toBeGreaterThan(-1);
    expect(auth, 'Insert vor der Autorisierung').toBeLessThan(insert);
  });
});

describe('browser-action-log: Mandant und Akteur stammen aus der Pruefung', () => {
  it('payload.tenantId kommt genau einmal vor — als Argument der Pruefung', () => {
    const treffer = code.match(/payload\.tenantId/g) ?? [];
    expect(treffer.length).toBe(1);
  });

  it('der Write nimmt den geprueften Mandanten', () => {
    expect(code).toContain('const tenantId = auth.tenantId');
    expect(code).toMatch(/tenant_id:\s*tenantId/);
    expect(code).not.toMatch(/tenant_id:\s*payload\.tenantId/);
  });

  it('der Akteur kommt aus der Sitzung, nicht aus dem Body', () => {
    expect(code).toContain('const actorId = auth.user.id');
    expect(code).toMatch(/actor_id:\s*actorId/);
    expect(code).not.toContain('payload.actorId');
    expect(code).not.toContain('actorId?:');
  });
});

describe('browser-action-log: Plattform-Gate bleibt konsistent', () => {
  const toml = readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8');

  it('bleibt deklariert verify_jwt = false, solange die Function live so laeuft', () => {
    // Der Edge-Function-Drift-Guard prueft Repo gegen Live: eine entfernte
    // Deklaration bei live false ist UNDECLARED_NO_JWT. Das Gate schuetzt
    // ohnehin nicht (Anon-Key ist ein gueltiges JWT) — die Sicherheit liegt
    // im Handler, wie bei welcome-email (#1297). Wer auf Default true
    // umstellt, deployt zuerst und passt diesen Test dann an.
    const kopf = '[functions.browser-action-log]';
    const start = toml.indexOf(kopf);
    expect(start, 'Eintrag fehlt in config.toml').toBeGreaterThanOrEqual(0);
    const rest = toml.slice(start + kopf.length);
    const next = rest.search(/\n\[/);
    const stanza = rest.slice(0, next === -1 ? rest.length : next);
    expect(stanza).toMatch(/verify_jwt\s*=\s*false/);
  });

  it('die Absicht ist in der config dokumentiert', () => {
    expect(toml).toContain('browser-action-log: braucht eine echte Nutzersitzung');
    expect(toml).toContain('requireAuthAndTenant');
  });
});

describe('EmbeddedBrowserCanvas: sendet die Sitzung mit und keinen Akteur', () => {
  const canvas = ohneKommentare(
    readFileSync(resolve(ROOT, 'src/components/governance-os/EmbeddedBrowserCanvas.tsx'), 'utf8'),
  );

  it('ruft die Function ueber den Supabase-Client auf (haengt das User-JWT an)', () => {
    expect(canvas).toContain("functions.invoke");
    expect(canvas).toContain("'browser-action-log'");
    expect(canvas).not.toMatch(/fetch\([^)]*browser-action-log/);
  });

  it('protokolliert nicht ohne Sitzung', () => {
    const session = canvas.indexOf('auth.getSession()');
    const invoke = canvas.indexOf("functions.invoke");
    expect(session).toBeGreaterThan(-1);
    expect(session).toBeLessThan(invoke);
    expect(canvas).toContain('if (!session?.access_token)');
  });

  it('benennt keinen Akteur im Body', () => {
    expect(canvas).not.toMatch(/actorId/);
  });
});
