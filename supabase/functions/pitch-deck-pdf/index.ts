// Sales-Pitch-Deck Renderer.
//
// GET /functions/v1/pitch-deck-pdf?prospect=<Name>&company=<Firma>&audit_id=<uuid>
// Auth: Supabase JWT, requires profiles.is_super_admin = true
//
// Returns: print-friendly HTML 8-slide deck with auto-print trigger.
// User saves as PDF via browser dialog. Personalizable Cover via query
// params; if audit_id given we pull the prospect's score + top 3 issues
// into Slide 2 for instant pain-validation.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

interface AuditSnap {
  domain: string;
  score: number;
  severity: string;
  topIssues: Array<{ title: string; severity: string; paragraph_ref?: string }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') return text('GET only', 405);

  const url = new URL(req.url);
  const prospect = url.searchParams.get('prospect')?.slice(0, 80) ?? '';
  const company = url.searchParams.get('company')?.slice(0, 120) ?? '';
  const auditId = url.searchParams.get('audit_id');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

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

  let snap: AuditSnap | null = null;
  if (auditId) {
    const { data: audit } = await admin
      .from('gdpr_audits')
      .select('domain, score, severity, issues')
      .eq('id', auditId)
      .maybeSingle();
    if (audit) {
      const issues = (audit.issues as Array<{ title: string; severity: string; paragraph_ref?: string }>) ?? [];
      snap = {
        domain: audit.domain,
        score: audit.score,
        severity: audit.severity,
        topIssues: issues
          .filter((i) => ['critical', 'high'].includes(i.severity))
          .slice(0, 3)
          .map((i) => ({ title: i.title, severity: i.severity, paragraph_ref: i.paragraph_ref })),
      };
    }
  }

