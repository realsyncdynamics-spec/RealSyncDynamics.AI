// C2PA Manifest Generator
//
// Generates C2PA 2.0 manifests for audit reports and exports.
// Endpoint: POST /functions/v1/c2pa-manifest-generate
// Body: { content_type, content_id, content_hash, signer_name, signer_contact }
//
// Returns: { ok: true, manifest: {...}, assertion_hash: "..." }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ManifestRequest {
  content_type: 'audit_report' | 'compliance_export' | 'remediation_evidence' | 'governance_decision';
  content_id: string;
  content_hash: string;
  signer_name?: string;
  signer_contact?: string;
}

async function generateSHA256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildC2PAManifest(
  contentType: string,
  contentHash: string,
  signerName: string,
  signerContact: string
): Record<string, unknown> {
  const now = new Date().toISOString();

  return {
    version: '2.0',
    claim_generator: 'RealSyncDynamics/1.0',
    claim_generator_info: {
      name: 'RealSyncDynamics',
      version: '1.0',
      component: 'audit-provenance-engine',
    },
    assertions: [
      {
        type: 'c2pa.hash.assertion',
        label: 'content_hash',
        content_type: contentType,
        hash_algorithm: 'sha256',
        hash_value: contentHash,
      },
      {
        type: 'c2pa.actions.assertion',
        label: 'actions',
        actions: [
          {
            action: 'created',
            when: now,
            software_agent: 'RealSyncDynamics/1.0',
            parameters: {
              source: 'RealSyncDynamics Audit Engine',
              content_type: contentType,
              jurisdiction: 'eu',
              compliance_framework: 'DSGVO,NIS2,DSA',
            },
          },
        ],
      },
      {
        type: 'c2pa.identity.assertion',
        label: 'signer_identity',
        identity: {
          name: signerName || 'RealSyncDynamics System',
          contact: signerContact || 'audit@realsync.eu',
          role: 'content_creator',
        },
      },
      {
        type: 'c2pa.location.assertion',
        label: 'processing_location',
        location: 'EU',
        jurisdiction: 'GDPR',
      },
      {
        type: 'c2pa.data.assertion',
        label: 'metadata',
        data: {
          platform: 'RealSyncDynamics',
          audit_engine_version: '2.0',
          c2pa_spec_version: '2.0',
          timestamp_utc: now,
          retention_policy: 'permanent',
          authenticity_guarantee: 'cryptographic',
        },
      },
    ],
    signing_info: {
      algorithm: 'sha256',
      timestamp_utc: now,
      expires_at: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    },
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonError(405, 'BAD_REQUEST', 'POST only');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Parse request
  let body: ManifestRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  // Validate input
  const validContentTypes = ['audit_report', 'compliance_export', 'remediation_evidence', 'governance_decision'];
  if (!validContentTypes.includes(body.content_type)) {
    return jsonError(400, 'BAD_REQUEST', `content_type must be one of: ${validContentTypes.join(', ')}`);
  }

  if (!body.content_id || !body.content_hash) {
    return jsonError(400, 'BAD_REQUEST', 'content_id and content_hash are required');
  }

  if (body.content_hash.length !== 64) {
    return jsonError(400, 'BAD_REQUEST', 'content_hash must be 64-character SHA256 hex string');
  }

  try {
    // Build C2PA manifest
    const manifest = buildC2PAManifest(
      body.content_type,
      body.content_hash,
      body.signer_name || 'RealSyncDynamics System',
      body.signer_contact || 'audit@realsync.eu'
    );

    // Generate assertion hash
    const manifestJson = JSON.stringify(manifest);
    const assertionHash = await generateSHA256(manifestJson);

    return jsonResponse({
      ok: true,
      manifest,
      assertion_hash: assertionHash,
      c2pa_version: '2.0',
      content_type: body.content_type,
      content_id: body.content_id,
      timestamp_utc: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Error generating C2PA manifest:', e);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
