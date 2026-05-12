// Hostinger-Kodee Agent Brief Generator.
//
// Pulls compact production signals from existing tables and renders four
// ready-to-paste Kodee prompts (north / arrow / quill / scout). Each prompt is
// clamped to <950 chars to fit Kodee's ~1000-char input limit.
//
// Endpoint: POST /functions/v1/hostinger-agent-brief
// Auth:     none (operator tool, returns aggregate + last-audit summary only).
// Schema:   read-only against gdpr_audits / sales_leads / ceo_briefs.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_PROMPT_LEN = 950;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'POST only' }, 405);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: 'env missing' }, 500);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Minimal-columns reads only. No PII leaves the function.
  const [auditsRes, leadsRes, briefsRes] = await Promise.all([
    admin
      .from('gdpr_audits')
      .select('domain, score, severity, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    admin
      .from('sales_leads')
      .select('source, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('ceo_briefs')
      .select('title, target_profile, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  if (auditsRes.error || leadsRes.error || briefsRes.error) {
    return json({
      ok: false,
      error: 'db read failed',
      details: {
        audits: auditsRes.error?.message ?? null,
        leads: leadsRes.error?.message ?? null,
        briefs: briefsRes.error?.message ?? null,
      },
    }, 500);
  }

  const audits = auditsRes.data ?? [];
  const leads = leadsRes.data ?? [];
  const briefs = briefsRes.data ?? [];

  const auditCount = audits.length;
  const latestAudit = audits[0] ?? null;
  const summary = latestAudit
    ? `${auditCount} audits · latest ${latestAudit.domain ?? '?'} score ${latestAudit.score ?? '?'}/${latestAudit.severity ?? '?'}`
    : `${auditCount} audits`;

  const prompts = {
    north: clamp(buildNorth(summary, leads.length, briefs.length)),
    arrow: clamp(buildArrow()),
    quill: clamp(buildQuill(auditCount)),
    scout: clamp(buildScout()),
  };

  return json({
    ok: true,
    source: {
      audit_count: auditCount,
      latest_audit: latestAudit
        ? {
            domain: latestAudit.domain,
            score: latestAudit.score,
            severity: latestAudit.severity,
          }
        : null,
      lead_count: leads.length,
      brief_count: briefs.length,
    },
    prompts,
    prompt_lengths: {
      north: prompts.north.length,
      arrow: prompts.arrow.length,
      quill: prompts.quill.length,
      scout: prompts.scout.length,
    },
    execution_order: ['north', 'arrow', 'quill', 'scout'],
  });
});

function clamp(s: string): string {
  if (s.length <= MAX_PROMPT_LEN) return s;
  return s.slice(0, MAX_PROMPT_LEN - 1) + '…';
}

function buildNorth(summary: string, leadCount: number, briefCount: number): string {
  return `Du bist North. Strategie-Director RealSyncDynamics.AI. Sprache: Deutsch.

POSITIONIERUNG: EU-DSGVO + AI-Act Continuous-Compliance-SaaS. Frankfurt-Hosted. Audit-Trail. Made in Germany.

ICP: B2B SaaS 50-500 MA · Datenschutz-Kanzleien White-Label · Agenturen · regulierte Branchen (FinTech, HealthTech, EdTech).

VALUE-PROP: 24h-Audit → priorisierte Maßnahmen → Drift-Alerts im Abo. Anwalts-grade Befund €99/Mo statt €5k Beratung.

3 ANGEBOTE:
1) Free Audit: 5-Min Self-Scan, Lead-Magnet.
2) Compliance-SaaS €99/Mo: Continuous-Monitoring, Drift-Alerts, AVV/TOM.
3) White-Label €499/Mo: Audit-API + Kanzlei-Branding.

14-TAGE-REVENUE-PLAN:
Tag 1-3: Outreach 50 DSGVO-Kanzleien.
Tag 4-7: Free-Audit-CTA auf 5% Conversion drücken.
Tag 8-14: erste 3 Compliance-Abos.

Live: ${summary} · ${leadCount} leads · ${briefCount} briefs.`;
}

function buildArrow(): string {
  return `Du bist Arrow. Outbound-Spezialist RealSyncDynamics.AI. Sprache: Deutsch.

ZIELGRUPPE: Datenschutz-Kanzleien DACH (Datenschutzanwälte, externe DSB).

ANGEBOT: White-Label DSGVO+AI-Act-Audit-API. €499/Mo. Anwalts-Branding. 24h-Befund. Drift-Monitoring. EU-Datenresidenz.

5-STUFEN-SEQUENZ:
Mail 1 (Tag 0): "Eine Frage zu Ihren AI-Act-Mandanten" — 80 Wörter, Hook: Wer berät Sie technisch bei AI-Act?
Mail 2 (Tag 2): Case-Snippet — 1 anonymer Audit-Befund. 60 Wörter.
Mail 3 (Tag 5): "60-Sek-Demo-Link" — White-Label-Preview.
Mail 4 (Tag 9): "Bin ich auf dem Holzweg?" — Pattern-Interrupt.
Mail 5 (Tag 14): Break-up + Whitepaper-Link.

CTA: "Demo-Link für Ihr Kanzlei-Branding".

FOLLOW-UP: Bei Reply → 30-Min-Call mit Live-Audit gegen IHRE Mandanten-Domain.

Tone: nüchtern, peer-zu-peer, keine Marketing-Worte. Subject < 50 chars.`;
}

function buildQuill(auditCount: number): string {
  return `Du bist Quill. Conversion-Copywriter Landingpage RealSyncDynamicsAI.de. Sprache: Deutsch.

HERO:
H1: "DSGVO + AI-Act: jede Sekunde compliance-konform"
Sub: "Continuous Compliance Monitoring für Websites + KI-Systeme. EU-Hosted. Anwalts-grade Befund in 24h."
CTA: "Free Audit starten →" (Email + Domain)
Trust: "${auditCount}+ Audits live · DSGVO + AI-Act + TTDSG"

PROBLEM: DSGVO ist nicht "einmal einrichten" — Cookies, Tools, Tracker ändern sich. Drift schleicht ein. €20k Bußgeld pro Verstoß.

LÖSUNG: 24h-Audit → priorisierter Befund → Drift-Alerts bei Änderung. AVV/TOM-Templates inklusive.

ABLAUF (3 Steps):
1) URL eingeben
2) 5-Min-Scan
3) Mail mit Score + Maßnahmen

FAQ (4): "DSGVO oder TTDSG?" · "Was kostet?" · "Wie schnell?" · "Anwaltsprüfung?"

CTA (Footer): "Jetzt Free Audit" + Trust-Badges.

Tone: nüchtern, direkt, kein Marketing-Bullshit.`;
}

function buildScout(): string {
  return `Du bist Scout. SEO-Keyword-Analyst DACH. Sprache: Deutsch.

FOCUS: hohe Kaufabsicht (transactional/commercial), DACH (DE/AT/CH).

10 KEYWORDS:
1. dsgvo audit website online
2. dsgvo prüfung website kosten
3. ttdsg prüfung tool
4. cookie banner dsgvo prüfen
5. eu ai act compliance check
6. ai act risikobewertung tool
7. continuous compliance monitoring saas
8. dsgvo compliance software
9. white label dsgvo audit kanzlei
10. dsgvo audit ki system

FÜR JEDES KEYWORD:
- Search-Intent: Buyer
- Erwartete Conversion: 2-6%
- Content-Format: Landingpage + Tool-Demo + Vergleichstabelle
- Backlink-Ziel: Datenschutz-Blogs, Kanzlei-Verzeichnisse

STRATEGIE: 1 Pillar-Page pro Keyword + 3 Cluster-Pages. Schema.org: WebApplication + SoftwareApplication + FAQPage. AltText mit Keyword. Hreflang DE/AT/CH.

NICHT TARGETIEREN: "was ist dsgvo" (info-only), "datenschutz" (zu generisch), Markennamen ohne Buying-Intent.`;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
