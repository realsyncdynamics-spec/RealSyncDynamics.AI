// ai-os-control — Operationen. Jede Operation ist genau einer Gateway-Aktion
// zugeordnet (OPERATIONS); index.ts prüft Rolle, AAL und Gateway-Entscheidung,
// bevor eine Operation läuft.

import {
  ROUTINES,
  collectCiFailures,
  collectGithubStatus,
  collectSecurityInfra,
  createGithubClient,
  findSecretLikeContent,
  getRoutine,
  isAllowedKnowledgePath,
  KNOWLEDGE_ROOT,
  type AgentId,
  type GithubClient,
  type GhWorkflowRun,
} from '../../../packages/ai-os-core/src/index.ts';

// deno-lint-ignore no-explicit-any
type Db = any;

export interface OpContext {
  /** Nutzer-Client (RLS mit Nutzer-JWT). */
  user: Db;
  /** Service-Role-Client — nur für Aggregate und Protokoll. */
  admin: Db;
  params: Record<string, unknown>;
  github: () => GithubClient | null;
  now: Date;
}

export interface OpResult {
  status?: number;
  body: Record<string, unknown>;
  /** Ziel für das Protokoll (Routine, Pfad), nie Inhalte. */
  target?: string;
  /** Ergebnis-Kennungen für das Protokoll (PR-Nummer, Workflow-Zustand). */
  auditDetail?: Record<string, unknown>;
}

export interface OperationSpec {
  actionId: string;
  /** Agent, in dessen Namen die Operation läuft (für die Positivliste). */
  agentFor?: (params: Record<string, unknown>) => AgentId | undefined;
  maxGithubCalls: number;
  run: (ctx: OpContext) => Promise<OpResult>;
}

export const GITHUB_NOT_CONFIGURED: OpResult = {
  body: {
    configured: false,
    message:
      'GitHub ist nicht verbunden. Benötigt wird das Supabase-Function-Secret AI_OS_GITHUB_TOKEN (fein granularer Token, nur dieses Repository).',
  },
};

const routineParam = (params: Record<string, unknown>) => {
  const id = typeof params.routineId === 'string' ? params.routineId : '';
  return getRoutine(id);
};

function b64decodeUtf8(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function b64encodeUtf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

const MAX_NOTE_BYTES = 60_000;
const MAX_NOTES = 20;

// ── Kosten ────────────────────────────────────────────────────────────────

interface CostBucket { key: string; amountUsd: number; rows: number }

function addTo(map: Map<string, CostBucket>, key: string, amount: number) {
  const b = map.get(key) ?? { key, amountUsd: 0, rows: 0 };
  b.amountUsd += Number.isFinite(amount) ? amount : 0;
  b.rows += 1;
  map.set(key, b);
}

const sorted = (m: Map<string, CostBucket>) =>
  [...m.values()].map((b) => ({ ...b, amountUsd: Math.round(b.amountUsd * 10_000) / 10_000 }))
    .sort((a, b) => b.amountUsd - a.amountUsd);

const ROW_CAP = 20_000;
/** PostgREST liefert je Anfrage höchstens `max_rows` (Supabase-Standard 1000). */
const PAGE_SIZE = 1_000;

/**
 * Liest seitenweise bis ROW_CAP. Ohne Paging kämen still nur die ersten 1000
 * Zeilen an — die Summen wären zu niedrig, ohne dass es jemand sieht.
 */
async function readPaged(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<{ data: Array<Record<string, unknown>>; error: unknown; truncated: boolean }> {
  const rows: Array<Record<string, unknown>> = [];
  for (let from = 0; from < ROW_CAP; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error, truncated: false };
    const chunk = (data ?? []) as Array<Record<string, unknown>>;
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) return { data: rows, error: null, truncated: false };
  }
  return { data: rows, error: null, truncated: true };
}

