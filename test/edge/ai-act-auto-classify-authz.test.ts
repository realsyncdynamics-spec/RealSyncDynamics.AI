// @vitest-environment node
/**
 * ai-act-auto-classify — Autorisierung vor jedem Service-Role-Zugriff (P0).
 *
 * ## Der Befund
 *
 * Die Function stand mit verify_jwt = true in Produktion, pruefte im Code aber
 * weder den Aufrufer noch dessen Mitgliedschaft. Der oeffentliche Anon-Key ist
 * ein gueltiger Projekt-JWT und passiert das Plattform-Gate — wer ihn hatte,
 * konnte mit beliebiger tenant_id / ai_system_id Service-Role-Writes in
 * ai_systems / ai_act_assessments ausloesen. Zusaetzlich rief der Erfolgspfad
 * `jsonResponse(200, {...})` mit vertauschten Argumenten auf: der Write war
 * schon passiert, die Antwort warf trotzdem (500).
 *
 * ## Was hier geprueft wird
 *
 * - logic.ts (rein): Bearer-Vorfilter, Body-Validierung, Besitzpruefung des
 *   ai_system, Scoring.
 * - handler.ts mit einem Fake des kanonischen Resolvers requireAuthAndTenant,
 *   der dessen Semantik nachbildet (401 ohne gueltige Sitzung, 403 ohne
 *   Mitgliedschaft bzw. ohne erlaubte Rolle). Belegt wird: kein Token / Anon /
 *   service_role → 401 ohne jeden DB-Zugriff; Nicht-Mitglied → 403 ohne
 *   DB-Zugriff; fremdes ai_system → 404 ohne Write; Owner → 200 mit Writes
 *   ausschliesslich auf den geprueften Mandanten.
 * - index.ts (Quelltext): nutzt genau den kanonischen Resolver, erzeugt keinen
 *   eigenen Service-Role-Client. Das Laufzeitverhalten von _shared/auth.ts
 *   selbst ist aus Vitest nicht pruefbar (jsr:-Import), siehe
 *   test/security/agents-run-canonical-auth.test.ts.
 */
import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  WRITE_ROLES,
  checkSystemOwnership,
  classifySystem,
  isRejection,
  parseClassifyBody,
  rejectNonUserBearer,
} from '../../supabase/functions/ai-act-auto-classify/logic';
import {
  handleAutoClassify,
  type AdminClient,
  type RequireAuthAndTenant,
} from '../../supabase/functions/ai-act-auto-classify/handler';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const SYSTEM_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SYSTEM_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OWNER = '0000000a-0000-4000-8000-00000000000a';
const MEMBER = '0000000b-0000-4000-8000-00000000000b';
const OUTSIDER = '0000000c-0000-4000-8000-00000000000c';

const b64url = (o: unknown) =>
  Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** Unsigned JWT — signature is irrelevant for the reject-only pre-filter. */
