// Generate-Document — server-side Renderer für DSGVO-Pflichtdokumente
// (DSE / AVV / VVT / TOM) basierend auf einem konkreten gdpr_audits-Run.
//
// POST /functions/v1/generate-document   (verify_jwt = false; public)
// Body: { audit_id: UUID, doc_type: 'dse'|'avv'|'vvt'|'tom', tenant_id?: UUID }
//
// Response: { ok: true, document_id, html_content, doc_type, domain }
//
// Pipeline:
//   1. Validate body
//   2. SELECT audit-row by audit_id (service-role bypasses RLS)
//   3. Render HTML-Template basierend auf dem doc_type, parametrisiert mit
//      domain / company / issues[]
//   4. INSERT into generated_documents
//   5. Return html_content damit das Frontend es im neuen Tab öffnen kann
//      (User druckt dann via Browser → PDF)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOC_TYPES = ['dse', 'avv', 'vvt', 'tom'] as const;
type DocType = typeof DOC_TYPES[number];
const METHODOLOGY_VERSION = '2026.05.0';

interface AuditIssue {
  id: string;
  severity: string;
  title: string;
  detail: string;
  paragraph_ref?: string;
}

interface AuditRow {
  id: string;
  domain: string;
  company: string | null;
  issues: AuditIssue[];
  score: number;
  severity: string;
}

const DISCLAIMER = `
  <div class="disclaimer">
    Dieses Dokument wurde automatisch generiert und durch unsere Partnerkanzlei
    geprüft. Es ersetzt keine individuelle Rechtsberatung.
  </div>
`;

function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '');
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

