// microsoft365-connect — Einrichtung und Pruefung der Microsoft-365-Anbindung
// (Plan P2-2, Durchsetzbarkeits-Klasse C).
//
// POST /functions/v1/microsoft365-connect   (verify_jwt = true, Default)
//   { op: 'configure',  tenant_id, azure_tenant_id, client_id, client_secret, scope?, streams? }
//   { op: 'test',       tenant_id, connection_id }
//   { op: 'disconnect', tenant_id, connection_id }
//
// GOVERNANCE-ZWECK
// Diese Function ist der einzige Schreibpfad fuer die Zugangsdaten einer
// Microsoft-365-Anbindung. Ein Graph-App-Geheimnis oeffnet das gesamte
// Postfach- und Dateisystem eines Kunden; es wird hier AES-256-GCM versiegelt
// (`_shared/secretBox.ts`) und verlaesst die Serverseite nie wieder — weder in
// einer Tabellen-SELECT (Spaltenrechte, Migration 20260905100000) noch in
// einer Antwort dieser Function. Es gibt KEINEN Klartext-Fallback.
//
// EHRLICHKEIT ALS TEIL DER FUNKTION
// Beim Anlegen entsteht zugleich eine Zeile in `connector_registry`. Deren
// Durchsetzbarkeits-Klasse wird vom Trigger aus dem Systemtyp abgeleitet
// (`microsoft365` -> 'C') und kann von hier aus nicht gesetzt werden. Die
// Antwort nennt die Klasse und ihre Bedeutung, damit niemand die Anbindung
// fuer eine Schranke haelt.
//
// SICHERHEITSRELEVANZ: owner/admin-only. `tenant_id` wird gegen die
// Mitgliedschaft geprueft, nie dem Body geglaubt. Jede Aenderung landet im
// Pruefpfad (`governance_admin_log`).
//
// EU AI Act Art. 12 · DSGVO Art. 32.

import { requireAuthAndTenant } from '../_shared/auth.ts';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { importSecretKey, open, seal } from '../_shared/secretBox.ts';
import { audit } from '../_shared/auditLog.ts';
import { fetchGraphToken, fetchPrimaryDomain } from '../_shared/m365/graph.ts';

const corsHeaders = buildCorsHeaders('POST, OPTIONS');

const ALLOWED_STREAMS = ['directory_audits', 'sign_ins'] as const;
type Stream = typeof ALLOWED_STREAMS[number];

/**
 * Was die Anbindung kann — und was nicht. Wird jeder Antwort beigelegt,
 * damit die Zusage an derselben Stelle steht wie die Einrichtung.
 */
const CLASS_NOTE = {
  enforcement_class: 'C',
  kann_blockieren: false,
  bedeutung:
    'Microsoft Graph liefert Prueferereignisse erst nach der Handlung. Diese '
    + 'Anbindung kann feststellen, belegen, melden und eskalieren — verhindern '
    + 'kann sie nichts. Ein echter Block braeuchte Microsoft Purview DLP oder '
    + 'eine Netzwerk-/Geraeteebene; beides ist nicht Teil dieses Produkts.',
} as const;

// deno-lint-ignore no-explicit-any
async function loadSealKey(admin: any): Promise<CryptoKey | null> {
  let b64 = Deno.env.get('INTEGRATION_CREDENTIALS_KEY') ?? null;
  if (!b64) {
    try {
      const { data } = await admin.rpc('get_app_secret', {
        secret_name: 'integration_credentials_key',
      });
      if (typeof data === 'string' && data.length > 0) b64 = data;
    } catch { /* Vault optional — env ist der Primaerweg */ }
  }
  if (!b64) return null;
  try {
    return await importSecretKey(b64);
  } catch (e) {
    console.error('[microsoft365-connect] invalid seal key', e);
    return null;
  }
}

