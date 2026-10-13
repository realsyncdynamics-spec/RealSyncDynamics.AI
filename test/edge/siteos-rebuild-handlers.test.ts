// @vitest-environment node
//
// siteos/rebuild-* — Verhalten der Handler (Ersatz-Schnitt 3 aus #1727).
//
// Der Quelltext-Vertrag (`test/security/siteos-rebuild-auth.test.ts`) sichert
// die Reihenfolge im Code und die Verdrahtung in `rebuild-deps.ts`. Hier
// laufen die Handler wirklich: gestellt sind nur der Resolver (die Semantik
// von `_shared/auth.ts`, das selbst `jsr:` importiert), die Plan-Schranken,
// die Blueprint-Persistenz und der Netzabruf. Echt sind der
// Kern (Snapshot → Positionierung → Bewertung → Richtungen → Überarbeitung),
// der Nachweis (`evidence.ts`), die Lauf-Bindung (`rebuild-context.ts`) und
// das Prüfprotokoll (`auditLog.ts`) — gegen eine Datenbank im Speicher, die
// jsonb wie Postgres über JSON hin und zurück schreibt.
//
// Geprüft wird, was bei einer Verletzung teuer wäre: kein Abruf und kein
// Schreiben vor der Autorisierung, kein Lauf ohne Nachweis, keine Übernahme
// einer anderen als der angebotenen Richtung, kein Austausch der
// Ausgangsseite einer bestehenden Site, keine Überarbeitung eines fremden
// Stands, kein behaupteter Verbindungsstand.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canonicalHash, type SiteBlueprint } from '../../packages/siteos-core/src/index';
import { snapshotInput } from '../siteos/rebuild-helpers';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';

