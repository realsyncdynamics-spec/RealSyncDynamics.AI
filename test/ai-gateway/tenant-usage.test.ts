/**
 * Zugriffs- und Verbrauchspruefung des AI-Gateways.
 *
 * ## Warum es diesen Test gibt
 *
 * Der Gateway lief ohne jede Eingangspruefung: kein Nutzer, kein Tenant,
 * kein Verbrauch. `verify_jwt = true` steht zwar in `config.toml`, aber der
 * Anon-Key ist ein gueltiges JWT und liegt im Frontend-Bundle — wer ihn
 * hatte, konnte die Provider-Credits des Betreibers verbrauchen. Gebremst
 * hat nur das IP-Rate-Limit.
 *
 * Geprueft wird deshalb das Verhalten der Entscheidung, nicht ihre
 * Schreibweise: welche Antwort faellt in welchem Fall, und in welcher
 * Reihenfolge wird dafuer die Datenbank angefasst.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  resolveTenantAccess,
  quotaWouldExceed,
  type TenantAccessDeps,
} from '../../supabase/functions/_shared/tenantAccess';

const EIGENER_TENANT = '11111111-1111-4111-8111-111111111111';
const FREMDER_TENANT = '22222222-2222-4222-8222-222222222222';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** Protokolliert jeden Aufruf, damit die Reihenfolge pruefbar ist. */
function deps(over: Partial<TenantAccessDeps> = {}) {
  const spuren: string[] = [];
  const basis: TenantAccessDeps = {
    async getUserId(jwt) {
      spuren.push(`getUserId:${jwt}`);
      return jwt === 'session-token' ? USER : null;
    },
    async isMember(userId, tenantId) {
      spuren.push(`isMember:${userId}:${tenantId}`);
      return userId === USER && tenantId === EIGENER_TENANT;
    },
  };
  return { deps: { ...basis, ...over }, spuren };
}

const anfrage = (over: Record<string, unknown> = {}) => ({
  authHeader: 'Bearer session-token',
  tenantId: EIGENER_TENANT,
  ...over,
});

