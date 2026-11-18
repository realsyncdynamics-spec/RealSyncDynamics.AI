/**
 * Fix 2 (MP-0 Nachtrag, Codex P1 governance-router:410):
 * Policy-Quelle vor dem Evidence-Insert unterscheiden.
 *
 * `ai_evidence_events.policy_id` hat laut 20260510_ai_governance_core.sql
 * einen Fremdschluessel ausschliesslich auf `ai_policies`. Der PDP liefert
 * `primary_policy_id` aber auch fuer Treffer aus `governance_policies`
 * (decide.ts laedt beide Tabellen). Landete so eine UUID in der Spalte,
 * scheiterte der Insert — und weil die Reservierung seit MP-0 fail-closed
 * ist, haette das jeden Provider-Aufruf mit Governance-Treffer verhindert,
 * im Shadow-Modus inklusive.
 *
 * Muster und Feldname folgen `governance-approvals/evidence.ts`:
 * Spalte `policy_id` null, ID als `governance_policy_id` im Evidence-JSON.
 *
 * Grenze dieses Tests: Der Fremdschluessel selbst wird hier nicht geprueft
 * (keine DB im Unit-Lauf). Geprueft wird, dass in die Spalte nie eine
 * governance_policies-UUID geschrieben wird — damit der Verstoss nicht
 * entstehen kann.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildAiCallEvidenceRow } from '../../supabase/functions/_shared/aiGateway/callEvidence';
import { primaryPolicySource } from '../../supabase/functions/_shared/aiGateway/pdpGuard';

const T1 = '11111111-1111-4111-8111-111111111111';
const AI_POLICY = '22222222-2222-4222-8222-222222222222';
const GOV_POLICY = '33333333-3333-4333-8333-333333333333';

function args(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: T1,
    path: 'service' as const,
    internalCaller: 'governance-router',
    feature: 'governance_router',
    route: '/v1/chat/completions',
    op: 'chat.completions',
    provider: 'lm_studio',
    model: 'qwen2.5',
    modelProfile: 'governance-brief',
    verdict: 'allow',
    requestId: 'req-1',
    latencyMs: 0,
    inputLength: 42,
    ...overrides,
  };
}

describe('Evidence: Policy-Quelle entscheidet ueber policy_id', () => {
  it('governance_policies: Spalte bleibt null, ID steht als governance_policy_id im JSON', async () => {
    const row = await buildAiCallEvidenceRow(args({
      policyId: GOV_POLICY,
      policySource: 'governance_policies',
    }) as never);

    expect(row.policy_id).toBeNull();
    expect(row.evidence.policy_id).toBeNull();
    expect(row.evidence.governance_policy_id).toBe(GOV_POLICY);
  });

  it('ai_policies: policy_id wird wie bisher gesetzt', async () => {
    const row = await buildAiCallEvidenceRow(args({
      policyId: AI_POLICY,
      policySource: 'ai_policies',
    }) as never);

    expect(row.policy_id).toBe(AI_POLICY);
    expect(row.evidence.policy_id).toBe(AI_POLICY);
    expect(row.evidence.governance_policy_id).toBeNull();
  });

  it('ohne policySource gilt wie bisher ai_policies (Rueckwaertsverhalten)', async () => {
    const row = await buildAiCallEvidenceRow(args({ policyId: AI_POLICY }) as never);
    expect(row.policy_id).toBe(AI_POLICY);
    expect(row.evidence.governance_policy_id).toBeNull();
  });

  it('ohne Policy-Treffer bleiben beide Felder null', async () => {
    const row = await buildAiCallEvidenceRow(args({
      policyId: null,
      policySource: 'governance_policies',
    }) as never);
    expect(row.policy_id).toBeNull();
    expect(row.evidence.governance_policy_id).toBeNull();
  });

  it('gilt fuer alle Stufen: started, completed, failed, blocked', async () => {
    for (const stage of ['started', 'completed', 'failed', 'blocked'] as const) {
      const row = await buildAiCallEvidenceRow(args({
        stage,
        policyId: GOV_POLICY,
        policySource: 'governance_policies',
        errorCode: stage === 'failed' ? 'provider_error' : null,
      }) as never);
      expect(row.policy_id, `Stufe ${stage}`).toBeNull();
      expect(row.evidence.governance_policy_id, `Stufe ${stage}`).toBe(GOV_POLICY);
    }
  });
});

describe('primaryPolicySource', () => {
  it('liest die Quelle der gewinnenden Regel aus den Gruenden', () => {
    const result = {
      decision: 'allow',
      primary_policy_id: GOV_POLICY,
      reasons: [
        { text_de: 'a', policy_id: GOV_POLICY, policy_source: 'governance_policies' },
        { text_de: 'b', policy_id: AI_POLICY, policy_source: 'ai_policies' },
      ],
    };
    expect(primaryPolicySource(result)).toBe('governance_policies');
  });

  it('null ohne Primaertreffer, ohne Ergebnis und bei unbekannter ID', () => {
    expect(primaryPolicySource(null)).toBeNull();
    expect(primaryPolicySource({ decision: 'allow', reasons: [], primary_policy_id: null })).toBeNull();
    expect(primaryPolicySource({
      decision: 'allow',
      primary_policy_id: 'fehlt',
      reasons: [{ text_de: 'a', policy_id: AI_POLICY, policy_source: 'ai_policies' }],
    })).toBeNull();
  });
});

describe('Beide Eingaenge reichen die Quelle durch', () => {
  const read = (p: string) => readFileSync(resolve(__dirname, '../../supabase/functions', p), 'utf8');

  it('governance-router setzt policySource an allen Evidence-Stufen', () => {
    const src = read('governance-router/index.ts');
    // blocked, started und Abschluss (finalize) — drei Aufrufe.
    const hits = src.match(/policySource: primaryPolicySource\(pep\.result\)/g) ?? [];
    expect(hits.length).toBe(3);
  });

  it('ai-gateway setzt policySource an allen Evidence-Stufen', () => {
    const src = read('ai-gateway/handler.ts');
    expect(src).toContain('policySource: primaryPolicySource(verdict)');
    const hits = src.match(/policySource: primaryPolicySource\(g\.verdict\)/g) ?? [];
    expect(hits.length).toBe(2); // completedOutcome + failedOutcome
    expect(src).toContain('policySource: outcome.policySource ?? null');
  });

  it('die Quelle wird nach dem Muster aus governance-approvals gefuehrt', () => {
    const approvals = read('governance-approvals/evidence.ts');
    const shared = read('_shared/aiGateway/callEvidence.ts');
    // Gleicher Feldname, gleiche Stelle: policy_id null, ID im evidence-JSON.
    expect(approvals).toContain('governance_policy_id');
    expect(shared).toContain('governance_policy_id');
  });
});