const h = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Result = { data: unknown; error: { message: string } | null; count?: number | null };

  /** jsonb-Rundreise wie in Postgres: `undefined` fällt weg, Typen werden JSON. */
  const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

  class FakeDb {
    tables = new Map<string, Row[]>();
    /** Reihenfolge der Zugriffe: `tabelle:operation`. */
    log: string[] = [];
    /** Erzwungene Fehler je `tabelle:operation` (oder `rpc-name:rpc`). */
    fail = new Map<string, string>();
    /** So oft meldet `append_governance_evidence` einen bewegten Kettenkopf. */
    rpcConflicts = 0;
    private seq = 0;

    rows(table: string): Row[] {
      let rows = this.tables.get(table);
      if (!rows) {
        rows = [];
        this.tables.set(table, rows);
      }
      return rows;
    }

    now(): string {
      this.seq += 1;
      return new Date(Date.now() + this.seq).toISOString();
    }

    from(table: string): Query {
      return new Query(this, table);
    }

    async rpc(fn: string, args: { p_row: Row; p_expected_previous_hash: string | null }): Promise<Result> {
      this.log.push(`${fn}:rpc`);
      const forced = this.fail.get(`${fn}:rpc`);
      if (forced) return { data: null, error: { message: forced } };
      if (fn !== 'append_governance_evidence') return { data: null, error: { message: `unknown rpc ${fn}` } };
      if (this.rpcConflicts > 0) {
        this.rpcConflicts -= 1;
        return { data: null, error: null };
      }
      const tenantId = args.p_row.tenant_id;
      const head = this.rows('governance_evidence')
        .filter((r) => r.tenant_id === tenantId && r.content_hash != null)
        .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)) || String(b.id).localeCompare(String(a.id)))[0];
      if ((head?.content_hash ?? null) !== args.p_expected_previous_hash) return { data: null, error: null };
      this.rows('governance_evidence').push({ ...roundTrip(args.p_row), created_at: this.now() });
      return { data: args.p_row.id, error: null };
    }
  }

  class Query implements PromiseLike<Result> {
    private op: 'select' | 'insert' | 'update' = 'select';
    private columns = '*';
    private head = false;
    private filters: ((row: Row) => boolean)[] = [];
    private orders: { column: string; ascending: boolean }[] = [];
    private max: number | null = null;
    private payload: Row | Row[] | null = null;
    private single = false;

    constructor(private readonly db: FakeDb, private readonly table: string) {}

    select(columns = '*', options?: { count?: string; head?: boolean }): this {
      if (this.op === 'select') {
        this.columns = columns;
        this.head = options?.head === true;
      }
      return this;
    }
    insert(payload: Row | Row[]): this { this.op = 'insert'; this.payload = payload; return this; }
    update(patch: Row): this { this.op = 'update'; this.payload = patch; return this; }
    eq(column: string, value: unknown): this { this.filters.push((r) => r[column] === value); return this; }
    neq(column: string, value: unknown): this { this.filters.push((r) => r[column] !== value); return this; }
    gte(column: string, value: string): this { this.filters.push((r) => String(r[column]) >= value); return this; }
    is(column: string, value: null): this { this.filters.push((r) => (value === null ? r[column] == null : r[column] === value)); return this; }
    not(column: string, operator: string, value: unknown): this {
      if (operator !== 'is' || value !== null) throw new Error(`not(${operator}) wird hier nicht gebraucht`);
      this.filters.push((r) => r[column] != null);
      return this;
    }
    order(column: string, options?: { ascending?: boolean }): this { this.orders.push({ column, ascending: options?.ascending !== false }); return this; }
    limit(n: number): this { this.max = n; return this; }
    maybeSingle(): Promise<Result> { this.single = true; return this.run(); }
    then<A = Result, B = never>(onFulfilled?: ((value: Result) => A | PromiseLike<A>) | null, onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
      return this.run().then(onFulfilled, onRejected);
    }

    private matching(): Row[] {
      const rows = this.db.rows(this.table).filter((r) => this.filters.every((f) => f(r)));
      for (const { column, ascending } of [...this.orders].reverse()) {
        rows.sort((a, b) => {
          const x = a[column] as string | number;
          const y = b[column] as string | number;
          const cmp = x < y ? -1 : x > y ? 1 : 0;
          return ascending ? cmp : -cmp;
        });
      }
      return this.max === null ? rows : rows.slice(0, this.max);
    }

    private project(row: Row): Row {
      if (this.columns.trim() === '*') return roundTrip(row);
      const out: Row = {};
      for (const column of this.columns.split(',').map((c) => c.trim())) if (column in row) out[column] = row[column];
      return roundTrip(out);
    }

    private async run(): Promise<Result> {
      this.db.log.push(`${this.table}:${this.op}`);
      const forced = this.db.fail.get(`${this.table}:${this.op}`);
      if (forced) return { data: null, error: { message: forced }, count: null };
      if (this.op === 'insert') {
        const rows = Array.isArray(this.payload) ? this.payload : [this.payload as Row];
        for (const row of rows) this.db.rows(this.table).push({ created_at: this.db.now(), ...roundTrip(row) });
        return { data: null, error: null };
      }
      if (this.op === 'update') {
        for (const row of this.db.rows(this.table).filter((r) => this.filters.every((f) => f(r)))) {
          Object.assign(row, roundTrip(this.payload as Row));
        }
        return { data: null, error: null };
      }
      const rows = this.matching();
      if (this.head) return { data: null, error: null, count: rows.length };
      if (this.single) {
        if (rows.length > 1) return { data: null, error: { message: 'JSON object requested, multiple rows returned' } };
        return { data: rows[0] ? this.project(rows[0]) : null, error: null };
      }
      return { data: rows.map((r) => this.project(r)), error: null };
    }
  }

  const state = {
    db: new FakeDb(),
    /** Rolle des Aufrufers je Mandant — die Mitgliedschaft, die der echte Resolver liest. */
    memberships: new Map<string, string>(),
    authCalls: [] as { tenantId: string | null; roles: string[] | undefined }[],
    gates: { edit: null as Response | null, create: null as Response | null, createSlugs: [] as (string | null | undefined)[] },
    persistCalls: [] as Record<string, unknown>[],
    crawl: (async () => { throw new Error('crawlSite nicht gestellt'); }) as (start: URL, nowIso: string) => Promise<unknown>,
    crawlCalls: [] as string[],
    reset() {
      state.db = new FakeDb();
      state.memberships = new Map();
      state.authCalls = [];
      state.gates = { edit: null, create: null, createSlugs: [] };
      state.persistCalls = [];
      state.crawlCalls = [];
    },
  };

  const deny = (status: number, code: string) =>
    new Response(JSON.stringify({ ok: false, error: { code, message: code } }), { status, headers: { 'content-type': 'application/json' } });

  /** Wie `_shared/auth.ts`: Token, dann Mitgliedschaft im behaupteten Mandanten, dann Rolle. */
  async function requireAuthAndTenant(req: Request, clientTenantId: string | null | undefined, allowedRoles?: string[]) {
    state.authCalls.push({ tenantId: clientTenantId ?? null, roles: allowedRoles });
    if (!req.headers.get('Authorization')?.startsWith('Bearer ')) return deny(401, 'UNAUTHORIZED');
    if (!clientTenantId) return deny(400, 'BAD_REQUEST');
    const role = state.memberships.get(clientTenantId);
    if (!role || (allowedRoles && !allowedRoles.includes(role))) return deny(403, 'FORBIDDEN');
    return { user: { id: '33333333-3333-4333-8333-333333333333', email: 'inhaber@firma.example' }, admin: state.db, userClient: state.db, tenantId: clientTenantId };
  }

  /** Wie `persistBlueprintVersion`: Version + 1, gleicher Hash ⇒ unverändert. */
  async function persist(input: Record<string, unknown>) {
    state.persistCalls.push(input);
    const blueprint = input.blueprint as { slug: string };
    const rows = state.db.rows('siteos_blueprints')
      .filter((r) => r.tenant_id === input.tenantId && r.slug === blueprint.slug)
      .sort((a, b) => Number(b.version) - Number(a.version));
    const latest = rows[0];
    if (latest && latest.content_sha256 === input.blueprintSha256) {
      return { unchanged: true, version: latest.version, contentSha256: latest.content_sha256 };
    }
    const id = crypto.randomUUID();
    const version = Number(latest?.version ?? 0) + 1;
    state.db.rows('siteos_blueprints').push(roundTrip({
      id, tenant_id: input.tenantId, slug: blueprint.slug, version, status: 'draft',
      blueprint: input.blueprint, content_sha256: input.blueprintSha256,
      origin_source: input.originSource, origin_model: input.originModel, project_id: input.projectId,
    }));
    return { unchanged: false, blueprintId: id, version, prevHash: latest?.content_sha256 ?? null, tasks: [], provenanceLinked: true };
  }

  return { state, requireAuthAndTenant, persist };
});

