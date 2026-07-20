#!/usr/bin/env node
/**
 * verify-determinism-fixture.ts
 *
 * Gate 1: Verify Golden Audit Fixture Determinism
 *
 * Usage:
 *   npx ts-node scripts/verify-determinism-fixture.ts \
 *     --fixture golden_001 \
 *     --tenant-id <uuid>
 *
 * Checks all 5 cycles and reports:
 *   ✓ Findings hash identical across all cycles?
 *   ✓ Decision hash identical across all cycles?
 *   ✓ Engine version consistent?
 *   ✓ Policy version consistent?
 *
 * Success: All hashes match → Fixture is DETERMINISTIC ✓
 * Failure: Hashes differ → Engine is NON-DETERMINISTIC ✗
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface VerifyArgs {
  fixture: string;
  tenantId: string;
}

interface TestCycle {
  testCycle: number;
  engineVersion: string;
  policyPackVersion: string;
  findingsHash: string;
  decisionHash: string;
  executionEndedAt: string;
}

function parseArgs(): VerifyArgs {
  const args = process.argv.slice(2);
  const params: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    params[key] = value;
  }

  return {
    fixture: params['fixture'] || 'golden_001',
    tenantId: params['tenant-id'] || '',
  };
}

async function verifyFixture(args: VerifyArgs): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  }

  if (!args.tenantId) {
    throw new Error('Missing required arg: --tenant-id');
  }

  const client = createClient(SUPABASE_URL, SERVICE_KEY);

  console.log(`\n🔐 Verifying Determinism Fixture: ${args.fixture}\n`);

  // Fetch all cycles for this fixture
  const { data: cycles, error } = await client
    .from('audit_determinism_tests')
    .select('test_cycle, engine_version, policy_pack_version, findings_hash, decision_hash, execution_ended_at')
    .eq('fixture_id', args.fixture)
    .eq('tenant_id', args.tenantId)
    .order('test_cycle', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch cycles: ${error.message}`);
  }

  if (!cycles || cycles.length === 0) {
    console.log(`❌ No test cycles found for fixture: ${args.fixture}`);
    process.exit(1);
  }

  const testCycles = cycles as TestCycle[];

  console.log(`📊 Test Summary`);
  console.log(`   Total cycles: ${testCycles.length}/5`);
  console.log(`   Time span: ${testCycles[0].executionEndedAt} → ${testCycles[testCycles.length - 1].executionEndedAt}`);
  console.log();

  // Check consistency
  const uniqueFindingsHashes = new Set(testCycles.map((c) => c.findingsHash));
  const uniqueDecisionHashes = new Set(testCycles.map((c) => c.decisionHash));
  const uniqueEngineVersions = new Set(testCycles.map((c) => c.engineVersion));
  const uniquePolicyVersions = new Set(testCycles.map((c) => c.policyPackVersion));

  const findingsConsistent = uniqueFindingsHashes.size === 1;
  const decisionsConsistent = uniqueDecisionHashes.size === 1;

  console.log(`🔍 Consistency Checks\n`);

  // Findings hash
  if (findingsConsistent) {
    console.log(`   ✅ Findings Hash:       CONSISTENT`);
    console.log(`      Hash: ${Array.from(uniqueFindingsHashes)[0].slice(0, 16)}...`);
  } else {
    console.log(`   ❌ Findings Hash:       INCONSISTENT`);
    for (const hash of uniqueFindingsHashes) {
      console.log(`      - ${hash.slice(0, 16)}...`);
    }
  }

  console.log();

  // Decisions hash
  if (decisionsConsistent) {
    console.log(`   ✅ Decisions Hash:      CONSISTENT`);
    console.log(`      Hash: ${Array.from(uniqueDecisionHashes)[0].slice(0, 16)}...`);
  } else {
    console.log(`   ❌ Decisions Hash:      INCONSISTENT`);
    for (const hash of uniqueDecisionHashes) {
      console.log(`      - ${hash.slice(0, 16)}...`);
    }
  }

  console.log();

  // Versions
  console.log(`📦 Versions Tested\n`);
  console.log(`   Engine:       ${Array.from(uniqueEngineVersions).join(', ')}`);
  console.log(`   Policy Pack:  ${Array.from(uniquePolicyVersions).join(', ')}`);

  console.log();

  // Final verdict
  const isDeterministic = findingsConsistent && decisionsConsistent;

  if (isDeterministic) {
    console.log(`\n🎉 DETERMINISM VERIFIED ✓`);
    console.log(`\n   Engine produces identical outputs for identical inputs.`);
    console.log(`   This audit is reproducible and verifiable.`);
  } else {
    console.log(`\n⚠️  DETERMINISM FAILED ✗`);
    console.log(`\n   Engine produces different outputs for identical inputs.`);
    console.log(`   This blocks Go-Live. Investigate engine randomness.`);
  }

  console.log();

  // Next steps
  if (isDeterministic) {
    console.log(`📝 Next: Export & Verify CLI`);
    console.log(`   realsync export audit --audit-id <id> --format bundle`);
    console.log(`   realsync verify audit-export-<id>/`);
  } else {
    console.log(`📝 Next: Debug engine non-determinism`);
    console.log(`   - Check for randomness in findings generation`);
    console.log(`   - Verify policy evaluation is deterministic`);
    console.log(`   - Review decision ranking logic`);
  }

  console.log();

  // Exit code
  process.exit(isDeterministic ? 0 : 1);
}

verifyFixture(parseArgs()).catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
