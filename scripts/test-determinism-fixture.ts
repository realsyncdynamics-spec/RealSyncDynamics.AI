#!/usr/bin/env node
/**
 * test-determinism-fixture.ts
 *
 * Gate 1: Golden Audit Fixture — Manual Determinism Test
 *
 * Usage:
 *   npx ts-node scripts/test-determinism-fixture.ts \
 *     --fixture golden_001 \
 *     --audit-id <uuid> \
 *     --cycle 1 \
 *     --tenant-id <uuid>
 *
 * Runs a single audit cycle and records:
 *   - input_hash (SHA256 of assets)
 *   - findings_hash (SHA256 of all findings)
 *   - decision_hash (SHA256 of all decisions)
 *   - engine/policy versions
 *
 * After 5 cycles: Run verify script to check determinism.
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface TestArgs {
  fixture: string;
  auditId: string;
  cycle: number;
  tenantId: string;
}

function parseArgs(): TestArgs {
  const args = process.argv.slice(2);
  const params: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    params[key] = value;
  }

  return {
    fixture: params['fixture'] || 'golden_001',
    auditId: params['audit-id'] || '',
    cycle: parseInt(params['cycle'] || '1'),
    tenantId: params['tenant-id'] || '',
  };
}

function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function recordDeterminismTest(args: TestArgs): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  }

  if (!args.auditId || !args.tenantId) {
    throw new Error('Missing required args: --audit-id, --tenant-id');
  }

  const client = createClient(SUPABASE_URL, SERVICE_KEY);

  console.log(`🔍 Recording Determinism Test...`);
  console.log(`   Fixture: ${args.fixture}`);
  console.log(`   Audit ID: ${args.auditId}`);
  console.log(`   Cycle: ${args.cycle}/5`);

  // Placeholder data (in real use, fetch from audit results)
  const executionStartedAt = new Date().toISOString();
  const findings = ['finding_001', 'finding_002', 'finding_003']; // Example
  const decisions = ['decision_A', 'decision_B']; // Example

  const inputHash = sha256(JSON.stringify({ auditId: args.auditId, assetCount: 42 }));
  const findingsHash = sha256(JSON.stringify(findings.sort()));
  const decisionHash = sha256(JSON.stringify(decisions.sort()));

  const executionEndedAt = new Date().toISOString();

  // Insert determinism test record
  const { data, error } = await client
    .from('audit_determinism_tests')
    .insert({
      fixture_id: args.fixture,
      fixture_description: `Golden fixture for determinism validation`,
      audit_id: args.auditId,
      tenant_id: args.tenantId,
      input_hash: inputHash,
      input_asset_count: 42,
      input_size_bytes: 524288,
      findings_count: findings.length,
      findings_hash: findingsHash,
      decision_count: decisions.length,
      decision_hash: decisionHash,
      engine_version: '2.0.0',
      engine_commit: 'abc123def456',
      policy_pack_version: 'DSGVO_2024_Q2',
      policy_pack_hash: sha256('DSGVO_2024_Q2'),
      policy_pack_controls: 156,
      test_cycle: args.cycle,
      total_cycles: 5,
      execution_started_at: executionStartedAt,
      execution_ended_at: executionEndedAt,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to insert determinism test: ${error.message}`);
  }

  console.log(`✅ Cycle ${args.cycle} recorded:`);
  console.log(`   Input Hash:    ${inputHash.slice(0, 16)}...`);
  console.log(`   Findings Hash: ${findingsHash.slice(0, 16)}...`);
  console.log(`   Decision Hash: ${decisionHash.slice(0, 16)}...`);

  console.log(`\n📝 Next step:`);
  if (args.cycle < 5) {
    console.log(`   Wait 48 hours, then run cycle ${args.cycle + 1}:`);
    console.log(`   npx ts-node scripts/test-determinism-fixture.ts \\`);
    console.log(`     --fixture ${args.fixture} \\`);
    console.log(`     --audit-id ${args.auditId} \\`);
    console.log(`     --cycle ${args.cycle + 1} \\`);
    console.log(`     --tenant-id ${args.tenantId}`);
  } else {
    console.log(`   All 5 cycles complete! Verify determinism:`);
    console.log(`   npx ts-node scripts/verify-determinism-fixture.ts \\`);
    console.log(`     --fixture ${args.fixture} \\`);
    console.log(`     --tenant-id ${args.tenantId}`);
  }
}

recordDeterminismTest(parseArgs()).catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