describe('AI-Gateway: wer darf inferieren', () => {
  it('ohne Anmeldung → 401, ohne jede Datenbankabfrage', async () => {
    const { deps: d, spuren } = deps();
    const r = await resolveTenantAccess(anfrage({ authHeader: null }), d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(401);
    expect(spuren).toEqual([]);
  });

  it('mit dem Anon-Key statt einer Sitzung → 401', async () => {
    // Der Anon-Key passiert das Plattform-Gate, weil er ein gueltiges JWT
    // ist. Abweisen muss ihn die Function selbst — genau das ist der Kern
    // dieser Aenderung.
    const { deps: d } = deps();
    const r = await resolveTenantAccess(anfrage({ authHeader: 'Bearer anon-key' }), d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(401);
    expect(r.code).toBe('UNAUTHORIZED');
  });

  it('fremder Tenant → 403', async () => {
    const { deps: d, spuren } = deps();
    const r = await resolveTenantAccess(anfrage({ tenantId: FREMDER_TENANT }), d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(403);
    expect(spuren).toEqual(['getUserId:session-token', `isMember:${USER}:${FREMDER_TENANT}`]);
  });

  it('eigener Tenant → erfolgreich, mit geprüfter Identität', async () => {
    const { deps: d } = deps();
    const r = await resolveTenantAccess(anfrage(), d);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.userId).toBe(USER);
    expect(r.tenantId).toBe(EIGENER_TENANT);
  });

  it('ohne Tenant → 400, statt still ohne Mandant zu laufen', async () => {
    // Ein Aufruf ohne Tenant liesse sich weder einem Kontingent zuordnen
    // noch abrechnen. Er liefe auf Kosten des Betreibers.
    const { deps: d } = deps();
    for (const leer of [undefined, null, '', '   ', 42, {}]) {
      const r = await resolveTenantAccess(anfrage({ tenantId: leer }), d);
      expect(r.ok, `tenantId=${JSON.stringify(leer)}`).toBe(false);
      if (r.ok) continue;
      expect(r.status).toBe(400);
    }
  });

  it('nicht-UUID erreicht die Datenbank nicht', async () => {
    const { deps: d, spuren } = deps();
    const r = await resolveTenantAccess(anfrage({ tenantId: "' OR 1=1 --" }), d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe('INVALID_TENANT');
    expect(spuren).toEqual(['getUserId:session-token']);
  });

  it('meldet einen DB-Ausfall als 500, nicht als 403', async () => {
    const { deps: d } = deps({
      async isMember() { throw new Error('connection refused'); },
    });
    const r = await resolveTenantAccess(anfrage(), d);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.status).toBe(500);
  });
});

describe('AI-Gateway: Kontingentregel', () => {
  it('laesst durch, solange das Limit nicht ueberschritten wird', () => {
    expect(quotaWouldExceed({ current: 0, limit: 2000 })).toBe(false);
    expect(quotaWouldExceed({ current: 1999, limit: 2000 })).toBe(false);
  });

  it('blockt den Aufruf, der das Limit ueberschreiten wuerde', () => {
    expect(quotaWouldExceed({ current: 2000, limit: 2000 })).toBe(true);
    expect(quotaWouldExceed({ current: 2500, limit: 2000 })).toBe(true);
  });

  it('behandelt -1 als unbegrenzt', () => {
    expect(quotaWouldExceed({ current: 10_000_000, limit: -1 })).toBe(false);
  });

  it('laesst durch, wenn kein Kontingent hinterlegt ist', () => {
    // Dieselbe Auslegung wie in automation-trigger: ein fehlender Eintrag
    // ist kein Limit von null.
    expect(quotaWouldExceed({ current: 5, limit: undefined })).toBe(false);
  });

  it('rechnet mit dem angefragten Delta', () => {
    expect(quotaWouldExceed({ current: 1998, limit: 2000, delta: 2 })).toBe(false);
    expect(quotaWouldExceed({ current: 1999, limit: 2000, delta: 2 })).toBe(true);
  });
});

describe('AI-Gateway: Verdrahtung in der Function', () => {
  const ROOT = resolve(__dirname, '../..');
  const quelle = readFileSync(
    resolve(ROOT, 'supabase/functions/ai-gateway/index.ts'),
    'utf8',
  );
  /** Kommentarfrei — die Zusicherungen gelten dem Code, nicht der Prosa. */
  const code = quelle
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('ermittelt den Mandanten in beiden Routen, vor dem Provider-Aufruf', () => {
    for (const abschnitt of ['handleOpBased', 'handleOpenAIChatCompletions']) {
      const start = code.indexOf(`async function ${abschnitt}`);
      expect(start, abschnitt).toBeGreaterThan(-1);
      const rumpf = code.slice(start, start + 3000);
      expect(rumpf, `${abschnitt}: Mandantenermittlung fehlt`).toContain('await mandantFuer(req,');
      expect(rumpf, `${abschnitt}: Ablehnung wird nicht durchgereicht`)
        .toContain('if (mandant instanceof Response) return mandant');
    }
  });

  it('bricht bei abgelehntem Zugriff ab', () => {
    expect(code).toContain('if (!access.ok) return jsonError(access.status, access.code, access.message)');
  });

  it('prüft das Kontingent vor dem Provider-Aufruf und bucht danach', () => {
    for (const abschnitt of ['handleOpBased', 'handleOpenAIChatCompletions']) {
      const start = code.indexOf(`async function ${abschnitt}`);
      const rumpf = code.slice(start, start + 3000);
      const quota = rumpf.indexOf('quotaBlocked(mandant.tenantId)');
      const buche = rumpf.indexOf('bucheVerbrauch(mandant.tenantId');
      expect(quota, `${abschnitt}: Kontingentprüfung fehlt`).toBeGreaterThan(-1);
      expect(buche, `${abschnitt}: Verbrauchsbuchung fehlt`).toBeGreaterThan(-1);
      expect(quota, `${abschnitt}: Prüfung muss vor der Buchung stehen`).toBeLessThan(buche);
    }
  });

  // Der Audit-Co-Pilot auf /audit und der Assistenten-Chip rufen den
  // Gateway heute bewusst ohne Mandant auf — auf einer oeffentlichen Seite.
  // Eine Mandantenpflicht ohne diese Ausnahme haette beide abgeschaltet.
  it('haelt die anonyme Fläche auf genau den heutigen drei Features', () => {
    const start = code.indexOf('const ANON_FEATURES');
    expect(start).toBeGreaterThan(-1);
    const block = code.slice(start, code.indexOf(']', start));
    for (const feature of [
      'audit_copilot.fix_snippet',
      'audit_copilot.remediation_plan',
      'assistant_chip_quick_chat',
    ]) {
      expect(block, `${feature} fehlt in der Allowlist`).toContain(feature);
    }
    // Vier Eintraege waeren eine neue oeffentliche Flaeche — das ist eine
    // Produktentscheidung und darf nicht unbemerkt durchrutschen.
    expect(block.match(/'/g)?.length).toBe(6);
  });

  it('fordert für alles andere einen Mandanten', () => {
    expect(code).toContain('if (ANON_FEATURES.has(feature)) return null');
    expect(code).toContain('const access = await resolveAccess(req)');
  });

  // Interne Aufrufer sind der Grund, warum die Allowlist klein bleiben darf:
  // sechs Edge Functions rufen den Gateway serverseitig auf. Ohne diesen
  // Fall muessten ihre zwoelf Features in die anonyme Flaeche — und die
  // waere damit die gesamte Flaeche.
  it('erkennt interne Aufrufer am Service-Role-Bearer', () => {
    expect(code).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')");
    expect(code).toContain('function internerAufruf(req: Request): boolean');
    // Voller Vergleich, nicht `startsWith` — ein Praefix waere kein Beleg.
    expect(code).toMatch(/header\.slice\(7\)\.trim\(\) === srk/);
  });

  it('prüft den internen Fall vor der anonymen Allowlist', () => {
    const start = code.indexOf('async function mandantFuer');
    expect(start).toBeGreaterThan(-1);
    const rumpf = code.slice(start, start + 1200);
    const intern = rumpf.indexOf('internerAufruf(req)');
    const anon = rumpf.indexOf('ANON_FEATURES.has(feature)');
    expect(intern, 'interner Fall fehlt').toBeGreaterThan(-1);
    expect(intern, 'interner Fall muss zuerst greifen').toBeLessThan(anon);
  });

  it('nimmt auch vom internen Aufrufer keinen freien Tenant-Text an', () => {
    const start = code.indexOf('async function mandantFuer');
    const rumpf = code.slice(start, start + 1200);
    expect(rumpf).toContain('TENANT_UUID_RE.test(genannt)');
  });

  it('nutzt dieselben Verbrauchsschlüssel wie der andere AI-Pfad', () => {
    // _shared/ai.ts bucht auf genau diese Keys. Ein zweiter Namensraum
    // waere wieder ein zweiter Pfad.
    expect(code).toContain("'limit.ai_calls_monthly'");
    expect(code).toContain("'limit.ai_tokens_monthly'");
  });

  it('bucht keine Kosten, weil es dafür keinen Preis gibt', () => {
    // Die Kosten pro Token stehen in ai_tools (cost_input_per_million_usd),
    // also pro Tool. Der Gateway hat keine Tool-Zeile. Einen Preis zu
    // erfinden hiesse, eine erfundene Zahl in eine Abrechnung zu schreiben.
    expect(code).not.toContain('limit.ai_cost_monthly_cents');
  });

  it('liest den Tenant aus dem Header, nicht aus dem Body', () => {
    // Die OpenAI-kompatible Schale hat ein fremdes Body-Format; ein Weg für
    // beide Routen ist besser als zwei.
    expect(code).toContain("req.headers.get('x-tenant-id')");
  });
});

/**
 * Die eigentliche Luecke war nicht der Gateway allein, sondern dass seine
 * eigenen Aufrufer den Anon-Key schickten: damit war ein interner Aufruf
 * von einem fremden nicht zu unterscheiden, und eine Mandantenpflicht
 * haette alle zwoelf internen Features abgeschaltet.
 */
describe('AI-Gateway: interne Aufrufer schicken den Service-Role-Key', () => {
  const ROOT = resolve(__dirname, '../..');
  const AUFRUFER = [
    'supabase/functions/governance-agent/index.ts',
    'supabase/functions/classify-document/index.ts',
    'supabase/functions/remediation-agent/index.ts',
    'supabase/functions/telegram-webhook/index.ts',
    'supabase/functions/_shared/agents/governanceBriefRunner.ts',
  ];

  const quelleVon = (rel: string) =>
    readFileSync(resolve(ROOT, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it.each(AUFRUFER)('%s weist sich als intern aus', (rel) => {
    expect(quelleVon(rel)).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('kein Aufrufer schickt den Anon-Key noch als Bearer an den Gateway', () => {
    for (const rel of AUFRUFER) {
      const code = quelleVon(rel);
      expect(code, `${rel}: Anon-Key als Bearer`).not.toMatch(/Bearer \$\{ANON\}/);
      expect(code, `${rel}: Anon-Key als Bearer`).not.toMatch(/Bearer \$\{anon\}/);
    }
  });

  it('telegram-webhook reicht seinen Mandanten an den Gateway durch', () => {
    // Der einzige interne Aufrufer, der einen Mandanten kennt — also der
    // einzige, dessen Verbrauch heute schon zugeordnet werden kann.
    const code = quelleVon('supabase/functions/telegram-webhook/index.ts');
    expect(code).toMatch(/tenantId:\s*tenantId/);
  });
});

describe('AI-Gateway: beide Client-Kopien tragen dieselben Felder', () => {
  const ROOT = resolve(__dirname, '../..');
  const kopien = [
    'src/core/ai-gateway/edgeClient.ts',
    'supabase/functions/_shared/aiGateway/edgeClient.ts',
  ].map((rel) => readFileSync(resolve(ROOT, rel), 'utf8'));

  it.each(['accessToken?: string;', 'tenantId?: string;'])(
    'beide kennen %s',
    (feld) => {
      for (const kopie of kopien) expect(kopie).toContain(feld);
    },
  );

  it('beide senden Token und Tenant im selben Header-Block', () => {
    for (const kopie of kopien) {
      expect(kopie).toContain('`Bearer ${this.config.accessToken ?? this.config.apiKey}`');
      expect(kopie).toContain("'x-tenant-id': this.config.tenantId");
    }
  });
});

describe('AI-Gateway: der Client schickt die Sitzung', () => {
  const ROOT = resolve(__dirname, '../..');
  const client = readFileSync(resolve(ROOT, 'src/core/ai-gateway/edgeClient.ts'), 'utf8');
  const code = client
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('sendet das Zugriffstoken als Bearer', () => {
    expect(code).toContain('this.config.accessToken');
  });

  it('reicht den Tenant als Header durch', () => {
    expect(code).toContain("'x-tenant-id': this.config.tenantId");
  });
});

/**
 * Der `stream`-Op kam nach dem ersten Entwurf dieses PRs auf `main` dazu
 * (NDJSON-Route und OpenAI-kompatible Schale). Beim Rebase war er der
 * einzige Weg, der den Gateway erreicht haette, ohne durch `mandantFuer`
 * zu laufen: derselbe Provider, dieselben Kosten, nur ohne Mandanten — und
 * auf der Client-Seite schickte `stream()` nur den Anon-Key.
 *
 * Eine Luecke, die ein Merge aufreisst, ist keine kleinere Luecke als eine
 * geschriebene. Diese Zusicherungen halten sie geschlossen.
 */
describe('AI-Gateway: Streaming laeuft durch dieselbe Sperre', () => {
  const ROOT = resolve(__dirname, '../..');
  const quelle = readFileSync(
    resolve(ROOT, 'supabase/functions/ai-gateway/index.ts'),
    'utf8',
  );
  const code = quelle
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  /** Fehlt die Ermittlung ganz, liefert indexOf -1 — und -1 liegt vor allem.
   *  Jede Reihenfolge-Zusicherung muss deshalb ZUERST belegen, dass es sie
   *  ueberhaupt gibt, sonst ist sie leer wahr. */
  function mandantAn(): number {
    const i = code.indexOf('await mandantFuer(req,');
    expect(i, 'Mandantenermittlung fehlt vollstaendig').toBeGreaterThan(-1);
    return i;
  }

  it('der stream-Op wird erst nach der Mandantenermittlung abgezweigt', () => {
    const mandant = mandantAn();
    const abzweig = code.indexOf("if (op === 'stream')");
    expect(abzweig, 'stream-Abzweig nicht gefunden').toBeGreaterThan(-1);
    expect(mandant, 'stream zweigt vor der Pruefung ab').toBeLessThan(abzweig);
  });

  it('beide Streaming-Routen bekommen den geprueften Mandanten', () => {
    expect(code).toContain('streamNdjson(gateway, request, governance, mandant ?? undefined)');
    expect(code).toContain('streamOpenAiCompat(gateway, parsed.request, mandant ?? undefined)');
  });

  it('gebucht wird erst im done-Chunk, mit den Zahlen des Providers', () => {
    // Nicht vorher: das waere geschaetzt, und ein abgebrochener Stream
    // haette etwas berechnet, das nie fertig wurde.
    const treffer = code.match(/chunk\.event === 'done'[\s\S]{0,400}?bucheVerbrauch\(/g) ?? [];
    expect(treffer.length, 'keine Buchung am done-Chunk').toBe(2);
    expect(code).toContain('chunk.usage as');
  });

  it('kein Streaming-Pfad bucht ohne Mandanten', () => {
    const buchungen = [...code.matchAll(/if \(mandant\)\s*\{\s*await bucheVerbrauch\(/g)];
    expect(buchungen.length).toBeGreaterThan(0);
    expect(code).not.toMatch(/bucheVerbrauch\(\s*mandant\.tenantId[^)]*\)\s*;\s*\}\s*\}\s*catch/);
  });

  it('auch der stream-Aufruf des Clients schickt Sitzung und Mandant', () => {
    for (const rel of [
      'src/core/ai-gateway/edgeClient.ts',
      'supabase/functions/_shared/aiGateway/edgeClient.ts',
    ]) {
      const kopie = readFileSync(resolve(ROOT, rel), 'utf8');
      const i = kopie.indexOf("op: 'stream'");
      expect(i, `${rel}: stream-Aufruf nicht gefunden`).toBeGreaterThan(-1);
      // Der Header-Block steht vor dem Body im selben fetch.
      const block = kopie.slice(Math.max(0, i - 900), i);
      expect(block, `${rel}: stream schickt nur den Anon-Key`)
        .toContain('`Bearer ${this.config.accessToken ?? this.config.apiKey}`');
      expect(block, `${rel}: stream reicht den Mandanten nicht durch`)
        .toContain("'x-tenant-id': this.config.tenantId");
    }
  });
});
