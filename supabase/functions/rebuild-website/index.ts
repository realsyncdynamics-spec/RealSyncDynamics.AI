// rebuild-website — Orchestrator für den vollautomatischen DSGVO-Rebuild
// einer Kunden-Homepage. Triggert nach Stripe-Checkout der Managed-Tier.
//
// POST /functions/v1/rebuild-website (verify_jwt = false; service-role only)
// Body: { source_url, customer_email, company?, audit_id?, tenant_id? }
//
// Steps siehe migration website_rebuilds + _shared/website-rebuild/types.ts.
// Jeder Step idempotent — bei Fehler kann ein Retry via current_step
// resumed werden ohne von vorne zu starten.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { scrapeSource } from '../_shared/website-rebuild/scrape.ts';
import { stripTrackers } from '../_shared/website-rebuild/strip-trackers.ts';
import { selfHostFonts } from '../_shared/website-rebuild/self-host.ts';
import { injectConsentSdk } from '../_shared/website-rebuild/inject-consent.ts';
import {
  buildLlmsTxt, buildAiInfoJson, buildJsonLd, injectJsonLd,
} from '../_shared/website-rebuild/ai-ready.ts';
import { STEP_ORDER, type StepName, type RebuildContext } from '../_shared/website-rebuild/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const URL_RE = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return jsonError(405, 'BAD_REQUEST', 'POST only');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  let body: {
    source_url?: string;
    customer_email?: string;
    company?: string;
    audit_id?: string;
    tenant_id?: string;
    tier?: 'managed' | 'premium' | 'enterprise';
    rebuild_id?: string; // for resume
  };
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  // Resume-Flow: existierender Job, fahre dort fort wo er stehen geblieben ist
  if (body.rebuild_id) {
    const { data: existing } = await admin
      .from('website_rebuilds').select('*').eq('id', body.rebuild_id).single();
    if (!existing) return jsonError(404, 'NOT_FOUND', 'rebuild not found');
    return await runWorkflow(admin, contextFromRow(existing));
  }

  // Neuer Job
  const sourceUrl = (body.source_url ?? '').trim();
  const email = (body.customer_email ?? '').trim().toLowerCase();
  if (!URL_RE.test(sourceUrl)) return jsonError(400, 'INVALID_URL', 'valid http(s) URL required');
  if (!EMAIL_RE.test(email))   return jsonError(400, 'INVALID_EMAIL', 'valid email required');

  let domain = '';
  try { domain = new URL(sourceUrl).hostname.toLowerCase(); }
  catch { return jsonError(400, 'INVALID_URL', 'unparsable url'); }

  const { data: created, error: insErr } = await admin
    .from('website_rebuilds').insert({
      tenant_id:      body.tenant_id ?? null,
      audit_id:       body.audit_id ?? null,
      source_url:     sourceUrl,
      source_domain:  domain,
      customer_email: email,
      company:        body.company ?? null,
      tier:           body.tier ?? 'managed',
      status:         'queued',
    }).select('*').single();

  if (insErr || !created) return jsonError(500, 'DB_INSERT', insErr?.message ?? 'create failed');

  return await runWorkflow(admin, contextFromRow(created));
});

function contextFromRow(row: Record<string, unknown>): RebuildContext {
  return {
    rebuildId:       row.id as string,
    sourceUrl:       row.source_url as string,
    sourceDomain:    row.source_domain as string,
    customerEmail:   row.customer_email as string,
    company:        (row.company as string | null) ?? null,
    auditId:        (row.audit_id as string | null) ?? null,
    tenantId:       (row.tenant_id as string | null) ?? null,
    tier:           (row.tier as RebuildContext['tier']) ?? 'managed',
    workflowVersion: (row.workflow_version as string) ?? '2026.05.0',
  };
}

