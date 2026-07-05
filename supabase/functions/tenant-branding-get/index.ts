// Tenant Branding Retrieval API
//
// Allows anyone to fetch branding for a tenant (public or by custom domain).
// Endpoint: GET /functions/v1/tenant-branding-get?tenant_id=<uuid> OR ?domain=<domain>
// Authentication: None (public read)
//
// Returns: { ok: true, branding: {...} }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method !== 'GET') {
    return jsonError(405, 'BAD_REQUEST', 'GET only');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenant_id');
  const domain = url.searchParams.get('domain');

  if (!tenantId && !domain) {
    return jsonError(400, 'BAD_REQUEST', 'provide either tenant_id or domain query parameter');
  }

  try {
    let branding: Record<string, unknown> | null = null;

    if (tenantId) {
      // Fetch by tenant ID
      const { data } = await admin.rpc('get_tenant_branding', { p_tenant_id: tenantId });
      branding = data;
    } else if (domain) {
      // Fetch by custom domain
      const { data } = await admin.rpc('get_tenant_branding_by_domain', { p_domain: domain });
      branding = data;
    }

    if (!branding) {
      return jsonError(404, 'NOT_FOUND', 'tenant branding not found');
    }

    return jsonResponse({
      ok: true,
      branding,
    });
  } catch (e) {
    console.error('Error:', e);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