function todayDe(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function detectTrackers(issues: AuditIssue[]): { id: string; name: string; norm: string }[] {
  const trackers: { id: string; name: string; norm: string }[] = [];
  for (const iss of issues) {
    if (iss.id === 'GA4_WITHOUT_CONSENT')        trackers.push({ id: 'ga4',        name: 'Google Analytics 4',  norm: '§ 25 Abs. 1 TTDSG, Art. 6 Abs. 1 lit. a DSGVO' });
    if (iss.id === 'META_PIXEL_WITHOUT_CONSENT') trackers.push({ id: 'meta_pixel', name: 'Meta Pixel (Facebook)', norm: '§ 25 Abs. 1 TTDSG, Art. 6 Abs. 1 lit. a DSGVO' });
    if (iss.id === 'GOOGLE_FONTS_EMBEDDED')      trackers.push({ id: 'gfonts',     name: 'Google Fonts (extern eingebunden)', norm: 'Art. 6 Abs. 1 lit. a DSGVO, BGH 2022' });
  }
  return trackers;
}

const BASE_CSS = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 760px; margin: 32px auto; padding: 24px; color: #1a1a1f; line-height: 1.5; }
  h1 { font-size: 24px; margin: 0 0 4px; letter-spacing: -0.4px; }
  h2 { font-size: 16px; margin-top: 24px; margin-bottom: 6px; }
  h3 { font-size: 13px; margin-top: 12px; margin-bottom: 4px; color: #3a3a44; }
  p, li, td, th { font-size: 12px; color: #3a3a44; }
  .eyebrow { font-size: 9px; letter-spacing: 1.6px; text-transform: uppercase; color: #a07a2a; font-weight: 700; margin-bottom: 4px; }
  .lead { font-size: 12px; color: #3a3a44; margin-bottom: 18px; }
  .muted { color: #6a6a78; font-size: 10px; }
  .panel { background: #f5f4f0; padding: 12px; margin: 14px 0; border-left: 2px solid #a07a2a; }
  .disclaimer { background: #fdf6e3; border: 1px solid #e0c98a; padding: 10px 14px; margin: 24px 0 12px; font-size: 11px; color: #1a1a1f; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0 14px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f5f4f0; }
  ul { margin: 4px 0 8px 18px; padding: 0; }
  li { margin-bottom: 3px; }
  .checkbox { display: inline-block; width: 11px; height: 11px; border: 1px solid #6a6a78; margin-right: 6px; vertical-align: middle; }
  .checkbox.fail { border-color: #b91c1c; background: #fee2e2; }
  .footer { margin-top: 32px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 9px; color: #6a6a78; letter-spacing: 0.5px; display: flex; justify-content: space-between; }
  @media print { body { margin: 0; padding: 16mm; max-width: none; } .no-print { display: none; } }
  .print-banner { position: sticky; top: 0; background: #1a1a1f; color: #fff; padding: 10px 14px; margin: -24px -24px 18px; font-size: 12px; display: flex; justify-content: space-between; align-items: center; }
  .print-btn { background: #a07a2a; color: #fff; padding: 6px 12px; border: none; cursor: pointer; font-weight: 700; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase; }
`;

function htmlShell(title: string, body: string, audit: AuditRow): string {
  const company = escape(audit.company ?? `Verantwortliche Stelle für ${audit.domain}`);
  return html`<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${escape(title)} — ${escape(audit.domain)}</title>
<meta name="generator" content="RealSyncDynamics.AI · Methodik ${METHODOLOGY_VERSION}">
<style>${BASE_CSS}</style>
</head>
<body>
  <div class="print-banner no-print">
    <span>${escape(title)} — ${escape(audit.domain)}</span>
    <button class="print-btn" onclick="window.print()">Drucken / als PDF speichern</button>
  </div>
  <h1>${escape(title)}</h1>
  <p class="lead">${company} · ${escape(audit.domain)} · Stand ${todayDe()}</p>
  ${body}
  ${DISCLAIMER}
  <div class="footer">
    <span>Generiert von RealSyncDynamics.AI · ${todayDe()} · Methodik ${METHODOLOGY_VERSION}</span>
    <span>Audit-ID: ${escape(audit.id.slice(0, 8))}…</span>
  </div>
</body></html>`;
}

/* ────────── Templates ────────── */

function renderDSE(audit: AuditRow): string {
  const trackers = detectTrackers(audit.issues);
  const company = escape(audit.company ?? `[Verantwortliche Stelle für ${audit.domain}]`);
  const trackerSections = trackers.length === 0
    ? `<p>Beim automatischen Audit wurden keine Tracker oder externe Embeds erkannt, die einer expliziten Einwilligung bedürfen. Bei späteren Erweiterungen ist diese Erklärung anzupassen.</p>`
    : trackers.map((t) => `
        <h3>${escape(t.name)}</h3>
        <p>Diese Website setzt ${escape(t.name)} ein. Die Verarbeitung erfolgt ausschließlich auf Basis Ihrer Einwilligung gemäß § 25 Abs. 1 TTDSG i. V. m. Art. 6 Abs. 1 lit. a DSGVO. Sie können Ihre Einwilligung jederzeit über den Cookie-Banner widerrufen.</p>
        <p class="muted">Rechtsgrundlage: ${escape(t.norm)}</p>`).join('');

  const body = html`
    <div class="eyebrow">Art. 13 + 14 DSGVO</div>

    <h2>1. Verantwortlicher</h2>
    <p>Verantwortlicher i. S. d. Art. 4 Nr. 7 DSGVO ist:</p>
    <p>${company}</p>
    <p>Anschrift: [bitte ergänzen]</p>
    <p>E-Mail: [bitte ergänzen]</p>

    <h2>2. Hosting</h2>
    <p>Diese Website wird in der Europäischen Union gehostet. Mit dem Hosting-Provider besteht ein Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO.</p>

    <h2>3. Cookies und Tracking</h2>
    <p>Diese Website verwendet Cookies. Cookies, die für den Betrieb erforderlich sind, basieren auf § 25 Abs. 2 Nr. 2 TTDSG. Alle weiteren Cookies werden ausschließlich auf Basis Ihrer Einwilligung (§ 25 Abs. 1 TTDSG) gesetzt.</p>
    ${trackerSections}

    <h2>4. Ihre Rechte</h2>
    <p>Sie haben jederzeit das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Außerdem haben Sie ein Beschwerderecht bei der zuständigen Aufsichtsbehörde (Art. 77).</p>

    <h2>5. Speicherdauer</h2>
    <p>Personenbezogene Daten werden gelöscht, sobald der Zweck der Verarbeitung entfällt und keine gesetzlichen Aufbewahrungsfristen entgegenstehen.</p>
  `;
  return htmlShell('Datenschutzerklärung', body, audit);
}

function renderAVV(audit: AuditRow): string {
  const company = escape(audit.company ?? `[Verantwortliche Stelle für ${audit.domain}]`);
  const body = html`
    <div class="eyebrow">Art. 28 DSGVO</div>

    <h2>1. Vertragsparteien</h2>
    <h3>Auftraggeber (Verantwortlicher):</h3>
    <p>${company}</p>
    <p>Domain: ${escape(audit.domain)}</p>
    <p>Anschrift: [bitte ergänzen]</p>

    <h3>Auftragnehmer (Auftragsverarbeiter):</h3>
    <p>[Name + Anschrift wird ergänzt]</p>

    <h2>2. Gegenstand und Dauer</h2>
    <p>Gegenstand des Auftrags ist die Verarbeitung personenbezogener Daten im Auftrag des Auftraggebers nach Art. 28 DSGVO. Die Dauer richtet sich nach dem Hauptvertrag.</p>

    <h2>3. Art und Zweck der Verarbeitung</h2>
    <p>[Konkrete Art der Verarbeitung — z. B. Hosting, Wartung, Support, Cloud-Speicher.]</p>

    <h2>4. Art der Daten und Kategorien betroffener Personen</h2>
    <ul>
      <li>Stammdaten (Name, Anschrift, Kontaktdaten)</li>
      <li>Vertrags- und Abrechnungsdaten</li>
      <li>Nutzungsdaten / Log-Daten</li>
      <li>[konkrete Kategorien ergänzen]</li>
    </ul>
    <h3>Kategorien betroffener Personen:</h3>
    <ul><li>Kunden / Nutzer / Beschäftigte / Lieferanten [auswählen]</li></ul>

    <h2>5. Pflichten des Auftragnehmers</h2>
    <ul>
      <li>Verarbeitung ausschließlich auf dokumentierte Weisung (Art. 28 Abs. 3 lit. a)</li>
      <li>Vertraulichkeitsverpflichtung der mit der Verarbeitung befassten Personen</li>
      <li>Technisch-organisatorische Maßnahmen nach Art. 32 (siehe TOM-Anhang)</li>
      <li>Unterstützung bei Betroffenenrechten (Art. 15 ff.)</li>
      <li>Unterstützung bei Pflichten aus Art. 32–36 (Sicherheit, DSFA, Meldung)</li>
      <li>Löschung oder Rückgabe der Daten nach Vertragsende</li>
      <li>Nachweispflichten (Art. 28 Abs. 3 lit. h)</li>
    </ul>

    <h2>6. Sub-Auftragsverarbeiter</h2>
    <p>Der Auftragnehmer darf Sub-Auftragsverarbeiter nur mit vorheriger Genehmigung des Auftraggebers einsetzen. Bei einer allgemeinen Genehmigung informiert der Auftragnehmer den Auftraggeber rechtzeitig über jede Änderung.</p>

    <h2>7. Drittlandtransfer</h2>
    <p>Eine Übermittlung personenbezogener Daten in Drittländer (außerhalb EU/EWR) erfolgt nur auf Grundlage eines Angemessenheitsbeschlusses, geeigneter Garantien (z. B. Standardvertragsklauseln) oder einer Ausnahme nach Art. 49 DSGVO.</p>

    <h2>8. Haftung</h2>
    <p>Es gelten die Haftungsregelungen aus Art. 82 DSGVO sowie ergänzend die Bestimmungen des Hauptvertrages.</p>

    <h2>Unterschriften</h2>
    <table>
      <tr><th style="width:50%">Auftraggeber</th><th>Auftragnehmer</th></tr>
      <tr style="height:60px"><td>&nbsp;</td><td>&nbsp;</td></tr>
      <tr><td>Ort, Datum, Unterschrift</td><td>Ort, Datum, Unterschrift</td></tr>
    </table>
  `;
  return htmlShell('Auftragsverarbeitungsvertrag (AVV)', body, audit);
}

function renderVVT(audit: AuditRow): string {
  const trackers = detectTrackers(audit.issues);
  const trackerRows = trackers.map((t) => `
    <tr>
      <td>${escape(t.name)} (Tracking)</td>
      <td>Reichweitenmessung / Marketing</td>
      <td>Art. 6 Abs. 1 lit. a DSGVO</td>
      <td>IP, User-Agent, Cookie-IDs, Klick-Events</td>
      <td>Anbieter ${escape(t.name.split(' ')[0])} (Auftragsverarbeiter)</td>
      <td>nach Widerruf der Einwilligung</td>
    </tr>`).join('');

  const company = escape(audit.company ?? `[Verantwortliche Stelle für ${audit.domain}]`);
  const body = html`
    <div class="eyebrow">Art. 30 DSGVO</div>

    <h2>Verantwortlicher</h2>
    <p>${company} · Domain: ${escape(audit.domain)}</p>

    <h2>Verarbeitungstätigkeiten</h2>
    <table>
      <thead>
        <tr>
          <th>Bezeichnung</th>
          <th>Zweck</th>
          <th>Rechtsgrundlage</th>
          <th>Datenkategorien</th>
          <th>Empfänger</th>
          <th>Speicherdauer</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Website-Betrieb / Logfiles</td>
          <td>Bereitstellung der Website, IT-Sicherheit</td>
          <td>Art. 6 Abs. 1 lit. f DSGVO</td>
          <td>IP, User-Agent, Referer, Zeitstempel</td>
          <td>Hosting-Provider (AVV)</td>
          <td>7 Tage</td>
        </tr>
        <tr>
          <td>Kontaktformular</td>
          <td>Bearbeitung Anfragen</td>
          <td>Art. 6 Abs. 1 lit. b oder f DSGVO</td>
          <td>Name, E-Mail, Anfragetext</td>
          <td>Email-Hosting, intern</td>
          <td>Bis Abschluss + Aufbewahrungsfrist</td>
        </tr>
        <tr>
          <td>Newsletter / E-Mail-Marketing</td>
          <td>Versand redaktioneller Inhalte</td>
          <td>Art. 6 Abs. 1 lit. a DSGVO (Einwilligung, Double-Opt-In)</td>
          <td>E-Mail, Klick- / Öffnungs-Statistiken</td>
          <td>Newsletter-Provider (AVV)</td>
          <td>Bis Widerruf</td>
        </tr>
        ${trackerRows}
      </tbody>
    </table>

    <p class="muted">Hinweis: Diese Tabelle wurde aus dem Audit-Lauf
      (Audit-ID ${escape(audit.id.slice(0, 8))}…) für ${escape(audit.domain)}
      erzeugt. Weitere Verarbeitungen (Bewerbungen, Buchhaltung, Vertragsabwicklung,
      Personalverwaltung etc.) müssen ergänzt werden.</p>

    <h2>Technisch-organisatorische Maßnahmen</h2>
    <p>Eine Beschreibung der TOMs i. S. d. Art. 32 DSGVO findet sich im separaten
      TOM-Dokument.</p>
  `;
  return htmlShell('Verzeichnis der Verarbeitungstätigkeiten (VVT)', body, audit);
}

function renderTOM(audit: AuditRow): string {
  // Erkenne Sicherheitslücken aus Audit-Issues — werden als „offen" markiert
  const findingIds = new Set(audit.issues.map((i) => i.id));
  const open = (id: string) => findingIds.has(id);

  const checkbox = (failed: boolean, label: string) =>
    `<li><span class="checkbox${failed ? ' fail' : ''}"></span>${escape(label)}${failed ? ' <em class="muted">(im Audit als offen erkannt)</em>' : ''}</li>`;

  const company = escape(audit.company ?? `[Verantwortliche Stelle für ${audit.domain}]`);
  const body = html`
    <div class="eyebrow">Art. 32 DSGVO</div>

    <p>Verantwortlicher: ${company} · Domain: ${escape(audit.domain)}</p>
    <p>Die nachfolgenden Maßnahmen sichern die Vertraulichkeit, Integrität, Verfügbarkeit
      und Belastbarkeit der Verarbeitungssysteme im Sinne von Art. 32 DSGVO.</p>

    <h2>1. Vertraulichkeit (Art. 32 Abs. 1 lit. b)</h2>
    <ul>
      ${checkbox(false, 'Zutrittskontrolle: Schlüssel-/Chipkonzept, Besuchsbegleitung')}
      ${checkbox(false, 'Zugangskontrolle: Personalisierte Accounts, MFA, Passwort-Policy ≥ 12 Zeichen')}
      ${checkbox(false, 'Zugriffskontrolle: Berechtigungs-Konzept Need-to-know')}
      ${checkbox(false, 'Trennungskontrolle: Mandantentrennung, getrennte Test-/Prod-Umgebungen')}
    </ul>

    <h2>2. Integrität</h2>
    <ul>
      ${checkbox(false, 'Eingabekontrolle: Logging aller Schreibzugriffe inkl. User-ID')}
      ${checkbox(false, 'Weitergabekontrolle: TLS 1.3 in Transit, dokumentierte Schnittstellen')}
      ${checkbox(false, 'Datenträger-Verschlüsselung (LUKS / FileVault / BitLocker)')}
    </ul>

    <h2>3. Verfügbarkeit und Belastbarkeit</h2>
    <ul>
      ${checkbox(false, 'Backup-Konzept: tägliche Backups, geo-redundant, 30-Tage-Retention')}
      ${checkbox(false, 'USV / Datacenter-Redundanz (Provider-SLA)')}
      ${checkbox(false, 'Incident-Response-Plan, quartalsweise Notfall-Übung')}
    </ul>

    <h2>4. Verfahren zur regelmäßigen Überprüfung (Art. 32 Abs. 1 lit. d)</h2>
    <ul>
      ${checkbox(false, 'Datenschutz-Management-System mit jährlichem Review')}
      ${checkbox(false, 'Externe Penetrationstests mind. alle 24 Monate')}
      ${checkbox(false, 'Mitarbeiterschulungen mind. jährlich, dokumentiert')}
    </ul>

    <h2>5. Auftragskontrolle</h2>
    <ul>
      ${checkbox(open('MISSING_AVV_REFERENCE'), 'AVV mit allen Auftragsverarbeitern abgeschlossen')}
      ${checkbox(false, 'Sub-Processor-Liste aktiv geführt + öffentlich einsehbar')}
      ${checkbox(false, 'Drittland-Bewertung pro Provider dokumentiert')}
    </ul>

    <h2>6. Datenschutzfreundliche Voreinstellungen (Art. 25)</h2>
    <ul>
      ${checkbox(false, 'Privacy by Design + Privacy by Default in Produkt-Entwicklung')}
      ${checkbox(open('COOKIE_BANNER_DARK_PATTERN'), 'Cookie-Banner mit echter Wahlfreiheit (TTDSG § 25)')}
      ${checkbox(false, 'Minimal-Data-Prinzip in Formularen')}
    </ul>

    <h2>7. Meldewesen Datenschutzvorfälle (Art. 33 / 34)</h2>
    <ul>
      ${checkbox(false, '72-Stunden-Meldekette dokumentiert')}
      ${checkbox(false, 'Eskalations-Matrix Mitarbeiter → DSB → Aufsichtsbehörde')}
      ${checkbox(false, 'Vorfall-Logbuch mit Volltext-Beschreibung + Maßnahmen')}
    </ul>

    <h2>8. Schulung und Awareness</h2>
    <ul>
      ${checkbox(false, 'Onboarding-Module mit Datenschutz-Pflichteinheit')}
      ${checkbox(false, 'Phishing-Simulationen mind. quartalsweise')}
      ${checkbox(false, 'Datenschutz-Wiki / FAQ intern verfügbar')}
    </ul>

    ${audit.issues.length > 0 ? `
      <div class="panel">
        <strong>Audit-Befunde, die hier verlinkt sind:</strong>
        <ul style="margin-top:6px">
          ${audit.issues.map((i) => `<li>${escape(i.title)} <span class="muted">(${escape(i.id)})</span></li>`).join('')}
        </ul>
      </div>` : ''}
  `;
  return htmlShell('Technisch-organisatorische Maßnahmen (TOM)', body, audit);
}

function render(docType: DocType, audit: AuditRow): string {
  switch (docType) {
    case 'dse': return renderDSE(audit);
    case 'avv': return renderAVV(audit);
    case 'vvt': return renderVVT(audit);
    case 'tom': return renderTOM(audit);
  }
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST')   return jsonError(405, 'BAD_REQUEST', 'POST only');

  let body: { audit_id?: string; doc_type?: string; tenant_id?: string };
  try { body = await req.json(); }
  catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const auditId = (body.audit_id ?? '').trim();
  const docType = (body.doc_type ?? '').trim().toLowerCase() as DocType;
  const tenantId = body.tenant_id ? body.tenant_id.trim() : null;

  if (!auditId || !UUID_RE.test(auditId))                  return jsonError(400, 'INVALID_AUDIT_ID', 'audit_id must be UUID');
  if (!docType || !DOC_TYPES.includes(docType))            return jsonError(400, 'INVALID_DOC_TYPE', `doc_type must be one of ${DOC_TYPES.join(', ')}`);
  if (tenantId && !UUID_RE.test(tenantId))                 return jsonError(400, 'INVALID_TENANT_ID', 'tenant_id must be UUID');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // Audit-Row laden
  const { data: audit, error: auditErr } = await admin
    .from('gdpr_audits')
    .select('id, domain, company, issues, score, severity')
    .eq('id', auditId)
    .single();
  if (auditErr || !audit) return jsonError(404, 'AUDIT_NOT_FOUND', 'audit_id does not exist');

  const auditRow = audit as AuditRow;
  const htmlContent = render(docType, auditRow);

  // Persistieren
  const { data: doc, error: insertErr } = await admin
    .from('generated_documents')
    .insert({
      tenant_id: tenantId,
      audit_id: auditRow.id,
      doc_type: docType,
      domain: auditRow.domain,
      company: auditRow.company,
      html_content: htmlContent,
      methodology_version: METHODOLOGY_VERSION,
    })
    .select('id')
    .single();
  if (insertErr || !doc) return jsonError(500, 'INSERT_FAILED', insertErr?.message ?? 'insert failed');

  return jsonResponse({
    ok: true,
    document_id: doc.id,
    doc_type: docType,
    domain: auditRow.domain,
    html_content: htmlContent,
    methodology_version: METHODOLOGY_VERSION,
  });
});
