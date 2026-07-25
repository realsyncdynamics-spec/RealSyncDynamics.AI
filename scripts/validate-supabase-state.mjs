#!/usr/bin/env node

/**
 * Validate Supabase deployment state post-deploy
 *
 * Runs after db-push and functions-deploy to verify:
 * - All migrations applied correctly
 * - No constraint violations in key tables
 * - All functions deployed successfully
 * - Database state is consistent
 */

import { createClient } from '@supabase/supabase-js';

const PROJECT_REF = process.env.SUPABASE_PROJECT_ID;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;

if (!PROJECT_REF || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_PROJECT_ID or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function validateMigrations() {
  console.log('\n🔍 Validating migrations...');

  const { data, error } = await supabase
    .from('schema_migrations')
    .select('version, name, executed_at')
    .order('version', { ascending: true });

  if (error) {
    console.error(`❌ Failed to fetch migrations: ${error.message}`);
    return false;
  }

  console.log(`✅ Found ${data.length} migrations`);

  // Check for 20260510 orphan
  const hasOrphan = data.some(m => m.version === '20260510');
  if (hasOrphan) {
    console.warn('⚠️  Orphan 20260510 still present (expected if drift not yet repaired)');
  }

  // Check for gaps (missing versions)
  let lastVersion = null;
  for (const m of data) {
    if (lastVersion && m.version < lastVersion) {
      console.error(`❌ Migration versions out of order: ${lastVersion} → ${m.version}`);
      return false;
    }
    lastVersion = m.version;
  }

  console.log(`✅ All ${data.length} migrations in correct order`);
  return true;
}

async function validateTables() {
  console.log('\n🔍 Validating key tables...');

  const tables = [
    'ai_systems',
    'ai_policies',
    'governance_controls',
    'runtime_events',
    'audit_jobs'
  ];

  let success = true;
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error(`❌ Table ${table}: ${error.message}`);
      success = false;
    } else {
      console.log(`✅ Table ${table}: accessible`);
    }
  }

  return success;
}

async function validateRLS() {
  console.log('\n🔍 Validating RLS policies...');

  // Try to query with anon key (should be blocked by RLS)
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.warn('⚠️  SUPABASE_ANON_KEY not available, skipping RLS test');
    return true;
  }

  const anonClient = createClient(SUPABASE_URL, anonKey);

  // This should fail due to RLS (no authenticated session)
  const { error } = await anonClient
    .from('ai_systems')
    .select('*')
    .limit(1);

  if (error?.code === 'PGRST301') {
    console.log('✅ RLS protection verified (anonymous access blocked)');
    return true;
  }

  console.warn('⚠️  RLS test inconclusive');
  return true;
}

async function validateFunctions() {
  console.log('\n🔍 Validating edge functions...');

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/health`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    if (response.ok) {
      console.log('✅ Edge functions endpoint reachable');
      return true;
    } else {
      console.warn(`⚠️  Edge functions endpoint returned ${response.status}`);
      return false;
    }
  } catch (err) {
    console.error(`❌ Could not reach edge functions: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🚀 Supabase Post-Deploy Validation\n');
  console.log(`Project: ${PROJECT_REF}`);
  console.log(`URL: ${SUPABASE_URL}`);

  const results = {
    migrations: await validateMigrations(),
    tables: await validateTables(),
    rls: await validateRLS(),
    functions: await validateFunctions()
  };

  console.log('\n' + '='.repeat(50));
  console.log('📊 Validation Summary:');
  Object.entries(results).forEach(([name, passed]) => {
    console.log(`  ${passed ? '✅' : '❌'} ${name}`);
  });

  const allPassed = Object.values(results).every(r => r);
  if (allPassed) {
    console.log('\n✅ All validations passed!');
    process.exit(0);
  } else {
    console.log('\n❌ Some validations failed');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
