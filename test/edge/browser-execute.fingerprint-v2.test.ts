/**
 * browser-execute mit Fingerprint v2 – Handler-Test mit gemocktem Supabase.
 * reserve_browser_execution/finish_browser_execution sind 1:1 der Logik der
 * produktiven SQL-Funktionen nachgebildet (Stand 16.11.2026).
 *
 * Geprüft:
 *  V1  verändernde Aktion ohne target ⇒ 400 TARGET_REQUIRED, keine Freigabe angelegt
 *  V2  ungültiges target ⇒ 400 TARGET_INVALID
 *  V3  erste Anfrage ⇒ 409 APPROVAL_REQUIRED; Event-Payload ohne Klartextwerte
 *  V4  freigegeben + gleiches Ziel/Inhalt ⇒ 200, Executor bekommt expected_target
 *  V5  freigegeben + geänderter Inhalt ⇒ 409 APPROVAL_MISMATCH, Executor nicht aufgerufen
 *  V6  freigegeben + anderer Empfänger ⇒ 409 APPROVAL_MISMATCH
 *  V7  gleiche Freigabe zweimal ⇒ 409 APPROVAL_ALREADY_USED
 *  V8  v1-Freigabe (alter Fingerprint) ⇒ 409 APPROVAL_MISMATCH
 *  V9  reine Lese-Aktionen brauchen kein target und keine Freigabe
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const TENANT = '00000000-0000-0000-0000-0000000000aa';
const SESSION = 'sess-0123456789abcdef';

// ---------- In-Memory-DB ----------
type Row = Record<string, any>;
const db = { governance_events: [] as Row[], governance_approvals: [] as Row[], browser_executions: [] as Row[], governance_evidence: [] as Row[] };
let idSeq = 0;
const newId = () => `00000000-0000-0000-0000-${String(++idSeq).padStart(12, '0')}`;

function reserveBrowserExecution(p: { p_tenant_id: string; p_approval_id: string; p_fingerprint: string }) {
  const a = db.governance_approvals.find((x) => x.id === p.p_approval_id);
  if (!a || a.tenant_id !== p.p_tenant_id) return { outcome: 'not_found', execution_id: null, execution_status: null, approval_status: null };
  const e = db.browser_executions.find((x) => x.approval_id === p.p_approval_id);
  if (e) return { outcome: 'already_used', execution_id: e.id, execution_status: e.status, approval_status: a.status };
  if (a.status !== 'approved') return { outcome: 'not_approved', execution_id: null, execution_status: null, approval_status: a.status };
  if (new Date(a.expires_at).getTime() <= Date.now()) return { outcome: 'expired', execution_id: null, execution_status: null, approval_status: a.status };
  if (a.requested_action !== p.p_fingerprint) return { outcome: 'mismatch', execution_id: null, execution_status: null, approval_status: a.status };
  const id = newId();
  db.browser_executions.push({ id, tenant_id: p.p_tenant_id, approval_id: p.p_approval_id, fingerprint: p.p_fingerprint, status: 'reserved' });
  return { outcome: 'reserved', execution_id: id, execution_status: 'reserved', approval_status: a.status };
}

function finishBrowserExecution(p: { p_execution_id: string; p_status: string }) {
  const e = db.browser_executions.find((x) => x.id === p.p_execution_id && x.status === 'reserved');
  if (!e) return false;
  e.status = p.p_status;
  return true;
}

function table(name: keyof typeof db) {
  let inserted: Row | null = null;
  const q: any = {
    insert(row: Row) {
      inserted = { id: newId(), expires_at: new Date(Date.now() + 3600_000).toISOString(), ...row };
      db[name].push(inserted);
      return q;
    },
    select() { return q; },
    single: async () => ({ data: inserted, error: null }),
    eq() { return q; }, not() { return q; }, order() { return q; },
    limit: async () => ({ data: [...db[name]].reverse().slice(0, 1), error: null }),
  };
  return q;
}

const admin = {
  from: (t: keyof typeof db) => table(t),
  rpc: async (fn: string, args: any) => {
    if (fn === 'reserve_browser_execution') return { data: [reserveBrowserExecution(args)], error: null };
    if (fn === 'finish_browser_execution') return { data: finishBrowserExecution(args), error: null };
    if (fn === 'append_governance_evidence') { const id = newId(); db.governance_evidence.push({ id, ...args.p_row }); return { data: id, error: null }; }
    return { data: null, error: { message: `unknown rpc ${fn}` } };
  },
};

vi.mock('../../supabase/functions/_shared/auth.ts', () => ({
  requireAuthAndTenant: async () => ({ admin, tenantId: TENANT, user: { id: 'user-1', email: 'pruefer@example.org' } }),
}));
vi.mock('../../supabase/functions/_shared/ai.ts', () => ({
  AiInvokeError: class extends Error {},
  runAiTool: async () => { throw new Error('nicht im Test'); },
}));

// ---------- Deno-Shim + Executor ----------
let handler: (req: Request) => Promise<Response>;
const executorCalls: any[] = [];

beforeAll(async () => {
  (globalThis as any).Deno = {
    serve: (h: any) => { handler = h; },
    env: { get: (k: string) => ({ PLAYWRIGHT_SCANNER_URL: 'https://executor.test', PLAYWRIGHT_SCANNER_KEY: 'test-key' } as Record<string, string>)[k] },
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    executorCalls.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true, results: [{ type: 'click', ok: true }] }), { status: 200 });
  }));
  // Pfad bewusst nicht literal: sonst folgt `tsc` (npm run lint) dem Import in die
  // Deno-Function (jsr:/npm:-Imports, Deno.serve) – supabase/functions ist aus der
  // Typprüfung ausgeschlossen. vitest löst den Pfad zur Laufzeit normal auf.
  const handlerModule = '../../supabase/functions/browser-execute/index.ts';
  await import(/* @vite-ignore */ handlerModule);
});

