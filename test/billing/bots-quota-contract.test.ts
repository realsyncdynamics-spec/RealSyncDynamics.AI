/**
 * Bot-Kontingent (P0-5b) — Vertrag am Quelltext.
 *
 * Die Durchsetzung selbst prüft test/runtime/db/bots-quota.db.test.ts gegen
 * echtes Postgres. Hier stehen die Eigenschaften, die auch ohne Datenbank
 * gelten müssen und deren Verlust ein späterer Edit leicht übersieht:
 *
 *  1. Der interne Auflöser ist der alte Rumpf ohne Autorisierungs-CTE —
 *     Zeichen für Zeichen. Zwei Fassungen derselben Logik wären eine zweite
 *     Entitlement-SSoT; genau das darf nicht passieren.
 *  2. Der Trigger prüft für Clients die Mitgliedschaft VOR allem anderen
 *     (Postgres wendet RLS erst nach BEFORE-Triggern an), sperrt dann VOR
 *     dem Zählen (Advisory-Lock je Mandant), feuert nur BEFORE INSERT und
 *     löscht nichts.
 *  3. Die Migration trägt ein Release-Gate auf 20260920120000 (#1491).
 *  4. Der Onboarding-Orchestrator bestimmt die Berechtigung IMMER — auch
 *     bei Bestand —, legt keinen Bot mehr bedingungslos an, fragt dieselbe
 *     Quelle wie der Trigger und meldet ohne Bot weder `bot_id` noch
 *     `next.chat`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PLAN_ENTITLEMENTS } from '../../shared/pricing';

const root = (p: string) => resolve(__dirname, '../..', p);

const ALT = readFileSync(root('supabase/migrations/20260904000000_addon_booking_schema.sql'), 'utf8');
const NEU = readFileSync(root('supabase/migrations/20260920130000_bots_quota_enforcement.sql'), 'utf8');
const ORCHESTRATOR = readFileSync(root('supabase/functions/onboarding-orchestrator/index.ts'), 'utf8');

/** Kommentare raus, Whitespace kollabiert — vergleicht Logik, nicht Formatierung. */
const norm = (t: string) => t.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();

/** Rumpf einer `CREATE OR REPLACE FUNCTION public.<name>(` zwischen den $function$-Marken. */
function rumpf(sql: string, name: string): string {
  const kopf = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  expect(kopf, `${name} nicht gefunden`).toBeGreaterThan(-1);
  const a = sql.indexOf('$function$', kopf) + '$function$'.length;
  const b = sql.indexOf('$function$', a);
  return norm(sql.slice(a, b));
}