async function costs(ctx: OpContext): Promise<OpResult> {
  const days = 30;
  const since = new Date(ctx.now.getTime() - days * 86_400_000).toISOString();

  const ledger = await readPaged((from, to) => ctx.admin
    .from('tenant_cost_ledger')
    .select('vendor, model_ref, cost_kind, amount_usd')
    .gte('occurred_at', since)
    .eq('is_simulated', false)
    .order('id', { ascending: true })
    .range(from, to));
  const runs = await readPaged((from, to) => ctx.admin
    .from('ai_tool_runs')
    .select('tool_key, input_tokens, output_tokens, cost_usd, status')
    .gte('created_at', since)
    .order('id', { ascending: true })
    .range(from, to));

  const byVendor = new Map<string, CostBucket>();
  const byModel = new Map<string, CostBucket>();
  const byKind = new Map<string, CostBucket>();
  for (const r of ledger.data) {
    const amount = Number(r.amount_usd);
    addTo(byVendor, String(r.vendor ?? 'unbekannt'), amount);
    addTo(byModel, String(r.model_ref ?? 'unbekannt'), amount);
    addTo(byKind, String(r.cost_kind), amount);
  }
  const byTool = new Map<string, CostBucket>();
  let inputTokens = 0;
  let outputTokens = 0;
  let errors = 0;
  for (const r of runs.data) {
    addTo(byTool, String(r.tool_key), Number(r.cost_usd));
    inputTokens += Number(r.input_tokens) || 0;
    outputTokens += Number(r.output_tokens) || 0;
    if (r.status !== 'success') errors += 1;
  }

  return {
    body: {
      periodDays: days,
      since,
      currency: 'USD',
      ledger: ledger.error
        ? { available: false, error: 'tenant_cost_ledger nicht lesbar' }
        : {
          available: true,
          rows: ledger.data.length,
          truncated: ledger.truncated,
          totalUsd: sorted(byVendor).reduce((s, b) => s + b.amountUsd, 0),
          byVendor: sorted(byVendor),
          byModel: sorted(byModel).slice(0, 15),
          byKind: sorted(byKind),
        },
      toolRuns: runs.error
        ? { available: false, error: 'ai_tool_runs nicht lesbar' }
        : {
          available: true,
          rows: runs.data.length,
          truncated: runs.truncated,
          inputTokens,
          outputTokens,
          errorRuns: errors,
          byTool: sorted(byTool).slice(0, 15),
        },
      providerQuotas: {
        available: false,
        message: 'Provider-Kontingente (Anthropic, OpenAI, Google) sind nicht angebunden und werden nicht geschätzt.',
      },
    },
  };
}

// ── Routinen ──────────────────────────────────────────────────────────────

async function routines(ctx: OpContext): Promise<OpResult> {
  const health = await ctx.user.rpc('admin_system_health');
  const cronJobs = health.error ? null : ((health.data as { cron_jobs?: unknown[] } | null)?.cron_jobs ?? []);
  const gh = ctx.github();
  if (!gh) return { body: { ...GITHUB_NOT_CONFIGURED.body, routines: [], cronJobs } };

  const out = [];
  for (const r of ROUTINES) {
    try {
      const wf = await gh.get<{ state: string; html_url: string }>(`/actions/workflows/${r.workflowFile}`);
      const runs = await gh.get<{ workflow_runs: GhWorkflowRun[] }>(`/actions/workflows/${r.workflowFile}/runs?per_page=5`);
      out.push({
        id: r.id,
        state: wf.state,
        url: wf.html_url,
        runs: (runs.workflow_runs ?? []).map((x) => ({
          id: x.id, event: x.event, status: x.status, conclusion: x.conclusion, createdAt: x.created_at, url: x.html_url,
        })),
      });
    } catch (e) {
      out.push({ id: r.id, state: 'not_found', error: (e as Error).message, runs: [] });
    }
  }
  return { body: { configured: true, routines: out, cronJobs, apiCalls: gh.calls() } };
}

async function routineDispatch(ctx: OpContext): Promise<OpResult> {
  const r = routineParam(ctx.params);
  if (!r) return { status: 400, body: { error: 'unknown_routine' } };
  const gh = ctx.github();
  if (!gh) return { status: 503, ...GITHUB_NOT_CONFIGURED };
  await gh.send('POST', `/actions/workflows/${r.workflowFile}/dispatches`, { ref: 'main' });
  return {
    body: { ok: true, routineId: r.id, message: 'Lauf angefordert. GitHub startet ihn in wenigen Sekunden.' },
    target: r.workflowFile,
    auditDetail: { routineId: r.id },
  };
}

