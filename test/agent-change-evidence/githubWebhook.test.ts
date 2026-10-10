import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildEvidenceRow,
  computeDiffHash,
  extractChangeSet,
  githubHmacSha256Hex,
  isUniqueViolation,
  readBodyLimited,
  verifyGithubSignature,
} from '../../supabase/functions/_shared/agentChangeEvidence/githubWebhook';

const SECRET = 'test_github_webhook_secret';
const BODY = '{"zen":"Keep it logically awesome.","repository":{"full_name":"acme/app"}}';

/** Independent HMAC-SHA256 hex reference (node:crypto), not the SUT. */
function referenceSig(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

describe('agentChangeEvidence / GitHub signature', () => {
  it('matches an independent HMAC-SHA256 reference', async () => {
    expect(await githubHmacSha256Hex(BODY, SECRET)).toBe(referenceSig(BODY, SECRET));
  });

  it('accepts a valid X-Hub-Signature-256', async () => {
    const header = `sha256=${referenceSig(BODY, SECRET)}`;
    expect(await verifyGithubSignature(BODY, header, SECRET)).toBe(true);
  });

  it('rejects a missing signature', async () => {
    expect(await verifyGithubSignature(BODY, null, SECRET)).toBe(false);
    expect(await verifyGithubSignature(BODY, undefined, SECRET)).toBe(false);
    expect(await verifyGithubSignature(BODY, '', SECRET)).toBe(false);
  });

  it('rejects an invalid signature', async () => {
    expect(await verifyGithubSignature(BODY, 'sha256=deadbeef', SECRET)).toBe(false);
    expect(await verifyGithubSignature(BODY, `sha256=${referenceSig(BODY, 'wrong')}`, SECRET)).toBe(false);
    expect(await verifyGithubSignature(BODY + 'x', `sha256=${referenceSig(BODY, SECRET)}`, SECRET)).toBe(false);
  });

  it('rejects empty secret', async () => {
    const header = `sha256=${referenceSig(BODY, SECRET)}`;
    expect(await verifyGithubSignature(BODY, header, '')).toBe(false);
  });
});

describe('agentChangeEvidence / extract + hash + idempotency helpers', () => {
  it('extracts push paths and actor', () => {
    const change = extractChangeSet('push', {
      ref: 'refs/heads/main',
      after: 'abc123',
      pusher: { name: 'ada' },
      repository: { full_name: 'Acme/App' },
      commits: [
        { added: ['.env'], modified: ['src/a.ts'], removed: [] },
        { added: [], modified: ['src/b.ts'], removed: ['old.ts'] },
      ],
    });
    expect(change).toMatchObject({
      event: 'push',
      repo: 'acme/app',
      ref: 'refs/heads/main',
      commit_sha: 'abc123',
      actor: 'ada',
    });
    expect(change!.paths.sort()).toEqual(['.env', 'old.ts', 'src/a.ts', 'src/b.ts']);
  });

  it('extracts pull_request head sha without inventing file lists', () => {
    const change = extractChangeSet('pull_request', {
      action: 'opened',
      pull_request: {
        number: 42,
        user: { login: 'bob' },
        head: { ref: 'feat/x', sha: 'def456' },
        base: { ref: 'main' },
      },
      repository: { full_name: 'acme/app' },
    });
    expect(change).toMatchObject({
      event: 'pull_request',
      repo: 'acme/app',
      ref: 'feat/x',
      commit_sha: 'def456',
      actor: 'bob',
      paths: [],
    });
  });

  it('ignores unsupported events at extraction', () => {
    expect(extractChangeSet('ping', { repository: { full_name: 'acme/app' } })).toBeNull();
  });

  it('hashes sorted paths when no patch is available', async () => {
    const a = await computeDiffHash({ paths: ['b.ts', 'a.ts'] });
    const b = await computeDiffHash({ paths: ['a.ts', 'b.ts', 'a.ts'] });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('buildEvidenceRow always records and stores only paths + classes', async () => {
    const change = extractChangeSet('push', {
      ref: 'refs/heads/main',
      after: 'abc123',
      pusher: { name: 'ada' },
      repository: { full_name: 'acme/app' },
      commits: [{ added: ['.env.production'], modified: [], removed: [] }],
    })!;
    const row = await buildEvidenceRow({
      tenantId: '00000000-0000-0000-0000-000000000001',
      deliveryId: 'delivery-1',
      change,
    });
    expect(row.decision).toBe('recorded');
    expect(row.source).toBe('github');
    expect(row.risk_level).toBe('high');
    expect(row.payload_ref.hit_classes).toContain('env');
    expect(row.payload_ref.changed_paths).toEqual(['.env.production']);
    expect(JSON.stringify(row)).not.toMatch(/password|BEGIN PRIVATE/i);
  });

  it('detects unique-violation shapes for idempotent retries', () => {
    expect(isUniqueViolation({ code: '23505' })).toBe(true);
    expect(isUniqueViolation({ message: 'duplicate key value violates unique constraint' })).toBe(true);
    expect(isUniqueViolation({ code: '42501', message: 'denied' })).toBe(false);
  });
});

describe('agentChangeEvidence / readBodyLimited', () => {
  const stream = (...parts: string[]) =>
    new ReadableStream<Uint8Array>({
      start(c) {
        for (const p of parts) c.enqueue(new TextEncoder().encode(p));
        c.close();
      },
    });

  it('returns the full text within the limit', async () => {
    expect(await readBodyLimited(stream('{"a":', '1}'), null, 100)).toBe('{"a":1}');
  });

  it('counts UTF-8 bytes, not UTF-16 code units', async () => {
    // 'ä' = 2 Bytes: 3 Zeichen, 6 Bytes.
    expect(await readBodyLimited(stream('äää'), null, 5)).toBeNull();
    expect(await readBodyLimited(stream('äää'), null, 6)).toBe('äää');
  });

  it('stops while streaming when no Content-Length is declared', async () => {
    expect(await readBodyLimited(stream('x'.repeat(60), 'x'.repeat(60)), null, 100)).toBeNull();
  });

  it('rejects a declared Content-Length above the limit without reading', async () => {
    expect(await readBodyLimited(stream('x'), '101', 100)).toBeNull();
  });

  it('does not trust an understated Content-Length', async () => {
    expect(await readBodyLimited(stream('x'.repeat(150)), '10', 100)).toBeNull();
  });

  it('treats a missing body as empty', async () => {
    expect(await readBodyLimited(null, null, 100)).toBe('');
  });
});