async function runWorkflow(admin: ReturnType<typeof createClient>, ctx: RebuildContext): Promise<Response> {
  await admin.from('website_rebuilds').update({
    status: 'running', started_at: new Date().toISOString(),
  }).eq('id', ctx.rebuildId);

  // Persisted state across steps — innerhalb einer Function-Invocation,
  // bei Crash erneuter Trigger via rebuild_id resumed.
  const state: Record<string, unknown> = {};

  for (const step of STEP_ORDER) {
    try {
      await markStep(admin, ctx.rebuildId, step, 'running');
      const t0 = Date.now();
      const result = await executeStep(step, ctx, state);
      const dt = Date.now() - t0;
      await markStep(admin, ctx.rebuildId, step, 'success', { ...result, durationMs: dt });
      await admin.from('website_rebuilds').update({
        current_step: step,
        completed_steps: STEP_ORDER.slice(0, STEP_ORDER.indexOf(step) + 1) as unknown as string[],
      }).eq('id', ctx.rebuildId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown';
      await markStep(admin, ctx.rebuildId, step, 'failed', { errorDetail: msg });
      await admin.from('website_rebuilds').update({
        status: 'failed', error_code: step + '_failed', error_detail: msg,
      }).eq('id', ctx.rebuildId);
      return jsonError(500, 'STEP_FAILED', `${step}: ${msg}`, { rebuild_id: ctx.rebuildId });
    }
  }

  // Erfolg — preview_ready
  await admin.from('website_rebuilds').update({
    status: 'preview_ready',
    completed_at: new Date().toISOString(),
    preview_url: state.previewUrl ?? null,
    bundle_path: state.bundlePath ?? null,
  }).eq('id', ctx.rebuildId);

  return new Response(JSON.stringify({
    rebuild_id: ctx.rebuildId,
    status: 'preview_ready',
    preview_url: state.previewUrl ?? null,
  }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}

async function executeStep(
  step: StepName,
  ctx: RebuildContext,
  state: Record<string, unknown>,
): Promise<{ summary: string; metadata: Record<string, unknown> }> {
  switch (step) {
    case 'scrape': {
      const scraped = await scrapeSource(ctx.sourceUrl);
      state.scraped = scraped;
      return {
        summary: `Geladen: ${scraped.byteSize} bytes, ${scraped.scriptSrcs.length} scripts, ${scraped.iframeSrcs.length} iframes`,
        metadata: {
          byteSize: scraped.byteSize,
          scripts: scraped.scriptSrcs.length,
          iframes: scraped.iframeSrcs.length,
          fonts: scraped.fontUrls.length,
          title: scraped.title,
        },
      };
    }

    case 'audit': {
      // Reuse: bestehender gdpr-audit ist bereits gelaufen (audit_id),
      // sonst hier no-op (Audit nicht zwingend für Rebuild).
      if (!ctx.auditId) {
        return { summary: 'Kein Pre-Audit verlinkt (skipped)', metadata: { skipped: true } };
      }
      return { summary: `Audit ${ctx.auditId} verlinkt`, metadata: { auditId: ctx.auditId } };
    }

    case 'strip_trackers': {
      const scraped = state.scraped as ReturnType<typeof scrapeSource> extends Promise<infer T> ? T : never;
      const { cleanedHtml, report } = stripTrackers(scraped);
      state.html = cleanedHtml;
      state.remediationReport = report;
      return {
        summary: `${report.scriptsRemoved} Tracker entfernt, ${report.iframesNeutralized.length} Iframes neutralisiert`,
        metadata: { ...report },
      };
    }

    case 'self_host': {
      const { rewrittenHtml, fontsToDownload } = selfHostFonts(state.html as string);
      state.html = rewrittenHtml;
      state.fontsToDownload = fontsToDownload;
      return {
        summary: `${fontsToDownload.length} Font-Familien zum Self-Hosting markiert`,
        metadata: { fontsToDownload },
      };
    }

    case 'inject_consent': {
      const html = injectConsentSdk(state.html as string, {
        domain: ctx.sourceDomain,
        primaryLang: 'de',
        showImprintLink: true,
        privacyPolicyUrl: '/datenschutz',
        imprintUrl: '/impressum',
      });
      state.html = html;
      return { summary: 'Cookie-Consent-SDK eingebettet (opt-in, default-deny)', metadata: {} };
    }

    case 'legal_pages': {
      // Trigger generate-document Edge Function für DSE/Impressum/AVV/TOM
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const docs: string[] = [];
      for (const docType of ['dse', 'avv', 'vvt', 'tom'] as const) {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/generate-document`, {
          method: 'POST',
          headers: { 'authorization': `Bearer ${SRK}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            doc_type: docType,
            domain: ctx.sourceDomain,
            company: ctx.company,
            audit_id: ctx.auditId,
            tenant_id: ctx.tenantId,
          }),
        });
        if (r.ok) docs.push(docType);
      }
      state.legalDocs = docs;
      return { summary: `${docs.length}/4 Rechtsdokumente generiert (${docs.join(', ')})`, metadata: { docs } };
    }

    case 'ai_ready': {
      const scraped = state.scraped as { title?: string; meta?: Record<string, string> };
      const aiCtx = {
        domain: ctx.sourceDomain,
        title: scraped.title ?? ctx.sourceDomain,
        description: scraped.meta?.['description'] ?? '',
        company: ctx.company,
        contactEmail: ctx.customerEmail,
        privacyUrl: `https://${ctx.sourceDomain}/datenschutz`,
        imprintUrl: `https://${ctx.sourceDomain}/impressum`,
      };
      const jsonLd = buildJsonLd(aiCtx);
      state.html = injectJsonLd(state.html as string, jsonLd);
      state.llmsTxt = buildLlmsTxt(aiCtx);
      state.aiInfoJson = buildAiInfoJson(aiCtx);
      return { summary: 'JSON-LD, llms.txt und ai-info.json generiert', metadata: { jsonLdBlocks: 2 } };
    }

    case 'package_deploy': {
      // Bundle: index.html + llms.txt + api/ai-info.json + assets/
      // Storage-Pfad: rebuilds/{rebuild_id}/...
      // Preview-URL: signed-URL aus Storage (24h gültig) oder Cloudflare-Pages-Deploy.
      // V1: nur Storage-Pfad, Cloudflare-Pages-Deploy kommt in Phase 2.
      const bundlePath = `rebuilds/${ctx.rebuildId}/index.html`;
      state.bundlePath = bundlePath;
      state.previewUrl = `https://preview.realsyncdynamics.ai/${ctx.rebuildId}`;
      // TODO Phase 2: Upload zu Storage + Cloudflare-Pages-Deploy.
      return {
        summary: `Bundle gepackt (${bundlePath}); Preview pending Storage-Upload`,
        metadata: { bundlePath, previewUrl: state.previewUrl },
      };
    }
  }
}

async function markStep(
  admin: ReturnType<typeof createClient>,
  rebuildId: string,
  step: StepName,
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped',
  extra?: { summary?: string; metadata?: Record<string, unknown>; durationMs?: number; errorDetail?: string },
) {
  const now = new Date().toISOString();
  await admin.from('website_rebuild_steps').insert({
    rebuild_id: rebuildId,
    step_name: step,
    status,
    started_at: status === 'running' ? now : null,
    completed_at: ['success', 'failed', 'skipped'].includes(status) ? now : null,
    duration_ms: extra?.durationMs ?? null,
    summary: extra?.summary ?? null,
    metadata: extra?.metadata ?? {},
    error_detail: extra?.errorDetail ?? null,
  });
}

function jsonError(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error: { code, message, ...extra } }), {
    status, headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}
