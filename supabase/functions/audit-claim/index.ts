// Übernahme eines anonymen DSGVO-Audits in einen Mandanten.
//
// POST /functions/v1/audit-claim   (verify_jwt = true — Default, kein
//                                   config.toml-Eintrag noetig)
// Body: { audit_id: uuid, tenant_id?: uuid }
//
// Schliesst die Lücke zwischen Bericht und Konto: `gdpr_audits` trägt
// `user_id`, `tenant_id` und `claimed_at`, und die Lese-Policy
// `gdpr_audits tenant_read` macht ein Audit erst sichtbar, wenn `tenant_id`
// gesetzt ist — aber nichts hat diese Spalten je geschrieben (0 von 159
// Zeilen, gemessen 2026-08-30). Der Lesepfad wartete auf einen Schreiber.
//
// Es gibt **keine** INSERT-/UPDATE-Policy auf `gdpr_audits`; geschrieben
// werden kann ausschliesslich mit der Service-Role, also nur hier.
//
// Muster unveraendert aus `siteos/handlers/anonymous.ts` uebernommen
// (`canonical-funnel-decision.md`: kein zweites Claim-Modell).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { audit } from '../_shared/auditLog.ts';
import {
  decideClaim,
  resolveTenant,
  isUuid,
  emailMismatch,
  type AuditClaimRow,
} from '../_shared/audit-claim.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'Authorization header required');
  }

  let body: { audit_id?: unknown; tenant_id?: unknown };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const auditId = body.audit_id;
  if (!isUuid(auditId)) return jsonError(400, 'BAD_REQUEST', 'audit_id must be a uuid');
  const requestedTenant = body.tenant_id === undefined || body.tenant_id === null
    ? null
    : (isUuid(body.tenant_id) ? body.tenant_id : undefined);
  if (requestedTenant === undefined) return jsonError(400, 'BAD_REQUEST', 'tenant_id must be a uuid');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Identität über den Nutzer-Token, nicht über den Request-Body: Wer
  // uebernimmt, wird bewiesen, nicht behauptet.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const { data: memberships, error: memErr } = await admin
      .from('memberships').select('tenant_id').eq('user_id', userId);
    if (memErr) throw memErr;

    const resolved = resolveTenant(memberships ?? [], requestedTenant);
    if (!resolved.ok) {
      const message = resolved.code === 'TENANT_AMBIGUOUS'
        ? 'Mehrere Arbeitsbereiche — tenant_id angeben.'
        : resolved.code === 'TENANT_NOT_FOUND'
          ? 'Kein Arbeitsbereich für diesen Zugang gefunden.'
          : 'Kein Mitglied dieses Arbeitsbereichs.';
      return jsonError(resolved.code === 'FORBIDDEN' ? 403 : 400, resolved.code, message);
    }
    const tenantId = resolved.tenantId;

    const { data: row, error: rowErr } = await admin
      .from('gdpr_audits')
      .select('id, tenant_id, user_id, claimed_at, email, domain, score, severity')
      .eq('id', auditId).maybeSingle();
    if (rowErr) throw rowErr;
    if (!row) return jsonError(404, 'NOT_FOUND', 'Audit nicht gefunden.');

    const decision = decideClaim(row as AuditClaimRow, tenantId);

    if (decision.status === 'taken') {
      return jsonError(409, 'ALREADY_CLAIMED', 'Dieses Audit gehört bereits zu einem anderen Arbeitsbereich.');
    }
    if (decision.status === 'already_mine') {
      // Dieselbe Antwort wie beim ersten Mal — ein erneuter Aufruf ist kein
      // Fehler, sondern ein Reload.
      return jsonResponse({
        ok: true, already_claimed: true,
        audit_id: row.id, tenant_id: row.tenant_id, domain: row.domain,
        score: row.score, severity: row.severity,
      });
    }

    const nowIso = new Date().toISOString();

    // Atomar: `.is('claimed_at', null)` entscheidet das Rennen in der
    // Datenbank. Zwei gleichzeitige Übernahmen — derselbe Link in zwei
    // Tabs — koennen so nicht beide gewinnen.
    const { data: claimed, error: updErr } = await admin
      .from('gdpr_audits')
      .update({ tenant_id: tenantId, user_id: userId, claimed_at: nowIso })
      .eq('id', auditId).is('claimed_at', null)
      .select('id, tenant_id, domain, score, severity').maybeSingle();
    if (updErr) throw updErr;

    if (!claimed) {
      // Verloren: zwischen Lesen und Schreiben hat jemand anders uebernommen.
      const { data: winner } = await admin
        .from('gdpr_audits').select('tenant_id').eq('id', auditId).maybeSingle();
      if (winner?.tenant_id === tenantId) {
        return jsonResponse({ ok: true, already_claimed: true, audit_id: auditId, tenant_id: tenantId });
      }
      return jsonError(409, 'ALREADY_CLAIMED', 'Dieses Audit gehört bereits zu einem anderen Arbeitsbereich.');
    }

    const mismatch = emailMismatch(row.email ?? null, userEmail);

    await audit(admin, {
      tenant_id: tenantId, actor_user_id: userId, actor_email: userEmail,
      action: 'audit.claim', target_type: 'gdpr_audit', target_id: auditId,
      payload: {
        domain: row.domain,
        // Beobachtet, nicht blockiert: Scan-Adresse und Konto-Adresse
        // duerfen abweichen (Optimizer-Scan erhebt gar keine).
        email_mismatch: mismatch,
      },
    });

    return jsonResponse({
      ok: true, already_claimed: false,
      audit_id: claimed.id, tenant_id: claimed.tenant_id,
      domain: claimed.domain, score: claimed.score, severity: claimed.severity,
    });
  } catch (e) {
    console.error(JSON.stringify({ level: 'error', scope: 'audit_claim_failed', error: (e as Error)?.message }));
    return jsonError(500, 'INTERNAL', 'claim failed');
  }
});