  const html = renderDeck({ prospect, company, snap });

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

function renderDeck(opts: { prospect: string; company: string; snap: AuditSnap | null }): string {
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  const audience = opts.company || opts.prospect || 'Compliance-Team';
  const safe = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const auditSlide = opts.snap
    ? `<section class="slide" data-n="2">
      <div class="num">02 / 08</div>
      <h2>Status quo bei ${safe(opts.snap.domain)}</h2>
      <div class="audit-score audit-${opts.snap.severity}">
        <div class="score">${opts.snap.score}<span>/100</span></div>
        <div class="label">${severityLabel(opts.snap.severity)}</div>
      </div>
      <ul class="issues">
        ${opts.snap.topIssues.map((i) => `<li><strong>${safe(i.title)}</strong>${i.paragraph_ref ? ` <code>${safe(i.paragraph_ref)}</code>` : ''}</li>`).join('')}
      </ul>
      <p class="footnote">Auszug aus dem automatischen DSGVO-Audit · realsyncdynamics-spec.github.io/RealSyncDynamics.AI/audit</p>
    </section>`
    : `<section class="slide" data-n="2">
      <div class="num">02 / 08</div>
      <h2>Das Risiko: 4 Gesetze, 4 Bußgeld-Stufen</h2>
      <table class="risks">
        <tr><th>DSGVO Art. 32</th><td>Stand der Technik bei AI-Verarbeitung</td><td class="bad">bis 4 % Jahresumsatz</td></tr>
        <tr><th>DSGVO Art. 28</th><td>AVV-Pflicht mit AI-Anbieter</td><td class="bad">+ Mitverantwortung</td></tr>
        <tr><th>EU AI Act</th><td>Risk-Klassifikation + Audit-Log ab 2026</td><td class="bad">bis 7 % Jahresumsatz</td></tr>
        <tr><th>§ 25 TTDSG</th><td>Cookies + Tracking nur mit Consent</td><td class="bad">bis 300 k€ pro Fall</td></tr>
      </table>
      <p class="footnote">Quellen: EuGH Schrems II · BGH Cookie II · BfDI · EDSA Guidelines 03/2022</p>
    </section>`;

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>RealSync Dynamics — Pitch Deck${opts.company ? ' für ' + safe(opts.company) : ''}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1f2b; background: #f6f8fa; }
  .slide {
    width: 297mm; height: 210mm;
    padding: 22mm 26mm 18mm;
    background: white;
    page-break-after: always;
    position: relative;
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid #e1e4ea; /* visible separator on screen, hidden in print */
  }
  .slide:last-child { page-break-after: auto; }
  .num {
    position: absolute; top: 12mm; right: 22mm;
    font-size: 9pt; color: #7a838e; font-family: ui-monospace, SFMono-Regular, monospace;
    letter-spacing: 0.08em;
  }
  .brand {
    position: absolute; bottom: 10mm; left: 22mm;
    font-size: 9pt; color: #7a838e;
  }
  .brand strong { color: #2c3340; }
  h1 { font-size: 32pt; line-height: 1.1; letter-spacing: -0.015em; margin-bottom: 14mm; max-width: 90%; }
  h2 { font-size: 22pt; line-height: 1.2; margin-bottom: 10mm; max-width: 90%; }
  h3 { font-size: 13pt; margin: 6mm 0 3mm; }
  p, li, td, th { font-size: 11pt; line-height: 1.5; }
  ul { margin-left: 20pt; margin-bottom: 6mm; }
  li { margin-bottom: 4mm; }
  .accent { color: #1f6feb; }
  .pain { color: #c53030; }
  .ok { color: #2f855a; }
  .footnote { font-size: 9pt; color: #7a838e; margin-top: auto; padding-top: 8mm; }

  /* COVER */
  .cover { background: linear-gradient(135deg, #0d1117 0%, #1a1f2b 100%); color: white; padding: 30mm 26mm; }
  .cover .num { color: #6e7781; }
  .cover h1 { color: white; font-size: 38pt; }
  .cover .sub { color: #c8ccd2; font-size: 16pt; max-width: 80%; margin-bottom: 14mm; }
  .cover .for { color: #c8ccd2; font-size: 11pt; }
  .cover .for strong { color: white; }
  .cover .badge {
    display: inline-block; padding: 4mm 8mm;
    border: 1px solid #2f855a; color: #68d391; font-size: 9pt;
    letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8mm;
  }
  .cover .brand { color: #6e7781; }
  .cover .brand strong { color: #c8ccd2; }

  /* RISIKO-TABELLE */
  table.risks { width: 100%; border-collapse: collapse; margin-top: 6mm; }
  table.risks th { text-align: left; font-weight: 700; color: #c53030; padding: 4mm 6mm 4mm 0; font-size: 11pt; vertical-align: top; width: 35mm; }
  table.risks td { padding: 4mm 6mm 4mm 0; vertical-align: top; }
  table.risks td.bad { text-align: right; color: #c53030; font-weight: 700; white-space: nowrap; }
  table.risks tr { border-bottom: 1px solid #e1e4ea; }

  /* AUDIT-SCORE */
  .audit-score {
    display: flex; align-items: center; gap: 8mm;
    padding: 8mm 12mm; margin-bottom: 8mm;
    border-left: 4mm solid;
  }
  .audit-score.audit-critical { border-color: #c53030; background: #fff5f5; }
  .audit-score.audit-high { border-color: #d69e2e; background: #fffaf0; }
  .audit-score.audit-medium { border-color: #d97706; background: #fff7ed; }
  .audit-score.audit-low { border-color: #4a5568; background: #f7fafc; }
  .audit-score.audit-pass { border-color: #2f855a; background: #f0fff4; }
  .audit-score .score { font-size: 48pt; font-weight: 700; line-height: 1; }
  .audit-score .score span { font-size: 18pt; color: #7a838e; }
  .audit-score .label { font-size: 14pt; font-weight: 700; }
  ul.issues { margin-left: 0; list-style: none; }
  ul.issues li { padding: 3mm 0; border-bottom: 1px solid #e1e4ea; }
  ul.issues code { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 9pt; color: #6e7781; margin-left: 4mm; }

  /* COLUMNS */
  .cols { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8mm; margin-top: 6mm; }
  .col {
    border-top: 3px solid #1f6feb;
    padding-top: 4mm;
  }
  .col h3 { color: #2c3340; font-size: 12pt; margin-bottom: 3mm; }
  .col p { font-size: 10.5pt; color: #4a5160; }
  .col .step { font-family: ui-monospace, SFMono-Regular, monospace; font-size: 9pt; color: #1f6feb; margin-bottom: 2mm; }

  /* COMPARE */
  table.compare { width: 100%; border-collapse: collapse; margin-top: 4mm; font-size: 10pt; }
  table.compare th, table.compare td { padding: 3mm 4mm; text-align: left; vertical-align: top; }
  table.compare thead th { background: #f6f8fa; border-bottom: 2px solid #2c3340; font-weight: 700; }
  table.compare tbody tr { border-bottom: 1px solid #e1e4ea; }
  table.compare .yes { color: #2f855a; font-weight: 700; }
  table.compare .no  { color: #c53030; font-weight: 700; }
  table.compare .partial { color: #d97706; font-weight: 700; }

  /* PRICING */
  .tiers { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; margin-top: 4mm; }
  .tier {
    border: 1px solid #d0d4dc; padding: 5mm;
  }
  .tier.hl { border: 2px solid #1f6feb; background: #f0f7ff; }
  .tier .name { font-weight: 700; font-size: 13pt; }
  .tier .price { font-size: 22pt; font-weight: 700; margin: 3mm 0; }
  .tier .tag { font-size: 9pt; color: #6e7781; }
  .tier ul { margin-left: 14pt; margin-top: 3mm; }
  .tier li { font-size: 9pt; margin-bottom: 1.5mm; line-height: 1.4; }

  /* PROCESS */
  .timeline { display: flex; gap: 5mm; margin-top: 5mm; }
  .stage {
    flex: 1; padding: 5mm; border: 1px solid #d0d4dc;
    text-align: center; position: relative;
  }
  .stage:not(:last-child)::after {
    content: '→'; position: absolute; right: -5mm; top: 50%; transform: translateY(-50%);
    color: #1f6feb; font-size: 16pt; z-index: 1;
  }
  .stage .day { font-size: 9pt; color: #1f6feb; font-weight: 700; letter-spacing: 0.06em; }
  .stage .title { font-size: 11pt; font-weight: 700; margin: 2mm 0 1mm; }
  .stage .desc { font-size: 9pt; color: #6e7781; line-height: 1.4; }

  /* CONTACT */
  .contact { padding: 8mm 0; }
  .contact .qr { display: inline-block; padding: 4mm; border: 1mm solid #1a1f2b; font-size: 8pt; }

  @media screen {
    body { padding: 10mm; }
    .slide { box-shadow: 0 4mm 12mm rgba(0,0,0,0.08); margin-bottom: 8mm; }
    .actions {
      position: fixed; top: 5mm; right: 5mm; z-index: 100;
      background: #1f6feb; color: white; padding: 3mm 6mm; cursor: pointer;
      border: none; font-size: 11pt; font-weight: 700;
    }
  }
  @media print {
    body { padding: 0; background: white; }
    .slide { box-shadow: none; margin: 0; border-bottom: none; }
    .actions { display: none !important; }
  }
</style>
</head>
<body>

<button class="actions" onclick="window.print()">Als PDF speichern (Drucken)</button>

<!-- ─── SLIDE 1: COVER ───────────────────────────────────────────── -->
<section class="slide cover" data-n="1">
  <div class="num">01 / 08</div>
  <span class="badge">EU-DSGVO · AI Act · BAIT · MaRisk</span>
  <h1>KI nutzen,<br>ohne <span class="pain">DSGVO-Bußgeld</span> zu riskieren.</h1>
  <p class="sub">Die Compliance-Schicht für AI-Workflows in regulierten Branchen — EU-Datenresidenz, lückenloser Audit-Trail, automatisierte Auskunfts-/Löschanfragen.</p>
  ${opts.prospect || opts.company ? `<p class="for">Für: <strong>${safe(audience)}</strong>${opts.prospect && opts.company ? ` · ${safe(opts.prospect)}` : ''}</p>` : ''}
  <div class="brand"><strong>RealSync Dynamics</strong> · ${today}</div>
</section>

<!-- ─── SLIDE 2: AUDIT or RISK ───────────────────────────────────── -->
${auditSlide}

<!-- ─── SLIDE 3: WAS WIR LIEFERN ─────────────────────────────────── -->
<section class="slide" data-n="3">
  <div class="num">03 / 08</div>
  <h2>Eine Plattform, drei Schichten —<br>DSGVO als Default, nicht als Add-on.</h2>
  <div class="cols">
    <div class="col">
      <div class="step">SCHICHT 01</div>
      <h3>EU-Datenresidenz pro AI-Aufruf</h3>
      <p>Pro User oder Tenant erzwingbar: cloud (Anthropic / Google / OpenAI mit AVV) oder eu_local (Ollama auf unserem EU-Server). Modus protokolliert pro Call.</p>
    </div>
    <div class="col">
      <div class="step">SCHICHT 02</div>
      <h3>Lückenloser Audit-Trail</h3>
      <p>Mitarbeiter, Modell, Tokens, Kosten, Datenresidenz — pro AI-Aufruf gespeichert. Exportierbar als CSV/PDF für Auditor + Datenschutzbeauftragten.</p>
    </div>
    <div class="col">
      <div class="step">SCHICHT 03</div>
      <h3>DSGVO-Selfservice</h3>
      <p>Auskunfts- (Art. 15) und Löschanfragen (Art. 17) als API + UI. Endkunde klickt selbst, Datenexport binnen Sekunden, Audit-Log dokumentiert.</p>
    </div>
  </div>
</section>

<!-- ─── SLIDE 4: VERGLEICH ───────────────────────────────────────── -->
<section class="slide" data-n="4">
  <div class="num">04 / 08</div>
  <h2>Compliance-Vergleich: AI-Provider direkt vs. mit RealSync</h2>
  <table class="compare">
    <thead><tr>
      <th></th>
      <th>OpenAI / Anthropic direkt</th>
      <th>RealSync Dynamics</th>
    </tr></thead>
    <tbody>
      <tr><td>EU-Datenresidenz erzwingbar</td><td class="no">✗ US-only (Schrems II)</td><td class="yes">✓ eu_local Modus</td></tr>
      <tr><td>Audit-Log pro AI-Call</td><td class="no">✗ nur Account-Logs</td><td class="yes">✓ Pro-Call: User, Modell, Tokens, Kosten</td></tr>
      <tr><td>AVV / DPA inklusive</td><td class="partial">teils, nicht DSGVO-konform</td><td class="yes">✓ deutsches Recht</td></tr>
      <tr><td>DSGVO Art. 15 / 17 als API</td><td class="no">✗</td><td class="yes">✓ Selfservice für Endkunden</td></tr>
      <tr><td>Sub-Prozessoren öffentlich</td><td class="partial">teilweise</td><td class="yes">✓ vollständig dokumentiert</td></tr>
      <tr><td>Multi-Tenant + RLS</td><td class="no">✗</td><td class="yes">✓ saubere Mandanten-Isolation</td></tr>
      <tr><td>Kosten (typische SMB-Nutzung)</td><td>nur API-Kosten + interne Compliance</td><td>API + 99-299 €/M, Compliance enthalten</td></tr>
    </tbody>
  </table>
</section>

<!-- ─── SLIDE 5: TIMELINE ────────────────────────────────────────── -->
<section class="slide" data-n="5">
  <div class="num">05 / 08</div>
  <h2>So sieht die Einführung aus — 14 Tage rechtssicher.</h2>
  <div class="timeline">
    <div class="stage"><div class="day">TAG 0</div><div class="title">Demo-Call</div><div class="desc">30 Min, eu_local-Modus + Audit-Log live an Ihren Daten</div></div>
    <div class="stage"><div class="day">TAG 1</div><div class="title">Trial-Workshop</div><div class="desc">1 h, Use-Case-Setup, Sub-Prozessoren-Liste prüfen</div></div>
    <div class="stage"><div class="day">TAG 2-13</div><div class="title">14-Tage-Trial</div><div class="desc">Echte AI-Inferenz, Ihr Team testet, AVV-Vorbereitung</div></div>
    <div class="stage"><div class="day">TAG 14</div><div class="title">Go-Live</div><div class="desc">Stripe-Checkout, AVV unterzeichnet, Audit-Log scharf</div></div>
  </div>
  <p class="footnote">Kein Lock-in · monatliche Kündigung · AVV bei Vertragsende automatisch beendet</p>
</section>

<!-- ─── SLIDE 6: PRICING ─────────────────────────────────────────── -->
<section class="slide" data-n="6">
  <div class="num">06 / 08</div>
  <h2>Transparente Preise. Kein Setup-Fee.</h2>
  <div class="tiers">
    <div class="tier">
      <div class="name">Bronze</div>
      <div class="tag">Solo · DSGVO-Basis</div>
      <div class="price">29 €<span style="font-size:10pt;color:#6e7781;">/M</span></div>
      <ul><li>EU-Datenresidenz</li><li>Audit-Log</li><li>50 AI-Calls / 100k Tokens</li><li>Selfservice 15 + 17</li></ul>
    </div>
    <div class="tier hl">
      <div class="name">Silver ★</div>
      <div class="tag">Teams · Compliance-Standard</div>
      <div class="price">99 €<span style="font-size:10pt;color:#6e7781;">/M</span></div>
      <ul><li>+ Workflow-Engine</li><li>+ AVV / DPA-Generator</li><li>250 AI-Calls</li><li>10 Team-Seats</li></ul>
    </div>
    <div class="tier">
      <div class="name">Gold</div>
      <div class="tag">Mittelstand · Audit-tauglich</div>
      <div class="price">299 €<span style="font-size:10pt;color:#6e7781;">/M</span></div>
      <ul><li>+ API + Bulk-Jobs</li><li>+ signierte Compliance-PDFs</li><li>+ Bring-Your-Own-Key</li><li>2.500 AI-Calls</li></ul>
    </div>
    <div class="tier">
      <div class="name">Enterprise</div>
      <div class="tag">Behörden · Konzerne</div>
      <div class="price" style="font-size:14pt;line-height:1.5;">Auf Anfrage</div>
      <ul><li>+ SSO / SAML</li><li>+ Org-Governance</li><li>+ Public-Sector-Modus</li><li>unlimitierte AI-Calls</li></ul>
    </div>
  </div>
  <p class="footnote">Alle Preise zzgl. USt. · monatlich kündbar · AI-Kontingent rollt nicht über</p>
</section>

<!-- ─── SLIDE 7: WAS UNS ANDERS MACHT ────────────────────────────── -->
<section class="slide" data-n="7">
  <div class="num">07 / 08</div>
  <h2>Warum nicht „selbst bauen" oder OneTrust kaufen?</h2>
  <div class="cols">
    <div class="col">
      <div class="step">SELBST BAUEN</div>
      <h3>Kostet 6-12 Monate</h3>
      <p>Audit-Log-Infrastruktur, AVV mit jedem Provider, Sub-Prozessoren-Tracking, Selfservice-Endpunkte für DSGVO Art. 15 / 17 — alles im Detail. Bei 1 FTE = 80-160 k €.</p>
    </div>
    <div class="col">
      <div class="step">ENTERPRISE-TOOL</div>
      <h3>OneTrust + Co.</h3>
      <p>Lösen DSGVO-Compliance auf Ent-Niveau (50 k+ €/Jahr Setup + Lizenz). Aber nicht für AI-Workflows. Für KMU + Mittelstand out of reach.</p>
    </div>
    <div class="col">
      <div class="step">REALSYNC</div>
      <h3>99 - 299 €/Monat</h3>
      <p>Genau die Schicht, die AI-Compliance abdeckt. Kein Setup-Fee. Monatlich kündbar. AVV inklusive. Made in Germany, gehostet in der EU.</p>
    </div>
  </div>
</section>

<!-- ─── SLIDE 8: KONTAKT ─────────────────────────────────────────── -->
<section class="slide" data-n="8">
  <div class="num">08 / 08</div>
  <h2>Nächster Schritt: 30-Minuten-Demo.</h2>
  <div class="contact">
    <p style="font-size: 14pt; margin-bottom: 5mm;">Wir zeigen den eu_local-Modus, das Audit-Log, einen Beispiel-Workflow und die DSGVO-Selfservice-API live an <strong>Ihren</strong> Daten.</p>
    <p style="font-size: 11pt;">Keine Kaltakquise · Sie entscheiden danach.</p>
  </div>
  <div style="margin-top: auto;">
    <h3>Kontakt</h3>
    <p>Dominik Seed · RealSync Dynamics<br>
       <a href="https://realsyncdynamics-spec.github.io/RealSyncDynamics.AI/contact-sales">realsyncdynamics-spec.github.io/RealSyncDynamics.AI/contact-sales</a><br>
       <a href="mailto:hi@realsyncdynamicsai.de">hi@realsyncdynamicsai.de</a>
    </p>
  </div>
  <div class="brand"><strong>RealSync Dynamics</strong> · ${today} · Made in Germany</div>
</section>

<script>setTimeout(() => { try { window.print(); } catch(e) {} }, 600);</script>
</body>
</html>`;
}

function severityLabel(s: string): string {
  switch (s) {
    case 'critical': return 'KRITISCH — sofort handeln';
    case 'high':     return 'HOCH — Risiko-Profil hoch';
    case 'medium':   return 'MITTEL — Verbesserungsbedarf';
    case 'low':      return 'NIEDRIG — solide Basis';
    case 'pass':     return 'AUDIT BESTANDEN';
    default:         return s;
  }
}