async function routineToggle(ctx: OpContext): Promise<OpResult> {
  const r = routineParam(ctx.params);
  if (!r) return { status: 400, body: { error: 'unknown_routine' } };
  if (typeof ctx.params.enabled !== 'boolean') return { status: 400, body: { error: 'enabled_missing' } };
  const gh = ctx.github();
  if (!gh) return { status: 503, ...GITHUB_NOT_CONFIGURED };
  const verb = ctx.params.enabled ? 'enable' : 'disable';
  await gh.send('PUT', `/actions/workflows/${r.workflowFile}/${verb}`);
  return {
    body: { ok: true, routineId: r.id, enabled: ctx.params.enabled },
    target: r.workflowFile,
    auditDetail: { routineId: r.id, enabled: ctx.params.enabled },
  };
}

// ── Wissen ────────────────────────────────────────────────────────────────

async function knowledgeList(ctx: OpContext): Promise<OpResult> {
  const gh = ctx.github();
  if (!gh) return GITHUB_NOT_CONFIGURED;
  const tree = await gh.get<{ tree: Array<{ path: string; type: string; size?: number }>; truncated?: boolean }>(
    '/git/trees/main?recursive=1',
  );
  const files = (tree.tree ?? [])
    .filter((t) => t.type === 'blob' && isAllowedKnowledgePath(t.path))
    .sort((a, b) => a.path.localeCompare(b.path));
  const notes = [];
  for (const f of files.slice(0, MAX_NOTES)) {
    if ((f.size ?? 0) > MAX_NOTE_BYTES) {
      notes.push({ path: f.path, content: null, tooLarge: true });
      continue;
    }
    const file = await gh.get<{ content: string; sha: string; html_url: string }>(`/contents/${f.path}?ref=main`);
    notes.push({ path: f.path, sha: file.sha, url: file.html_url, content: b64decodeUtf8(file.content) });
  }
  return { body: { configured: true, root: KNOWLEDGE_ROOT, notes, omitted: Math.max(0, files.length - MAX_NOTES) } };
}

async function knowledgePropose(ctx: OpContext): Promise<OpResult> {
  const path = typeof ctx.params.path === 'string' ? ctx.params.path : '';
  const content = typeof ctx.params.content === 'string' ? ctx.params.content : '';
  const summary = typeof ctx.params.summary === 'string' ? ctx.params.summary.slice(0, 120).trim() : '';
  if (!isAllowedKnowledgePath(path)) return { status: 400, body: { error: 'path_not_allowed', allowed: `${KNOWLEDGE_ROOT}**/*.md` } };
  if (!content.trim() || new TextEncoder().encode(content).length > MAX_NOTE_BYTES) {
    return { status: 400, body: { error: 'content_invalid', maxBytes: MAX_NOTE_BYTES } };
  }
  const secrets = findSecretLikeContent(content);
  if (secrets.length > 0) return { status: 422, body: { error: 'secret_like_content', found: secrets } };
  if (!summary) return { status: 400, body: { error: 'summary_missing' } };

  const gh = ctx.github();
  if (!gh) return { status: 503, ...GITHUB_NOT_CONFIGURED };
  const main = await gh.get<{ object: { sha: string } }>('/git/ref/heads/main');
  const stamp = ctx.now.toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const branch = `ai-os/wissen-${stamp}-${crypto.randomUUID().slice(0, 6)}`;
  await gh.send('POST', '/git/refs', { ref: `refs/heads/${branch}`, sha: main.object.sha });

  let existingSha: string | undefined;
  try {
    const current = await gh.get<{ sha: string }>(`/contents/${path}?ref=main`);
    existingSha = current.sha;
  } catch (e) {
    if ((e as { status?: number }).status !== 404) throw e;
  }
  await gh.send('PUT', `/contents/${path}`, {
    message: `docs(ai-os): ${summary}`,
    content: b64encodeUtf8(content),
    branch,
    ...(existingSha ? { sha: existingSha } : {}),
  });
  const pr = await gh.send<{ number: number; html_url: string }>('POST', '/pulls', {
    title: `docs(ai-os): ${summary}`,
    head: branch,
    base: 'main',
    draft: true,
    body:
      'Vorgeschlagen über das AI Command Center (Knowledge Center).\n\n' +
      `Datei: \`${path}\`\n\nWirksam erst nach Review und Merge. Inhalte wurden vor dem Anlegen auf Zugangsdaten-Muster geprüft.`,
  });
  return {
    body: { ok: true, pr: pr ? { number: pr.number, url: pr.html_url } : null, branch },
    target: path,
    auditDetail: { pr: pr?.number ?? null, branch, created: !existingSha },
  };
}

