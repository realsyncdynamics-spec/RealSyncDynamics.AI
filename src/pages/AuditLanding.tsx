import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, AlertTriangle, CheckCircle2, Loader2, Send,
  Globe, Mail, Building2, Gavel, ArrowRight, Linkedin, Share2, FileText,
} from 'lucide-react';

import { getAffiliateRef } from '../lib/affiliate';
import { LegalDisclaimer } from '../components/LegalDisclaimer';
import { AuditToWebsiteNote } from '../components/AuditToWebsiteNote';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'pass';

interface Issue {
  id: string;
  severity: Exclude<Severity, 'pass'>;
  title: string;
  detail: string;
  paragraph_ref?: string;
}

interface Report {
  audit_id: string;
  domain: string;
  score: number;
  severity: Severity;
  issues: Issue[];
  fetched: boolean;
  fetched_status: number | null;
  fetch_error: string | null;
}

export function AuditLanding() {
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setReport(null);
    try {
      const normalizedUrl = url.trim().match(/^https?:\/\//i) ? url.trim() : `https://${url.trim()}`;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/gdpr-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: normalizedUrl,
          email: email.trim(),
          company: company.trim() || undefined,
          referral_code: getAffiliateRef() || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error?.message ?? `HTTP ${resp.status}`);
      setReport(data as Report);
      if (data.audit_id) {
        // Fire-and-forget: triggers Resend-email if RESEND_API_KEY is configured.
        // Failures are intentionally swallowed — report is already shown in-browser.
        fetch(`${SUPABASE_URL}/functions/v1/audit-report-email?id=${data.audit_id}`, {
          method: 'GET',
          keepalive: true,
        }).catch(() => { /* non-blocking */ });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <Header />

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">

          {!report && (
            <>
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 border border-titanium-700 bg-obsidian-900 text-titanium-200 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
                  <ShieldCheck className="h-3 w-3" /> Kostenlos · Kein Account · 30 Sekunden
                </div>
                <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
                  Wo verstößt Deine Website gegen die DSGVO?
                </h1>
                <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed mb-4">
                  Wir scannen Deine Site auf 12 typische Compliance-Fallen — von Tracking-ohne-Consent bis Cookie-Banner-Dark-Pattern.
                  Du bekommst sofort einen Score und eine konkrete Fix-Liste.
                </p>
                <AuditMethodologyTags />
                <div className="max-w-xl mx-auto text-left mt-4">
                  <LegalDisclaimer context="audit" />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3 mb-4">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="bg-obsidian-900 border border-titanium-900 p-6 sm:p-8 rounded-none space-y-4">
                <Field label="Deine Website-URL" icon={<Globe className="h-3.5 w-3.5" />} required>
                  <input
                    type="text" required value={url} onChange={(e) => setUrl(e.target.value)}
                    placeholder="kanzlei-mueller.de"
                    className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-titanium-100"
                  />
                </Field>

                <Field label="E-Mail (für Report-Zustellung)" icon={<Mail className="h-3.5 w-3.5" />} required>
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="dein@kanzlei.de" autoComplete="email"
                    className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-titanium-100"
                  />
                </Field>

                <Field label="Kanzlei / Firma (optional)" icon={<Building2 className="h-3.5 w-3.5" />}>
                  <input
                    type="text" value={company} onChange={(e) => setCompany(e.target.value)}
                    placeholder="Kanzlei Müller & Partner"
                    className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-titanium-100"
                  />
                </Field>

                <button
                  type="submit" disabled={loading || !url || !email}
                  className="surface-mono w-full inline-flex items-center justify-center gap-2 px-6 py-3 disabled:opacity-40 font-bold rounded-none"
                >
                  {loading
                    ? (<><Loader2 className="h-4 w-4 animate-spin" /> Audit läuft …</>)
                    : (<><Send className="h-4 w-4" /> Jetzt prüfen</>)}
                </button>

                <p className="text-[11px] text-titanium-500 text-center pt-1">
                  Wir scannen Deine Site nur einmalig und speichern keine Inhalte. Email landet in unserem CRM für späteren Outreach.
                  Verarbeitung gemäß <Link to="/legal/privacy" className="text-titanium-100 hover:underline">Datenschutzerklärung</Link>.
                </p>
              </form>

              <Pillars />
              <AuditToWebsiteNote source="audit-pre" />
            </>
          )}

          {report && <ReportView report={report} onRetry={() => setReport(null)} />}
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────

function AuditMethodologyTags() {
  const [trackerDb, setTrackerDb] = React.useState<{ version: string; updated_at: string; sources: string[] } | null>(null);
  React.useEffect(() => {
    fetch('/tracker-db-version.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setTrackerDb(data))
      .catch(() => null);
  }, []);
  return (
    <div className="inline-flex flex-wrap items-center justify-center gap-2 text-[10px] text-titanium-500 font-mono">
      <span className="px-2 py-0.5 border border-titanium-800 bg-obsidian-900 rounded-none">
        audit-engine: 2026.05.0
      </span>
      <span
        className="px-2 py-0.5 border border-titanium-800 bg-obsidian-900 rounded-none"
        title={trackerDb ? `Aktualisiert ${trackerDb.updated_at} · ${trackerDb.sources.join(' + ')}` : ''}
      >
        tracker-db: {trackerDb ? `${trackerDb.version} (${trackerDb.updated_at})` : '2026.05.0'}
      </span>
      <Link to="/legal/methodology" className="text-titanium-400 hover:text-titanium-200 underline">
        Methodik
      </Link>
      <Link to="/grenzen" className="text-titanium-400 hover:text-titanium-200 underline">
        Grenzen
      </Link>
    </div>
  );
}

function Header() {
  return (
    <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
      <Link to="/" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
        <ArrowLeft className="h-4 w-4" />
      </Link>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-none bg-obsidian-950 border border-titanium-700 flex items-center justify-center">
          <ShieldCheck className="h-4 w-4 text-titanium-100" />
        </div>
        <div className="leading-tight">
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">DSGVO-Audit</div>
          <div className="text-[11px] text-titanium-400 font-medium">Kostenlos · 30 Sek.</div>
        </div>
      </div>
    </header>
  );
}

// ─── Pillars (Trust elements unten auf der Form) ─────────────────────────

function Pillars() {
  const items = [
    { law: 'DSGVO Art. 6 Abs. 1', issue: 'Tracker ohne Consent', max: '4 % Jahresumsatz' },
    { law: 'DSGVO Art. 13', issue: 'Fehlende Datenschutzerklärung', max: 'Aufsichts-Reklamation' },
    { law: '§ 25 TTDSG', issue: 'Cookies vor Consent', max: 'bis 300 k€ pro Fall' },
    { law: '§ 5 TMG', issue: 'Fehlendes Impressum', max: 'Abmahnung 1.500 €+' },
  ];
  return (
    <div className="mt-12">
      <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-4 text-center">Was wir prüfen</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((it) => (
          <div key={it.law} className="p-4 bg-obsidian-900 border border-titanium-800 border-l-2 border-l-titanium-500 rounded-none">
            <div className="flex items-center gap-2 mb-1.5">
              <Gavel className="h-3.5 w-3.5 text-titanium-300" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-titanium-300">{it.law}</span>
            </div>
            <div className="font-display font-bold text-sm text-titanium-50">{it.issue}</div>
            <div className="text-xs text-titanium-500 mt-0.5">Risiko: {it.max}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Report ───────────────────────────────────────────────────────────────

function ReportView({ report, onRetry }: { report: Report; onRetry: () => void }) {
  const config = severityConfig(report.severity);
  return (
    <div className="space-y-6">
      <div className={`p-6 sm:p-8 ${config.bg} border ${config.border} rounded-none`}>
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <div className="text-xs text-titanium-400 mb-1">{report.domain}</div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-titanium-50">DSGVO-Audit · {config.label}</h1>
          </div>
          <div className={`text-5xl sm:text-6xl font-display font-bold tabular-nums ${config.color}`}>
            {report.score}
            <span className="text-base text-titanium-500"> / 100</span>
          </div>
        </div>
        <p className={`text-sm ${config.color} mt-3 leading-relaxed`}>
          {config.summary(report.issues.length)}
        </p>
      </div>

      <div>
        <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-3">
          {report.issues.length} {report.issues.length === 1 ? 'Befund' : 'Befunde'}
        </h2>
        {report.issues.length === 0
          ? (
            <div className="p-5 bg-obsidian-900 border border-titanium-700 rounded-none flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-titanium-100 mt-0.5 shrink-0" />
              <div>
                <div className="font-display font-bold text-titanium-50 mb-0.5">Saubere Site!</div>
                <div className="text-sm text-titanium-300">
                  Keiner unserer 12 Standard-Checks hat angeschlagen. Glückwunsch — das ist seltener als Du denkst.
                </div>
              </div>
            </div>
          )
          : (
            <ul className="space-y-3">
              {report.issues.map((iss) => <IssueCard key={iss.id} issue={iss} />)}
            </ul>
          )}
      </div>

      <NextStepBlock report={report} />

      <DocumentGeneratorBlock auditId={report.audit_id} domain={report.domain} />

      <div className="bg-obsidian-900 border border-titanium-700 p-6 rounded-none">
        <h3 className="font-display font-bold text-titanium-50 text-lg mb-2">So fixen wir das für Dich</h3>
        <p className="text-sm text-titanium-300 mb-4 leading-relaxed">
          RealSync Dynamics liefert die fehlenden DSGVO-Bausteine als SaaS — EU-Datenresidenz, Audit-Log, AVV/DPA-Generator,
          DSGVO-Selfservice. <strong className="text-titanium-50">In 14 Tagen rechtssicher</strong>, nicht in 6 Monaten.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            to={`/contact-sales?source=audit_lp&audit=${report.audit_id}`}
            className="surface-mono inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-none"
          >
            Demo buchen <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-titanium-200 text-titanium-200 text-sm font-bold rounded-none"
          >
            Preise ansehen
          </Link>
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-titanium-400 hover:text-titanium-200 text-sm rounded-none"
          >
            Andere URL prüfen
          </button>
        </div>
      </div>

      <div className="bg-obsidian-900 border border-titanium-800 p-5 sm:p-6 rounded-none">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-none bg-obsidian-950 border border-titanium-700 flex items-center justify-center mt-0.5">
            <Globe className="h-5 w-5 text-titanium-100" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-titanium-400 font-bold mb-1">Alternative · Komplett-Service</div>
            <h3 className="font-display font-bold text-titanium-50 text-lg mb-1">Lieber kein Tool, sondern jemand der's macht?</h3>
            <p className="text-sm text-titanium-300 mb-4 leading-relaxed">
              Audit · Rebuild · Managed-Hosting im Paket. Wir bauen Ihre Site nach aktuellen DSGVO-, TTDSG- und AI-Act-Anforderungen neu auf und betreiben sie monatlich — keine Selbst-Pflege, kein Tool-Stack.
              <strong className="text-titanium-50"> Ab 99 €/Monat</strong> nach einmaligem Rebuild.
            </p>
            <Link
              to={`/dsgvo-website?source=audit&audit=${report.audit_id}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-obsidian-950 border border-titanium-700 hover:border-titanium-200 text-titanium-100 text-xs font-bold rounded-none"
            >
              3-Paket-Angebot ansehen <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <ShareBlock report={report} />
    </div>
  );
}

function ShareBlock({ report }: { report: Report }) {
  const shareUrl = `${window.location.origin}${import.meta.env.BASE_URL}audit/share/${report.audit_id}`.replace(/\/+/g, '/').replace(':/', '://');
  const shareText = report.score >= 80
    ? `Meine Website hat ${report.score}/100 im DSGVO-Audit von RealSyncDynamics.AI erreicht. Hier ist der Report:`
    : `${report.issues.length} DSGVO-Schwachstellen auf meiner Website (Score ${report.score}/100). Vollständiger Report:`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const copyLink = () => {
    navigator.clipboard?.writeText(`${shareText} ${shareUrl}`).catch(() => {});
  };
  return (
    <div className="bg-obsidian-900 border border-titanium-800 p-5 rounded-none">
      <div className="flex items-start gap-3 mb-3">
        <Share2 className="h-4 w-4 text-titanium-400 mt-1" />
        <div>
          <div className="font-display font-bold text-titanium-100 text-sm">Score teilen</div>
          <div className="text-xs text-titanium-500 mt-0.5">
            DSGVO-Awareness verbreiten — keine personenbezogenen Daten werden übermittelt.
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={linkedInUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0A66C2] hover:bg-[#004182] text-white text-xs font-semibold rounded-none"
        >
          <Linkedin className="h-3.5 w-3.5" /> LinkedIn
        </a>
        <a
          href={xUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-obsidian-950 border border-titanium-700 hover:border-titanium-500 text-titanium-200 text-xs font-semibold rounded-none"
        >
          X / Twitter
        </a>
        <button
          onClick={copyLink}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-obsidian-950 border border-titanium-700 hover:border-titanium-500 text-titanium-200 text-xs font-semibold rounded-none"
        >
          Link kopieren
        </button>
      </div>
    </div>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  // Mono-Enterprise: nur `critical` rot, restliche Severities via
  // Helligkeit und Border-Stärke differenziert (kein Bling-Bling).
  const sevColor: Record<Issue['severity'], string> = {
    critical: 'text-red-300 border-red-900 bg-red-950/30',
    high:     'text-titanium-50 border-titanium-600 bg-obsidian-900',
    medium:   'text-titanium-100 border-titanium-700 bg-obsidian-900',
    low:      'text-titanium-300 border-titanium-800 bg-obsidian-900',
    info:     'text-titanium-200 border-titanium-800 bg-obsidian-900',
  };
  const sevLabel: Record<Issue['severity'], string> = {
    critical: 'KRITISCH',
    high:     'HOCH',
    medium:   'MITTEL',
    low:      'NIEDRIG',
    info:     'INFO',
  };
  return (
    <li className={`p-4 border ${sevColor[issue.severity]} rounded-none`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`text-[10px] font-bold uppercase tracking-wider`}>
          {sevLabel[issue.severity]}
        </span>
        {issue.paragraph_ref && (
          <span className="text-[10px] text-titanium-500 font-mono">{issue.paragraph_ref}</span>
        )}
      </div>
      <div className="font-display font-bold text-titanium-50 mb-1">{issue.title}</div>
      <div className="text-sm text-titanium-300 leading-relaxed">{issue.detail}</div>
    </li>
  );
}

function severityConfig(s: Severity): {
  label: string;
  bg: string;
  border: string;
  color: string;
  summary: (n: number) => string;
} {
  // Mono-Enterprise: nur `critical` nutzt rot als einziges Warnsignal,
  // alle anderen Severities werden über Helligkeit + Text differenziert.
  switch (s) {
    case 'critical': return { label: 'Kritisch — handeln', bg: 'bg-red-950/30', border: 'border-red-900', color: 'text-red-300',
      summary: (n) => `${n} Befunde, davon mindestens einer mit Bußgeld-Risiko bis 4 % Jahresumsatz. Hier brauchst Du eine Lösung — bevor Dich ein Mitbewerber abmahnt oder Dein DSB blockt.` };
    case 'high':     return { label: 'Hohe Priorität', bg: 'bg-obsidian-900', border: 'border-titanium-700', color: 'text-titanium-50',
      summary: (n) => `${n} Befunde mit hohem Risiko-Profil. Schnell adressieren — bevor erste Beschwerden bei der Aufsicht eingehen.` };
    case 'medium':   return { label: 'Verbesserungsbedarf', bg: 'bg-obsidian-900', border: 'border-titanium-800', color: 'text-titanium-100',
      summary: (n) => `${n} Befunde mittlerer Severity. Kein akutes Bußgeld-Risiko, aber rechtssicher ist anders.` };
    case 'low':      return { label: 'Solide Basis', bg: 'bg-obsidian-900', border: 'border-titanium-900', color: 'text-titanium-200',
      summary: (n) => `${n} kleinere Findings. Best-Practice-Verbesserungen.` };
    case 'pass':     return { label: 'Audit bestanden', bg: 'bg-obsidian-900', border: 'border-titanium-700', color: 'text-titanium-50',
      summary: () => 'Keiner unserer Checks hat angeschlagen. Sehr selten — Glückwunsch.' };
    default:         return { label: 'Audit-Ergebnis', bg: 'bg-obsidian-900', border: 'border-titanium-900', color: 'text-titanium-200',
      summary: () => '' };
  }
}

// ─── Form-Field-Helper ───────────────────────────────────────────────────

function Field({ label, icon, required, children }: { label: string; icon?: React.ReactNode; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-titanium-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        {icon}{label}{required && <span className="text-red-400">*</span>}
      </span>
      {children}
    </label>
  );
}

// ─── DocumentGeneratorBlock ──────────────────────────────────────────────
//
// Nach dem Audit-Lauf können User pro Dokument-Typ ein HTML-Dokument
// generieren das auf den konkreten Audit-Findings basiert. Der Edge-
// Function-Endpoint /functions/v1/generate-document persistiert es in
// public.generated_documents und liefert html_content zurück, das wir in
// einem neuen Tab öffnen damit der User via Browser-Druck → PDF speichern
// kann.

const DOC_TYPES_UI: Array<{ id: 'dse' | 'avv' | 'vvt' | 'tom'; name: string; norm: string; hint: string }> = [
  { id: 'dse', name: 'Datenschutzerklärung',          norm: 'Art. 13/14 DSGVO', hint: 'Tracker-Erkennung aus dem Audit fließt automatisch ein.' },
  { id: 'avv', name: 'Auftragsverarbeitungsvertrag',  norm: 'Art. 28 DSGVO',    hint: 'Standard-Klauseln, Auftragnehmer-Felder beim Druck ergänzen.' },
  { id: 'vvt', name: 'Verzeichnis Verarbeitungstätigkeiten', norm: 'Art. 30 DSGVO', hint: 'Tabellarisch — Logfiles, Kontaktformular, Newsletter + erkannte Tracker.' },
  { id: 'tom', name: 'Technisch-organisatorische Maßnahmen', norm: 'Art. 32 DSGVO', hint: 'Audit-Befunde mit roter Checkbox markiert.' },
];

/**
 * Risk-tiered next-step CTAs. Neutral copy, no panic / "Bußgeld droht"
 * language. High-risk audits get fix-call + fix-package + monitoring;
 * low-risk audits get audit-pro + monitoring. The disclaimer line is
 * shown unconditionally.
 */
function NextStepBlock({ report }: { report: Report }) {
  const highRisk = report.severity === 'critical' || report.severity === 'high' || report.score < 60;
  const ctas = highRisk
    ? [
        { label: 'Fix-Call buchen',     to: `/contact-sales?intent=fix-call&source=audit_report&audit=${report.audit_id}` },
        { label: 'Fix-Paket anfragen',  to: `/fix-paket?source=audit_report&audit=${report.audit_id}` },
        { label: 'Monitoring anfragen', to: `/contact-sales?intent=monitoring&source=audit_report&audit=${report.audit_id}` },
      ]
    : [
        { label: 'Audit Pro anfragen',  to: `/contact-sales?intent=audit-pro&source=audit_report&audit=${report.audit_id}` },
        { label: 'Monitoring aktivieren', to: `/contact-sales?intent=monitoring&source=audit_report&audit=${report.audit_id}` },
      ];
  return (
    <div className="bg-obsidian-900 border border-titanium-800 p-6 rounded-none">
      <div className="text-[10px] uppercase tracking-wider text-titanium-400 font-bold mb-1">
        Nächster Schritt · {highRisk ? 'priorisierte Umsetzung' : 'optionale Vertiefung'}
      </div>
      <h3 className="font-display font-bold text-titanium-50 text-lg mb-2">
        Nächster sinnvoller Schritt
      </h3>
      <p className="text-sm text-titanium-300 mb-4 leading-relaxed">
        Die technische Auswertung zeigt mögliche Risiken, die priorisiert geprüft und umgesetzt werden sollten.
      </p>
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-4">
        {ctas.map((c, i) => (
          <Link
            key={c.to}
            to={c.to}
            className={
              i === 0
                ? 'surface-mono inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-none'
                : 'inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-titanium-200 text-titanium-200 text-sm font-bold rounded-none'
            }
          >
            {c.label} <ArrowRight className="h-4 w-4" />
          </Link>
        ))}
      </div>
      <p className="text-[11px] text-titanium-500 leading-relaxed">
        Der Audit ersetzt keine individuelle Rechtsberatung und keine vollständige technische Prüfung.
      </p>
    </div>
  );
}

function DocumentGeneratorBlock({ auditId, domain }: { auditId: string; domain: string }) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [generated, setGenerated] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(docType: 'dse' | 'avv' | 'vvt' | 'tom') {
    setError(null);
    setGenerating(docType);
    try {
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audit_id: auditId, doc_type: docType }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setError(data?.error?.message ?? `HTTP ${resp.status}`);
        return;
      }
      // Open generated HTML in new tab — user nutzt Browser-Print für PDF
      const blob = new Blob([data.html_content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      // URL.revokeObjectURL nach kurzem Delay damit Tab geladen ist
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setGenerated((prev) => new Set(prev).add(docType));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="bg-obsidian-900 border border-titanium-700 p-6 rounded-none">
      <div className="flex items-start gap-3 mb-4">
        <FileText className="h-5 w-5 text-titanium-100 shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-display font-bold text-titanium-50 text-lg mb-1">
            DSGVO-Dokumente aus diesem Audit generieren
          </h3>
          <p className="text-sm text-titanium-300 leading-relaxed">
            Auf Basis der Befunde für <strong className="text-titanium-50">{domain}</strong> erzeugen
            wir vier Dokumente — automatisch befüllt mit den erkannten Trackern und Schwachstellen.
            Sie öffnen sich in einem neuen Tab und können via Browser-Druck als PDF gespeichert werden.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3 mb-4">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {DOC_TYPES_UI.map((doc) => {
          const isGen = generating === doc.id;
          const isDone = generated.has(doc.id);
          return (
            <button
              key={doc.id}
              type="button"
              onClick={() => handleGenerate(doc.id)}
              disabled={isGen || (generating !== null && generating !== doc.id)}
              className={`text-left p-4 border rounded-none transition-colors ${
                isDone
                  ? 'border-titanium-200 bg-obsidian-950'
                  : 'border-titanium-700 hover:border-titanium-200 bg-obsidian-950'
              } disabled:opacity-50`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <div className="font-display font-bold text-titanium-50 text-sm">{doc.name}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-400">{doc.norm}</div>
                </div>
                {isGen
                  ? <Loader2 className="h-4 w-4 text-titanium-100 animate-spin shrink-0 mt-0.5" />
                  : isDone
                    ? <CheckCircle2 className="h-4 w-4 text-titanium-100 shrink-0 mt-0.5" />
                    : <FileText className="h-4 w-4 text-titanium-400 shrink-0 mt-0.5" />}
              </div>
              <p className="text-xs text-titanium-400 leading-snug">{doc.hint}</p>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-titanium-500 mt-4 leading-relaxed">
        Dieses Dokument wurde automatisch generiert und durch unsere Partnerkanzlei geprüft.
        Es ersetzt keine individuelle Rechtsberatung.
      </p>
    </div>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-titanium-900 bg-obsidian-950 px-4 sm:px-6 py-8">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-titanium-500">
        <div>© 2026 RealSync Dynamics · Made in Germany</div>
        <div className="flex flex-wrap gap-4">
          <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
          <Link to="/legal/sub-processors" className="hover:text-titanium-300">Sub-Prozessoren</Link>
          <Link to="/" className="hover:text-titanium-300">Plattform</Link>
        </div>
      </div>
    </footer>
  );
}
