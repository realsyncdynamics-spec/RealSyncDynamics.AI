// POST /functions/v1/shopify-scan
// Body: { shop: "<store>.myshopify.com" }
//
// 1) lookup shop, return 401 if not installed
// 2) insert scan_run status=running
// 3) execute runShopifyStorefrontScan
// 4) write result back + previous-vs-current drift events
// 5) return JSON

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { normalizeShopDomain } from '../_shared/shopify-oauth.ts';
import { runShopifyStorefrontScan } from '../_shared/shopify-scanner.ts';
import { compareShopifyScans } from '../_shared/shopify-drift.ts';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: { code: 'BAD_REQUEST', message: 'POST only' } }, 405);

  let body: { shop?: string };
  try { body = await req.json(); } catch { return jsonResponse({ ok: false, error: { code: 'BAD_REQUEST', message: 'invalid json' } }, 400); }

  const shop = normalizeShopDomain(body.shop ?? '');
  if (!shop) return jsonResponse({ ok: false, error: { code: 'BAD_REQUEST', message: 'invalid shop' } }, 400);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  const { data: shopRow } = await admin.from('shopify_shops')
    .select('*').eq('shop_domain', shop).eq('status', 'installed').maybeSingle();
  if (!shopRow) {
    return jsonResponse({
      ok: false,
      error: { code: 'SHOP_NOT_INSTALLED', message: 'Shop ist nicht (mehr) installiert.' },
      cta: { label: 'Shopify Store verbinden', href: `/functions/v1/shopify-install?shop=${encodeURIComponent(shop)}` },
    }, 401);
  }

  // Insert run
  const { data: run, error: runErr } = await admin.from('shopify_scan_runs').insert({
    shop_id: shopRow.id,
    status: 'running',
    started_at: new Date().toISOString(),
  }).select('*').single();
  if (runErr) return jsonResponse({ ok: false, error: { code: 'DB', message: runErr.message } }, 500);

  // Previous scan for drift
  const { data: prev } = await admin.from('shopify_scan_runs')
    .select('*').eq('shop_id', shopRow.id).eq('status', 'completed')
    .order('completed_at', { ascending: false }).limit(1).maybeSingle();

  try {
    const result = await runShopifyStorefrontScan({ shopDomain: shop });
    await admin.from('shopify_scan_runs').update({
      status: 'completed',
      score: result.score,
      summary: result.summary,
      findings: result.findings,
      evidence: result.evidence,
      completed_at: new Date().toISOString(),
    }).eq('id', run.id);

    await admin.from('shopify_shops').update({ last_scan_at: new Date().toISOString() }).eq('id', shopRow.id);

    // Drift events
    if (prev) {
      const drifts = compareShopifyScans({
        score: prev.score ?? 0,
        summary: prev.summary ?? '',
        findings: prev.findings ?? [],
        evidence: prev.evidence ?? { scannedUrls: [], headers: {}, detectedVendors: [], consentSignals: [] },
      }, result);
      if (drifts.length > 0) {
        await admin.from('shopify_drift_events').insert(
          drifts.map((d) => ({
            shop_id: shopRow.id,
            scan_run_id: run.id,
            type: d.type,
            severity: d.severity,
            title: d.title,
            description: d.description,
            evidence: d.evidence,
          })),
        );
      }
    }

    return jsonResponse({ ok: true, scan_run_id: run.id, result });
  } catch (e) {
    await admin.from('shopify_scan_runs').update({
      status: 'failed',
      error_message: (e as Error).message,
      completed_at: new Date().toISOString(),
    }).eq('id', run.id);
    return jsonResponse({ ok: false, error: { code: 'SCAN_FAILED', message: (e as Error).message } }, 500);
  }
});