vi.mock('../../supabase/functions/siteos/persist.ts', () => ({
  persistBlueprintVersion: (input: Record<string, unknown>) => h.persist(input),
}));
vi.mock('../../supabase/functions/siteos/rebuild-fetch.ts', () => ({
  crawlSite: (start: URL, nowIso: string) => {
    h.state.crawlCalls.push(start.toString());
    return h.state.crawl(start, nowIso);
  },
}));

import {
  handleAnalyze,
  handleRefine,
  handleSelect,
  handleStatus,
  type RebuildDeps,
} from '../../supabase/functions/siteos/handlers/rebuild';

/**
 * Was `rebuild-deps.ts` in Produktion einsetzt, hier nachgebildet: der
 * Resolver mit der Semantik von `_shared/auth.ts`, die Plan-Schranken als
 * Schalter.
 */
const deps: RebuildDeps = {
  requireAuthAndTenant: (req, tenantId, roles) => h.requireAuthAndTenant(req, tenantId, roles),
  gateSiteEdit: async () => h.state.gates.edit,
  gateSiteCreate: async (_admin, _tenantId, slug) => {
    h.state.gates.createSlugs.push(slug);
    return h.state.gates.create;
  },
};

type Handler = (req: Request, deps: RebuildDeps) => Promise<Response>;
// deno-lint-ignore no-explicit-any
type Json = any;

async function call(handler: Handler, body: unknown, options: { bearer?: boolean } = {}): Promise<{ status: number; json: Json }> {
  const res = await handler(new Request('https://edge.example/functions/v1/siteos/rebuild', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(options.bearer === false ? {} : { Authorization: 'Bearer test-token' }) },
    body: JSON.stringify(body),
  }), deps);
  return { status: res.status, json: await res.json() };
}

const db = () => h.state.db;
const rows = (table: string) => db().rows(table);

function asOwner(tenantId = TENANT, role = 'owner'): void {
  h.state.memberships.set(tenantId, role);
}

async function analyzed(): Promise<Json> {
  const res = await call(handleAnalyze, { tenant_id: TENANT, url: 'https://www.mueller-haustechnik.example/' });
  expect(res.status, JSON.stringify(res.json)).toBe(200);
  return res.json;
}

async function selected(direction?: string): Promise<{ analysis: Json; selection: Json }> {
  const analysis = await analyzed();
  const key = direction ?? analysis.directions[0].plan.key;
  const res = await call(handleSelect, { tenant_id: TENANT, run_id: analysis.run.id, direction: key });
  expect(res.status, JSON.stringify(res.json)).toBe(200);
  return { analysis, selection: res.json };
}

beforeEach(() => {
  h.state.reset();
  h.state.crawl = async () => ({ input: snapshotInput('handwerk') });
});

// ─────────────────────────────────────────────────────────────────────
// rebuild-analyze
// ─────────────────────────────────────────────────────────────────────

