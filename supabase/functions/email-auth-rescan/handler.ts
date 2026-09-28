// Request handler for email-auth-rescan. index.ts wires in the real
// dependencies (Supabase repo, Deno.resolveDns, entitlements); tests inject
// fakes. No Deno / jsr imports here, so the handler stays vitest-importable.
//
// Order (pinned by test/edge/email-auth-rescan.test.ts):
//   1. OPTIONS / method guard
//   2. cron auth: missing CRON_WEBSITE_RESCAN_KEY → 500, wrong bearer → 401.
//      No DB access and no DNS lookup before this passes.
//   3. targets (website governance_assets + websites) → apex domains,
//      deduped per tenant, plan mode per tenant, cap MAX_DOMAINS_PER_RUN
//   4. DNS checks (parallel, per-lookup timeout, errors isolated per domain)
//   5. per domain, sequential: evidence (hash-chained) → findings upsert /
//      resolve → email_auth_finding / email_auth_resolved events

import { handleOptions, jsonError, jsonResponse } from '../_shared/gateway.ts';
import {
  CHECKS,
  DETECTOR,
  EVENT_FINDING,
  EVENT_RESOLVED,
  EVENT_SOURCE,
  EVIDENCE_TITLE,
  MAX_DOMAINS_PER_RUN,
  SCANNER_VERSION,
  buildResolvedPayload,
  buildSnapshot,
  buildTargets,
  checkCronAuth,
  checkDomain,
  dedupeKey,
  evidenceContentHash,
  evidenceMetadata,
  findingSpec,
  lifecycleOf,
  openFindingEventsFor,
  stateOf,
  type AssetRow,
  type CheckName,
  type DomainCheckResult,
  type EventRow,
  type Target,
  type DnsResolver,
  type TenantMode,
  type WebsiteRow,
} from './logic.ts';

export interface OpenFindingRow {
  id: string;
  dedupe_key: string | null;
  status: string;
  asset_id: string | null;
  raw_payload: Record<string, unknown> | null;
}

/** DB surface used by the function. Implemented in repo.ts (service_role client). */
export interface RescanRepo {
  listWebsiteAssets(): Promise<AssetRow[]>;
  listWebsites(): Promise<WebsiteRow[]>;
  listEmailAuthEvents(tenantId: string): Promise<EventRow[]>;
  listOpenEmailAuthFindings(tenantId: string): Promise<OpenFindingRow[]>;
  latestEvidenceHash(tenantId: string): Promise<string | null>;
  insertEvidence(row: Record<string, unknown>): Promise<{ id: string }>;
  insertEvent(row: Record<string, unknown>): Promise<{ id: string }>;
  /** Returns 'conflict' when the partial unique index (open dedupe_key) already holds a row. */
  insertFinding(row: Record<string, unknown>): Promise<{ id: string } | 'conflict'>;
  updateOpenFinding(id: string, patch: Record<string, unknown>): Promise<void>;
  resolveFinding(id: string, resolvedAt: string): Promise<void>;
}

export interface HandlerDeps {
  /** Value of the CRON_WEBSITE_RESCAN_KEY Function Secret. */
  cronKey: string | undefined;
  repo: RescanRepo;
  dns: DnsResolver;
  /** Plan gate: 'full' (monitoring entitlement) or 'resolve_only'. */
  planMode: (tenantId: string) => Promise<TenantMode>;
  now?: () => Date;
  uuid?: () => string;
  maxDomains?: number;
  dnsConcurrency?: number;
}

export interface DomainOutcome {
  tenant_id: string;
  domain: string;
  mode: TenantMode;
  spf?: string;
  dmarc?: string;
  dkim?: string;
  evidence_id?: string | null;
  findings_created: number;
  findings_updated: number;
  findings_resolved: number;
  events_finding: number;
  events_resolved: number;
  error?: string;
}

