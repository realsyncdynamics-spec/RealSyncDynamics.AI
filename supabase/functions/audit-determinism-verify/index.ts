/**
 * audit-determinism-verify — Gate 2: Determinism Test API
 *
 * REST endpoint for reproducibility checks & external verification.
 *
 * POST /functions/v1/audit-determinism-verify
 * Body:
 *   {
 *     "fixtureId": "golden_001",
 *     "auditId": "aud_xxx",
 *     "tenantId": "tenant_xxx"
 *   }
 *
 * Returns:
 *   {
 *     "isDeterministic": true,
 *     "findingsConsistent": true,
 *     "decisionsConsistent": true,
 *     "cycles": [ ... ],
 *     "summary": { ... }
 *   }
 *
 * Use cases:
 * - Automated determinism validation (CI/CD)
 * - External auditor verification API
 * - Integration with 3rd-party compliance tools
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface VerifyRequest {
  fixtureId: string;
  auditId?: string;
  tenantId: string;
}

interface DeterminismTestCycle {
  testCycle: number;
  engineVersion: string;
  policyPackVersion: string;
  findingsHash: string;
  decisionHash: string;
  executionEndedAt: string;
}

interface VerifyResponse {
  fixtureId: string;
  isDeterministic: boolean;
  findingsConsistent: boolean;
  decisionsConsistent: boolean;
  totalCycles: number;
  engineVersions: string[];
  policyVersions: string[];
  cycles: DeterminismTestCycle[];
  summary: {
    distinctFindingHashes: number;
    distinctDecisionHashes: number;
    hasBreakingChanges: boolean;
  };
  verifiedAt: string;
}

async function verifyDeterminism(req: VerifyRequest): Promise<VerifyResponse> {
  const client = createClient(SUPABASE_URL, SERVICE_KEY);

  // Fetch all cycles for this fixture
  const { data: cycles, error } = await client
    .from('audit_determinism_tests')
    .select(
      'test_cycle, engine_version, policy_pack_version, findings_hash, decision_hash, execution_ended_at'
    )
    .eq('fixture_id', req.fixtureId)
    .eq('tenant_id', req.tenantId)
    .order('test_cycle', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch cycles: ${error.message}`);
  }

  if (!cycles || cycles.length === 0) {
    throw new Error(`No test cycles found for fixture: ${req.fixtureId}`);
  }

  const testCycles = cycles as DeterminismTestCycle[];

  // Check consistency
  const uniqueFindingsHashes = new Set(testCycles.map((c) => c.findingsHash));
  const uniqueDecisionHashes = new Set(testCycles.map((c) => c.decisionHash));
  const uniqueEngineVersions = new Set(testCycles.map((c) => c.engineVersion));
  const uniquePolicyVersions = new Set(testCycles.map((c) => c.policyPackVersion));

  const findingsConsistent = uniqueFindingsHashes.size === 1;
  const decisionsConsistent = uniqueDecisionHashes.size === 1;
  const isDeterministic = findingsConsistent && decisionsConsistent;

  // Update fixture with determinism status (if all cycles complete)
  if (testCycles.length === 5) {
    await client
      .from('audit_determinism_tests')
      .update({
        is_deterministic: isDeterministic,
        determinism_verified_at: new Date().toISOString(),
      })
      .eq('fixture_id', req.fixtureId)
      .eq('tenant_id', req.tenantId);
  }

  return {
    fixtureId: req.fixtureId,
    isDeterministic,
    findingsConsistent,
    decisionsConsistent,
    totalCycles: testCycles.length,
    engineVersions: Array.from(uniqueEngineVersions),
    policyVersions: Array.from(uniquePolicyVersions),
    cycles: testCycles,
    summary: {
      distinctFindingHashes: uniqueFindingsHashes.size,
      distinctDecisionHashes: uniqueDecisionHashes.size,
      hasBreakingChanges: !isDeterministic,
    },
    verifiedAt: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (handleOptions(req)) return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body: VerifyRequest = await req.json();

    if (!body.fixtureId || !body.tenantId) {
      return jsonResponse({ error: 'Missing required fields: fixtureId, tenantId' }, 400);
    }

    const result = await verifyDeterminism(body);

    return jsonResponse(result, 200);
  } catch (err) {
    console.error('Error:', err);
    return jsonResponse(
      {
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      500
    );
  }
});
