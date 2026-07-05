// Tenant Branding Management API
//
// Allows tenant admins to update white-label branding settings.
// Endpoint: PATCH /functions/v1/tenant-branding-update
// Authentication: Tenant member (admin role)
// Body: { company_name?, brand_colors?, custom_logo_url?, ... }
//
// Returns: { ok: true, branding: {...} }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { jsonResponse, jsonError } from '../_shared/gateway.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface BrandingUpdateRequest {
  company_name?: string;
  brand_colors?: { primary?: string; secondary?: string; accent?: string; background?: string; text?: string };
  custom_logo_url?: string;
  favicon_url?: string;
  support_email?: string;
  support_phone?: string;
  support_url?: string;
  footer_text?: string;
  custom_css?: Record<string, unknown>;
}

async function validateBrandingUpdate(data: BrandingUpdateRequest): Promise<string[]> {
  const errors: string[] = [];

  if (data.company_name !== undefined && (typeof data.company_name !== 'string' || data.company_name.length > 256)) {
    errors.push('company_name must be a string (max 256 chars)');
  }

  if (data.brand_colors) {
    const validKeys = ['primary', 'secondary', 'accent', 'background', 'text'];
    for (const [key, value] of Object.entries(data.brand_colors)) {
      if (!validKeys.includes(key)) {
        errors.push(`brand_colors: invalid key "${key}", valid keys: ${validKeys.join(', ')}`);
      }
      if (typeof value !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(value)) {
        errors.push(`brand_colors.${key} must be a valid hex color (e.g., #0F766E)`);
      }
    }
  }

  if (data.custom_logo_url !== undefined && (typeof data.custom_logo_url !== 'string' || data.custom_logo_url.length > 2048)) {
    errors.push('custom_logo_url must be a URL string (max 2048 chars)');
  }

  if (data.favicon_url !== undefined && (typeof data.favicon_url !== 'string' || data.favicon_url.length > 2048)) {
    errors.push('favicon_url must be a URL string (max 2048 chars)');
  }

  if (data.support_email !== undefined && data.support_email !== null) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof data.support_email !== 'string' || !emailRegex.test(data.support_email)) {
      errors.push('support_email must be a valid email address');
    }
  }

  if (data.support_phone !== undefined && (typeof data.support_phone !== 'string' || data.support_phone.length > 20)) {
    errors.push('support_phone must be a phone number string (max 20 chars)');
  }

  if (data.support_url !== undefined && (typeof data.support_url !== 'string' || data.support_url.length > 2048)) {
    errors.push('support_url must be a URL string (max 2048 chars)');
  }

  if (data.footer_text !== undefined && (typeof data.footer_text !== 'string' || data.footer_text.length > 1024)) {
    errors.push('footer_text must be a string (max 1024 chars)');
  }

  return errors;
}

Deno.serve(async (req) => {
  if (req.method !== 'PATCH') {
    return jsonError(405, 'BAD_REQUEST', 'PATCH only');
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Get auth context
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonError(401, 'UNAUTHORIZED', 'missing Authorization header');
  }

  // Parse request body
  let body: BrandingUpdateRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  if (Object.keys(body).length === 0) {
    return jsonError(400, 'BAD_REQUEST', 'no branding fields provided');
  }

  // Validate input
  const validationErrors = await validateBrandingUpdate(body);
  if (validationErrors.length > 0) {
    return jsonError(400, 'BAD_REQUEST', validationErrors.join('; '));
  }

  try {
    // Use custom claim from JWT to get tenant_id and user_id
    // The Authorization header contains the JWT token
    const token = authHeader.slice(7); // Remove "Bearer "

    // Decode JWT (simple payload extraction, not verifying signature here)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return jsonError(401, 'UNAUTHORIZED', 'invalid token format');
    }

    // Decode payload (add padding if needed)
    const payload = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
          (c) => c.charCodeAt(0)
        )
      )
    );

    const userId = payload.sub;
    const tenantId = payload.tenant_id;

    if (!userId || !tenantId) {
      return jsonError(401, 'UNAUTHORIZED', 'invalid token claims');
    }

    // Check if user is admin in this tenant
    const { data: membership, error: memberErr } = await admin
      .from('memberships')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (memberErr || !membership) {
      return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
    }

    if (!['owner', 'admin'].includes(membership.role)) {
      return jsonError(403, 'FORBIDDEN', 'insufficient permissions (admin role required)');
    }

    // Merge brand_colors (preserve existing colors if partial update)
    let brandingUpdate: Record<string, unknown> = { ...body };

    if (body.brand_colors) {
      const { data: currentTenant } = await admin
        .from('tenants')
        .select('brand_colors')
        .eq('id', tenantId)
        .single();

      brandingUpdate.brand_colors = {
        ...(currentTenant?.brand_colors || {}),
        ...body.brand_colors,
      };
    }

    // Update tenant branding
    const { data: updatedTenant, error: updateErr } = await admin
      .from('tenants')
      .update(brandingUpdate)
      .eq('id', tenantId)
      .select(
        'id, company_name, brand_colors, custom_logo_url, favicon_url, support_email, support_phone, support_url, footer_text, custom_css'
      )
      .single();

    if (updateErr) {
      console.error('Failed to update tenant branding:', updateErr);
      return jsonError(500, 'INTERNAL', 'failed to update branding');
    }

    return jsonResponse({
      ok: true,
      branding: updatedTenant,
    });
  } catch (e) {
    console.error('Error:', e);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