interface TenantCtx {
  mode: TenantMode;
  events: EventRow[];
  openFindings: OpenFindingRow[];
  lastHash: string | null | undefined; // undefined = not loaded yet
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

function hasOpenItems(ctx: TenantCtx, t: Target): boolean {
  if (openFindingEventsFor(ctx.events, t).length > 0) return true;
  return ctx.openFindings.some((f) => typeof f.dedupe_key === 'string' && f.dedupe_key.endsWith(`:${t.domain}`)
    && f.dedupe_key.startsWith('email_auth.'));
}

export async function handleEmailAuthRescan(req: Request, deps: HandlerDeps): Promise<Response> {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  // Drift-Guard: verify_jwt=false, own bearer check against the dedicated
  // cron key (never service_role). Fail-closed.
  const auth = checkCronAuth(deps.cronKey, req.headers.get('Authorization'));
  if (!auth.ok) return jsonError(auth.status, auth.code, auth.message);

  let body: { trigger?: unknown; dry_run?: unknown } = {};
  try {
    const text = await req.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }
  const trigger = typeof body.trigger === 'string' ? body.trigger.slice(0, 40) : 'manual';
  const dryRun = body.dry_run === true;

  const now = deps.now ?? (() => new Date());
  const uuid = deps.uuid ?? (() => crypto.randomUUID());
  const repo = deps.repo;
  const maxDomains = deps.maxDomains ?? MAX_DOMAINS_PER_RUN;

  // 3. Targets
  let targets: Target[];
  try {
    const [assets, websites] = await Promise.all([repo.listWebsiteAssets(), repo.listWebsites()]);
    targets = buildTargets(assets, websites);
  } catch (e) {
    console.error('[email-auth-rescan] target load failed', e);
    return jsonError(500, 'DB_ERROR', 'failed to load targets');
  }

  const tenants = new Map<string, TenantCtx>();
  const tenantErrors: Array<{ tenant_id: string; error: string }> = [];
  const queue: Array<{ target: Target; priority: number }> = [];
  let skippedPlan = 0;

  for (const tenantId of [...new Set(targets.map((t) => t.tenant_id))].sort()) {
    let ctx: TenantCtx;
    try {
      let mode: TenantMode;
      try {
        mode = await deps.planMode(tenantId);
      } catch (e) {
        // Entitlement lookup failed: never scan-and-create on unknown plan,
        // but still allow verifying/closing existing items.
        console.error('[email-auth-rescan] plan lookup failed', tenantId, e);
        mode = 'resolve_only';
      }
      const [events, openFindings] = await Promise.all([
        repo.listEmailAuthEvents(tenantId),
        repo.listOpenEmailAuthFindings(tenantId),
      ]);
      ctx = { mode, events, openFindings, lastHash: undefined };
    } catch (e) {
      tenantErrors.push({ tenant_id: tenantId, error: (e as Error)?.message ?? String(e) });
      continue;
    }
    tenants.set(tenantId, ctx);
    for (const t of targets.filter((x) => x.tenant_id === tenantId)) {
      const open = hasOpenItems(ctx, t);
      if (ctx.mode === 'resolve_only' && !open) { skippedPlan++; continue; }
      queue.push({ target: t, priority: open ? 0 : 1 });
    }
  }

  // Domains with open items first, so a stale finding is never starved by the cap.
  queue.sort((a, b) => a.priority - b.priority
    || a.target.tenant_id.localeCompare(b.target.tenant_id)
    || a.target.domain.localeCompare(b.target.domain));
  const selected = queue.slice(0, maxDomains).map((q) => q.target);
  const truncated = queue.length - selected.length;

  // 4. DNS (no DB access in here; a thrown resolver is classified per lookup).
  const checks = await mapLimit(selected, deps.dnsConcurrency ?? 10, async (t) => {
    try {
      return await checkDomain(t.domain, deps.dns, now());
    } catch (e) {
      return { error: (e as Error)?.message ?? String(e) } as const;
    }
  });

  // 5. Persist, sequentially (the evidence hash chain is per tenant and
  //    must not fork inside one run).
  const results: DomainOutcome[] = [];
  for (let i = 0; i < selected.length; i++) {
    const t = selected[i];
    const ctx = tenants.get(t.tenant_id)!;
    const check = checks[i];
    const outcome: DomainOutcome = {
      tenant_id: t.tenant_id, domain: t.domain, mode: ctx.mode,
      findings_created: 0, findings_updated: 0, findings_resolved: 0, events_finding: 0, events_resolved: 0,
    };
    if ('error' in check) {
      outcome.error = check.error;
      results.push(outcome);
      continue;
    }
    outcome.spf = check.spf.status;
    outcome.dmarc = check.dmarc.status;
    outcome.dkim = check.dkim.status;
    try {
      await persistDomain({ repo, ctx, target: t, result: check, outcome, dryRun, uuid, now });
    } catch (e) {
      outcome.error = (e as Error)?.message ?? String(e);
      console.error('[email-auth-rescan] persist failed', t.tenant_id, t.domain, e);
    }
    results.push(outcome);
  }

  return jsonResponse({
    ok: true,
    scanner_version: SCANNER_VERSION,
    trigger,
    dry_run: dryRun,
    targets_total: targets.length,
    domains_checked: selected.length,
    truncated,
    skipped_plan: skippedPlan,
    tenant_errors: tenantErrors,
    results,
  });
}

interface PersistArgs {
  repo: RescanRepo;
  ctx: TenantCtx;
  target: Target;
  result: DomainCheckResult;
  outcome: DomainOutcome;
  dryRun: boolean;
  uuid: () => string;
  now: () => Date;
}

async function persistDomain(a: PersistArgs): Promise<void> {
  const { repo, ctx, target, result, outcome } = a;
  const tenantId = target.tenant_id;
  const openEvents = openFindingEventsFor(ctx.events, target);
  const findingsByKey = new Map<string, OpenFindingRow>();
  for (const f of ctx.openFindings) if (f.dedupe_key) findingsByKey.set(f.dedupe_key, f);

  type Plan =
    | { kind: 'create'; check: 'spf' | 'dmarc'; legacyEventId: string | null }
    | { kind: 'update'; check: CheckName; finding: OpenFindingRow }
    | { kind: 'resolve'; check: CheckName; finding: OpenFindingRow | null; events: EventRow[] };
  const plans: Plan[] = [];

  for (const check of CHECKS) {
    const lc = lifecycleOf(result, check);
    const key = dedupeKey(check, target.domain);
    const finding = findingsByKey.get(key) ?? null;
    const evs = openEvents.filter((e) => e.check === check).map((e) => e.event);
    if (lc === 'unknown' || lc === 'info') continue; // DNS error resolves nothing; DKIM not_found is informational
    if (lc === 'ok') {
      if (finding || evs.length) plans.push({ kind: 'resolve', check, finding, events: evs });
      continue;
    }
    // problem (spf / dmarc only)
    if (ctx.mode !== 'full') continue; // resolve_only never creates or refreshes
    if (finding) plans.push({ kind: 'update', check, finding });
    else plans.push({ kind: 'create', check: check as 'spf' | 'dmarc', legacyEventId: evs[0]?.id ?? null });
  }

  const hasResolve = plans.some((p) => p.kind === 'resolve');
  const needEvidence = ctx.mode === 'full' || hasResolve;
  if (!needEvidence) return;

  if (a.dryRun) {
    for (const p of plans) {
      if (p.kind === 'create') { outcome.findings_created++; if (!p.legacyEventId) outcome.events_finding++; }
      if (p.kind === 'update') outcome.findings_updated++;
      if (p.kind === 'resolve') { if (p.finding) outcome.findings_resolved++; outcome.events_resolved += p.events.length; }
    }
    outcome.evidence_id = null;
    return;
  }

  // Evidence: one DNS snapshot per domain per run, chained onto the tenant's
  // latest content_hash as read at runtime (or the link written earlier in
  // this run for the same tenant). Written FIRST, so every event/finding that
  // cites evidence_id points at an existing row; therefore event_id is null
  // (events reference the evidence via payload.evidence_id instead).
  if (ctx.lastHash === undefined) ctx.lastHash = await repo.latestEvidenceHash(tenantId);
  const evidenceId = a.uuid();
  const snapshot = buildSnapshot({
    tenantId, assetId: target.primary_asset_id, eventId: null, evidenceId,
    previousHash: ctx.lastHash, result,
  });
  const resolves = plans.flatMap((p) => (p.kind === 'resolve' ? p.events.map((e) => e.id) : []));
  const metadata = evidenceMetadata(result, ctx.mode, snapshot, resolves);
  const contentHash = await evidenceContentHash(snapshot);
  const evidence = await repo.insertEvidence({
    id: evidenceId,
    tenant_id: tenantId,
    event_id: null,
    asset_id: target.primary_asset_id,
    evidence_type: 'json',
    title: EVIDENCE_TITLE,
    storage_path: null,
    content_hash: contentHash,
    previous_hash: ctx.lastHash,
    metadata,
  });
  ctx.lastHash = contentHash;
  outcome.evidence_id = evidence.id;
  const nowIso = a.now().toISOString();

  for (const p of plans) {
    if (p.kind === 'create') {
      const spec = findingSpec(result, p.check);
      const findingId = a.uuid();
      const eventId = p.legacyEventId ? null : a.uuid();
      const state = stateOf(result, p.check);
      const ins = await repo.insertFinding({
        id: findingId,
        tenant_id: tenantId,
        website_id: target.website_ids[0] ?? null,
        asset_id: target.primary_asset_id,
        category: 'security',
        severity: spec.severity,
        status: 'open',
        detector: DETECTOR,
        summary: spec.title.slice(0, 1000),
        raw_payload: {
          check: p.check, domain: target.domain, state, checked_at: result.checked_at,
          event_id: p.legacyEventId ?? eventId, scanner_version: SCANNER_VERSION,
        },
        confidence_score: 0.95,
        evidence_level: 'observed',
        evidence_id: evidence.id,
        dedupe_key: dedupeKey(p.check, target.domain),
      });
      if (ins === 'conflict') continue; // concurrent run already holds the open row
      outcome.findings_created++;
      ctx.openFindings.push({
        id: ins.id, dedupe_key: dedupeKey(p.check, target.domain), status: 'open',
        asset_id: target.primary_asset_id, raw_payload: { event_id: p.legacyEventId ?? eventId },
      });
      if (eventId) {
        const payload = {
          check: p.check, domain: target.domain, state, current_state: state,
          checked_at: result.checked_at, evidence_id: evidence.id, finding_id: ins.id,
          scanner_version: SCANNER_VERSION, source: 'scanner',
        };
        await repo.insertEvent({
          id: eventId,
          tenant_id: tenantId,
          asset_id: target.primary_asset_id,
          event_type: EVENT_FINDING,
          event_source: EVENT_SOURCE,
          title: spec.title,
          summary: spec.summary,
          risk_level: spec.risk_level,
          policy_action: 'warn',
          data_types: ['email_metadata'],
          payload,
        });
        ctx.events.push({ id: eventId, asset_id: target.primary_asset_id, event_type: EVENT_FINDING, payload, created_at: nowIso });
        outcome.events_finding++;
      }
    } else if (p.kind === 'update') {
      const spec = findingSpec(result, p.check as 'spf' | 'dmarc');
      await repo.updateOpenFinding(p.finding.id, {
        severity: spec.severity,
        summary: spec.title.slice(0, 1000),
        evidence_id: evidence.id,
        raw_payload: {
          ...(p.finding.raw_payload ?? {}),
          check: p.check, domain: target.domain, state: stateOf(result, p.check),
          checked_at: result.checked_at, scanner_version: SCANNER_VERSION,
        },
      });
      outcome.findings_updated++;
    } else {
      // resolve
      const findingId: string | null = p.finding?.id ?? null;
      if (p.finding) {
        await repo.resolveFinding(p.finding.id, nowIso);
        ctx.openFindings = ctx.openFindings.filter((f) => f.id !== p.finding!.id);
        outcome.findings_resolved++;
      }
      for (const ev of p.events) {
        const linked = findingId
          ?? ctx.openFindings.find((f) => f.raw_payload?.['event_id'] === ev.id)?.id
          ?? null;
        const payload = buildResolvedPayload({ event: ev, check: p.check, result, evidenceId: evidence.id, findingId: linked });
        const label = p.check.toUpperCase();
        const detail = p.check === 'dmarc' && result.dmarc.policy ? ` (p=${result.dmarc.policy})` : '';
        const id = a.uuid();
        await repo.insertEvent({
          id,
          tenant_id: tenantId,
          asset_id: ev.asset_id ?? target.primary_asset_id,
          event_type: EVENT_RESOLVED,
          event_source: EVENT_SOURCE,
          title: `${label} behoben: ${target.domain}${detail}`,
          summary: `Automatische DNS-Nachprüfung: ${label} für ${target.domain} ist jetzt wirksam. Löst Ereignis ${ev.id} auf.`,
          risk_level: 'info',
          policy_action: 'log',
          data_types: ['email_metadata'],
          payload,
        });
        ctx.events.push({ id, asset_id: ev.asset_id, event_type: EVENT_RESOLVED, payload: payload as unknown as Record<string, unknown>, created_at: nowIso });
        outcome.events_resolved++;
      }
    }
  }
}
