// CEO-Brief Print-View Renderer.
//
// GET  /functions/v1/ceo-brief-pdf?id=<brief_uuid>
// Auth: Standard Supabase JWT (Bearer); user must have profiles.is_super_admin = true
//
// Returns: text/html document with print-friendly styling and an
// auto-trigger window.print() — user gets browser's native PDF dialog.
// Deno-Edge-Functions können kein puppeteer; HTML-Print ist sauberster
// nicht-zerbrechlicher Pfad und benötigt keine 3rd-party PDF-API.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleOptions } from '../_shared/gateway.ts';

// Abweichende CORS-Header: kein x-client-info/apikey benötigt für PDF-View
const corsHeaders = buildCorsHeaders('GET, OPTIONS');
corsHeaders['Access-Control-Allow-Headers'] = 'authorization, content-type';

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'GET') return text('GET only', 405);

  const url = new URL(req.url);
  const briefId = url.searchParams.get('id');
  if (!briefId) return text('missing ?id=', 400);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Auth: validate the user's JWT, then check is_super_admin
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return text('unauthorized', 401);
  const userClient = createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: false },
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return text('unauthorized', 401);

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });
  const { data: profile } = await admin
    .from('profiles')
    .select('is_super_admin')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (!profile?.is_super_admin) return text('forbidden — super_admin required', 403);

  // Fetch brief + linked gap
  const { data: brief, error: briefErr } = await admin
    .from('ceo_briefs')
    .select('id, title, body_md, target_profile, market_gap_id, created_at')
    .eq('id', briefId)
    .maybeSingle();
  if (briefErr || !brief) return text(`brief not found: ${briefErr?.message ?? briefId}`, 404);

  const { data: gap } = await admin
    .from('market_gaps')
    .select('industry, sector, urgency_score, revenue_potential, build_complexity, tam_estimate')
    .eq('id', brief.market_gap_id)
    .maybeSingle();

  const html = renderHtml(brief, gap);

  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
});

function text(body: string, status: number) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders, 'content-type': 'text/plain; charset=utf-8' },
  });
}

// Minimal Markdown → HTML. Handles headings, bold, lists, blank-line paragraphs.
function md2html(src: string): string {
  // Escape HTML first
  const escaped = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = escaped.split('\n');
  const out: string[] = [];
  let inList = false;
  let inPara = false;

  const closePara = () => { if (inPara) { out.push('</p>'); inPara = false; } };
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === '') { closePara(); closeList(); continue; }

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^### (.*)$/))) { closePara(); closeList(); out.push(`<h3>${inline(m[1])}</h3>`); continue; }
    if ((m = line.match(/^## (.*)$/)))  { closePara(); closeList(); out.push(`<h2>${inline(m[1])}</h2>`); continue; }
    if ((m = line.match(/^# (.*)$/)))   { closePara(); closeList(); out.push(`<h1>${inline(m[1])}</h1>`); continue; }
    if ((m = line.match(/^[-*] (.*)$/))) {
      closePara();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(m[1])}</li>`);
      continue;
    }
    closeList();
    if (!inPara) { out.push('<p>'); inPara = true; } else { out.push('<br>'); }
    out.push(inline(line));
  }
  closePara();
  closeList();
  return out.join('\n');
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

function renderHtml(
  brief: { id: string; title: string; body_md: string; target_profile: string | null; created_at: string },
  gap: { industry: string; sector: string; urgency_score: number; revenue_potential: string; build_complexity: string; tam_estimate: string | null } | null
): string {
  const date = new Date(brief.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const bodyHtml = md2html(brief.body_md);
  const safeTitle = brief.title.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${safeTitle}</title>
<style>
  @page { size: A4; margin: 22mm 18mm; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1f2b;
         font-size: 11pt; line-height: 1.55; max-width: 720px; margin: 24px auto;
         padding: 0 24px; }
  .meta { font-size: 9pt; color: #5a6470; border-bottom: 1px solid #e1e4ea;
          padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; }
  h1 { font-size: 18pt; margin: 0 0 12px; letter-spacing: -0.01em; }
  h2 { font-size: 13pt; margin: 24px 0 8px; color: #2c3340; border-left: 3px solid #1f6feb; padding-left: 10px; }
  h3 { font-size: 11pt; margin: 18px 0 6px; }
  p { margin: 0 0 10px; }
  ul { margin: 6px 0 12px 22px; padding: 0; }
  li { margin-bottom: 4px; }
  strong { color: #0d1117; }
  code { background: #f4f5f7; padding: 1px 4px; border-radius: 2px; font-size: 90%; }
  .badges { margin: 12px 0 24px; }
  .badge { display: inline-block; font-size: 9pt; padding: 2px 8px; margin-right: 6px;
           border: 1px solid #d0d4dc; color: #2c3340; background: #f6f8fa; }
  .badge.urg { background: #fff4f0; border-color: #f7c4ad; }
  .badge.rev { background: #f0f9f3; border-color: #b6d8c0; }
  .footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #e1e4ea;
            font-size: 8pt; color: #7a838e; }
  .actions { margin: 18px 0 24px; }
  .actions button { background: #1f6feb; color: white; border: none; padding: 10px 16px;
                    font-size: 11pt; cursor: pointer; }
  .actions button + button { margin-left: 8px; background: #6e7781; }
  @media print {
    .actions, .meta { display: none !important; }
    body { margin: 0; padding: 0; max-width: none; }
  }
</style>
</head>
<body>
  <div class="meta">
    <span>RealSync Dynamics · CEO Brief</span>
    <span>${date}</span>
  </div>

  <h1>${safeTitle}</h1>

  ${gap ? `<div class="badges">
    <span class="badge">${gap.industry} → ${gap.sector}</span>
    <span class="badge urg">Urgency ${gap.urgency_score}/10</span>
    <span class="badge rev">Revenue: ${gap.revenue_potential}</span>
    <span class="badge">Build: ${gap.build_complexity}</span>
    ${gap.tam_estimate ? `<span class="badge">TAM: ${gap.tam_estimate}</span>` : ''}
  </div>` : ''}

  <div class="actions">
    <button onclick="window.print()">Als PDF speichern (Drucken)</button>
    <button onclick="window.close()">Schließen</button>
  </div>

  <article>
    ${bodyHtml}
  </article>

  <div class="footer">
    Brief-ID: ${brief.id} · Generiert ${new Date().toISOString()}<br>
    Vertraulich — RealSync Dynamics interner Outreach. Nicht zur Weitergabe.
  </div>

  <script>
    // Auto-open print dialog after rendering — disable if you want to manual-trigger
    setTimeout(() => { try { window.print(); } catch(e) {} }, 500);
  </script>
</body>
</html>`;
}
