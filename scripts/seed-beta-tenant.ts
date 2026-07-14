/**
 * Beta Tenant Seeding Script
 *
 * Creates a test tenant with realistic assets for beta onboarding testing.
 * Usage: npm run seed:beta -- --email test-beta@example.com --industry healthcare
 *
 * Creates:
 * - 1 test tenant (with specified industry)
 * - 5 assets with realistic configurations:
 *   * 1 AI system (high-risk, PII/health data)
 *   * 1 website (personal data)
 *   * 1 dataset (health records, special categories)
 *   * 1 API (vendor connector, limited data)
 *   * 1 workflow (automation, GDPR-relevant)
 */

import { createClient } from '@supabase/supabase-js';

interface BetaAsset {
  asset_type: string;
  name: string;
  description: string;
  ai_act_class: string;
  data_types: string[];
  risk_score: number;
  owner_email?: string;
  vendor?: string;
}

const BETA_ASSETS: BetaAsset[] = [
  {
    asset_type: 'ai_system',
    name: 'Patient Risk Prediction Model',
    description: 'ML model for predicting patient readmission risk using medical history',
    ai_act_class: 'high',
    data_types: ['health_records', 'diagnosis', 'personal_data', 'email', 'phone'],
    risk_score: 85,
    owner_email: 'test-beta@example.com',
  },
  {
    asset_type: 'website',
    name: 'Patient Portal',
    description: 'Public-facing website for patient appointment booking and records access',
    ai_act_class: 'minimal',
    data_types: ['personal_data', 'email', 'phone', 'address'],
    risk_score: 45,
    owner_email: 'test-beta@example.com',
  },
  {
    asset_type: 'dataset',
    name: 'Historical Health Records Database',
    description: 'De-identified patient records for research purposes (post-2020)',
    ai_act_class: 'limited',
    data_types: ['health_records', 'diagnosis', 'genetic_data', 'biometric'],
    risk_score: 78,
  },
  {
    asset_type: 'api',
    name: 'Third-party EHR Integration',
    description: 'REST API connector to vendor EHR system for real-time data sync',
    ai_act_class: 'limited',
    data_types: ['health_records', 'personal_data'],
    risk_score: 62,
    vendor: 'Epic Systems',
  },
  {
    asset_type: 'workflow',
    name: 'GDPR Data Subject Request Automation',
    description: 'n8n workflow: collects all personal data for DSR response (automated)',
    ai_act_class: 'minimal',
    data_types: ['personal_data', 'email', 'phone', 'address'],
    risk_score: 35,
  },
];

async function run() {
  const args = process.argv.slice(2);
  const emailIdx = args.indexOf('--email');
  const industryIdx = args.indexOf('--industry');

  const testEmail = emailIdx >= 0 ? args[emailIdx + 1] : 'test-beta@example.com';
  const testIndustry = industryIdx >= 0 ? args[industryIdx + 1] : 'healthcare';

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    process.exit(1);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    console.log(`🚀 Creating beta tenant for: ${testEmail} (industry: ${testIndustry})\n`);

    // 1. Create or find user (mock - in production use auth admin API)
    console.log(`  📧 Using email: ${testEmail}`);
    let userId = crypto.randomUUID();

    // 2. Create tenant
    console.log(`  🏢 Creating tenant...`);
    const { data: tenant, error: tenantErr } = await admin
      .from('tenants')
      .insert({
        name: `Beta Test Tenant - ${testIndustry.toUpperCase()}`,
        industry: testIndustry,
        created_by: userId,
      } as never)
      .select()
      .single();

    if (tenantErr) throw tenantErr;
    const tenantId = (tenant as any).id;
    console.log(`  ✅ Tenant created: ${tenantId}\n`);

    // 3. Create membership (owner)
    console.log(`  👤 Creating owner membership...`);
    const { error: memberErr } = await admin
      .from('memberships')
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        role: 'owner',
      } as never);

    if (memberErr && !memberErr.message?.includes('duplicate')) throw memberErr;
    console.log(`  ✅ Membership created\n`);

    // 4. Create assets
    console.log(`  📊 Creating ${BETA_ASSETS.length} assets...\n`);
    for (const asset of BETA_ASSETS) {
      const { data: created, error: assetErr } = await admin
        .from('governance_assets')
        .insert({
          tenant_id: tenantId,
          asset_type: asset.asset_type,
          name: asset.name,
          description: asset.description,
          ai_act_class: asset.ai_act_class,
          data_types: asset.data_types,
          risk_score: asset.risk_score,
          owner_email: asset.owner_email || null,
          vendor: asset.vendor || null,
          status: 'active',
          metadata: {},
        } as never)
        .select()
        .single();

      if (assetErr) throw assetErr;

      console.log(`    ✅ ${asset.asset_type.toUpperCase()}: ${asset.name}`);
      console.log(`       Risk: ${asset.risk_score}/100 | AI-Act: ${asset.ai_act_class}`);
      console.log(`       Data: ${asset.data_types.join(', ')}\n`);
    }

    console.log(`\n✨ Beta tenant setup complete!\n`);
    console.log(`Summary:`);
    console.log(`  • Tenant ID: ${tenantId}`);
    console.log(`  • Email: ${testEmail}`);
    console.log(`  • Industry: ${testIndustry}`);
    console.log(`  • Assets: ${BETA_ASSETS.length}\n`);
    console.log(`Next steps:`);
    console.log(`  1. Log in with ${testEmail}`);
    console.log(`  2. View Governance Dashboard`);
    console.log(`  3. Click "Auto-Map" on any asset to test intelligence`);
    console.log(`  4. Check policy pack recommendations\n`);
  } catch (err) {
    console.error(`\n❌ Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

run();
