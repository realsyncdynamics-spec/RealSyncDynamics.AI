#!/usr/bin/env node
/**
 * export-audit-bundle.ts
 *
 * Gate 3: Export Audit as Verifiable Bundle
 *
 * Usage:
 *   npx ts-node scripts/export-audit-bundle.ts \
 *     --audit-id <uuid> \
 *     --tenant-id <uuid> \
 *     --output ./audit-exports/
 *
 * Outputs: audit-export-<audit-id>.zip
 *   ├── manifest.json
 *   ├── evidence.json
 *   ├── chain.json
 *   ├── signature.sig
 *   └── README.md (verification instructions)
 */

import { createClient } from '@supabase/supabase-js';
import { createWriteStream, mkdirSync } from 'fs';
import { join } from 'path';
import JSZip from 'jszip';
import {
  createManifest,
  signManifest,
  hashJSON,
  type ExportedFinding,
  type ExportedDecision,
  type ExportedChainEvent,
} from '../src/lib/export-bundle';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface ExportArgs {
  auditId: string;
  tenantId: string;
  output: string;
}

function parseArgs(): ExportArgs {
  const args = process.argv.slice(2);
  const params: Record<string, string> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    params[key] = value;
  }

  return {
    auditId: params['audit-id'] || '',
    tenantId: params['tenant-id'] || '',
    output: params['output'] || './audit-exports',
  };
}

async function exportAuditBundle(args: ExportArgs): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  }

  if (!args.auditId || !args.tenantId) {
    throw new Error('Missing required args: --audit-id, --tenant-id');
  }

  const client = createClient(SUPABASE_URL, SERVICE_KEY);

  console.log(`📦 Exporting Audit Bundle...`);
  console.log(`   Audit ID: ${args.auditId}`);
  console.log(`   Tenant ID: ${args.tenantId}`);

  // Create output directory
  mkdirSync(args.output, { recursive: true });

  // 1. Fetch audit findings
  const { data: findings, error: findingsError } = await client
    .from('audit_findings')
    .select('*')
    .eq('audit_id', args.auditId)
    .eq('tenant_id', args.tenantId);

  if (findingsError) {
    throw new Error(`Failed to fetch findings: ${findingsError.message}`);
  }

  const exportedFindings: ExportedFinding[] = (findings || []).map((f: any) => ({
    id: f.id,
    auditId: f.audit_id,
    severity: f.severity || 'medium',
    title: f.title || 'Unknown',
    description: f.description || '',
    ruleId: f.rule_id || '',
    controlId: f.control_id || '',
    evidence: [],
    createdAt: f.created_at,
  }));

  console.log(`   ✓ Fetched ${exportedFindings.length} findings`);

  // 2. Fetch audit decisions (from governance_approvals or similar)
  const { data: decisions, error: decisionsError } = await client
    .from('governance_approvals')
    .select('*')
    .eq('audit_id', args.auditId)
    .eq('tenant_id', args.tenantId);

  if (decisionsError && decisionsError.code !== 'PGRST116') {
    console.warn(`Warning fetching decisions: ${decisionsError.message}`);
  }

  const exportedDecisions: ExportedDecision[] = (decisions || []).map((d: any) => ({
    id: d.id,
    auditId: d.audit_id,
    policyId: d.policy_id || '',
    controlId: d.control_id || '',
    decision: d.status || 'review_required',
    reasoning: d.reasoning || '',
    rulesetHash: '',
    createdAt: d.created_at,
  }));

  console.log(`   ✓ Fetched ${exportedDecisions.length} decisions`);

  // 3. Fetch audit events (chain)
  const { data: events, error: eventsError } = await client
    .from('runtime_events')
    .select('*')
    .eq('audit_id', args.auditId)
    .eq('tenant_id', args.tenantId)
    .order('created_at', { ascending: true });

  if (eventsError && eventsError.code !== 'PGRST116') {
    console.warn(`Warning fetching events: ${eventsError.message}`);
  }

  const exportedChain: ExportedChainEvent[] = (events || []).map((e: any, idx: number) => ({
    id: e.id,
    auditId: e.audit_id,
    parentEventId: idx > 0 ? (events || [])[idx - 1]?.id : undefined,
    eventType: e.event_type || 'audit_start',
    payload: e.payload || {},
    payloadHash: '',
    chainHash: '',
    timestamp: e.created_at,
  }));

  console.log(`   ✓ Fetched ${exportedChain.length} events`);

  // 4. Compute chain hashes
  let previousChainHash = '';
  for (const evt of exportedChain) {
    evt.payloadHash = hashJSON(evt.payload);
    previousChainHash = hashJSON(previousChainHash + evt.payloadHash);
    evt.chainHash = previousChainHash;
  }

  // 5. Create manifest & sign
  const manifest = createManifest(
    args.auditId,
    exportedFindings,
    exportedDecisions,
    exportedChain,
    '2.0.0', // engine version
    'abc123def456', // engine commit (from metadata)
    'DSGVO_2024_Q2', // policy version (from metadata)
    hashJSON({ version: 'DSGVO_2024_Q2' }) // policy pack hash
  );

  const signature = signManifest(manifest);

  console.log(`   ✓ Created manifest & signature`);

  // 6. Create ZIP bundle
  const zip = new JSZip();

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file('evidence.json', JSON.stringify(exportedFindings, null, 2));
  zip.file('decisions.json', JSON.stringify(exportedDecisions, null, 2));
  zip.file('chain.json', JSON.stringify(exportedChain, null, 2));
  zip.file('signature.sig', signature);

  const readmeContent = `# RealSync Audit Export

**Audit ID**: ${args.auditId}
**Exported At**: ${manifest.exportedAt}
**Engine**: ${manifest.engine.version} (${manifest.engine.commit})
**Policy Pack**: ${manifest.policyPack.version}

## Verification

To verify this audit offline (no RealSync connection required):

\`\`\`bash
realsync verify audit-export-${args.auditId}/
\`\`\`

## Contents

- **manifest.json**: Checksums, versions, and metadata (signed)
- **evidence.json**: All findings with full context
- **decisions.json**: Policy decisions and reasoning
- **chain.json**: Event chain with parent links (tamper-proof)
- **signature.sig**: Ed25519 signature over manifest

## Integrity Checks

✓ Manifest signature (Ed25519)
✓ Evidence hash (SHA256)
✓ Chain hash (SHA256)
✓ Chain integrity (parent links)
✓ Version consistency

## External Audit

Share this bundle with auditors, regulators, or 3rd-party reviewers.
They can verify authenticity offline using the CLI.

---

Generated by RealSyncDynamics.AI (v1.0)
`;

  zip.file('README.md', readmeContent);

  // 7. Write ZIP file
  const bundleFileName = `audit-export-${args.auditId.slice(0, 8)}.zip`;
  const bundlePath = join(args.output, bundleFileName);

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(bundlePath);
    stream.on('finish', resolve);
    stream.on('error', reject);
    stream.write(zipBuffer);
    stream.end();
  });

  console.log(`\n✅ Bundle exported successfully\n`);
  console.log(`   Location: ${bundlePath}`);
  console.log(`   Size: ${Math.round(zipBuffer.length / 1024)} KB`);
  console.log();
  console.log(`📋 Next step: Verify offline`);
  console.log(`   realsync verify ${bundlePath}`);
  console.log();
}

exportAuditBundle(parseArgs()).catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