/** Eine GUID, wie Azure sie fuer Mandanten und Anwendungen vergibt. */
function isGuid(v: unknown): v is string {
  return typeof v === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
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
  if (op !== 'configure' && op !== 'test' && op !== 'disconnect') {
    return jsonError(400, 'BAD_REQUEST', `unknown op: ${op}`, corsHeaders);
  }

  // Fremdsysteme anbinden duerfen nur owner/admin — wer sie sieht, darf sie
  // nicht umkonfigurieren.
  const auth = await requireAuthAndTenant(req, body.tenant_id as string, ['owner', 'admin']);
  if (auth instanceof Response) return auth;
  const { admin, user, tenantId } = auth;

  // ── configure ────────────────────────────────────────────────────────────
  if (op === 'configure') {
    const azureTenantId = String(body.azure_tenant_id ?? '').trim();
    const clientId = String(body.client_id ?? '').trim();
    const clientSecret = String(body.client_secret ?? '');

    if (!isGuid(azureTenantId)) {
      return jsonError(400, 'BAD_REQUEST', 'azure_tenant_id muss eine GUID sein', corsHeaders);
    }
    if (!isGuid(clientId)) {
      return jsonError(400, 'BAD_REQUEST', 'client_id muss eine GUID sein', corsHeaders);
    }
    if (clientSecret.length < 8) {
      return jsonError(400, 'BAD_REQUEST', 'client_secret fehlt', corsHeaders);
    }

    const streams: Stream[] = Array.isArray(body.streams)
      ? (body.streams as unknown[])
        .map((s) => String(s))
        .filter((s): s is Stream => (ALLOWED_STREAMS as readonly string[]).includes(s))
      : ['directory_audits'];
    if (streams.length === 0) {
      return jsonError(400, 'BAD_REQUEST', 'mindestens ein Protokollstrom noetig', corsHeaders);
    }

    const key = await loadSealKey(admin);
    if (!key) {
      // Kein Klartext-Fallback: Lieber gar keine Anbindung als ein
      // App-Geheimnis im Klartext (Auftrag §4).
      return jsonError(
        503, 'NO_SEAL_KEY',
        'Zugangsdaten-Siegel nicht konfiguriert — Anbindung abgelehnt',
        corsHeaders,
      );
    }
    const sealed = await seal(key, { client_secret: clientSecret });

    // Die Registratur-Zeile zuerst: Sie traegt die Klasse, und die Klasse ist
    // die governance-relevante Tatsache. Der Trigger leitet sie ab; ein hier
    // mitgeschickter Wert wuerde ohnehin verworfen — deshalb wird keiner
    // mitgeschickt.
    // Kein `upsert`: Der eindeutige Index auf `connector_registry` ist ein
    // Teil-Index ueber (tenant_id, source_table, source_id) und greift nur,
    // wenn beide Zeiger gesetzt sind. Hier gibt es keine Bestandszeile, auf
    // die gezeigt werden koennte — die Anbindung IST neu. Also erst suchen,
    // dann anlegen.
    const { data: existingReg } = await admin
      .from('connector_registry')
      .select('id, enforcement_class')
      .eq('tenant_id', tenantId)
      .eq('system_type', 'microsoft365')
      .maybeSingle();

    const registryRow = {
      tenant_id: tenantId,
      system_type: 'microsoft365',
      display_name: 'Microsoft 365',
      auth_kind: 'oauth2',
      scope: (typeof body.scope === 'string' && body.scope.trim())
        ? body.scope.trim()
        : 'Verzeichnis- und Anmeldeprotokoll (lesend)',
      status: 'pending',
    };

    const { data: reg, error: regErr } = existingReg
      ? await admin.from('connector_registry')
        .update(registryRow).eq('id', existingReg.id)
        .select('id, enforcement_class').maybeSingle()
      : await admin.from('connector_registry')
        .insert(registryRow)
        .select('id, enforcement_class').maybeSingle();

    if (regErr) {
      console.error('[microsoft365-connect] registry write failed', regErr.message);
    }

    const { data: conn, error } = await admin
      .from('m365_connections')
      .upsert({
        tenant_id: tenantId,
        azure_tenant_id: azureTenantId,
        client_id: clientId,
        credentials_enc: sealed,
        scope: typeof body.scope === 'string' ? body.scope.trim() : null,
        streams,
        status: 'pending',
        last_error: null,
        registry_id: reg?.id ?? null,
        created_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id,azure_tenant_id' })
      .select('id, azure_tenant_id, client_id, streams, status')
      .single();

    if (error) {
      return jsonError(500, 'DB_ERROR', error.message, corsHeaders);
    }

    await audit(admin, {
      tenant_id: tenantId,
      actor_user_id: user.id,
      actor_email: user.email ?? null,
      action: 'm365.configure',
      target_type: 'm365_connection',
      target_id: conn.id,
      // Kein Geheimnis im Pruefpfad — nur die Tatsache, dass eines gesetzt wurde.
      payload: { azure_tenant_id: azureTenantId, client_id: clientId, streams, secret_set: true },
    });

    return jsonResponse({
      ok: true,
      connection: conn,
      enforcement: { ...CLASS_NOTE, registry_class: reg?.enforcement_class ?? 'C' },
    }, 200, corsHeaders);
  }

  // ── test ─────────────────────────────────────────────────────────────────
  //
  // Prueft, ob die hinterlegten Daten wirklich ein Token ergeben, und liest
  // dabei die Hauptdomaene. Ohne diesen Schritt bliebe „verbunden" eine
  // Behauptung des Kunden statt einer Feststellung.
  if (op === 'test') {
    const connectionId = String(body.connection_id ?? '');
    if (!connectionId) {
      return jsonError(400, 'BAD_REQUEST', 'connection_id fehlt', corsHeaders);
    }

    const { data: conn, error } = await admin
      .from('m365_connections')
      .select('id, tenant_id, azure_tenant_id, client_id, credentials_enc, registry_id')
      .eq('id', connectionId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) return jsonError(500, 'DB_ERROR', error.message, corsHeaders);
    if (!conn) return jsonError(404, 'NOT_FOUND', 'Anbindung nicht gefunden', corsHeaders);
    if (!conn.credentials_enc) {
      return jsonError(400, 'NO_CREDENTIALS', 'Kein Geheimnis hinterlegt', corsHeaders);
    }

    const key = await loadSealKey(admin);
    if (!key) {
      return jsonError(503, 'NO_SEAL_KEY', 'Zugangsdaten-Siegel nicht konfiguriert', corsHeaders);
    }

    let secret: string;
    try {
      const opened = await open(key, conn.credentials_enc) as { client_secret?: string };
      secret = String(opened?.client_secret ?? '');
      if (!secret) throw new Error('leer');
    } catch {
      // Kein Fallback und keine Details: Ein fehlgeschlagenes Entsiegeln
      // heisst entweder falscher Schluessel oder Manipulation. Beides ist ein
      // Betriebsvorfall, kein Eingabefehler des Nutzers.
      await admin.from('m365_connections')
        .update({ status: 'error', last_error: 'Siegel konnte nicht geoeffnet werden' })
        .eq('id', conn.id);
      return jsonError(500, 'SEAL_ERROR', 'Zugangsdaten konnten nicht geoeffnet werden', corsHeaders);
    }

    try {
      const token = await fetchGraphToken({
        azure_tenant_id: conn.azure_tenant_id,
        client_id: conn.client_id,
        client_secret: secret,
      });
      const domain = await fetchPrimaryDomain(token.access_token);

      await admin.from('m365_connections').update({
        status: 'connected',
        last_error: null,
        primary_domain: domain,
        updated_at: new Date().toISOString(),
      }).eq('id', conn.id);

      if (conn.registry_id) {
        await admin.from('connector_registry')
          .update({ status: 'connected', last_error: null })
          .eq('id', conn.registry_id);
      }

      await audit(admin, {
        tenant_id: tenantId,
        actor_user_id: user.id,
        actor_email: user.email ?? null,
        action: 'm365.test.ok',
        target_type: 'm365_connection',
        target_id: conn.id,
        payload: { primary_domain: domain },
      });

      return jsonResponse({
        ok: true,
        status: 'connected',
        primary_domain: domain,
        enforcement: CLASS_NOTE,
      }, 200, corsHeaders);
    } catch (e) {
      const detail = (e as Error)?.message ?? 'unbekannt';
      await admin.from('m365_connections')
        .update({ status: 'error', last_error: detail, updated_at: new Date().toISOString() })
        .eq('id', conn.id);
      return jsonResponse({ ok: false, status: 'error', error: detail }, 200, corsHeaders);
    }
  }

  // ── disconnect ───────────────────────────────────────────────────────────
  //
  // Das Geheimnis wird geloescht, die Zeile bleibt. Die festgestellten
  // Ereignisse sind Prueferpfad und duerfen nicht mit der Anbindung
  // verschwinden — wer sie loeschen darf, entscheidet die Aufbewahrungsregel,
  // nicht das Trennen einer Verbindung.
  const connectionId = String(body.connection_id ?? '');
  if (!connectionId) return jsonError(400, 'BAD_REQUEST', 'connection_id fehlt', corsHeaders);

  const { data: conn, error } = await admin
    .from('m365_connections')
    .update({
      credentials_enc: null,
      status: 'disabled',
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectionId)
    .eq('tenant_id', tenantId)
    .select('id, registry_id')
    .maybeSingle();

  if (error) return jsonError(500, 'DB_ERROR', error.message, corsHeaders);
  if (!conn) return jsonError(404, 'NOT_FOUND', 'Anbindung nicht gefunden', corsHeaders);

  if (conn.registry_id) {
    await admin.from('connector_registry').update({ status: 'disabled' }).eq('id', conn.registry_id);
  }

  await audit(admin, {
    tenant_id: tenantId,
    actor_user_id: user.id,
    actor_email: user.email ?? null,
    action: 'm365.disconnect',
    target_type: 'm365_connection',
    target_id: conn.id,
    payload: {},
  });

  return jsonResponse({ ok: true, status: 'disabled' }, 200, corsHeaders);
});