// ── Protokoll ─────────────────────────────────────────────────────────────

async function auditLog(ctx: OpContext): Promise<OpResult> {
  const log = await ctx.user
    .from('ai_os_action_log')
    .select('id, created_at, request_id, action_id, agent_id, action_class, phase, target, detail, actor_user_id')
    .order('created_at', { ascending: false })
    .limit(100);
  const operators = await ctx.admin
    .from('platform_operators')
    .select('user_id', { count: 'exact', head: true })
    .eq('active', true);
  return {
    body: {
      log: log.error ? null : log.data,
      logAvailable: !log.error,
      logError: log.error ? 'ai_os_action_log nicht lesbar — Migration 20261025120000 angewendet?' : null,
      activeOperators: operators.error ? null : operators.count,
    },
  };
}

// ── Register ─────────────────────────────────────────────────────────────

export const OPERATIONS: Record<string, OperationSpec> = {
  devops: {
    actionId: 'github.pulls.read',
    maxGithubCalls: 50,
    run: async (ctx) => {
      const gh = ctx.github();
      if (!gh) return GITHUB_NOT_CONFIGURED;
      const report = await collectGithubStatus(gh, ctx.now, { maxCheckLookups: 40 });
      const releases = await gh.get<Array<{ tag_name: string; name: string | null; published_at: string; html_url: string; draft: boolean }>>(
        '/releases?per_page=5',
      );
      return {
        body: {
          configured: true,
          report,
          releases: releases.map((r) => ({ tag: r.tag_name, name: r.name, publishedAt: r.published_at, url: r.html_url, draft: r.draft })),
        },
      };
    },
  },
  ci_failures: {
    actionId: 'github.actions.read',
    maxGithubCalls: 15,
    run: async (ctx) => {
      const gh = ctx.github();
      if (!gh) return GITHUB_NOT_CONFIGURED;
      return { body: { configured: true, report: await collectCiFailures(gh, ctx.now, { days: 3, maxRuns: 5 }) } };
    },
  },
  security: {
    actionId: 'github.actions.read',
    maxGithubCalls: 15,
    run: async (ctx) => {
      const gh = ctx.github();
      if (!gh) return GITHUB_NOT_CONFIGURED;
      return { body: { configured: true, report: await collectSecurityInfra(gh, ctx.now) } };
    },
  },
  routines: { actionId: 'github.actions.read', maxGithubCalls: 15, run: routines },
  routine_dispatch: {
    actionId: 'github.workflow.dispatch',
    agentFor: (p) => routineParam(p)?.agent,
    maxGithubCalls: 2,
    run: routineDispatch,
  },
  routine_toggle: {
    actionId: 'github.workflow.toggle',
    agentFor: (p) => routineParam(p)?.agent,
    maxGithubCalls: 2,
    run: routineToggle,
  },
  knowledge_list: { actionId: 'github.contents.read', maxGithubCalls: MAX_NOTES + 2, run: knowledgeList },
  knowledge_propose: {
    actionId: 'github.knowledge.propose',
    agentFor: () => 'knowledge',
    maxGithubCalls: 6,
    run: knowledgePropose,
  },
  costs: { actionId: 'supabase.costs.read', maxGithubCalls: 0, run: costs },
  audit: { actionId: 'supabase.audit.read', maxGithubCalls: 0, run: auditLog },
};

export function makeGithubFactory(maxCalls: number): () => GithubClient | null {
  const token = Deno.env.get('AI_OS_GITHUB_TOKEN');
  const repo = Deno.env.get('AI_OS_GITHUB_REPO') ?? 'realsyncdynamics-spec/RealSyncDynamics.AI';
  let client: GithubClient | null = null;
  return () => {
    if (!token || maxCalls === 0) return null;
    client ??= createGithubClient({ token, repo, maxCalls, maxAttempts: 2, userAgent: 'realsync-ai-os-control' });
    return client;
  };
}
