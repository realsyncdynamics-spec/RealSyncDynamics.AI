// integration-credentials — einziger Schreibpfad fuer Integrations-Zugangsdaten
// (Plan P0-1, Freigabe E8 vom 2026-08-24).
//
// POST /functions/v1/integration-credentials   (verify_jwt = true, Default)
//   { op: 'configure', tenant_id, integration_id, name, credentials: {..} }
//   { op: 'remove',    tenant_id, config_id }
//
// Governance-Zweck: Zugangsdaten fremder Systeme sind das wertvollste Gut,
// das Kunden dieser Plattform anvertrauen. Sie werden hier AES-256-GCM-
// versiegelt (credentials_enc) und verlassen die Serverseite nie wieder —
// weder in einer Tabellen-SELECT (Spaltenrechte, Migration 20260824110000)
// noch in einer Antwort dieser Function.
//
// Sicherheitsrelevanz: owner/admin-only (requireAuthAndTenant), tenant_id
// wird gegen die Mitgliedschaft geprueft, nie dem Body geglaubt. Ohne
// konfigurierten Siegel-Schluessel wird abgelehnt — es gibt KEINEN
// Klartext-Fallback. DSGVO Art. 32; EU AI Act Art. 12 via Audit-Log.

import { requireAuthAndTenant } from '../_shared/auth.ts';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { importSecretKey, seal } from '../_shared/secretBox.ts';
import { audit } from '../_shared/auditLog.ts';

const corsHeaders = buildCorsHeaders('POST, OPTIONS');

async function loadSealKey(admin: unknown): Promise<CryptoKey | null> {
  let b64 = Deno.env.get('INTEGRATION_CREDENTIALS_KEY') ?? null;
  if (!b64) {
    try {
      // deno-lint-ignore no-explicit-any
      const { data } = await (admin as any).rpc('get_app_secret', {
        secret_name: 'integration_credentials_key',
      });
      if (typeof data === 'string' && data.length > 0) b64 = data;
    } catch { /* Vault optional — env ist der Primaerweg */ }
  }
  if (!b64) return null;
  try {
    return await importSecretKey(b64);
  } catch (e) {
    console.error('[integration-credentials] invalid seal key', e);
    return null;
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only', corsHeaders);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json', corsHeaders);
  }

  const op = String(body.op ?? '');
  if (op !== 'configure' && op !== 'remove') {
    return jsonError(400, 'BAD_REQUEST', `unknown op: ${op}`, corsHeaders);
  }

  // Zugangsdaten verwalten duerfen nur owner/admin — ein viewer/member, der
  // Integrationen sieht, darf sie nicht umkonfigurieren.
  const auth = await requireAuthAndTenant(req, body.tenant_id as string, ['owner', 'admin']);
  if (auth instanceof Response) return auth;
  const { admin, user, tenantId } = auth;

  if (op === 'configure') {
    const integrationId = body.integration_id;
    const name = body.name;
    const credentials = body.credentials;
    if (typeof integrationId !== 'string' || !integrationId) {
      return jsonError(400, 'BAD_REQUEST', 'integration_id is required', corsHeaders);
    }
    if (typeof name !== 'string' || !name.trim()) {
      return jsonError(400, 'BAD_REQUEST', 'name is required', corsHeaders);
    }
    if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)
      || Object.keys(credentials).length === 0) {
      return jsonError(400, 'BAD_REQUEST', 'credentials must be a non-empty object', corsHeaders);
    }

    const key = await loadSealKey(admin);
    if (!key) {
      // Bewusst 503 statt Klartext-Fallback: lieber nicht speichern als
      // unversiegelt speichern (Auftrag §5).
      return jsonError(503, 'NOT_CONFIGURED',
        'INTEGRATION_CREDENTIALS_KEY fehlt — Zugangsdaten werden ohne Siegel nicht gespeichert',
        corsHeaders);
    }

    const sealed = await seal(key, credentials);
    const { data: row, error } = await admin
      .from('integration_configs')
      .upsert({
        tenant_id: tenantId,
        integration_id: integrationId,
        name: name.trim(),
        credentials: {},              // Klartext-Spalte bleibt fuer immer leer
        credentials_enc: sealed,
        enabled: true,
        created_by: user.id,
      }, { onConflict: 'tenant_id,integration_id' })
      .select('id, integration_id, name, enabled, created_at')
      .maybeSingle();
    if (error) return jsonError(500, 'INTERNAL', error.message, corsHeaders);

    await audit(admin, {
      tenant_id: tenantId,
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: 'integration_config.configure',
      target_type: 'integration_config',
      target_id: row?.id ?? null,
      // Nur Feldnamen ins Audit — nie Werte.
      payload: { integration_id: integrationId, credential_fields: Object.keys(credentials) },
    });

    return jsonResponse({ ok: true, config: row }, 200, corsHeaders);
  }

  // op === 'remove': deaktivieren UND Siegel entfernen — eine entfernte
  // Integration hinterlaesst keine schlummernden Zugangsdaten.
  const configId = body.config_id;
  if (typeof configId !== 'string' || !configId) {
    return jsonError(400, 'BAD_REQUEST', 'config_id is required', corsHeaders);
  }
  const { data: existing, error: exErr } = await admin
    .from('integration_configs')
    .select('id, tenant_id')
    .eq('id', configId)
    .maybeSingle();
  if (exErr) return jsonError(500, 'INTERNAL', exErr.message, corsHeaders);
  if (!existing || existing.tenant_id !== tenantId) {
    return jsonError(404, 'NOT_FOUND', 'config not found', corsHeaders);
  }
  const { error: rmErr } = await admin
    .from('integration_configs')
    .update({ enabled: false, credentials_enc: null, credentials: {} })
    .eq('id', configId);
  if (rmErr) return jsonError(500, 'INTERNAL', rmErr.message, corsHeaders);

  await audit(admin, {
    tenant_id: tenantId,
    actor_user_id: user.id,
    actor_email: user.email ?? null,
    action: 'integration_config.remove',
    target_type: 'integration_config',
    target_id: configId,
  });

  return jsonResponse({ ok: true }, 200, corsHeaders);
});
