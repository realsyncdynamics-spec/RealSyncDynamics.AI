// GitHub webhook helpers for Agent Change Evidence.
// Deno-frei (Web Crypto) — vitest und Edge Function teilen denselben Code.

import { timingSafeEqual } from '../timingSafeEqual.ts';
import { ruleCheck, type HitClass, type RiskLevel } from './ruleCheck.ts';

export type GithubEventName = 'push' | 'pull_request';

export interface ChangeExtraction {
  event: GithubEventName;
  repo: string;
  ref: string | null;
  commit_sha: string | null;
  actor: string | null;
  paths: string[];
  /** Optional in-memory line content for rule check only — never persist. */
  contents: string[];
}

export interface EvidencePayloadRef {
  changed_paths: string[];
  hit_classes: HitClass[];
  github_delivery: string;
  /** Optional PR number when event is pull_request. */
  pr_number?: number;
}

export interface BuiltEvidenceRow {
  tenant_id: string;
  source: 'github';
  event: GithubEventName;
  repo: string;
  ref: string | null;
  commit_sha: string | null;
  diff_hash: string;
  actor: string | null;
  agent_identity: string | null;
  policy_version: string | null;
  risk_level: RiskLevel;
  decision: 'recorded';
  payload_ref: EvidencePayloadRef;
  delivery_id: string;
}

function hexFromBuffer(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** HMAC-SHA256 hex digest of rawBody with secret. */
export async function githubHmacSha256Hex(rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return hexFromBuffer(mac);
}

/**
 * Verify X-Hub-Signature-256 (sha256=<hex>) with constant-time compare.
 * Missing/invalid header or empty secret → false.
 */
export async function verifyGithubSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
): Promise<boolean> {
  if (!secret || !signatureHeader) return false;
  const header = signatureHeader.trim();
  if (!header.toLowerCase().startsWith('sha256=')) return false;
  const expected = header.slice('sha256='.length).toLowerCase();
  if (!/^[0-9a-f]+$/.test(expected)) return false;
  const actual = await githubHmacSha256Hex(rawBody, secret);
  return timingSafeEqual(actual, expected);
}

/** sha256 hex of utf8 string. */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return hexFromBuffer(buf);
}

/**
 * diff_hash: sha256 of patch when provided; otherwise of sorted unique paths
 * (one path per line). If no paths either, hash a stable commit/ref sentinel
 * so empty deliveries remain distinct without storing content.
 */
export async function computeDiffHash(opts: {
  paths: string[];
  patch?: string | null;
  commit_sha?: string | null;
  ref?: string | null;
}): Promise<string> {
  if (opts.patch != null && opts.patch.length > 0) {
    return sha256Hex(opts.patch);
  }
  const sorted = [...new Set(opts.paths.map((p) => p.trim()).filter(Boolean))].sort();
  if (sorted.length > 0) {
    return sha256Hex(sorted.join('\n'));
  }
  return sha256Hex(`commit:${opts.commit_sha ?? ''}\nref:${opts.ref ?? ''}`);
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function collectPathsFromCommits(commits: unknown): string[] {
  if (!Array.isArray(commits)) return [];
  const out = new Set<string>();
  for (const c of commits) {
    const row = asRecord(c);
    if (!row) continue;
    for (const key of ['added', 'modified', 'removed'] as const) {
      const list = row[key];
      if (!Array.isArray(list)) continue;
      for (const p of list) {
        if (typeof p === 'string' && p.trim()) out.add(p.trim());
      }
    }
  }
  return [...out];
}

/**
 * Extract change metadata from a verified GitHub push or pull_request payload.
 * Returns null for unsupported / incomplete payloads.
 */
export function extractChangeSet(
  eventName: string,
  payload: unknown,
): ChangeExtraction | null {
  const body = asRecord(payload);
  if (!body) return null;
  const repoObj = asRecord(body.repository);
  const repo = str(repoObj?.full_name)?.toLowerCase() ?? null;
  if (!repo) return null;

  if (eventName === 'push') {
    const ref = str(body.ref);
    const commit_sha = str(body.after) ?? str(asRecord(body.head_commit)?.id);
    const pusher = asRecord(body.pusher);
    const sender = asRecord(body.sender);
    const actor = str(pusher?.name) ?? str(sender?.login);
    const paths = collectPathsFromCommits(body.commits);
    return { event: 'push', repo, ref, commit_sha, actor, paths, contents: [] };
  }

  if (eventName === 'pull_request') {
    const pr = asRecord(body.pull_request);
    if (!pr) return null;
    const head = asRecord(pr.head);
    const base = asRecord(pr.base);
    const user = asRecord(pr.user);
    const sender = asRecord(body.sender);
    const ref = str(head?.ref) ?? str(base?.ref);
    const commit_sha = str(head?.sha);
    const actor = str(user?.login) ?? str(sender?.login);
    // PR webhooks rarely include file lists; paths stay empty → sentinel hash.
    return {
      event: 'pull_request',
      repo,
      ref,
      commit_sha,
      actor,
      paths: [],
      contents: [],
    };
  }

  return null;
}

/** Build the insert row after rule check. decision is always recorded. */
export async function buildEvidenceRow(opts: {
  tenantId: string;
  deliveryId: string;
  change: ChangeExtraction;
  agentIdentity?: string | null;
  policyVersion?: string | null;
  patch?: string | null;
  prNumber?: number | null;
}): Promise<BuiltEvidenceRow> {
  const check = ruleCheck({ paths: opts.change.paths, contents: opts.change.contents });
  const diff_hash = await computeDiffHash({
    paths: opts.change.paths,
    patch: opts.patch,
    commit_sha: opts.change.commit_sha,
    ref: opts.change.ref,
  });

  const payload_ref: EvidencePayloadRef = {
    changed_paths: [...new Set(opts.change.paths)].sort(),
    hit_classes: check.classes,
    github_delivery: opts.deliveryId,
  };
  if (opts.prNumber != null && Number.isFinite(opts.prNumber)) {
    payload_ref.pr_number = opts.prNumber;
  }

  return {
    tenant_id: opts.tenantId,
    source: 'github',
    event: opts.change.event,
    repo: opts.change.repo,
    ref: opts.change.ref,
    commit_sha: opts.change.commit_sha,
    diff_hash,
    actor: opts.change.actor,
    agent_identity: opts.agentIdentity ?? null,
    policy_version: opts.policyVersion ?? null,
    risk_level: check.risk_level,
    decision: 'recorded',
    payload_ref,
    delivery_id: opts.deliveryId,
  };
}

/** Postgres unique_violation on delivery_id. */
export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  if (e.code === '23505') return true;
  const msg = String(e.message ?? '');
  return /duplicate key|unique constraint|agent_change_evidence_delivery_unique/i.test(msg);
}