describe('rebuild-analyze', () => {
  it('ohne Token: 401 — kein Abruf, kein Protokoll', async () => {
    asOwner();
    const res = await call(handleAnalyze, { tenant_id: TENANT, url: 'https://www.mueller-haustechnik.example/' }, { bearer: false });
    expect(res.status).toBe(401);
    expect(h.state.crawlCalls).toEqual([]);
    expect(db().log).toEqual([]);
  });

  it('fremder Mandant im Body: 403 — die Behauptung reicht nicht', async () => {
    asOwner(TENANT);
    const res = await call(handleAnalyze, { tenant_id: OTHER_TENANT, url: 'https://www.mueller-haustechnik.example/' });
    expect(res.status).toBe(403);
    expect(h.state.crawlCalls).toEqual([]);
    expect(db().log).toEqual([]);
  });

  it('Rolle ohne Analyse-Recht (Prüfer): 403', async () => {
    asOwner(TENANT, 'viewer_auditor');
    const res = await call(handleAnalyze, { tenant_id: TENANT, url: 'https://www.mueller-haustechnik.example/' });
    expect(res.status).toBe(403);
    expect(h.state.authCalls[0].roles).toEqual(['owner', 'admin', 'editor', 'dpo']);
    expect(h.state.crawlCalls).toEqual([]);
  });

  it('ohne Builder-Recht im Plan: Antwort der Schranke, kein Abruf', async () => {
    asOwner();
    h.state.gates.edit = new Response(JSON.stringify({ ok: false, error: { code: 'FORBIDDEN', message: 'siteos.builder' } }), { status: 403 });
    const res = await call(handleAnalyze, { tenant_id: TENANT, url: 'https://www.mueller-haustechnik.example/' });
    expect(res.status).toBe(403);
    expect(h.state.crawlCalls).toEqual([]);
  });

  it.each([
    ['http://10.0.0.7/', 'private Adresse'],
    ['http://169.254.169.254/latest/meta-data/', 'Metadaten-Dienst'],
    ['https://intranet.corp/', 'interner Name'],
    ['https://firma.example:8443/', 'Nicht-Standard-Port'],
    ['ftp://firma.example/', 'anderes Protokoll'],
  ])('lehnt %s ab (%s) — vor Kostenbremse und Protokoll', async (url) => {
    asOwner();
    const res = await call(handleAnalyze, { tenant_id: TENANT, url });
    expect(res.status).toBe(400);
    expect(h.state.crawlCalls).toEqual([]);
    expect(rows('governance_admin_log')).toEqual([]);
  });

  it('Kostenbremse: zwölf Versuche in der letzten Stunde — kein dreizehnter Abruf', async () => {
    asOwner();
    for (let i = 0; i < 12; i += 1) {
      rows('governance_admin_log').push({ tenant_id: TENANT, action: 'siteos.rebuild.analyze.attempt', created_at: new Date(Date.now() - 60_000 * i).toISOString() });
    }
    const res = await call(handleAnalyze, { tenant_id: TENANT, url: 'https://www.mueller-haustechnik.example/' });
    expect(res.status).toBe(429);
    expect(res.json.error.code).toBe('RATE_LIMITED');
    expect(h.state.crawlCalls).toEqual([]);
  });

  it('Kostenbremse zählt nur die letzte Stunde und nur den eigenen Mandanten', async () => {
    asOwner();
    for (let i = 0; i < 20; i += 1) {
      rows('governance_admin_log').push({ tenant_id: TENANT, action: 'siteos.rebuild.analyze.attempt', created_at: new Date(Date.now() - 3_700_000 - i).toISOString() });
      rows('governance_admin_log').push({ tenant_id: OTHER_TENANT, action: 'siteos.rebuild.analyze.attempt', created_at: new Date().toISOString() });
    }
    expect((await call(handleAnalyze, { tenant_id: TENANT, url: 'https://www.mueller-haustechnik.example/' })).status).toBe(200);
  });

  it('jeder Versuch wird vor dem Abruf protokolliert — scheitert das Protokoll, wird nicht abgerufen', async () => {
    asOwner();
    db().fail.set('governance_admin_log:insert', 'audit down');
    const res = await call(handleAnalyze, { tenant_id: TENANT, url: 'https://www.mueller-haustechnik.example/' });
    expect(res.status).toBe(503);
    expect(h.state.crawlCalls).toEqual([]);
  });

  it('ist der Zähler nicht lesbar, wird nicht abgerufen', async () => {
    asOwner();
    db().fail.set('governance_admin_log:select', 'count down');
    const res = await call(handleAnalyze, { tenant_id: TENANT, url: 'https://www.mueller-haustechnik.example/' });
    expect(res.status).toBe(503);
    expect(h.state.crawlCalls).toEqual([]);
  });

  it('auch ein gescheiterter Abruf zählt als Versuch', async () => {
    asOwner();
    h.state.crawl = async () => ({ status: 422, code: 'UNREACHABLE', error: 'Die Startseite war nicht abrufbar.' });
    const res = await call(handleAnalyze, { tenant_id: TENANT, url: 'https://www.mueller-haustechnik.example/' });
    expect(res.status).toBe(422);
    expect(rows('governance_admin_log').filter((r) => r.action === 'siteos.rebuild.analyze.attempt')).toHaveLength(1);
    expect(rows('siteos_rebuild_runs')).toEqual([]);
    expect(rows('governance_evidence')).toEqual([]);
  });

  it('belegt die Analyse in der Kette des Mandanten und speichert den Lauf erst danach', async () => {
    asOwner();
    const json = await analyzed();
    const run = rows('siteos_rebuild_runs');
    expect(run).toHaveLength(1);
    expect(run[0].tenant_id).toBe(TENANT);
    expect(run[0].created_by).toBe(USER);

    // Reihenfolge: Protokoll des Versuchs → Nachweis → Lauf → Abschluss-Protokoll.
    const order = db().log.filter((e) => e !== 'governance_evidence:select');
    expect(order.indexOf('append_governance_evidence:rpc')).toBeGreaterThan(order.indexOf('governance_admin_log:insert'));
    expect(order.indexOf('siteos_rebuild_runs:insert')).toBeGreaterThan(order.indexOf('append_governance_evidence:rpc'));

    const evidence = rows('governance_evidence');
    expect(evidence).toHaveLength(1);
    expect(run[0].evidence_id).toBe(evidence[0].id);
    const snapshot = (evidence[0].metadata as Json).snapshot;
    expect(snapshot).toMatchObject({ kind: 'siteos.rebuild.analysis', run_id: run[0].id, tenant_id: TENANT, evidence_id: evidence[0].id, previous_hash: null });
    expect(snapshot.snapshot_sha256).toBe(run[0].snapshot_sha256);

    // Der gespeicherte Snapshot (nach jsonb-Rundreise) hat genau den belegten Hash.
    expect(await canonicalHash(run[0].snapshot)).toBe(run[0].snapshot_sha256);
    expect(json.run).toMatchObject({ id: run[0].id, snapshot_sha256: run[0].snapshot_sha256, evidence_id: evidence[0].id });
    expect(rows('governance_admin_log').map((r) => r.action)).toEqual(['siteos.rebuild.analyze.attempt', 'siteos.rebuild.analyze']);
  });

  it('bindet jede angebotene Richtung an Lauf und Snapshot — und belegt ihre Hashes', async () => {
    asOwner();
    const json = await analyzed();
    expect(json.directions.length).toBeGreaterThanOrEqual(2);
    const stored = rows('siteos_rebuild_runs')[0].directions as Json;
    for (const [i, direction] of json.directions.entries()) {
      expect((direction.blueprint as SiteBlueprint).origin.rebuild).toEqual({ runId: json.run.id, snapshotSha256: json.run.snapshot_sha256 });
      expect(await canonicalHash(direction.blueprint)).toBe(direction.blueprint_sha256);
      expect(stored.items[i].blueprint_sha256).toBe(direction.blueprint_sha256);
      // Gespeichert werden Plan und Bericht, nicht der Blueprint.
      expect(stored.items[i].blueprint).toBeUndefined();
    }
    const evidenceDirections = ((rows('governance_evidence')[0].metadata as Json).snapshot).directions;
    expect(evidenceDirections.map((d: Json) => d.blueprint_sha256)).toEqual(json.directions.map((d: Json) => d.blueprint_sha256));
  });

  it('speichert keine Dokumente — abgeleitete Signale, Belegauszüge bis 280 Zeichen, Dokument-Hashes', async () => {
    asOwner();
    await analyzed();
    const snapshot = rows('siteos_rebuild_runs')[0].snapshot as Json;
    expect(JSON.stringify(snapshot)).not.toMatch(/<html|<!doctype|<head[ >]/i);
    expect(snapshot.pages).toHaveLength(2);
    for (const page of snapshot.pages) {
      expect(page.html).toBeUndefined();
      expect(page.documentSha256).toMatch(/^[0-9a-f]{64}$/);
    }
    for (const item of snapshot.evidence) expect(item.excerpt.length).toBeLessThanOrEqual(280);
    // Längster abgeleiteter Text ist die Textprobe der Seite (Lesbarkeit) —
    // gedeckelt, kein Volltext.
    const lengths: number[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === 'string') lengths.push(value.length);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') Object.values(value).forEach(walk);
    };
    walk(snapshot);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(1500);
  });

  it('kein Lauf ohne Nachweis: Schreibfehler der Kette ⇒ 500, nichts gespeichert', async () => {
    asOwner();
    db().fail.set('append_governance_evidence:rpc', 'chain down');
    const res = await call(handleAnalyze, { tenant_id: TENANT, url: 'https://www.mueller-haustechnik.example/' });
    expect(res.status).toBe(500);
    expect(res.json.error.code).toBe('EVIDENCE_INSERT');
    expect(rows('siteos_rebuild_runs')).toEqual([]);
  });

  it('bewegt sich der Kettenkopf, wird neu gehasht und erneut angehängt', async () => {
    asOwner();
    db().rpcConflicts = 2;
    await analyzed();
    expect(db().log.filter((e) => e === 'append_governance_evidence:rpc')).toHaveLength(3);
    expect(rows('governance_evidence')).toHaveLength(1);
  });

  it('bewegt er sich dauernd: 503 statt einer verzweigten Kette — und kein Lauf', async () => {
    asOwner();
    db().rpcConflicts = 99;
    const res = await call(handleAnalyze, { tenant_id: TENANT, url: 'https://www.mueller-haustechnik.example/' });
    expect(res.status).toBe(503);
    expect(res.json.error.code).toBe('EVIDENCE_CHAIN_CONFLICT');
    expect(rows('siteos_rebuild_runs')).toEqual([]);
  });

  it('hängt an den bestehenden Kettenkopf des Mandanten an', async () => {
    asOwner();
    rows('governance_evidence').push({ id: 'e-alt', tenant_id: TENANT, content_hash: 'f'.repeat(64), created_at: new Date(Date.now() - 1000).toISOString() });
    rows('governance_evidence').push({ id: 'e-fremd', tenant_id: OTHER_TENANT, content_hash: 'e'.repeat(64), created_at: new Date().toISOString() });
    await analyzed();
    const mine = rows('governance_evidence').find((r) => r.id !== 'e-alt' && r.tenant_id === TENANT);
    expect(mine?.previous_hash).toBe('f'.repeat(64));
    expect(((mine?.metadata as Json).snapshot).previous_hash).toBe('f'.repeat(64));
  });
});

