/**
 * Zugriffsprüfung des Agent-Runners.
 *
 * ## Warum es diesen Test gibt
 *
 * `enterprise-ai-os-agents-run` stand mit `verify_jwt = false` und ohne jede
 * Eingangsprüfung in der Produktion. Die `tenantId` kam aus dem Request-Body
 * und floss in einen Service-Role-Client, der RLS umgeht. Wer eine
 * Tenant-UUID kannte, konnte ohne Anmeldung deren `ai_systems` lesen (die
 * Agenten geben sie als `findings` zurück), `enterprise_agent_runs` auf
 * fremden Namen schreiben und Usage auf `limit.agent_runs_monthly` buchen,
 * die `stripe-meter-sync` als Overage abrechnet.
 *
 * Deshalb prüft dieser Test nicht, ob im Quelltext ein `401` vorkommt,
 * sondern was die Prüfung bei den vier Fällen tatsächlich entscheidet — und
 * zusätzlich, dass sie gar nicht erst in die Datenbank greift, wenn der
 * Aufrufer nicht feststeht. Die Reihenfolge ist die eigentliche Zusicherung:
 * Eine Mitgliedsabfrage, die vor der Identitätsprüfung läuft, wäre bereits
 * ein Leck.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  resolveTenantAccess,
  type AuthDeps,
} from '../../supabase/functions/enterprise-ai-os-agents-run/auth';

const EIGENER_TENANT = '11111111-1111-4111-8111-111111111111';
const FREMDER_TENANT = '22222222-2222-4222-8222-222222222222';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Protokolliert jeden Aufruf, damit die Reihenfolge prüfbar ist. */
function deps(over: Partial<AuthDeps> = {}) {
  const spuren: string[] = [];
  const basis: AuthDeps = {
    async getUserId(jwt) {
      spuren.push(`getUserId:${jwt}`);
      return jwt === 'gueltig' ? USER : null;
    },
    async isMember(userId, tenantId) {
      spuren.push(`isMember:${userId}:${tenantId}`);
      return userId === USER && tenantId === EIGENER_TENANT;
    },
  };
  return { deps: { ...basis, ...over }, spuren };
}

const anfrage = (over: Record<string, unknown> = {}) => ({
  authHeader: 'Bearer gueltig',
  bodyTenantId: EIGENER_TENANT,
  ...over,
});

describe('Agent-Runner: die vier Zugriffsfälle', () => {
  it('nicht angemeldet → 401, ohne jede Datenbankabfrage', async () => {
    const { deps: d, spuren } = deps();
    const r = await resolveTenantAccess(anfrage({ authHeader: null }), d);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(401);
    expect(r.code).toBe('UNAUTHORIZED');
    // Entscheidend: keine Mitgliedsabfrage, kein getUserId — nichts.
    expect(spuren).toEqual([]);
  });

  it('fremder Tenant → 403, und der Lauf kommt nie zustande', async () => {
    const { deps: d, spuren } = deps();
    const r = await resolveTenantAccess(anfrage({ bodyTenantId: FREMDER_TENANT }), d);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(403);
    expect(r.code).toBe('FORBIDDEN');
    // Die Mitgliedschaft wurde geprüft — mit genau diesem Paar, nicht anders.
    expect(spuren).toEqual([`getUserId:gueltig`, `isMember:${USER}:${FREMDER_TENANT}`]);
  });

  it('eigener Tenant → erfolgreich, mit geprüfter Identität', async () => {
    const { deps: d } = deps();
    const r = await resolveTenantAccess(anfrage(), d);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.userId).toBe(USER);
    expect(r.tenantId).toBe(EIGENER_TENANT);
  });

  it('manipulierte tenantId bleibt wirkungslos — der Rückgabewert trägt sie nicht', async () => {
    const { deps: d } = deps();
    const r = await resolveTenantAccess(anfrage({ bodyTenantId: FREMDER_TENANT }), d);

    // Es gibt keinen Pfad, auf dem der Fremd-Tenant weitergereicht wird:
    // bei ok:false existiert das Feld gar nicht.
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain(FREMDER_TENANT);
  });
});

