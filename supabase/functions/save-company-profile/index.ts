// Save company profile from unified-entry onboarding
// POST /functions/v1/save-company-profile
// Auth: Required (bearer token)
// Body: { sector: string, answers: Record<string, string>, tenantId?: string }
//
// Stores company profile with sector selection and context answers
// Creates company_profile row linked to tenant
//
// ── Vier Befunde vom 2026-08-19, vor dem ersten Deploy behoben ────────────
//
// 1. **`public.company_profiles` gab es nicht.** Weder live noch als Migration
//    im Repo. Die Function fing den fehlgeschlagenen Insert ab und antwortete
//    trotzdem `success: true` mit dem Hinweis „stored in session (table not
//    yet available)" — es wurde nichts gespeichert, nirgends. Die Oberfläche
//    hätte „Einrichtung abgeschlossen" gezeigt. Der Zweig ist entfernt, die
//    Tabelle kommt mit `20260824000000_company_profiles.sql`.
//
// 2. **Der Mandant wurde über `profiles.active_tenant_id` gesucht — die Spalte
//    gibt es nicht.** Die einzige Zuordnung Nutzer→Mandant ist `memberships`.
//
// 3. **`tenantId` aus dem Body wurde ungeprüft übernommen.** Mit
//    Service-Role-Schlüssel und ohne RLS hätte ein angemeldeter Nutzer das
//    Firmenprofil eines **fremden** Mandanten überschreiben können
//    (CLAUDE.md §4).
//
// 4. **Der Prüfpfad protokollierte Leeres.** `old_values: { sector:
//    existing.sector }` — `existing` war mit `.select('id')` geladen, `sector`
//    also immer `undefined`. Und `ip_address` bekam bei fehlendem
//    `X-Forwarded-For` den Text `'unknown'`, den die `inet`-Spalte ablehnt.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

// Spiegel von company_profiles_sector_check in
// supabase/migrations/20260824000000_company_profiles.sql und von SECTORS in
// src/unified-entry/pages/PostRegisterOnboardingPage.tsx.
const VALID_SECTORS = new Set(['saas', 'agency', 'healthcare', 'public_sector', 'generic']);

/**
 * Erste Adresse aus `X-Forwarded-For`, sonst null — `trial_audit_logs.
 * ip_address` ist vom Typ `inet` und lehnt alles andere ab.
 */
function clientIp(req: Request): string | null {
  const raw = req.headers.get('x-forwarded-for');
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError(401, 'UNAUTHORIZED', 'Authorization header required');

  let body: { sector?: string; answers?: Record<string, string>; tenantId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }

  const supabase = createClient(SUPABASE_URL, SRK);

  // Get authenticated user from JWT
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);

  if (userError || !user?.id) {
    return jsonError(401, 'UNAUTHORIZED', 'Invalid token');
  }

  // Validate inputs
  const sector = body.sector?.trim();
  const answers = body.answers ?? {};

  if (!sector || !VALID_SECTORS.has(sector)) {
    return jsonError(400, 'INVALID_SECTOR', 'Invalid sector value');
  }

  if (typeof answers !== 'object' || Array.isArray(answers)) {
    return jsonError(400, 'INVALID_ANSWERS', 'Answers must be an object');
  }

  try {
    // Mandant auflösen — und in jedem Fall gegen `memberships` prüfen. Die
    // Auflösung steht ausgeschrieben statt in `_shared/`, weil eine Änderung
    // dort `deploy.yml` auf `deploy_all` schaltet (alle 177 Verzeichnisse).
    let tenantId = body.tenantId;
    if (tenantId) {
      const { data: member } = await supabase
        .from('memberships').select('user_id')
        .eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
      if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
    } else {
      const { data: memberships, error: memberError } = await supabase
        .from('memberships').select('tenant_id').eq('user_id', user.id).limit(2);
      if (memberError) return jsonError(500, 'INTERNAL_ERROR', 'Failed to resolve tenant');
      if (!memberships || memberships.length === 0) {
        return jsonError(400, 'TENANT_NOT_FOUND', 'No tenant found for this user');
      }
      if (memberships.length > 1) {
        return jsonError(400, 'TENANT_AMBIGUOUS', 'Multiple tenants — tenantId required');
      }
      tenantId = memberships[0].tenant_id as string;
    }

    // `sector` wird mitgelesen: Er ist der Wert, der im Prüfpfad als
    // `old_values` steht. Ohne ihn protokollierte die Änderung ein leeres
    // Vorher — ein Eintrag, der nichts belegt.
    const { data: existing } = await supabase
      .from('company_profiles')
      .select('id, sector, onboarding_answers')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const now = new Date().toISOString();

    if (existing) {
      const { data, error } = await supabase
        .from('company_profiles')
        .update({
          sector,
          onboarding_answers: answers,
          updated_at: now,
        })
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) throw error;

      // `.insert(...)` liefert einen PostgREST-Builder, kein Promise: `.catch()`
      // gibt es dort nicht, der Zugriff warf `TypeError` — und zwar bevor der
      // Insert abgeschickt wurde. Der Pruefpfad wurde also nicht nur nicht
      // geschrieben, der ganze Request starb daran. Fehler gehoert ueber das
      // Ergebnis geprueft.
      const { error: auditErr } = await supabase
        .from('trial_audit_logs')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          resource_type: 'company_profile',
          action: 'UPDATE',
          old_values: { sector: existing.sector, onboarding_answers: existing.onboarding_answers },
          new_values: { sector, onboarding_answers: answers },
          source: 'unified-entry',
          ip_address: clientIp(req),
          user_agent: req.headers.get('user-agent'),
        });
      if (auditErr) console.warn('Audit log failed:', auditErr.message);

      return jsonResponse({
        success: true,
        created: false,
        profile: {
          id: data.id,
          tenant_id: data.tenant_id,
          sector: data.sector,
          onboarding_answers: data.onboarding_answers,
        },
      });
    }

    // Neu anlegen. Schlägt der Insert fehl, ist das ein Fehler und wird als
    // solcher gemeldet — der frühere Stand antwortete hier `success: true`
    // und verlor die Eingaben des Nutzers ohne Spur.
    const { data: newProfile, error: createError } = await supabase
      .from('company_profiles')
      .insert({
        tenant_id: tenantId,
        sector,
        onboarding_answers: answers,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (createError) throw createError;

    // `.insert(...)` liefert einen PostgREST-Builder, kein Promise: `.catch()`
    // gibt es dort nicht, der Zugriff warf `TypeError` — und zwar bevor der
    // Insert abgeschickt wurde. Der Pruefpfad wurde also nicht nur nicht
    // geschrieben, der ganze Request starb daran. Fehler gehoert ueber das
    // Ergebnis geprueft.
    const { error: auditErr } = await supabase
      .from('trial_audit_logs')
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        resource_type: 'company_profile',
        action: 'CREATE',
        new_values: { sector, onboarding_answers: answers },
        source: 'unified-entry',
        ip_address: clientIp(req),
        user_agent: req.headers.get('user-agent'),
      });
    if (auditErr) console.warn('Audit log failed:', auditErr.message);

    return jsonResponse({
      success: true,
      created: true,
      profile: {
        id: newProfile.id,
        tenant_id: newProfile.tenant_id,
        sector: newProfile.sector,
        onboarding_answers: newProfile.onboarding_answers,
      },
    });
  } catch (err) {
    console.error('Error saving company profile:', err);
    return jsonError(500, 'INTERNAL_ERROR', 'Failed to save company profile');
  }
});
