/**
 * O1 (Masterplan Phase 0 / P0-4, Befund I-6):
 * Freigabe-Evidence aus `governance-approvals` wird lückenlos in die
 * Mandanten-Hash-Kette (`append_governance_evidence` mit `content_hash` /
 * `previous_hash` nach RFC 8785 JCS) sowie in `ai_evidence_events`
 * geschrieben — kein unverketteter Insert mit `content_hash: null`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  appendApprovalEvidence,
  buildApprovalAiEvidenceEvent,
  chainedApprovalEvidenceRow,
  EVIDENCE_APPEND_ATTEMPTS,
  EvidenceChainBusyError,
  type ApprovalChainStore,
  type ApprovalEvidenceInput,
} from '../../supabase/functions/governance-approvals/evidence.ts';
import {
  EVIDENCE_HASH_METHOD,
  evidenceContentHash,
} from '../../supabase/functions/_shared/evidence-hash.ts';

const repoFile = (p: string) => resolve(__dirname, '../..', p);
const TENANT_ID = '11111111-1111-4111-8111-111111111111';

function sampleInput(overrides: Partial<ApprovalEvidenceInput> = {}): ApprovalEvidenceInput {
  return {
    evidenceId: 'ev-approval-1',
    tenantId: TENANT_ID,
    approvalId: 'appr-100',
    eventId: 'evt-200',
    assetId: 'asset-300',
    policyId: 'pol-400',
    status: 'approved',
    resolvedByUserId: 'user-500',
    resolvedByEmail: 'admin@example.de',
    resolvedAt: '2026-10-26T16:30:00.000Z',
    reason: 'Freigabe nach Vier-Augen-Prüfung',
    ...overrides,
  };
}

/** In-Memory-Nachbildung von `append_governance_evidence` (CAS auf den Kettenkopf je Mandant). */
function memApprovalChain(opts: { moveHeadTimes?: number } = {}) {
  const rows: Array<Record<string, unknown>> = [];
  let moves = opts.moveHeadTimes ?? 0;

  const head = (tenantId: string) =>
    ([...rows].reverse().find((r) => r.tenant_id === tenantId && r.content_hash)?.content_hash as string | undefined) ?? null;

  const store: ApprovalChainStore = {
    async latestHead(tenantId) {
      return head(tenantId);
    },
    async append(row, expected) {
      if (moves > 0) {
        moves -= 1;
        rows.push({
          id: `concurrent-${moves}`,
          tenant_id: row.tenant_id,
          content_hash: `concurrent-hash-${moves}`,
          previous_hash: head(row.tenant_id as string),
        });
      }
      if (row.previous_hash !== expected) {
        throw new Error('row.previous_hash must equal expected');
      }
      if (head(row.tenant_id as string) !== expected) {
        return 'conflict';
      }
      rows.push(row);
      return { id: row.id as string };
    },
  };

  return { rows, store, head };
}

