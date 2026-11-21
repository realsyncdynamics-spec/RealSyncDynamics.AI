/**
 * Gemeinsamer Test-Harness für browser-execute (PR A + PR B).
 * In-Memory-Nachbildung der benötigten Tabellen und RPCs.
 * reserve_browser_execution / finish_browser_execution folgen 1:1 der Logik der
 * produktiven SQL-Funktionen (Stand 16.11.2026).
 */
export const TENANT = '00000000-0000-0000-0000-0000000000aa';
export const SESSION = 'sess-0123456789abcdef';
export const ORIGIN = 'https://musterbetrieb.example';

type Row = Record<string, any>;
export const db = {
  governance_events: [] as Row[],
  governance_approvals: [] as Row[],
  browser_executions: [] as Row[],
  governance_evidence: [] as Row[],
  governance_policies: [] as Row[],
  browser_actions: [] as Row[],
};
export const flags = { policyError: false, evidenceError: false, eventError: false };
export const executorCalls: any[] = [];
let idSeq = 0;
const newId = () => `00000000-0000-0000-0000-${String(++idSeq).padStart(12, '0')}`;

export function resetDb(): void {
  for (const k of Object.keys(db) as (keyof typeof db)[]) db[k].length = 0;
  executorCalls.length = 0;
  flags.policyError = false;
  flags.evidenceError = false;
  flags.eventError = false;
}

/** Freigabe-Richtlinie für Browser-Origins anlegen (wie in governance_policies). */
export function allowOrigins(origins: string[], opts: { action?: string; mode?: string; enabled?: boolean; environment?: string } = {}): void {
  db.governance_policies.push({
    id: newId(), tenant_id: TENANT, policy_type: 'data_transfer', enabled: opts.enabled ?? true,
    action: opts.action ?? 'allow', mode: opts.mode ?? 'enforce', environment: opts.environment ?? 'production',
    condition: { scope: 'browser_origin', origins },
  });
}

function reserveBrowserExecution(p: { p_tenant_id: string; p_approval_id: string; p_fingerprint: string }) {
  const a = db.governance_approvals.find((x) => x.id === p.p_approval_id);
  if (!a || a.tenant_id !== p.p_tenant_id) return { outcome: 'not_found', execution_id: null, execution_status: null, approval_status: null };
  const e = db.browser_executions.find((x) => x.approval_id === p.p_approval_id);
  if (e) return { outcome: 'already_used', execution_id: e.id, execution_status: e.status, approval_status: a.status };
  if (a.status !== 'approved') return { outcome: 'not_approved', execution_id: null, execution_status: null, approval_status: a.status };
  if (new Date(a.expires_at).getTime() <= Date.now()) return { outcome: 'expired', execution_id: null, execution_status: null, approval_status: a.status };
  if (a.requested_action !== p.p_fingerprint) return { outcome: 'mismatch', execution_id: null, execution_status: null, approval_status: a.status };
  const id = newId();
  db.browser_executions.push({ id, tenant_id: p.p_tenant_id, approval_id: p.p_approval_id, fingerprint: p.p_fingerprint, status: 'reserved', detail: null });
  return { outcome: 'reserved', execution_id: id, execution_status: 'reserved', approval_status: a.status };
}

function finishBrowserExecution(p: { p_execution_id: string; p_status: string }) {
  const e = db.browser_executions.find((x) => x.id === p.p_execution_id && x.status === 'reserved');
  if (!e) return false;
  e.status = p.p_status;
  e.detail = (p as any).p_detail ?? null;
  e.finished_at = new Date().toISOString();
  return true;
}

function table(name: keyof typeof db) {
  let inserted: Row | null = null;
  let patch: Row | null = null;
  let failed = false;
  const filters: Array<[string, unknown]> = [];
  const match = () => db[name].filter((r) => filters.every(([c, v]) => (v === null ? r[c] === null || r[c] === undefined : r[c] === v)));
  const q: any = {
    insert(row: Row) {
      if (name === 'governance_events' && flags.eventError) { inserted = null; failed = true; return q; }
      inserted = { id: newId(), ...(name === 'governance_approvals' ? { expires_at: new Date(Date.now() + 3600_000).toISOString() } : {}), ...row };
      db[name].push(inserted);
      return q;
    },
    update(p: Row) { patch = p; return q; },
    select() { return q; },
    single: async () => (failed ? { data: null, error: { message: 'insert failed' } } : { data: inserted, error: null }),
    maybeSingle: async () => ({ data: match()[0] ?? null, error: null }),
    eq(col: string, val: unknown) { filters.push([col, val]); return q; },
    is(col: string, val: unknown) { filters.push([col, val]); return q; },
    not() { return q; },
    order() { return q; },
    limit: async () => ({ data: [...db[name]].reverse().slice(0, 1), error: null }),
    // await auf Abfrage/Update – UPDATE … WHERE ist wie in Postgres atomar (synchron ausgeführt)
    then(resolve: (v: unknown) => void) {
      if (inserted) return resolve({ data: inserted, error: null });
      if (patch) { const rows = match(); rows.forEach((r) => Object.assign(r, patch)); return resolve({ data: rows.map((r) => ({ id: r.id })), error: null }); }
      if (name === 'governance_policies' && flags.policyError) return resolve({ data: null, error: { message: 'connection reset' } });
      return resolve({ data: match(), error: null });
    },
  };
  return q;
}

export const admin = {
  from: (t: keyof typeof db) => table(t),
  rpc: async (fn: string, args: any) => {
    if (fn === 'reserve_browser_execution') return { data: [reserveBrowserExecution(args)], error: null };
    if (fn === 'finish_browser_execution') return { data: finishBrowserExecution(args), error: null };
    if (fn === 'append_governance_evidence') { if (flags.evidenceError) return { data: null, error: { message: 'write failed' } }; const id = newId(); db.governance_evidence.push({ id, ...args.p_row }); return { data: id, error: null }; }
    return { data: null, error: { message: `unknown rpc ${fn}` } };
  },
};

let handler: (req: Request) => Promise<Response>;

/** Deno-Shim, Executor-Mock, dann die Edge Function laden. */
export async function loadHandler(vi: any): Promise<void> {
  (globalThis as any).Deno = {
    serve: (h: any) => { handler = h; },
    env: { get: (k: string) => ({ PLAYWRIGHT_SCANNER_URL: 'https://executor.test', PLAYWRIGHT_SCANNER_KEY: 'test-key' } as Record<string, string>)[k] },
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    executorCalls.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ ok: true, results: [{ ok: true }] }), { status: 200 });
  }));
  // Pfad bewusst nicht literal: sonst folgt `tsc` (npm run lint) dem Import in die
  // Deno-Function (jsr:/npm:-Imports, Deno.serve) – supabase/functions ist aus der
  // Typprüfung ausgeschlossen. vitest löst den Pfad zur Laufzeit normal auf.
  const handlerModule = '../../supabase/functions/browser-execute/index.ts';
  await import(/* @vite-ignore */ handlerModule);
}

export async function call(body: Record<string, unknown>): Promise<{ status: number; json: any }> {
  const res = await handler(new Request('https://fn.test/browser-execute', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'execute', session_id: SESSION, ...body }),
  }));
  return { status: res.status, json: await res.json() };
}

export function approve(approvalId: string): void {
  db.governance_approvals.find((a) => a.id === approvalId)!.status = 'approved';
}