describe('Agent-Runner: die Prüfung lässt sich nicht umgehen', () => {
  it('weist ein Token ohne Bearer-Präfix ab', async () => {
    const { deps: d, spuren } = deps();
    const r = await resolveTenantAccess(anfrage({ authHeader: 'gueltig' }), d);
    expect(r.ok).toBe(false);
    expect(spuren).toEqual([]);
  });

  it('weist einen leeren Bearer ab', async () => {
    const { deps: d, spuren } = deps();
    const r = await resolveTenantAccess(anfrage({ authHeader: 'Bearer    ' }), d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(401);
    expect(spuren).toEqual([]);
  });

  it('behandelt ein geworfenes getUserId als 401, nicht als Serverfehler', async () => {
    const { deps: d } = deps({
      async getUserId() { throw new Error('jwt kaputt'); },
    });
    const r = await resolveTenantAccess(anfrage(), d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(401);
  });

  it('meldet einen DB-Ausfall als 500, nicht als 403', async () => {
    // Sonst sähe ein Infrastrukturproblem wie eine Zugriffsverweigerung aus
    // und würde als "Gate greift" fehlgedeutet.
    const { deps: d } = deps({
      async isMember() { throw new Error('connection refused'); },
    });
    const r = await resolveTenantAccess(anfrage(), d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(500);
    expect(r.code).toBe('INTERNAL');
  });

  it('lehnt eine fehlende tenantId ab, statt still ohne Tenant zu laufen', async () => {
    // Vorher lief die Function mit .eq('tenant_id', null) weiter — ein
    // Ergebnis, das nichts bedeutet, ohne Persistenz und ohne Usage.
    const { deps: d } = deps();
    for (const leer of [undefined, null, '', '   ', 42, {}]) {
      const r = await resolveTenantAccess(anfrage({ bodyTenantId: leer }), d);
      expect(r.ok, `bodyTenantId=${JSON.stringify(leer)}`).toBe(false);
      if (r.ok) continue;
      expect(r.status).toBe(400);
    }
  });

  it('lehnt eine tenantId ab, die keine UUID ist', async () => {
    const { deps: d, spuren } = deps();
    const r = await resolveTenantAccess(anfrage({ bodyTenantId: "' OR 1=1 --" }), d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe('INVALID_TENANT');
    // Nichts Freies erreicht die Datenbank.
    expect(spuren).toEqual(['getUserId:gueltig']);
  });
});

describe('Agent-Runner: Deployment und Verdrahtung', () => {
  const ROOT = resolve(__dirname, '../..');
  const quelle = readFileSync(
    resolve(ROOT, 'supabase/functions/enterprise-ai-os-agents-run/index.ts'),
    'utf8',
  );
  const toml = readFileSync(resolve(ROOT, 'supabase/config.toml'), 'utf8');
  /**
   * Kommentarfreie Fassung. Die Zusicherungen unten gelten dem Code, nicht der
   * Prosa — ein Kommentar, der `body.tenantId` erwähnt, ist kein Lesezugriff.
   */
  const code = quelle
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('steht in config.toml auf verify_jwt = true', () => {
    const kopf = '[functions.enterprise-ai-os-agents-run]';
    const start = toml.indexOf(kopf);
    expect(start, 'Stanza fehlt in config.toml').toBeGreaterThanOrEqual(0);
    const rest = toml.slice(start + kopf.length);
    const naechste = rest.search(/\n\[/);
    const stanza = rest.slice(0, naechste === -1 ? rest.length : naechste);
    expect(stanza).toMatch(/verify_jwt\s*=\s*true/);
  });

  it('ruft die Prüfung auf und nimmt die tenantId aus ihrem Ergebnis', () => {
    expect(quelle).toContain("import { resolveTenantAccess } from './auth.ts'");
    expect(quelle).toContain('await resolveTenantAccess(');
    expect(quelle).toContain('tenantId: access.tenantId');
  });

  it('liest body.tenantId nur noch als Eingabe der Prüfung', () => {
    // Genau ein Vorkommen: das Argument von resolveTenantAccess.
    const treffer = code.match(/body\.tenantId/g) ?? [];
    expect(treffer.length, 'body.tenantId darf nirgends sonst gelesen werden').toBe(1);
    expect(code).toContain('bodyTenantId: body.tenantId');
  });

  it('kennt den Null-Tenant-Pfad nicht mehr', () => {
    expect(code).not.toContain('tenantId || null');
  });

  it('bricht bei abgelehntem Zugriff ab, bevor ein Agent läuft', () => {
    const pruefung = quelle.indexOf('if (!access.ok)');
    const lauf = quelle.indexOf('await executeAgent(');
    expect(pruefung).toBeGreaterThan(-1);
    expect(lauf).toBeGreaterThan(-1);
    expect(pruefung, 'Die Prüfung muss vor dem Agentenlauf stehen').toBeLessThan(lauf);
  });

  it('übergibt jsonError die Argumente in der Reihenfolge der Signatur', () => {
    // _shared/gateway.ts: jsonError(status, code, message). Die alten Aufrufe
    // in dieser Datei reichten ein Objekt als status — der Fehlerpfad hätte
    // selbst geworfen.
    for (const aufruf of code.match(/jsonError\(\s*[^)]*/g) ?? []) {
      expect(aufruf, `falsche Signatur: ${aufruf}`).toMatch(/jsonError\(\s*(\d{3}|access\.status)/);
    }
  });
});