describe('Migration 20260920130000 — Auflöser geteilt, nicht verdoppelt', () => {
  it('tenant_entitlements_resolve ist der alte Rumpf ohne die authorized-CTE', () => {
    const alt = rumpf(ALT, 'tenant_entitlements');
    const neu = rumpf(NEU, 'tenant_entitlements_resolve');
    const start = alt.indexOf('active_sub AS (');
    expect(start).toBeGreaterThan(-1);
    const altOhneAuth = ('WITH ' + alt.slice(start)).replace(/\s*CROSS JOIN authorized a WHERE a\.ok;$/, ';');
    expect(neu).toBe(altOhneAuth);
  });

  it('tenant_entitlements bleibt Hülle mit derselben Regel: service_role ODER Mitgliedschaft', () => {
    const huelle = rumpf(NEU, 'tenant_entitlements');
    expect(huelle).toContain('FROM public.tenant_entitlements_resolve(p_tenant_id) r');
    expect(huelle).toContain("auth.role() = 'service_role'");
    expect(huelle).toContain('m.tenant_id = p_tenant_id AND m.user_id = auth.uid()');
    expect(NEU).toContain('GRANT EXECUTE ON FUNCTION public.tenant_entitlements(uuid) TO authenticated');
  });

  it('der interne Rumpf ist für keinen Client-Kontext ausführbar', () => {
    expect(NEU).toMatch(
      /REVOKE ALL ON FUNCTION public\.tenant_entitlements_resolve\(uuid\) FROM PUBLIC, anon, authenticated, service_role/,
    );
    expect(NEU).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.tenant_entitlements_resolve/);
  });

  it('bots_quota liest denselben Rumpf und ist nur für service_role', () => {
    expect(rumpf(NEU, 'bots_quota')).toContain('FROM public.tenant_entitlements_resolve(p_tenant_id) r');
    expect(NEU).toContain('REVOKE ALL ON FUNCTION public.bots_quota(uuid) FROM PUBLIC, anon, authenticated');
    expect(NEU).toContain('GRANT EXECUTE ON FUNCTION public.bots_quota(uuid) TO service_role');
  });

  it('Release-Gate prüft den Endzustand von #1491 am Enterprise-Produkt — nicht nur einen Vokabular-Key', () => {
    // `bots.chat` legt bereits 20260628193759 an; ein Gate auf den Key liefe
    // auf einem frischen Reset ins Leere. Was #1491 herstellt, ist die
    // Zuordnung am aktuellen Enterprise-Produkt.
    const a = NEU.indexOf('-- >>> RELEASE-GATE >>>');
    const b = NEU.indexOf('-- <<< RELEASE-GATE <<<');
    expect(a, 'Gate-Marker fehlen').toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(a, 'Gate steht vor allem anderen').toBeLessThan(NEU.indexOf('CREATE OR REPLACE FUNCTION'));
    const gate = norm(NEU.slice(a, b));
    expect(gate).toContain("WHERE p.default_for_plan_key IN ('enterprise', 'enterprise_yearly')");
    expect(gate).toContain("e.key = 'bots.enabled' AND pe.value = 1");
    expect(gate).toContain("e.key = 'limit.bots' AND pe.value = -1");
    expect(gate).toContain("e.key = 'bots.chat' AND pe.value = 1");
    expect(gate).toContain("RAISE EXCEPTION 'Release-Gate: Entitlement-Parität aus 20260920120000 (#1491) fehlt");
    // Kein Gate mehr auf die bloße Existenz des Keys.
    expect(gate).not.toContain("FROM public.entitlements WHERE key = 'bots.chat'");
  });

  it('die drei Gate-Werte sind exakt die der Quelle (PLAN_ENTITLEMENTS.enterprise)', () => {
    expect(PLAN_ENTITLEMENTS.enterprise?.['bots.enabled']).toBe(1);
    expect(PLAN_ENTITLEMENTS.enterprise?.['limit.bots']).toBe(-1);
    expect(PLAN_ENTITLEMENTS.enterprise?.['bots.chat']).toBe(1);
  });
});

describe('Migration 20260920130000 — Trigger', () => {
  const fn = rumpf(NEU, 'bots_enforce_quota');

  it('BEFORE INSERT, je Zeile, nicht auf UPDATE/DELETE', () => {
    expect(NEU).toMatch(/CREATE TRIGGER bots_enforce_quota\s+BEFORE INSERT ON public\.bots\s+FOR EACH ROW/);
    expect(NEU).not.toMatch(/BEFORE (INSERT OR UPDATE|UPDATE|DELETE)/);
    expect(NEU).not.toMatch(/AFTER (INSERT|UPDATE|DELETE)/);
  });

  it('Clients: Mitgliedschaft VOR Lock und Kontingent, mit RLS-Meldung und 42501', () => {
    // Postgres prüft WITH CHECK erst nach BEFORE-Triggern. Ohne diese Reihen-
    // folge verriete die Fehlerart einem Fremden Plan und Auslastung.
    const auth = fn.indexOf("IF auth.role() IN ('anon', 'authenticated') AND NOT public.is_tenant_member(NEW.tenant_id) THEN");
    const lock = fn.indexOf('pg_advisory_xact_lock(');
    const zaehlen = fn.indexOf('FROM public.bots_quota(NEW.tenant_id)');
    expect(auth, 'Autorisierung fehlt').toBeGreaterThan(-1);
    expect(auth).toBeLessThan(lock);
    expect(fn).toContain(`RAISE EXCEPTION 'new row violates row-level security policy for table "bots"' USING ERRCODE = '42501'`);
    // In diesem Pfad kein BOTS_*-Detail.
    expect(fn.slice(auth, lock)).not.toMatch(/BOTS_NOT_ENTITLED|BOT_QUOTA_EXCEEDED/);
    expect(lock).toBeLessThan(zaehlen);
  });

  it('Lock je Mandant, fail closed, -1 unbegrenzt, Codes im DETAIL', () => {
    expect(fn).toContain("pg_advisory_xact_lock(hashtext('public.bots.quota'), hashtext(NEW.tenant_id::text))");
    expect(fn).toContain('IF NOT v_enabled OR v_limit = 0 THEN RAISE EXCEPTION');
    expect(fn).toContain('IF v_limit = -1 THEN RETURN NEW; END IF;');
    expect(fn).toContain('IF v_used >= v_limit THEN RAISE EXCEPTION');
    expect(fn).toContain("DETAIL = 'BOTS_NOT_ENTITLED'");
    expect(fn).toContain("DETAIL = 'BOT_QUOTA_EXCEEDED'");
  });

  it('löscht und ändert keine Bestandsdaten', () => {
    expect(NEU).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(NEU).not.toMatch(/\bTRUNCATE\b/i);
    expect(NEU).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(NEU).not.toMatch(/\bDROP\s+FUNCTION\b/i);
    expect(NEU).not.toMatch(/\bUPDATE\s+public\.bots\b/i);
  });
});

