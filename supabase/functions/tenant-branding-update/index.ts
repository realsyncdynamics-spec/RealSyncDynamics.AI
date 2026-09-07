// Tenant Branding Management API
//
// Erlaubt Tenant-Admins, die White-Label-Einstellungen ihres Mandanten zu ändern.
// Endpoint: POST|PATCH /functions/v1/tenant-branding-update
// Authentication: Bearer <user JWT> — Mitglied des Tenants mit Rolle owner/admin
// Body: { tenant_id, company_name?, brand_colors?, custom_logo_url?, ... }
//
// Returns: { ok: true, branding: {...} }
//
// AP9 Welle 3 (2026-09-01) — warum diese Function neu aufgesetzt ist:
//
// Vorher las sie `tenant_id` aus dem JWT-Payload, ohne Signaturprüfung, und
// der Claim wird nirgends gesetzt — gemessen gegen Produktion tragen 0 von 6
// Nutzern ein `tenant_id` in `app_metadata`. Jeder Aufruf endete deshalb in
// 401 „invalid token claims". Dazu nahm sie nur PATCH an, während
// `functions.invoke()` in `BrandingSettings.tsx` POST sendet. Das Branding
// konnte also nie gespeichert werden.
//
// Jetzt: `requireUser` (echte Token-Prüfung), `tenant_id` aus dem Body,
// Mitgliedschaft mit Rolle, und das Plan-Gate `whitelabel.reports`. Eigenes
// Branding ist eine White-Label-Fähigkeit (Agency, Enterprise, Partner bzw.
// Add-on White Label), keine Grundfunktion — die Rolle sagt, *wer* handelt,
// das Entitlement, *ob der Plan es trägt*.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { requireUser, requireTenantMembership } from '../_shared/auth.ts';
import { gateFeature, EntitlementError } from '../_shared/entitlements.ts';

interface BrandingFields {
  company_name?: string;
  brand_colors?: { primary?: string; secondary?: string; accent?: string; background?: string; text?: string };
  custom_logo_url?: string;
  favicon_url?: string;
  support_email?: string | null;
  support_phone?: string;
  support_url?: string;
  footer_text?: string;
  custom_css?: Record<string, unknown>;
}

interface BrandingUpdateRequest extends BrandingFields {
  tenant_id?: string;
}

/** Nur diese Spalten dürfen über die Function geschrieben werden. */
const BRANDING_COLUMNS: ReadonlyArray<keyof BrandingFields> = [
  'company_name', 'brand_colors', 'custom_logo_url', 'favicon_url',
  'support_email', 'support_phone', 'support_url', 'footer_text', 'custom_css',
];

function validateBrandingUpdate(data: BrandingFields): string[] {
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

  if (data.custom_css !== undefined && (typeof data.custom_css !== 'object' || data.custom_css === null || Array.isArray(data.custom_css))) {
    errors.push('custom_css must be an object');
  }

  return errors;
}

async function requireWhitelabelEntitlement(admin: SupabaseClient, tenantId: string): Promise<Response | null> {
  try {
    await gateFeature(admin, tenantId, 'whitelabel.reports');
    return null;
  } catch (e) {
    if (e instanceof EntitlementError) {
      return jsonError(
        403,
        'ENTITLEMENT_MISSING',
        'Eigenes Branding ist im aktuellen Plan nicht enthalten (whitelabel.reports) — Enterprise oder Add-on White Label.',
      );
    }
    throw e;
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return jsonError(405, 'BAD_REQUEST', 'POST or PATCH only');
  }

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  let body: BrandingUpdateRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const tenantId = body.tenant_id;
  if (!tenantId || typeof tenantId !== 'string') {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  }

  // Nur bekannte Spalten übernehmen — was nicht in der Liste steht, erreicht
  // die Tabelle nicht, egal was der Client mitschickt.
  const fields: Record<string, unknown> = {};
  for (const column of BRANDING_COLUMNS) {
    if (body[column] !== undefined) fields[column] = body[column];
  }
  if (Object.keys(fields).length === 0) {
    return jsonError(400, 'BAD_REQUEST', 'no branding fields provided');
  }

  const validationErrors = validateBrandingUpdate(fields as BrandingFields);
  if (validationErrors.length > 0) {
    return jsonError(400, 'BAD_REQUEST', validationErrors.join('; '));
  }

  try {
    // Erst die Rolle: Branding ändert nur owner/admin des Tenants.
    const isAdmin = await requireTenantMembership(auth.admin, auth.user.id, tenantId, ['owner', 'admin']);
    if (!isAdmin) {
      return jsonError(403, 'FORBIDDEN', 'admin role in this tenant required');
    }

    // Dann der Plan: White Label muss im Plan oder als Add-on enthalten sein.
    const gate = await requireWhitelabelEntitlement(auth.admin, tenantId);
    if (gate) return gate;

    const brandingUpdate: Record<string, unknown> = { ...fields };

    // brand_colors zusammenführen — ein Teil-Update darf die übrigen Farben
    // nicht löschen.
    if (fields.brand_colors) {
      const { data: currentTenant } = await auth.admin
        .from('tenants')
        .select('brand_colors')
        .eq('id', tenantId)
        .single();

      brandingUpdate.brand_colors = {
        ...((currentTenant?.brand_colors as Record<string, string> | null) || {}),
        ...(fields.brand_colors as Record<string, string>),
      };
    }

    const { data: updatedTenant, error: updateErr } = await auth.admin
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