// ─────────────────────────────────────────────────────────────────────
// rebuild-select
// ─────────────────────────────────────────────────────────────────────

describe('rebuild-select', () => {
  it('übernimmt genau die angebotene Richtung — Herkunft import, gebunden an den Lauf', async () => {
    asOwner();
    const { analysis, selection } = await selected();
    const offered = analysis.directions[0];
    expect(selection.content_sha256).toBe(offered.blueprint_sha256);

    const site = rows('siteos_blueprints');
    expect(site).toHaveLength(1);
    expect(site[0]).toMatchObject({ tenant_id: TENANT, slug: selection.slug, version: 1, origin_source: 'import', content_sha256: offered.blueprint_sha256 });
    expect((site[0].blueprint as SiteBlueprint).origin.rebuild).toEqual({ runId: analysis.run.id, snapshotSha256: analysis.run.snapshot_sha256 });
    expect(h.state.persistCalls[0]).toMatchObject({ originSource: 'import', workflow: 'website-transformation', auditAction: 'siteos.rebuild.select' });

    const run = rows('siteos_rebuild_runs')[0];
    expect(run).toMatchObject({ status: 'selected', selected_direction: offered.plan.key, site_slug: selection.slug, selected_blueprint_id: site[0].id });
    expect(selection.blueprint_id).toBe(site[0].id);
    expect(h.state.gates.createSlugs).toEqual([selection.slug]);
  });

  it('nimmt keinen Blueprint aus der Anfrage an', async () => {
    asOwner();
    const analysis = await analyzed();
    const forged = { ...analysis.directions[0].blueprint, name: 'Gefälschte Firma' };
    const res = await call(handleSelect, { tenant_id: TENANT, run_id: analysis.run.id, direction: analysis.directions[0].plan.key, blueprint: forged });
    expect(res.status).toBe(200);
    expect((rows('siteos_blueprints')[0].blueprint as SiteBlueprint).name).not.toBe('Gefälschte Firma');
  });

  it('ein zweites Auswählen derselben Richtung erzeugt keine neue Version', async () => {
    asOwner();
    const { analysis, selection } = await selected();
    const again = await call(handleSelect, { tenant_id: TENANT, run_id: analysis.run.id, direction: analysis.directions[0].plan.key });
    expect(again.status).toBe(200);
    expect(again.json.unchanged).toBe(true);
    expect(again.json.blueprint_id).toBe(selection.blueprint_id);
    expect(rows('siteos_blueprints')).toHaveLength(1);
  });

  it('Richtung, die nicht angeboten wurde: 400', async () => {
    asOwner();
    const analysis = await analyzed();
    const offered = new Set(analysis.directions.map((d: Json) => d.plan.key));
    const missing = ['clean-enterprise', 'conversion-focus', 'local-trust', 'premium-advisory'].find((k) => !offered.has(k));
    expect(missing).toBeDefined();
    const res = await call(handleSelect, { tenant_id: TENANT, run_id: analysis.run.id, direction: missing });
    expect(res.status).toBe(400);
    expect(rows('siteos_blueprints')).toEqual([]);
  });

  it('Lauf eines anderen Mandanten: 404 — auch mit gültiger Kennung', async () => {
    asOwner(TENANT);
    const analysis = await analyzed();
    asOwner(OTHER_TENANT);
    const res = await call(handleSelect, { tenant_id: OTHER_TENANT, run_id: analysis.run.id, direction: analysis.directions[0].plan.key });
    expect(res.status).toBe(404);
    expect(rows('siteos_blueprints')).toEqual([]);
  });

  it('Datenschutzbeauftragte dürfen analysieren, aber keine Site anlegen', async () => {
    asOwner(TENANT, 'dpo');
    const analysis = await analyzed();
    const res = await call(handleSelect, { tenant_id: TENANT, run_id: analysis.run.id, direction: analysis.directions[0].plan.key });
    expect(res.status).toBe(403);
    expect(rows('siteos_blueprints')).toEqual([]);
  });

  it('veränderter Snapshot in der Datenbank: 409 INTEGRITY, nichts übernommen', async () => {
    asOwner();
    const analysis = await analyzed();
    const run = rows('siteos_rebuild_runs')[0] as Json;
    run.snapshot.host = 'andere-firma.example';
    const res = await call(handleSelect, { tenant_id: TENANT, run_id: analysis.run.id, direction: analysis.directions[0].plan.key });
    expect(res.status).toBe(409);
    expect(res.json.error.code).toBe('INTEGRITY');
    expect(h.state.persistCalls).toEqual([]);
  });

  it('weicht die neue Ableitung vom belegten Angebot ab: 409 STALE_DERIVATION', async () => {
    asOwner();
    const analysis = await analyzed();
    const run = rows('siteos_rebuild_runs')[0] as Json;
    run.directions.items[0].blueprint_sha256 = '0'.repeat(64);
    const res = await call(handleSelect, { tenant_id: TENANT, run_id: analysis.run.id, direction: analysis.directions[0].plan.key });
    expect(res.status).toBe(409);
    expect(res.json.error.code).toBe('STALE_DERIVATION');
    expect(h.state.persistCalls).toEqual([]);
  });

  it('ältere Engine-Version: 409 STALE_ENGINE', async () => {
    asOwner();
    const analysis = await analyzed();
    (rows('siteos_rebuild_runs')[0] as Json).engine_version = 'rebuild-2020.01.1';
    const res = await call(handleSelect, { tenant_id: TENANT, run_id: analysis.run.id, direction: analysis.directions[0].plan.key });
    expect(res.status).toBe(409);
    expect(res.json.error.code).toBe('STALE_ENGINE');
  });

  it('überschreibt keine Site, die nicht aus einer Website übernommen wurde (SLUG_TAKEN)', async () => {
    asOwner();
    const analysis = await analyzed();
    const slug = analysis.directions[0].blueprint.slug;
    rows('siteos_blueprints').push({ id: 'bp-builder', tenant_id: TENANT, slug, version: 3, origin_source: 'ai-builder', blueprint: { slug }, content_sha256: 'a'.repeat(64) });
    const res = await call(handleSelect, { tenant_id: TENANT, run_id: analysis.run.id, direction: analysis.directions[0].plan.key });
    expect(res.status).toBe(409);
    expect(res.json.error.code).toBe('SLUG_TAKEN');
    expect(h.state.persistCalls).toEqual([]);
  });

  it('tauscht die Ausgangsseite einer bestehenden Site nicht gegen eine andere Domain (OTHER_SOURCE)', async () => {
    asOwner();
    const analysis = await analyzed();
    const slug = analysis.directions[0].blueprint.slug;
    const boundRun = '44444444-4444-4444-8444-444444444444';
    rows('siteos_rebuild_runs').push({ id: boundRun, tenant_id: TENANT, host: 'mueller--haustechnik.example', site_slug: slug });
    rows('siteos_blueprints').push({
      id: 'bp-alt', tenant_id: TENANT, slug, version: 1, origin_source: 'import', content_sha256: 'b'.repeat(64),
      blueprint: { slug, origin: { source: 'import', rebuild: { runId: boundRun, snapshotSha256: 'c'.repeat(64) } } },
    });
    const res = await call(handleSelect, { tenant_id: TENANT, run_id: analysis.run.id, direction: analysis.directions[0].plan.key });
    expect(res.status).toBe(409);
    expect(res.json.error.code).toBe('OTHER_SOURCE');
    expect(h.state.persistCalls).toEqual([]);
  });

  it('ohne belegte Ausgangsseite oder ohne auffindbaren Lauf: ebenfalls kein Austausch (fail-closed)', async () => {
    asOwner();
    const analysis = await analyzed();
    const slug = analysis.directions[0].blueprint.slug;
    const row = { id: 'bp-alt', tenant_id: TENANT, slug, version: 1, origin_source: 'import', content_sha256: 'b'.repeat(64), blueprint: { slug, origin: { source: 'import' } } as Json };
    rows('siteos_blueprints').push(row);
    const unbound = await call(handleSelect, { tenant_id: TENANT, run_id: analysis.run.id, direction: analysis.directions[0].plan.key });
    expect(unbound.status).toBe(409);
    expect(unbound.json.error.code).toBe('OTHER_SOURCE');

    row.blueprint.origin.rebuild = { runId: '55555555-5555-4555-8555-555555555555', snapshotSha256: 'c'.repeat(64) };
    const vanished = await call(handleSelect, { tenant_id: TENANT, run_id: analysis.run.id, direction: analysis.directions[0].plan.key });
    expect(vanished.status).toBe(409);
    expect(vanished.json.error.code).toBe('OTHER_SOURCE');
    expect(h.state.persistCalls).toEqual([]);
  });

  it('eine neue Analyse derselben Website darf die Site fortschreiben (gleicher Host, mit oder ohne www)', async () => {
    asOwner();
    const first = await selected();
    h.state.crawl = async () => {
      const input = snapshotInput('handwerk');
      // Dieselbe Website, diesmal ohne www — und ein Satz mehr auf der Startseite.
      const strip = (u: string) => u.replace('://www.', '://');
      input.sourceUrl = strip(input.sourceUrl);
      input.resolvedUrl = strip(input.resolvedUrl);
      input.pages = input.pages.map((p) => ({ ...p, url: strip(p.url), html: p.html.replace('</main>', '<p>Neu: Notdienst auch am Wochenende.</p></main>') }));
      return { input };
    };
    const second = await analyzed();
    expect(second.run.id).not.toBe(first.analysis.run.id);
    const key = second.directions[0].plan.key;
    const res = await call(handleSelect, { tenant_id: TENANT, run_id: second.run.id, direction: key });
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    const versions = rows('siteos_blueprints').filter((r) => r.slug === res.json.slug);
    expect(versions.map((r) => r.version).sort()).toEqual([1, 2]);
    const latest = versions.find((r) => r.version === 2) as Json;
    expect(latest.blueprint.origin.rebuild.runId).toBe(second.run.id);
  });

  it('ohne freien Site-Platz im Plan: Antwort der Schranke, nichts übernommen', async () => {
    asOwner();
    const analysis = await analyzed();
    h.state.gates.create = new Response(JSON.stringify({ ok: false, error: { code: 'QUOTA_EXCEEDED', message: 'limit.sites' } }), { status: 402 });
    const res = await call(handleSelect, { tenant_id: TENANT, run_id: analysis.run.id, direction: analysis.directions[0].plan.key });
    expect(res.status).toBe(402);
    expect(h.state.persistCalls).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────
// rebuild-refine
// ─────────────────────────────────────────────────────────────────────

describe('rebuild-refine', () => {
  it('ohne gesehenen Stand (base_sha256) keine Überarbeitung', async () => {
    asOwner();
    const { selection } = await selected();
    const res = await call(handleRefine, { tenant_id: TENANT, slug: selection.slug, intents: ['premium-beratung'] });
    expect(res.status).toBe(400);
    expect(h.state.persistCalls).toHaveLength(1); // nur die Übernahme
  });

  it('hat sich die Site inzwischen bewegt: 409 STALE_BASE', async () => {
    asOwner();
    const { selection } = await selected();
    const res = await call(handleRefine, { tenant_id: TENANT, slug: selection.slug, base_sha256: '9'.repeat(64), intents: ['premium-beratung'] });
    expect(res.status).toBe(409);
    expect(res.json.error.code).toBe('STALE_BASE');
    expect(h.state.persistCalls).toHaveLength(1);
  });

  it('wendet benannte Regeln an, meldet die neue Zeile und trägt die Bindung weiter', async () => {
    asOwner();
    const { analysis, selection } = await selected('conversion-focus');
    const res = await call(handleRefine, { tenant_id: TENANT, slug: selection.slug, base_sha256: selection.content_sha256, intents: ['premium-beratung', 'kein-schluessel'] });
    expect(res.status, JSON.stringify(res.json)).toBe(200);
    expect(res.json.understood).toBe(true);
    expect(res.json.intents).toEqual(['premium-beratung']);
    expect(res.json.changes.length).toBeGreaterThan(0);

    const latest = rows('siteos_blueprints').find((r) => r.version === 2) as Json;
    expect(res.json.blueprint_id).toBe(latest.id);
    expect(res.json.content_sha256).toBe(latest.content_sha256);
    expect(latest.origin_source).toBe('import');
    expect(latest.blueprint.origin.rebuild).toEqual({ runId: analysis.run.id, snapshotSha256: analysis.run.snapshot_sha256 });
    expect(h.state.persistCalls[1]).toMatchObject({ workflow: 'content-governance', auditAction: 'siteos.rebuild.refine' });
  });

  it('Unverstandenes ändert nichts und sagt das', async () => {
    asOwner();
    const { selection } = await selected();
    const res = await call(handleRefine, { tenant_id: TENANT, slug: selection.slug, base_sha256: selection.content_sha256, instruction: 'qwrtz plmkn xyv' });
    expect(res.status).toBe(200);
    expect(res.json.understood).toBe(false);
    expect(h.state.persistCalls).toHaveLength(1);
  });

  it('Site eines anderen Mandanten: 404', async () => {
    asOwner(TENANT);
    const { selection } = await selected();
    asOwner(OTHER_TENANT);
    const res = await call(handleRefine, { tenant_id: OTHER_TENANT, slug: selection.slug, base_sha256: selection.content_sha256, intents: ['premium-beratung'] });
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────
// rebuild-status
// ─────────────────────────────────────────────────────────────────────

describe('rebuild-status', () => {
  it('nennt den gebundenen Lauf — nicht den zuletzt bearbeiteten', async () => {
    asOwner();
    const { analysis, selection } = await selected();
    // Eine spätere Analyse derselben Website, nicht übernommen.
    await analyzed();
    asOwner(TENANT, 'viewer_auditor');
    const res = await call(handleStatus, { tenant_id: TENANT, slug: selection.slug });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ run_id: analysis.run.id, source_host: 'www.mueller-haustechnik.example', binding_problem: null, origin_source: 'import', blueprint_id: selection.blueprint_id });
    expect(Array.isArray(res.json.next_steps)).toBe(true);
  });

  it('veränderter Snapshot des gebundenen Laufs: keine Bindung, mit Grund', async () => {
    asOwner();
    const { selection } = await selected();
    (rows('siteos_rebuild_runs')[0] as Json).snapshot.host = 'andere-firma.example';
    const res = await call(handleStatus, { tenant_id: TENANT, slug: selection.slug });
    expect(res.status).toBe(200);
    expect(res.json.run_id).toBeNull();
    expect(res.json.binding_problem).toMatch(/Hash/);
  });

  it('liest den Verbindungsstand aus der Registratur — eine Behauptung im Body zählt nicht', async () => {
    asOwner();
    const { selection } = await selected();
    const claimed = [{ systemType: 'crm', status: 'connected', displayName: 'Behauptetes CRM' }];

    const before = await call(handleStatus, { tenant_id: TENANT, slug: selection.slug, connectors: claimed });
    expect(before.json.next_steps.some((s: Json) => s.connection === 'connected')).toBe(false);

    rows('connector_registry').push({ tenant_id: TENANT, system_type: 'crm', status: 'connected', display_name: 'HubSpot' });
    rows('connector_registry').push({ tenant_id: OTHER_TENANT, system_type: 'messaging', status: 'connected', display_name: 'Fremdes Postfach' });
    const after = await call(handleStatus, { tenant_id: TENANT, slug: selection.slug, connectors: claimed });
    const connected = after.json.next_steps.filter((s: Json) => s.connection === 'connected').map((s: Json) => s.connectedSystem);
    expect(connected).toContain('HubSpot');
    expect(connected).not.toContain('Behauptetes CRM');
    expect(connected).not.toContain('Fremdes Postfach');
    for (const step of after.json.next_steps) expect(step.requiresApproval).toBe(true);
  });

  it('Site ohne Rebuild (Builder): kein Lauf erwartet, kein Problem gemeldet', async () => {
    asOwner();
    const analysis = await analyzed();
    const blueprint = { ...analysis.directions[0].blueprint, slug: 'praxis-am-markt', origin: { source: 'ai-builder', model: null, promptSha256: null, createdAt: analysis.run.derived_at } };
    rows('siteos_blueprints').push({ id: 'bp-b', tenant_id: TENANT, slug: 'praxis-am-markt', version: 1, origin_source: 'ai-builder', content_sha256: 'a'.repeat(64), blueprint });
    const res = await call(handleStatus, { tenant_id: TENANT, slug: 'praxis-am-markt' });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ run_id: null, binding_problem: null, origin_source: 'ai-builder' });
  });

  it('ohne Mitgliedschaft: 403', async () => {
    const res = await call(handleStatus, { tenant_id: TENANT, slug: 'irgendeine-site' });
    expect(res.status).toBe(403);
    expect(db().log).toEqual([]);
  });
});