describe('O1 — chainedApprovalEvidenceRow', () => {
  it('berechnet content_hash = sha256(JCS(metadata.snapshot)) und bindet previous_hash ein', async () => {
    const input = sampleInput();
    const row = await chainedApprovalEvidenceRow(input, 'prev-hash-0001');

    expect(row.id).toBe('ev-approval-1');
    expect(row.tenant_id).toBe(TENANT_ID);
    expect(row.event_id).toBe('evt-200');
    expect(row.asset_id).toBe('asset-300');
    expect(row.evidence_type).toBe('approval');
    expect(row.title).toBe('Approval granted');
    expect(row.previous_hash).toBe('prev-hash-0001');
    expect(typeof row.content_hash).toBe('string');
    expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/);

    const meta = row.metadata as Record<string, unknown>;
    expect(meta.source).toBe('governance-approvals');
    expect(meta.hash_method).toBe(EVIDENCE_HASH_METHOD);

    const snapshot = meta.snapshot as Record<string, unknown>;
    expect(snapshot.previous_hash).toBe('prev-hash-0001');
    expect(snapshot.approval_id).toBe('appr-100');
    expect(snapshot.status).toBe('approved');
    expect(row.content_hash).toBe(await evidenceContentHash(snapshot));
  });

  it('setzt Titel und Status bei Ablehnung (rejected) korrekt', async () => {
    const row = await chainedApprovalEvidenceRow(
      sampleInput({ status: 'rejected', reason: 'Unvollständige DSFA' }),
      null,
    );
    expect(row.title).toBe('Approval denied');
    expect(row.previous_hash).toBeNull();
    expect(row.content_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('O1 — appendApprovalEvidence (Compare-and-Swap Kette)', () => {
  it('verkettet aufeinanderfolgende Freigaben lückenlos pro Mandant', async () => {
    const { rows, store } = memApprovalChain();

    const first = await appendApprovalEvidence(store, sampleInput({ evidenceId: 'ev-1', approvalId: 'a-1' }));
    const second = await appendApprovalEvidence(
      store,
      sampleInput({ evidenceId: 'ev-2', approvalId: 'a-2', status: 'rejected', reason: 'Abgelehnt' }),
    );

    expect(first.previousHash).toBeNull();
    expect(second.previousHash).toBe(first.contentHash);
    expect(rows).toHaveLength(2);
    expect(rows[0].previous_hash).toBeNull();
    expect(rows[1].previous_hash).toBe(rows[0].content_hash);
  });

  it('liest bei bewegtem Kettenkopf neu, hasht neu und hängt an den neuen Kopf an', async () => {
    const { rows, store } = memApprovalChain({ moveHeadTimes: 2 });
    const appended = await appendApprovalEvidence(store, sampleInput({ evidenceId: 'ev-retry' }));

    expect(appended.id).toBe('ev-retry');
    const mine = rows.find((r) => r.id === 'ev-retry')!;
    const idx = rows.indexOf(mine);
    expect(mine.previous_hash).toBe(rows[idx - 1].content_hash);
    const snapshot = (mine.metadata as Record<string, unknown>).snapshot as Record<string, unknown>;
    expect(mine.content_hash).toBe(await evidenceContentHash(snapshot));
  });

  it('wirft EvidenceChainBusyError, wenn der Kettenkopf dauerhaft ausweicht', async () => {
    const { rows, store } = memApprovalChain({ moveHeadTimes: EVIDENCE_APPEND_ATTEMPTS });
    await expect(
      appendApprovalEvidence(store, sampleInput({ evidenceId: 'ev-busy' })),
    ).rejects.toBeInstanceOf(EvidenceChainBusyError);
    expect(rows.some((r) => r.id === 'ev-busy')).toBe(false);
  });
});

describe('O1 — buildApprovalAiEvidenceEvent (ai_evidence_events)', () => {
  it('erzeugt den korrespondierenden ai_evidence_events-Eintrag mit Hash-Referenzen', async () => {
    const { store } = memApprovalChain();
    const input = sampleInput({ status: 'rejected', reason: 'Kein AVV hinterlegt' });
    const link = await appendApprovalEvidence(store, input);
    const aiEv = buildApprovalAiEvidenceEvent(input, link);

    expect(aiEv).toMatchObject({
      tenant_id: TENANT_ID,
      policy_id: null,
      event_type: 'governance:approval',
      risk_level: 'high',
      evidence: {
        approval_id: 'appr-100',
        event_id: 'evt-200',
        asset_id: 'asset-300',
        governance_policy_id: 'pol-400',
        governance_evidence_id: 'ev-approval-1',
        content_hash: link.contentHash,
        previous_hash: null,
        status: 'rejected',
        resolved_by_user_id: 'user-500',
        reason: 'Kein AVV hinterlegt',
      },
    });
  });
});

describe('governance-approvals/index.ts — O1 Verdrahtung', () => {
  const src = readFileSync(repoFile('supabase/functions/governance-approvals/index.ts'), 'utf8');

  it('nutzt appendApprovalEvidence + append_governance_evidence statt content_hash: null', () => {
    expect(src).toContain('appendApprovalEvidence(chain, evidenceInput)');
    expect(src).toContain("admin.rpc('append_governance_evidence'");
    expect(src).toContain('buildApprovalAiEvidenceEvent(evidenceInput, appended)');
    expect(src).not.toMatch(/content_hash:\s*null/);
    expect(src).not.toMatch(/previous_hash:\s*null/);
  });

  it('liest den Kettenkopf in derselben Reihenfolge wie append_governance_evidence', () => {
    expect(src).toMatch(
      /\.not\('content_hash', 'is', null\)\s*\.order\('created_at', \{ ascending: false \}\)\s*\.order\('id', \{ ascending: false \}\)/,
    );
  });
});