describe('onboarding-orchestrator — Bot nur mit Berechtigung', () => {
  const src = ORCHESTRATOR.replace(/\/\/[^\n]*/g, '');

  it('legt keinen Bot mehr bedingungslos an', () => {
    expect(src).not.toContain("one(admin,'bots'");
    expect(src).not.toContain('existingBot');
  });

  it('bestimmt die Berechtigung IMMER — vor dem Bestandspfad', () => {
    const quota = src.indexOf("admin.rpc('bots_quota',{p_tenant_id:tenantId})");
    const bestand = src.indexOf('else if(vorhanden){');
    const nichtBerechtigt = src.indexOf("botSkipped='not_entitled'");
    expect(quota).toBeGreaterThan(-1);
    expect(bestand).toBeGreaterThan(-1);
    // Reihenfolge: Quota lesen → nicht berechtigt → Bestand → Kontingent voll → Insert
    expect(quota).toBeLessThan(nichtBerechtigt);
    expect(nichtBerechtigt).toBeLessThan(bestand);
    expect(bestand).toBeLessThan(src.indexOf("botSkipped='quota_exhausted'"));
    expect(src).toContain("q.enabled!==true||Number(q.max_bots)===0)botSkipped='not_entitled'");
    expect(src).toContain("Number(q.max_bots)!==-1&&Number(q.used)>=Number(q.max_bots))botSkipped='quota_exhausted'");
  });

  it('Bestand + nicht berechtigt: keine Mutation, kein Bot in der Antwort', () => {
    // Der Update-Pfad liegt im `else if(vorhanden)`-Zweig NACH not_entitled —
    // ein Free-Mandant mit Alt-Bot erreicht ihn nicht. Die Zeile bleibt, wird
    // aber weder aktualisiert noch als provisioniert gemeldet.
    const bestand = src.indexOf('else if(vorhanden){');
    const update = src.indexOf(".update({...botValues,config:{...(vorhanden.config??{})");
    expect(update).toBeGreaterThan(bestand);
    expect(src).not.toMatch(/\.delete\(\)[^\n]*bots|from\('bots'\)\.delete/);
  });

  it('Bestand + berechtigt: derselbe Bot wird aktualisiert, auch am Limit; config gemergt', () => {
    expect(src).toContain(".eq('tenant_id',tenantId).eq('name',botName).limit(1).maybeSingle()");
    expect(src).toContain('config:{...(vorhanden.config??{}),ai_system_id:ais.row.id');
    // Der Bestandszweig steht VOR der Kontingentprüfung: used == limit sperrt ihn nicht.
    expect(src.indexOf('else if(vorhanden){')).toBeLessThan(src.indexOf("botSkipped='quota_exhausted'"));
  });

  it('eine Trigger-Ablehnung ist kein Onboarding-Fehler', () => {
    expect(src).toContain("if(code.includes('BOT_QUOTA_EXCEEDED'))botSkipped='quota_exhausted'");
    expect(src).toContain("else if(code.includes('BOTS_NOT_ENTITLED'))botSkipped='not_entitled'");
    expect(src).toContain('else throw ie;');
  });

  it('ohne Bot: keine erfundene bot_id, kein next.chat, kein Agent-Profil, keine Wissensbasis', () => {
    expect((src.match(/bot_id:bot\?\.id\?\?null/g) ?? []).length, 'Audit ×2 + Antwort').toBe(3);
    expect(src).toContain("next:{...(bot?{chat:'bot-chat',voice:'bot-voice-webhook'}:{}),governance:");
    expect(src).toContain("bot:bot?{provisioned:true,id:bot.id}:{provisioned:false,reason:botSkipped}");
    expect(src).toContain('if(bot&&!agentId){');
    expect(src).toContain("const kb=agentId?await one(admin,'agent_knowledge_base'");
    expect(src).toContain('knowledge_base_id:kb?.row.id??null');
  });
});