beforeEach(() => {
  for (const k of Object.keys(db) as (keyof typeof db)[]) db[k].length = 0;
  executorCalls.length = 0;
});

const TARGET = { origin: 'https://musterbetrieb.example', method: 'POST', values: { name: 'Erika Muster', email: 'erika@example.org' } };
const CLICK = [{ type: 'click', selector: '#senden' }];

async function call(body: Record<string, unknown>) {
  const res = await handler(new Request('https://fn.test/browser-execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'execute', session_id: SESSION, ...body }) }));
  return { status: res.status, json: await res.json() as any };
}

async function requestAndApprove(target = TARGET) {
  const r = await call({ actions: CLICK, target });
  expect(r.status).toBe(409);
  expect(r.json.error.code).toBe('APPROVAL_REQUIRED');
  const approvalId = r.json.error.details.approval_id as string;
  db.governance_approvals.find((a) => a.id === approvalId)!.status = 'approved';
  return approvalId;
}

describe('browser-execute Fingerprint v2', () => {
  it('V1 verändernde Aktion ohne target ⇒ TARGET_REQUIRED, nichts angelegt', async () => {
    const r = await call({ actions: CLICK });
    expect(r.status).toBe(400);
    expect(r.json.error.code).toBe('TARGET_REQUIRED');
    expect(db.governance_approvals).toHaveLength(0);
  });

  it('V2 ungültiges target ⇒ TARGET_INVALID', async () => {
    const r = await call({ actions: CLICK, target: { ...TARGET, origin: 'https://x.example/pfad?d=geheim' } });
    expect(r.status).toBe(400);
    expect(r.json.error.code).toBe('TARGET_INVALID');
  });

  it('V3 Freigabe wird mit v2-Fingerprint angelegt; Event-Payload ohne Klartextwerte', async () => {
    await requestAndApprove();
    expect(db.governance_approvals[0].requested_action).toMatch(/^browser:v2:[0-9a-f]{64}$/);
    const payload = JSON.stringify(db.governance_events[0].payload);
    expect(payload).not.toContain('Erika');
    expect(payload).not.toContain('erika@example.org');
    expect(db.governance_events[0].payload.target).toMatchObject({ origin: TARGET.origin, method: 'POST' });
  });

  it('V4 gleiches Ziel und gleicher Inhalt ⇒ ausgeführt, Executor bekommt expected_target', async () => {
    const approvalId = await requestAndApprove();
    const r = await call({ actions: CLICK, target: TARGET, approval_id: approvalId });
    expect(r.status).toBe(200);
    expect(r.json.ok).toBe(true);
    expect(executorCalls).toHaveLength(1);
    expect(executorCalls[0].body.expected_target).toEqual(TARGET);
    expect(db.browser_executions[0].status).toBe('executed');
    expect(JSON.stringify(db.governance_evidence)).not.toContain('erika@example.org');
  });

  it('V5 geänderter Inhalt ⇒ APPROVAL_MISMATCH, Executor nicht aufgerufen', async () => {
    const approvalId = await requestAndApprove();
    const r = await call({ actions: CLICK, target: { ...TARGET, values: { ...TARGET.values, email: 'angreifer@example.net' } }, approval_id: approvalId });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('APPROVAL_MISMATCH');
    expect(executorCalls).toHaveLength(0);
    expect(db.browser_executions).toHaveLength(0);
  });

  it('V6 anderer Empfänger ⇒ APPROVAL_MISMATCH', async () => {
    const approvalId = await requestAndApprove();
    const r = await call({ actions: CLICK, target: { ...TARGET, origin: 'https://angreifer.example' }, approval_id: approvalId });
    expect(r.json.error.code).toBe('APPROVAL_MISMATCH');
    expect(executorCalls).toHaveLength(0);
  });

  it('V7 gleiche Freigabe zweimal ⇒ APPROVAL_ALREADY_USED', async () => {
    const approvalId = await requestAndApprove();
    expect((await call({ actions: CLICK, target: TARGET, approval_id: approvalId })).status).toBe(200);
    const r = await call({ actions: CLICK, target: TARGET, approval_id: approvalId });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('APPROVAL_ALREADY_USED');
    expect(executorCalls).toHaveLength(1);
  });

  it('V8 alte v1-Freigabe passt nicht mehr ⇒ APPROVAL_MISMATCH', async () => {
    const approvalId = await requestAndApprove();
    db.governance_approvals[0].requested_action = 'browser:v1:' + 'a'.repeat(64);
    const r = await call({ actions: CLICK, target: TARGET, approval_id: approvalId });
    expect(r.json.error.code).toBe('APPROVAL_MISMATCH');
  });

  it('V9 reine Lese-Aktionen: kein target, keine Freigabe', async () => {
    const r = await call({ actions: [{ type: 'extract' }] });
    expect(r.status).toBe(200);
    expect(db.governance_approvals).toHaveLength(0);
    expect(executorCalls[0].body.expected_target).toBeNull();
  });
});
