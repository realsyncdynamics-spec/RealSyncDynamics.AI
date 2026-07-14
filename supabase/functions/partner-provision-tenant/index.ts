// Partner Provisioning API
//
// Allows resellers/agencies to provision white-label tenant instances.
// Endpoint: POST /functions/v1/partner-provision-tenant
// Authentication: Bearer <partner-api-key>
// Rate limit: 100 tenants per month
//
// Request body:
// {
//   name: string,
//   domain?: string,
//   brand_colors?: { primary: string, secondary: string, accent: string },
//   plan_tier?: string,
//   billing_email?: string
// }
//
// Response:
// {
//   ok: true,
//   tenant_id: uuid,
//   api_key: string,
//   dashboard_url: string
// }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const DASHBOARD_URL = Deno.env.get('DASHBOARD_URL') || 'https://app.realsync.eu';

interface ProvisionRequest {
  name: string;
  domain?: string;
  brand_colors?: { primary?: string; secondary?: string; accent?: string };
  plan_tier?: string;
  billing_email?: string;
}

function generateApiKey(prefix: string = 'rsd'): { key: string; hash: string; prefix_stored: string } {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const randomPart = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 20);

  const key = `${prefix}_${randomPart}`;
  const keyData = new TextEncoder().encode(key);

  // Generate SHA-256 hash
  const hashPromise = crypto.subtle.digest('SHA-256', keyData);
  const hash = hashPromise.then((hashBuf) =>
    Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );

  return {
    key,
    hash: hash as any,
    prefix_stored: key.slice(0, 12),
  };
}

async function hashApiKey(key: string): Promise<string> {
  const keyData = new TextEncoder().encode(key);
  const hashBuf = await crypto.subtle.digest('SHA-256', keyData);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonError(405, 'BAD_REQUEST', 'POST only');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Validate partner API key from Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'missing or invalid Authorization header');
  }

  const partnerKey = authHeader.slice(7);
  const partnerKeyHash = await hashApiKey(partnerKey);

  const { data: partner, error: partnerErr } = await admin
    .from('partners')
    .select('id, name, max_tenants_per_month')
    .eq('api_key_hash', partnerKeyHash)
    .eq('enabled', true)
    .single();

  if (partnerErr || !partner) {
    return jsonError(401, 'UNAUTHORIZED', 'invalid partner API key');
  }

  // 2. Check rate limit (tenants provisioned this month)
  const { data: quota, error: quotaErr } = await admin.rpc('partner_get_quota_used', {
    p_partner_id: partner.id,
  });

  if (quotaErr) {
    console.error('Failed to check quota:', quotaErr);
    return jsonError(500, 'INTERNAL', 'failed to check provisioning quota');
  }

  const quotaUsed = typeof quota === 'number' ? quota : 0;
  if (quotaUsed >= partner.max_tenants_per_month) {
    return jsonError(
      429,
      'RATE_LIMITED',
      `monthly provisioning quota exceeded (${quotaUsed}/${partner.max_tenants_per_month})`
    );
  }

  // 3. Parse request body
  let body: ProvisionRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  if (!body.name || body.name.trim().length === 0) {
    return jsonError(400, 'BAD_REQUEST', 'name is required');
  }

  // 4. Create new tenant with branding
  const newTenant = {
    name: body.name.trim(),
    partner_id: partner.id,
    brand_colors: body.brand_colors || {},
    custom_domain: body.domain ? body.domain.toLowerCase() : null,
    billing_email: body.billing_email || null,
    auto_invoice_passthrough: true, // Enable for partner tenants
  };

  const { data: tenant, error: tenantErr } = await admin
    .from('tenants')
    .insert([newTenant])
    .select('id')
    .single();

  if (tenantErr || !tenant) {
    console.error('Failed to create tenant:', tenantErr);
    // Check if domain conflict
    if (tenantErr?.message?.includes('custom_domain')) {
      return jsonError(409, 'CONFLICT', 'custom domain already in use');
    }
    return jsonError(500, 'INTERNAL', 'failed to create tenant');
  }

  // 5. Create API key for the new tenant
  const apiKeyGen = generateApiKey('rsd');
  const apiKeyHash = await hashApiKey(apiKeyGen.key);

  const { error: keyErr } = await admin.from('api_keys').insert([
    {
      tenant_id: tenant.id,
      name: `Partner-${partner.name}-${Date.now()}`,
      key_hash: apiKeyHash,
      key_prefix: apiKeyGen.prefix_stored,
    },
  ]);

  if (keyErr) {
    console.error('Failed to create API key:', keyErr);
    // Clean up tenant
    await admin.from('tenants').delete().eq('id', tenant.id);
    return jsonError(500, 'INTERNAL', 'failed to create tenant API key');
  }

  // 6. Increment monthly quota
  const { error: incrementErr } = await admin.rpc('partner_increment_quota', {
    p_partner_id: partner.id,
  });

  if (incrementErr) {
    console.warn('Failed to increment quota (non-blocking):', incrementErr);
    // Don't fail the entire request, but log the issue
  }

  // 7. Return provisioning response
  const dashboardUrl = body.domain ? `https://${body.domain}` : `${DASHBOARD_URL}/t/${tenant.id}`;

  return jsonResponse({
    ok: true,
    tenant_id: tenant.id,
    api_key: apiKeyGen.key,
    dashboard_url: dashboardUrl,
    quota_remaining: partner.max_tenants_per_month - quotaUsed - 1,
  });
});
