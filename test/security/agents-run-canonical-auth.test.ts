/**
 * enterprise-ai-os-agents-run: Autorisierung ueber den kanonischen Resolver.
 *
 * ## Warum es diesen Test gibt
 *
 * Die Function stand mit `verify_jwt = false` und ohne Eingangspruefung in
 * Produktion. `tenantId` kam aus dem Request-Body und floss in einen
 * Service-Role-Client, der RLS umgeht: Wer eine Tenant-UUID kannte, konnte
 * ohne Anmeldung deren `ai_systems` lesen (die Agenten geben sie als
 * `findings` zurueck), `enterprise_agent_runs` unter fremdem Mandanten
 * schreiben und Usage auf `limit.agent_runs_monthly` buchen, die
 * `stripe-meter-sync` als Overage abrechnet.
 *
 * Ein erster Fix (PR #1383) brachte dafuer einen eigenen Resolver mit
 * eigener Mitgliedsabfrage mit. Das ist seit #1392 nicht mehr zulaessig:
 * Es gibt genau einen Resolver, `requireAuthAndTenant` in `_shared/auth.ts`,
 * und `auth.tenantId` ist danach die einzige Tenant-Autoritaet.
 *
 * ## Was dieser Test belegt — und was nicht
 *
 * Die Entscheidungslogik (401 ohne Sitzung, 400 ohne tenantId, 403 bei
 * fremdem Mandanten) liegt in `_shared/auth.ts`. Ihr Laufzeitverhalten ist
 * aus Vitest nicht pruefbar: `auth.ts` importiert `jsr:@supabase/supabase-js`,
 * und `vitest.config.ts` loest `jsr:`-Spezifier nicht auf.
 *
 * Geprueft wird deshalb, was am Quelltext pruefbar IST und was zuvor verletzt
 * war: dass genau dieser Resolver benutzt wird und kein zweiter existiert,
 * dass er vor jeder Wirkung steht, und dass der vom Aufrufer genannte
 * Mandant nach der Pruefung nicht mehr verwendet wird. Die Live-Bestaetigung
 * der Statuscodes gehoert in einen Durchlauf mit echten Sitzungen.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const FN_DIR = resolve(ROOT, 'supabase/functions/enterprise-ai-os-agents-run');
const QUELLE = readFileSync(resolve(FN_DIR, 'index.ts'), 'utf8');
const toml = readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8');

/** Kommentarfrei — die Zusicherungen gelten dem Code, nicht der Prosa. */
const code = QUELLE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Liest die verify_jwt-Stanza der Function aus config.toml. */
function stanza(fn: string): string | null {
  const kopf = `[functions.${fn}]`;
  const start = toml.indexOf(kopf);
  if (start === -1) return null;
  const rest = toml.slice(start + kopf.length);
  const next = rest.search(/\n\[/);
  return rest.slice(0, next === -1 ? rest.length : next);
}

describe('agents-run: Plattform-Gate (A)', () => {
  it('steht in config.toml auf verify_jwt = true', () => {
    const s = stanza('enterprise-ai-os-agents-run');
    expect(s, 'Stanza fehlt in config.toml').not.toBeNull();
    expect(s).toMatch(/verify_jwt\s*=\s*true/);
  });

  it('die Absicht ist in der config dokumentiert', () => {
    expect(toml).toContain('enterprise-ai-os-agents-run: braucht eine echte Nutzersitzung');
  });
});

describe('agents-run: genau ein Resolver (B, F)', () => {
  it('importiert requireAuthAndTenant aus _shared/auth.ts', () => {
    expect(code).toContain("import { requireAuthAndTenant } from '../_shared/auth.ts'");
    expect(code).toContain('await requireAuthAndTenant(');
  });

  it('hat keine eigene auth.ts neben index.ts', () => {
    // PR #1383 brachte functions/enterprise-ai-os-agents-run/auth.ts mit.
    // Ein zweiter Resolver ist eine zweite Security-Architektur.
    expect(existsSync(resolve(FN_DIR, 'auth.ts'))).toBe(false);
  });

  it('kennt weder resolveTenantAccess noch eine lokale Mitgliedsabfrage', () => {
    expect(code).not.toContain('resolveTenantAccess');
    expect(code).not.toMatch(/from\(\s*['"]memberships['"]\s*\)/);
    expect(code).not.toContain('requireTenantMembership(');
    expect(code).not.toContain('auth.getUser(');
  });

  it('erzeugt keinen eigenen Service-Role-Client', () => {
    // Der Service-Role-Client kommt als auth.admin aus dem Resolver und
    // existiert damit nur nach bestandener Mitgliedschaftspruefung.
    expect(code).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(code).not.toMatch(/\bcreateClient\(/);
    expect(code).toContain('auth.admin');
  });
});

describe('agents-run: Ablehnung wird durchgereicht (D)', () => {
  it('gibt die Response des Resolvers unveraendert zurueck', () => {
    expect(code).toContain('if (auth instanceof Response) return auth');
  });

  it('nach der Ablehnung folgt kein Agentenlauf im selben Block', () => {
    // Zwischen `return auth` und `executeAgent(` darf nur die Uebernahme
    // des geprueften Mandanten stehen — kein Zugriff, kein Lauf.
    const ablehnung = code.indexOf('if (auth instanceof Response) return auth');
    const lauf = code.indexOf('await executeAgent(');
    expect(ablehnung).toBeGreaterThan(-1);
    expect(lauf).toBeGreaterThan(ablehnung);
    const dazwischen = code.slice(ablehnung, lauf);
    expect(dazwischen).not.toMatch(/\.from\(/);
    expect(dazwischen).not.toContain('recordUsage(');
    expect(dazwischen).toContain('const tenantId = auth.tenantId');
  });
});

describe('agents-run: Autorisierung steht vor jeder Wirkung (C)', () => {
  // Fehlt die Autorisierung ganz, liefert indexOf -1 — und -1 liegt vor
  // allem. Jede Reihenfolge-Zusicherung belegt deshalb ZUERST, dass es sie
  // ueberhaupt gibt, sonst waere sie leer wahr.
  function autorisierungAn(): number {
    const i = code.indexOf('await requireAuthAndTenant(');
    expect(i, 'Autorisierung fehlt vollstaendig').toBeGreaterThan(-1);
    return i;
  }

  /** Position des Handlers — alles davor sind Hilfsfunktionen ohne Aufruf. */
  const handlerStart = code.indexOf('Deno.serve(');

  it('liegt im Handler, nicht in einer Hilfsfunktion', () => {
    expect(handlerStart).toBeGreaterThan(-1);
    expect(autorisierungAn()).toBeGreaterThan(handlerStart);
  });

  it('vor dem Agentenlauf', () => {
    const auth = autorisierungAn();
    const lauf = code.indexOf('await executeAgent(');
    expect(lauf, 'Agentenlauf nicht gefunden').toBeGreaterThan(-1);
    expect(auth, 'Agentenlauf vor der Autorisierung').toBeLessThan(lauf);
  });

  it('kein Datenbankzugriff und kein Metering im Handler vor der Autorisierung', () => {
    const auth = autorisierungAn();
    const handler = code.slice(handlerStart, auth);
    expect(handler).not.toMatch(/\.from\(/);
    expect(handler).not.toContain('recordUsage(');
    expect(handler).not.toContain('executeAgent(');
  });

  it('der Executor erhaelt den Mandanten nur als Parameter, nie aus dem Body', () => {
    // executeAgent(input, tenantId, supabase): der Mandant ist Pflichtparameter,
    // der Input-Typ kennt das Feld nicht mehr.
    expect(code).toMatch(/async function executeAgent\(\s*input: AgentRunInput,\s*tenantId: string,\s*supabase: SupabaseClient,?\s*\)/);
    expect(code).toContain("type AgentRunInput = Omit<AgentRunRequest, 'tenantId'>");
  });
});

describe('agents-run: der genannte Mandant ist nur ein Claim (E, G)', () => {
  it('body.tenantId kommt genau einmal vor — als Argument des Resolvers', () => {
    // Das ist die eigentliche Zusicherung: nach der Pruefung existiert nur
    // noch der verifizierte Wert. Der typeof-Ausdruck zaehlt zwei Vorkommen
    // in derselben Zeile; beide gehoeren zum Resolver-Argument.
    const zeilen = code.split('\n').filter((z) => z.includes('body.tenantId'));
    expect(zeilen.length).toBe(1);
    expect(zeilen[0].trim()).toBe("typeof body.tenantId === 'string' ? body.tenantId : undefined,");
  });

  it('kein Write und kein Read nimmt den ungeprueften Wert', () => {
    expect(code).not.toMatch(/tenant_id:\s*body\.tenantId/);
    expect(code).not.toMatch(/tenant_id',\s*body\.tenantId/);
    expect(code).not.toContain('input.tenantId');
    expect(code).not.toContain('req.tenantId');
  });

  it('der Null-Tenant-Pfad existiert nicht mehr', () => {
    // Vorher lief die Function mit .eq('tenant_id', null) weiter — ein
    // Ergebnis ohne Bedeutung, ohne Persistenz und ohne Usage.
    expect(code).not.toContain('tenantId || null');
    expect(code).not.toMatch(/tenantId\s*\?\?\s*null/);
  });

  it('alle tenantgebundenen Operationen nutzen den geprueften Mandanten', () => {
    // Read: ai_systems
    expect(code).toMatch(/from\('ai_systems'\)[\s\S]*?\.eq\('tenant_id',\s*tenantId\)/);
    // Write: enterprise_agent_runs
    expect(code).toMatch(/from\('enterprise_agent_runs'\)[\s\S]*?tenant_id:\s*tenantId,/);
    // Metering: recordUsage(supabase, tenantId, ...)
    expect(code).toMatch(/recordUsage\(supabase,\s*tenantId,\s*AGENT_RUNS_ENTITLEMENT/);
    // Und der Executor bekommt genau auth.tenantId.
    expect(code).toContain('const tenantId = auth.tenantId');
    expect(code).toMatch(/executeAgent\(\s*\{[^}]*\},\s*tenantId,\s*auth\.admin,?\s*\)/);
  });

  it('das Metering ist nicht mehr an einen optionalen Mandanten geknuepft', () => {
    // `if (tenantId && ...)` war der Ausdruck dafuer, dass tenantId fehlen
    // durfte. Jetzt ist er Pflicht; nur der Status entscheidet.
    expect(code).not.toMatch(/if\s*\(\s*tenantId\s*&&/);
    expect(code).toMatch(/if\s*\(\s*result\.status\s*!==\s*'error'\s*\)/);
  });
});

describe('agents-run: Fehlerpfad (jsonError-Befund aus #1383)', () => {
  it('uebergibt jsonError die Argumente in der Reihenfolge der Signatur', () => {
    // _shared/gateway.ts: jsonError(status, code, message, headers?). Die
    // alten Aufrufe reichten ein Objekt als status — der Fehlerpfad haette
    // selbst geworfen.
    const aufrufe = code.match(/jsonError\(\s*[^)]*/g) ?? [];
    expect(aufrufe.length).toBeGreaterThan(0);
    for (const aufruf of aufrufe) {
      expect(aufruf, `falsche Signatur: ${aufruf}`).toMatch(/jsonError\(\s*\d{3}\s*,\s*'[A-Z_]+'\s*,/);
    }
  });
});