const jwt = (payload: Record<string, unknown>) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.sig`;

const ANON_KEY = jwt({ iss: 'supabase', ref: 'proj', role: 'anon' });
const SERVICE_KEY = jwt({ iss: 'supabase', ref: 'proj', role: 'service_role' });
const OWNER_TOKEN = jwt({ sub: OWNER, role: 'authenticated' });
const MEMBER_TOKEN = jwt({ sub: MEMBER, role: 'authenticated' });
const OUTSIDER_TOKEN = jwt({ sub: OUTSIDER, role: 'authenticated' });
const FORGED_TOKEN = jwt({ sub: OWNER, role: 'authenticated', forged: true });

const USERS: Record<string, string> = {
  [OWNER_TOKEN]: OWNER,
  [MEMBER_TOKEN]: MEMBER,
  [OUTSIDER_TOKEN]: OUTSIDER,
};
const MEMBERSHIPS: Record<string, string> = {
  [`${TENANT_A}:${OWNER}`]: 'owner',
  [`${TENANT_A}:${MEMBER}`]: 'member',
  [`${TENANT_B}:${OUTSIDER}`]: 'owner',
};

type Row = Record<string, unknown>;
interface Call { table: string; op: string; args: unknown[] }

/**
 * Recording fake of the service_role client. Rows are filtered by the `.eq()`
 * calls like PostgREST would, so a query that forgets the tenant filter
 * really does see foreign rows.
 */
function fakeAdmin(tables: Record<string, Row[]>) {
  const calls: Call[] = [];
  let nextId = 1;
  const admin: AdminClient = {
    from(table: string) {
      let op = 'select';
      let payload: Row | null = null;
      const filters: [string, unknown][] = [];
      const run = () => {
        const rows = (tables[table] ??= []);
        const match = rows.filter((r) => filters.every(([c, v]) => r[c] === v));
        if (op === 'insert') {
          const row = { id: `assessment-${nextId++}`, ...payload };
          rows.push(row);
          return { data: row, error: null };
        }
        if (op === 'update') {
          match.forEach((r) => Object.assign(r, payload));
          return { data: match[0] ?? null, error: null };
        }
        return { data: match[0] ?? null, error: null };
      };
      const b: Record<string, unknown> = {
        select: (...args: unknown[]) => { calls.push({ table, op: op === 'select' ? 'select' : `${op}.select`, args }); return b; },
        insert: (p: Row) => { op = 'insert'; payload = p; calls.push({ table, op, args: [p] }); return b; },
        update: (p: Row) => { op = 'update'; payload = p; calls.push({ table, op, args: [p] }); return b; },
        upsert: (p: Row) => { op = 'upsert'; payload = p; calls.push({ table, op, args: [p] }); return b; },
        eq: (c: string, v: unknown) => { filters.push([c, v]); return b; },
        order: () => b,
        limit: () => b,
        maybeSingle: async () => run(),
        single: async () => run(),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
      };
      return b;
    },
  };
  const writes = () => calls.filter((c) => ['insert', 'update', 'upsert'].includes(c.op));
  return { admin, calls, writes, tables };
}

/** Fake of _shared/auth.ts#requireAuthAndTenant — same status semantics. */
function fakeCanonical(admin: AdminClient) {
  const json = (status: number, code: string) =>
    new Response(JSON.stringify({ ok: false, error: { code } }), { status });
  const fn = vi.fn<RequireAuthAndTenant>(async (req, tenantId, roles) => {
    const h = req.headers.get('Authorization') ?? '';
    const userId = USERS[h.replace(/^Bearer /, '')];
    if (!userId) return json(401, 'UNAUTHORIZED');           // auth.getUser() failed
    if (!tenantId) return json(400, 'BAD_REQUEST');
    const role = MEMBERSHIPS[`${tenantId}:${userId}`];
    if (!role || (roles && roles.length > 0 && !roles.includes(role))) return json(403, 'FORBIDDEN');
    return { user: { id: userId }, tenantId, admin };
  });
  return fn;
}

function seed() {
  return fakeAdmin({
    ai_systems: [
      { id: SYSTEM_A, tenant_id: TENANT_A, purpose: 'Employment screening', data_types: ['personal_data', 'minors'] },
      { id: SYSTEM_B, tenant_id: TENANT_B, purpose: 'Chatbot', data_types: [] },
    ],
    ai_act_assessments: [],
  });
}

function post(body: unknown, token?: string, raw = false) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  return new Request('http://localhost/functions/v1/ai-act-auto-classify', {
    method: 'POST',
    headers,
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

async function run(req: Request, db = seed()) {
  const canonical = fakeCanonical(db.admin);
  const res = await handleAutoClassify(req, {
    requireAuthAndTenant: canonical,
    now: () => new Date('2026-09-25T20:00:00Z'),
  });
  const json = await res.json().catch(() => null);
  return { res, json, canonical, db };
}

// ─── logic.ts ────────────────────────────────────────────────────────────────

describe('logic — rejectNonUserBearer (Vorfilter, gewaehrt nie Zugriff)', () => {
  it('kein Header → 401', () => {
    expect(rejectNonUserBearer(null)?.status).toBe(401);
    expect(rejectNonUserBearer(undefined)?.status).toBe(401);
    expect(rejectNonUserBearer('')?.status).toBe(401);
  });
  it('kein Bearer-Schema / leerer Token → 401', () => {
    expect(rejectNonUserBearer(`Basic ${OWNER_TOKEN}`)?.status).toBe(401);
    expect(rejectNonUserBearer('Bearer ')?.status).toBe(401);
  });
  it('Anon-Key (role=anon) → 401', () => {
    expect(rejectNonUserBearer(`Bearer ${ANON_KEY}`)).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
  });
  it('service_role-Key → 401 (kein Nutzer)', () => {
    expect(rejectNonUserBearer(`Bearer ${SERVICE_KEY}`)?.status).toBe(401);
  });
  it('opake API-Keys und Nicht-JWTs → 401', () => {
    expect(rejectNonUserBearer('Bearer sb_publishable_abc123')?.status).toBe(401);
    expect(rejectNonUserBearer('Bearer sb_secret_abc123')?.status).toBe(401);
    expect(rejectNonUserBearer('Bearer not-a-jwt')?.status).toBe(401);
    expect(rejectNonUserBearer('Bearer a.%%%.c')?.status).toBe(401);
  });
  it('JWT ohne sub → 401', () => {
    expect(rejectNonUserBearer(`Bearer ${jwt({ role: 'authenticated' })}`)?.status).toBe(401);
  });
  it('Nutzer-JWT → null (weiter an den kanonischen Resolver)', () => {
    expect(rejectNonUserBearer(`Bearer ${OWNER_TOKEN}`)).toBeNull();
  });
});

describe('logic — parseClassifyBody', () => {
  it('verlangt tenant_id und ai_system_id als UUID', () => {
    expect(isRejection(parseClassifyBody(null))).toBe(true);
    expect(isRejection(parseClassifyBody([]))).toBe(true);
    expect(isRejection(parseClassifyBody({ ai_system_id: SYSTEM_A }))).toBe(true);
    expect(isRejection(parseClassifyBody({ tenant_id: TENANT_A }))).toBe(true);
    expect(isRejection(parseClassifyBody({ tenant_id: 'x', ai_system_id: SYSTEM_A }))).toBe(true);
    expect(isRejection(parseClassifyBody({ tenant_id: TENANT_A, ai_system_id: "1' or 1=1" }))).toBe(true);
  });
  it('liefert die Werte, tenant_id nur als ungeprueften Claim', () => {
    expect(parseClassifyBody({ tenant_id: TENANT_A, ai_system_id: SYSTEM_A })).toEqual({
      aiSystemId: SYSTEM_A,
      tenantIdClaim: TENANT_A,
    });
  });
});

describe('logic — checkSystemOwnership', () => {
  it('fehlendes System → 404', () => {
    expect(checkSystemOwnership(null, SYSTEM_A, TENANT_A)?.status).toBe(404);
  });
  it('System eines fremden Mandanten → 404 (kein Existenz-Orakel)', () => {
    expect(checkSystemOwnership({ id: SYSTEM_B, tenant_id: TENANT_B }, SYSTEM_B, TENANT_A)?.status).toBe(404);
  });
  it('andere id als angefragt → 404', () => {
    expect(checkSystemOwnership({ id: SYSTEM_B, tenant_id: TENANT_A }, SYSTEM_A, TENANT_A)?.status).toBe(404);
  });
  it('eigenes System → null', () => {
    expect(checkSystemOwnership({ id: SYSTEM_A, tenant_id: TENANT_A }, SYSTEM_A, TENANT_A)).toBeNull();
  });
});

describe('logic — classifySystem', () => {
  it('minimal ohne Indikatoren', () => {
    expect(classifySystem({ purpose: null, data_types: null })).toMatchObject({
      riskScore: 0, classification: 'minimal_risk', recommendation: 'allowed',
    });
  });
  it('limited ab 25', () => {
    expect(classifySystem({ purpose: 'employment', data_types: ['personal_data'] })).toMatchObject({
      riskScore: 30, classification: 'limited_risk', recommendation: 'allowed',
    });
  });
  it('high ab 50 → requires_approval', () => {
    expect(classifySystem({ purpose: 'Employment', data_types: ['personal_data', 'minors'] })).toMatchObject({
      riskScore: 60, classification: 'high_risk', recommendation: 'requires_approval',
    });
  });
  it('Score wird auf 100 begrenzt (CHECK-Constraint)', () => {
    const r = classifySystem({
      purpose: 'critical law enforcement employment education',
      data_types: ['personal_data', 'special_category', 'minors', 'x'],
    });
    expect(r.riskScore).toBe(100);
  });
  it('Owner/Admin sind die einzigen Schreibrollen', () => {
    expect([...WRITE_ROLES].sort()).toEqual(['admin', 'owner']);
  });
});

// ─── handler.ts ──────────────────────────────────────────────────────────────

describe('handler — 401 ohne Nutzersitzung, vor jedem DB-Zugriff', () => {
  const body = { tenant_id: TENANT_A, ai_system_id: SYSTEM_A };

  it('kein Token → 401, Resolver und DB unberuehrt', async () => {
    const { res, canonical, db } = await run(post(body));
    expect(res.status).toBe(401);
    expect(canonical).not.toHaveBeenCalled();
    expect(db.calls).toEqual([]);
  });

  it('Anon-Key → 401, Resolver und DB unberuehrt', async () => {
    const { res, json, canonical, db } = await run(post(body, ANON_KEY));
    expect(res.status).toBe(401);
    expect(json).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
    expect(canonical).not.toHaveBeenCalled();
    expect(db.calls).toEqual([]);
  });

  it('service_role-Key als Bearer → 401', async () => {
    const { res, db } = await run(post(body, SERVICE_KEY));
    expect(res.status).toBe(401);
    expect(db.calls).toEqual([]);
  });

  it('Token, den auth.getUser() nicht kennt → 401 vom Resolver, keine DB', async () => {
    const { res, canonical, db } = await run(post(body, FORGED_TOKEN));
    expect(canonical).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(401);
    expect(db.calls).toEqual([]);
  });
});

describe('handler — Mandant und Rolle', () => {
  it('Nicht-Mitglied des angefragten Mandanten → 403, keine DB', async () => {
    const { res, db } = await run(post({ tenant_id: TENANT_A, ai_system_id: SYSTEM_A }, OUTSIDER_TOKEN));
    expect(res.status).toBe(403);
    expect(db.calls).toEqual([]);
  });

  it('Mitglied ohne owner/admin-Rolle → 403, keine DB', async () => {
    const { res, db } = await run(post({ tenant_id: TENANT_A, ai_system_id: SYSTEM_A }, MEMBER_TOKEN));
    expect(res.status).toBe(403);
    expect(db.calls).toEqual([]);
  });

  it('uebergibt dem Resolver den Claim und die Schreibrollen', async () => {
    const { canonical } = await run(post({ tenant_id: TENANT_A, ai_system_id: SYSTEM_A }, OWNER_TOKEN));
    expect(canonical).toHaveBeenCalledTimes(1);
    const [, tenantArg, rolesArg] = canonical.mock.calls[0];
    expect(tenantArg).toBe(TENANT_A);
    expect(rolesArg).toEqual(['owner', 'admin']);
  });

  it('Owner von A mit ai_system von B (tenant_id=A) → 404, kein Write', async () => {
    const { res, db } = await run(post({ tenant_id: TENANT_A, ai_system_id: SYSTEM_B }, OWNER_TOKEN));
    expect(res.status).toBe(404);
    expect(db.writes()).toEqual([]);
    expect(db.tables.ai_act_assessments).toEqual([]);
  });

  it('Owner von A mit tenant_id=B → 403, kein Zugriff auf B', async () => {
    const { res, db } = await run(post({ tenant_id: TENANT_B, ai_system_id: SYSTEM_B }, OWNER_TOKEN));
    expect(res.status).toBe(403);
    expect(db.calls).toEqual([]);
  });

  it('Besitzpruefung greift auch, wenn die DB eine fremde Zeile liefert', async () => {
    // Verteidigung in der Tiefe: selbst wenn der Tenant-Filter der Abfrage
    // wegfiele, blockiert checkSystemOwnership.
    const db = seed();
    const origFrom = db.admin.from.bind(db.admin);
    db.admin.from = (t: string) => {
      const q = origFrom(t);
      if (t !== 'ai_systems') return q;
      return { ...q, select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: SYSTEM_A, tenant_id: TENANT_B }, error: null }) }) }) }) };
    };
    const { res } = await run(post({ tenant_id: TENANT_A, ai_system_id: SYSTEM_A }, OWNER_TOKEN), db);
    expect(res.status).toBe(404);
    expect(db.writes()).toEqual([]);
  });
});

describe('handler — Erfolgspfad (Owner, eigenes System)', () => {
  it('200 statt 500 (vertauschte jsonResponse-Argumente) mit korrektem Body', async () => {
    const { res, json } = await run(post({ tenant_id: TENANT_A, ai_system_id: SYSTEM_A }, OWNER_TOKEN));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(json).toMatchObject({
      ok: true,
      assessment_id: 'assessment-1',
      classification: 'high_risk',
      risk_score: 60,
      recommendation: 'requires_approval',
    });
  });

  it('schreibt ausschliesslich auf den geprueften Mandanten', async () => {
    const { db } = await run(post({ tenant_id: TENANT_A, ai_system_id: SYSTEM_A }, OWNER_TOKEN));
    const inserted = db.tables.ai_act_assessments;
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      tenant_id: TENANT_A, ai_system_id: SYSTEM_A, assessed_by: OWNER, overall_risk_score: 60,
    });
    expect(db.tables.ai_systems.find((r) => r.id === SYSTEM_A)?.latest_assessment_id).toBe('assessment-1');
    expect(db.tables.ai_systems.find((r) => r.id === SYSTEM_B)?.latest_assessment_id).toBeUndefined();
    expect(db.calls.some((c) => c.op === 'upsert')).toBe(false);
  });

  it('zweiter Lauf aktualisiert die bestehende Bewertung statt eine zweite anzulegen', async () => {
    const db = seed();
    await run(post({ tenant_id: TENANT_A, ai_system_id: SYSTEM_A }, OWNER_TOKEN), db);
    const second = await run(post({ tenant_id: TENANT_A, ai_system_id: SYSTEM_A }, OWNER_TOKEN), db);
    expect(second.res.status).toBe(200);
    expect(second.json.assessment_id).toBe('assessment-1');
    expect(db.tables.ai_act_assessments).toHaveLength(1);
    expect(db.tables.ai_act_assessments[0].last_reassessed_at).toBe('2026-09-25T20:00:00.000Z');
  });
});

describe('handler — Protokoll', () => {
  it('OPTIONS → Preflight ohne Auth', async () => {
    const res = await handleAutoClassify(
      new Request('http://localhost/', { method: 'OPTIONS' }),
      { requireAuthAndTenant: fakeCanonical(seed().admin) },
    );
    expect(res.status).toBe(200);
  });
  it('GET → 405', async () => {
    const res = await handleAutoClassify(
      new Request('http://localhost/', { method: 'GET' }),
      { requireAuthAndTenant: fakeCanonical(seed().admin) },
    );
    expect(res.status).toBe(405);
  });
  it('ungueltiges JSON / fehlende Felder → 400, Resolver nicht aufgerufen', async () => {
    const a = await run(post('{nope', OWNER_TOKEN, true));
    expect(a.res.status).toBe(400);
    expect(a.canonical).not.toHaveBeenCalled();
    const b = await run(post({ tenant_id: TENANT_A }, OWNER_TOKEN));
    expect(b.res.status).toBe(400);
    expect(b.canonical).not.toHaveBeenCalled();
  });
});

// ─── index.ts / handler.ts (Quelltext) ───────────────────────────────────────

describe('Quelltext — genau ein Resolver, kein eigener Service-Role-Client', () => {
  const DIR = resolve(__dirname, '../../supabase/functions/ai-act-auto-classify');
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const index = strip(readFileSync(resolve(DIR, 'index.ts'), 'utf8'));
  const handler = strip(readFileSync(resolve(DIR, 'handler.ts'), 'utf8'));
  const both = index + handler;

  it('index.ts verdrahtet requireAuthAndTenant aus _shared/auth.ts', () => {
    expect(index).toContain("import { requireAuthAndTenant } from '../_shared/auth.ts'");
    expect(index).toContain('handleAutoClassify(req, { requireAuthAndTenant })');
  });

  it('keine eigene auth.ts, keine lokale Mitglieds- oder Nutzerabfrage', () => {
    expect(existsSync(resolve(DIR, 'auth.ts'))).toBe(false);
    expect(both).not.toMatch(/from\(\s*['"]memberships['"]\s*\)/);
    expect(both).not.toContain('auth.getUser(');
    expect(both).not.toContain('requireTenantMembership(');
  });

  it('kein eigener Service-Role-Client', () => {
    expect(both).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(both).not.toMatch(/\bcreateClient\(/);
    expect(handler).toContain('const admin = auth.admin');
  });

  it('Ablehnung des Resolvers wird unveraendert durchgereicht, vor jedem .from(', () => {
    const gate = handler.indexOf('if (auth instanceof Response) return auth');
    const firstFrom = handler.indexOf('.from(');
    expect(gate).toBeGreaterThan(-1);
    expect(firstFrom).toBeGreaterThan(gate);
  });

  it('Writes nehmen nur den geprueften Mandanten', () => {
    expect(handler).toContain('const tenantId = auth.tenantId');
    expect(handler).toMatch(/tenant_id:\s*tenantId/);
    expect(handler).not.toMatch(/tenant_id:\s*(body|parsed|raw)\./);
    // Der ungepruefte Claim kommt genau einmal vor: als Argument des Resolvers.
    const claimLines = handler.split('\n').filter((z) => z.includes('tenantIdClaim'));
    expect(claimLines).toHaveLength(1);
    expect(claimLines[0]).toContain('await deps.requireAuthAndTenant(req, parsed.tenantIdClaim,');
  });

  it('jsonResponse bekommt den Body zuerst, jsonError den Status zuerst', () => {
    expect(both).not.toMatch(/jsonResponse\(\s*\d{3}\s*,/);
    for (const call of both.match(/jsonError\(\s*[^)]*/g) ?? []) {
      expect(call, `falsche Signatur: ${call}`).toMatch(/jsonError\(\s*(\d{3}|r\.status)\s*,\s*('[A-Z_]+'|r\.code)\s*,/);
    }
  });
});
