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
 *  2. Der Trigger sperrt VOR dem Zählen (Advisory-Lock je Mandant), feuert
 *     nur BEFORE INSERT und löscht nichts.
 *  3. Der Onboarding-Orchestrator legt keinen Bot mehr bedingungslos an,
 *     fragt dieselbe Quelle wie der Trigger und meldet ohne Bot weder
 *     `bot_id` noch `next.chat`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

  it('Trigger: BEFORE INSERT, je Zeile, nicht auf UPDATE/DELETE', () => {
    expect(NEU).toMatch(/CREATE TRIGGER bots_enforce_quota\s+BEFORE INSERT ON public\.bots\s+FOR EACH ROW/);
    expect(NEU).not.toMatch(/BEFORE (INSERT OR UPDATE|UPDATE|DELETE)/);
    expect(NEU).not.toMatch(/AFTER (INSERT|UPDATE|DELETE)/);
  });

  it('Trigger: Lock je Mandant VOR dem Zählen, fail closed, -1 unbegrenzt', () => {
    const fn = rumpf(NEU, 'bots_enforce_quota');
    const lock = fn.indexOf("pg_advisory_xact_lock(hashtext('public.bots.quota'), hashtext(NEW.tenant_id::text))");
    const zaehlen = fn.indexOf('FROM public.bots_quota(NEW.tenant_id)');
    expect(lock, 'Advisory-Lock fehlt').toBeGreaterThan(-1);
    expect(zaehlen).toBeGreaterThan(lock);
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

  it('fragt dieselbe Quelle wie der Trigger (bots_quota) und wertet enabled / max_bots / used aus', () => {
    expect(src).toContain("admin.rpc('bots_quota',{p_tenant_id:tenantId})");
    expect(src).toContain("q.enabled!==true||Number(q.max_bots)===0)botSkipped='not_entitled'");
    expect(src).toContain("Number(q.max_bots)!==-1&&Number(q.used)>=Number(q.max_bots))botSkipped='quota_exhausted'");
  });

  it('eine Trigger-Ablehnung ist kein Onboarding-Fehler', () => {
    expect(src).toContain("if(code.includes('BOT_QUOTA_EXCEEDED'))botSkipped='quota_exhausted'");
    expect(src).toContain("else if(code.includes('BOTS_NOT_ENTITLED'))botSkipped='not_entitled'");
    // Alles andere bleibt ein echter Fehler — kein pauschales Schlucken.
    expect(src).toContain('else throw ie;');
  });

  it('ohne Bot: keine erfundene bot_id, kein next.chat, kein Agent-Profil, keine Wissensbasis', () => {
    expect(src).not.toContain('bot_id:existingBot');
    expect((src.match(/bot_id:bot\?\.id\?\?null/g) ?? []).length, 'Audit ×2 + Antwort').toBe(3);
    expect(src).toContain("next:{...(bot?{chat:'bot-chat',voice:'bot-voice-webhook'}:{}),governance:");
    expect(src).toContain("bot:bot?{provisioned:true,id:bot.id}:{provisioned:false,reason:botSkipped}");
    expect(src).toContain('if(bot&&!agentId){');
    expect(src).toContain("const kb=agentId?await one(admin,'agent_knowledge_base'");
    expect(src).toContain('knowledge_base_id:kb?.row.id??null');
  });

  it('bleibt idempotent: bestehender Bot wird aktualisiert, config gemergt', () => {
    expect(src).toContain(".eq('tenant_id',tenantId).eq('name',botName).limit(1).maybeSingle()");
    expect(src).toContain('config:{...(vorhanden.config??{}),ai_system_id:ais.row.id');
  });
});
