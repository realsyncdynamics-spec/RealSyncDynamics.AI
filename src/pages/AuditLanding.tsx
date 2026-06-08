import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShieldCheck, AlertTriangle, CheckCircle2, Loader2, Send,
  Globe, Mail, Building2, Gavel, ArrowRight, Linkedin, Share2, FileText,
  Activity, MessageSquare, Sparkles,
} from 'lucide-react';

import { getAffiliateRef } from '../lib/affiliate';
import { trackUpgradeClick } from '../lib/trackUpgradeClick';
import { trackConversion } from '../lib/pixels';
import { usePageMeta } from '../lib/usePageMeta';
import { LegalDisclaimer } from '../components/LegalDisclaimer';
import { ReportPreviewSection } from '../components/sections/ReportPreviewSection';
import { AuditChatHero } from '../components/audit/AuditChatHero';
import { AuditCopilotPanel } from '../components/audit/AuditCopilotPanel';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'pass';

interface Issue {
  id: string;
  severity: Exclude<Severity, 'pass'>;
  title: string;
  detail: string;
  paragraph_ref?: string;
    /** Evidence-Metadaten — vom Backend oder Mock-Fallback (Phase Evidence-Layer) */
    evidence?: {
          rule_id: string;
          rule_version: string;
          detected_at: string;
          source_url: string;
          evidence_type: 'dom' | 'network' | 'header' | 'cookie' | 'redirect';
          selector?: string;
          request_url?: string;
          sha256: string;
          confidence: number;
          scanner_engine: string;
    };
    /** Fix-Snippets vom Backend oder aus LiveFindingsSection-Definitionen */
    fix_snippets?: Array<{
          label: string;
          language: string;
          code: string;
    }>;
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
  usePageMeta({
    title: 'Kostenloser DSGVO-Audit — Tracking-, Consent- und Compliance-Check',
    description:
      'Technische Vorprüfung für Websites: Consent, Tracking, Drittanbieter-Skripte und mögliche DSGVO-/TTDSG-Risiken analysieren.',
    url: 'https://RealSyncDynamicsAI.de/audit',
  });
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [classicForm, setClassicForm] = useState(false);
  const [chatGen, setChatGen] = useState(0);

  function resetForNewScan() {
    setReport(null);
    setChatGen((n) => n + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setReport(null);
    try {
      const normalizedUrl = url.trim().match(/^https?:\/\//i) ? url.trim() : `https://${url.trim()}`;
      const params = new URLSearchParams(window.location.search);
      const plan = params.get('plan')?.trim().slice(0, 40) || undefined;
      const source = params.get('source')?.trim().slice(0, 200) || undefined;
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/gdpr-audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: normalizedUrl,
          email: email.trim(),
          company: company.trim() || undefined,
          referral_code: getAffiliateRef() || undefined,
          plan,
          source,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error?.message ?? `HTTP ${resp.status}`);
      setReport(data as Report);
      trackConversion('Lead', { content_name: 'dsgvo_audit' });
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
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-titanium-700 bg-obsidian-900 text-titanium-200 text-xs font-bold uppercase tracking-wider rounded-none mb-5">
                <ShieldCheck className="h-3 w-3" /> Kostenlos · Kein Account · 30 Sekunden
              </div>
              <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
                Kostenloser DSGVO- und Tracking-Audit
              </h1>
              <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed mb-4">
                Der Free Audit ist Dein Einstieg in unsere Compliance-Plattform: 12 typische Compliance-Fallen
                geprüft — von Tracking-ohne-Consent bis Cookie-Banner-Dark-Pattern. Score und Fix-Liste sofort,
                Continuous Monitoring optional ab Starter.
              </p>
              <AuditMethodologyTags />
              <div className="max-w-xl mx-auto text-left mt-4">
                <LegalDisclaimer context="audit" />
              </div>
            </div>
          )}

          {error && !report && (
            <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3 mb-4">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}

          {/* Chat hero stays mounted across the scan transition so the in-chat
              summary bubble (with #report CTA) remains visible. The full
              ReportView renders below it once the scan completes. */}
          {!classicForm && (
            <>
              <AuditChatHero
                key={chatGen}
                onScanComplete={(r) => {
                  setReport(r);
                  trackConversion('Lead', { content_name: 'dsgvo_audit' });
                }}
              />
              {!report && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => setClassicForm(true)}
                    className="text-xs text-titanium-400 hover:text-titanium-200 underline transition-colors"
                  >
                    Lieber das klassische Formular?
                  </button>
                </div>
              )}
            </>
          )}

          {classicForm && !report && (
            <>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[11px] text-titanium-500 font-mono uppercase tracking-wider">Klassisches Formular</span>
                    <button
                      type="button"
                      onClick={() => setClassicForm(false)}
                      className="inline-flex items-center gap-1.5 text-xs text-titanium-400 hover:text-titanium-200 underline transition-colors"
                    >
                      <MessageSquare className="h-3 w-3" /> Zum Chat
                    </button>
                  </div>
                  <form onSubmit={handleSubmit} className="bg-obsidian-900 border border-titanium-900 p-6 sm:p-8 rounded-none space-y-4">
                <Field label="Deine Website-URL" icon={<Globe className="h-3.5 w-3.5" />} required>
                  <input
                    type="text" required value={url} onChange={(e) => setUrl(e.target.value)}
                    placeholder="kanzlei-mueller.de"
                    className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-base sm:text-sm rounded-none outline-none focus:border-titanium-100"
                  />
                </Field>

                <Field label="E-Mail (für Report-Zustellung)" icon={<Mail className="h-3.5 w-3.5" />} required>
                  <input
                    type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="dein@kanzlei.de" autoComplete="email"
                    className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-base sm:text-sm rounded-none outline-none focus:border-titanium-100"
                  />
                </Field>

                <Field label="Kanzlei / Firma (optional)" icon={<Building2 className="h-3.5 w-3.5" />}>
                  <input
                    type="text" value={company} onChange={(e) => setCompany(e.target.value)}
                    placeholder="Kanzlei Müller & Partner"
                    className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-base sm:text-sm rounded-none outline-none focus:border-titanium-100"
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
            </>
          )}

          {!report && (
            <>
              <WhatGetsChecked />
              <Pillars />
            </>
          )}

          {report && <div id="report"><ReportView report={report} onRetry={resetForNewScan} /></div>}
        </div>
      </main>

      <ReportPreviewSection
        eyebrow="Beispiel-Report · Was Sie nach dem Scan bekommen"
        headline="Ihr eigener Audit sieht genauso aus."
        subline="Bei jedem Free-Audit erhalten Sie diesen strukturierten Output. Kein Marketing-Mockup — die exakte Form, in der unsere Engine Findings dokumentiert."
      />

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

// ─── WhatGetsChecked — SEO-friendly summary of audit scope ──────────────

function WhatGetsChecked() {
  const items = [
    'Consent- und Tracking-Verhalten',
    'Externe Dienste und Drittanbieter-Skripte',
    'Mögliche Pre-Consent-Risiken',
    'Technische Datenschutzindikatoren',
    'AI-Act-relevante Hinweise, sofern anwendbar',
    'Pflichtangaben: Impressum und Datenschutz',
  ];
  return (
    <section aria-label="Was geprüft wird" className="mt-10">
      <h2 className="text-xs font-bold text-titanium-500 uppercase tracking-[0.2em] mb-4 text-center">
        Was geprüft wird
      </h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-w-xl mx-auto">
        {items.map((b) => (
          <li
            key={b}
            className="flex items-center gap-2 text-sm text-titanium-300 bg-obsidian-900/60 border border-titanium-900 px-3 py-2 rounded-none"
          >
            <span className="text-titanium-100 text-xs">▸</span>
            {b}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[11px] text-titanium-500 text-center max-w-xl mx-auto leading-relaxed">
        Der Audit ersetzt keine individuelle Rechtsberatung und keine vollständige technische Prüfung.
      </p>
    </section>
  );
}

// ─── Pillars (Trust elements unten auf der Form) ─────────────────────────

function Pillars() {
  const items = [
    { law: 'DSGVO Art. 6 Abs. 1', issue: 'Tracker ohne Consent', max: 'Rechtsgrundlage erforderlich' },
    { law: 'DSGVO Art. 13',       issue: 'Fehlende Datenschutzerklärung', max: 'Informationspflicht' },
    { law: '§ 25 TTDSG',          issue: 'Cookies vor Consent', max: 'Einwilligung erforderlich' },
    { law: '§ 5 TMG',             issue: 'Fehlendes Impressum', max: 'Anbieterkennzeichnung erforderlich' },
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
            <div className="text-xs text-titanium-500 mt-0.5">Pflicht: {it.max}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Business Impact Mapping (statisch, severity-basiert) ────────────────
const ISSUE_BUSINESS_IMPACT: Record<string, { businessImpact: string; effort: string; action: string }> = {
  critical: {
    businessImpact: 'Art. 83(5) DSGVO — Bußgeld bis 4 % des weltweiten Jahresumsatzes möglich.',
    effort:         '2–5 Stunden',
    action:         'Sofortige Behebung empfohlen — Evidence dokumentieren.',
  },
  high: {
    businessImpact: 'Aufsichtsbehördliche Prüfung möglich. Nachweis technischer Schutzmaßnahmen nach Art. 32 DSGVO erforderlich.',
    effort:         '1–2 Stunden',
    action:         'Innerhalb 72 Stunden beheben und Evidence erzeugen.',
  },
  medium: {
    businessImpact: 'Dokumentationslücke bei internem oder externem Audit. Erschwert Rechenschaftspflicht nach Art. 5 Abs. 2 DSGVO.',
    effort:         '30 Minuten',
    action:         'Konfiguration prüfen und Datenschutzerklärung aktualisieren.',
  },
  low: {
    businessImpact: 'Geringes direktes Risiko. Empfohlen zur Stärkung der Compliance-Dokumentation.',
    effort:         '5–15 Minuten',
    action:         'Im nächsten Wartungszyklus adressieren.',
  },
  info: {
    businessImpact: 'Kein direktes Risiko. Hinweis zur Transparenz.',
    effort:         '—',
    action:         'Optional prüfen.',
  },
};

// ─── Trial CTA Block ─────────────────────────────────────────────────────────
//
// Erscheint direkt nach dem Score — primärer Conversion-Punkt.
// Speichert audit_id + domain in sessionStorage damit sie nach OAuth/Magic-Link
// automatisch dem Workspace zugeordnet werden können.
// DSGVO-Consent für anonymisierte Benchmark-Daten ist optional — Trial
// funktioniert auch ohne Zustimmung.

const CONSENT_VERSION = '1.0';
const CONSENT_TYPE = 'platform_improvement_analytics';
const PENDING_AUDIT_KEY = 'rsd_pending_audit';

function TrialCtaBlock({ report }: { report: Report }) {
  const navigate = useNavigate();
  const [analyticsConsent, setAnalyticsConsent] = useState(false);

  function handleActivate() {
    // Scan-Daten für Post-Auth-Import in sessionStorage speichern
    try {
      sessionStorage.setItem(PENDING_AUDIT_KEY, JSON.stringify({
        audit_id: report.audit_id,
        domain: report.domain,
        score: report.score,
        severity: report.severity,
        analytics_consent: analyticsConsent,
        consent_version: CONSENT_VERSION,
        consent_type: CONSENT_TYPE,
        ts: Date.now(),
      }));
    } catch { /* sessionStorage nicht verfügbar — kein Blocker */ }

    navigate(
      `/welcome?next=${encodeURIComponent(`/checkout/starter?pilot=true&audit_id=${report.audit_id}&source=trial_cta`)}`
    );
  }

  const criticalCount = report.issues.filter(i => i.severity === 'critical').length;
  const highCount     = report.issues.filter(i => i.severity === 'high').length;

  return (
    <div className="border-2 border-cyan-700 bg-obsidian-900 p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <ShieldCheck className="h-6 w-6 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-500 mb-1">
            14 Tage kostenlos · Starter Trial
          </p>
          <h2 className="font-display font-bold text-titanium-50 text-xl sm:text-2xl leading-tight">
            Diesen Befund 14 Tage kostenlos überwachen
          </h2>
        </div>
      </div>

      <p className="text-sm text-titanium-300 leading-relaxed mb-5 max-w-2xl">
        RealSyncDynamicsAI übernimmt diesen Scan in Ihr Governance-Dashboard und prüft automatisch,
        ob neue DSGVO-, Security- oder KI-Risiken entstehen.
        {(criticalCount > 0 || highCount > 0) && (
          <span className="block mt-2 text-amber-300 font-semibold">
            {criticalCount > 0 && `${criticalCount} kritische`}
            {criticalCount > 0 && highCount > 0 && ' + '}
            {highCount > 0 && `${highCount} hohe`}
            {' '}Befunde — Monitoring empfohlen.
          </span>
        )}
      </p>

      {/* DSGVO Consent — optional */}
      <label className="flex items-start gap-3 mb-5 cursor-pointer group">
        <input
          type="checkbox"
          checked={analyticsConsent}
          onChange={e => setAnalyticsConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-cyan-400 shrink-0"
        />
        <span className="text-xs text-titanium-400 leading-relaxed group-hover:text-titanium-300 transition-colors">
          Ich stimme zu, dass <strong className="text-titanium-200">anonymisierte und aggregierte</strong> Scan-Ergebnisse
          zur Verbesserung der Plattform, zur Risikoanalyse und zur Erstellung von Branchen-Benchmarks
          verwendet werden dürfen. Keine personenbezogenen Daten. Jederzeit widerrufbar.{' '}
          <span className="text-titanium-600">(optional — Trial funktioniert auch ohne Zustimmung)</span>
        </span>
      </label>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleActivate}
          className="inline-flex items-center justify-center gap-2 bg-cyan-400 text-obsidian-950 px-6 py-3 text-sm font-bold hover:bg-cyan-300 transition-colors"
        >
          Starter 14 Tage kostenlos aktivieren <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={handleActivate}
          className="inline-flex items-center justify-center gap-2 border border-titanium-700 text-titanium-100 px-5 py-3 text-sm font-semibold hover:border-titanium-400 transition-colors"
        >
          Monitoring für diese Domain starten
        </button>
      </div>

      <p className="mt-3 font-mono text-[10px] text-titanium-600">
        Keine Demo. Kein Verkaufsgespräch. Direkt starten. · Keine Kreditkarte für 14 Tage.
      </p>
    </div>
  );
}

// ─── Report ───────────────────────────────────────────────────────────────

function ReportView({ report, onRetry }: { report: Report; onRetry: () => void }) {
  const config = severityConfig(report.severity);
  const [explainIssue, setExplainIssue] = useState<Issue | null>(null);
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

      <TrialCtaBlock report={report} />

      {/* Business Impact Summary */}
      {report.issues.length > 0 && (
        <div className="border border-titanium-900 bg-obsidian-900">
          <div className="px-4 py-3 border-b border-titanium-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <span className="font-display font-semibold text-sm text-titanium-50">Geschäftliche Auswirkungen</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-y divide-titanium-900">
            <div className="p-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-1">Compliance Score</p>
              <p className={`font-display font-bold text-2xl ${report.score >= 75 ? 'text-emerald-300' : report.score >= 50 ? 'text-amber-300' : 'text-rose-300'}`}>{report.score}<span className="text-sm text-titanium-500"> /100</span></p>
            </div>
            <div className="p-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-1">Geschätztes Risiko</p>
              <p className={`font-display font-bold text-sm ${report.severity === 'critical' ? 'text-rose-300' : report.severity === 'high' ? 'text-amber-300' : 'text-emerald-300'}`}>
                {report.severity === 'critical' ? 'Hoch' : report.severity === 'high' ? 'Mittel' : 'Niedrig'}
              </p>
            </div>
            <div className="p-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-1">Kritische Befunde</p>
              <p className="font-display font-bold text-sm text-titanium-50">
                {report.issues.filter(i => i.severity === 'critical').length}
              </p>
            </div>
            <div className="p-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-1">Geschätzter Aufwand</p>
              <p className="font-display font-bold text-sm text-titanium-50">
                {report.issues.filter(i => i.severity === 'critical' || i.severity === 'high').length > 2 ? '1 Tag' : report.issues.length > 3 ? '2–4 Stunden' : '1–2 Stunden'}
              </p>
            </div>
            <div className="p-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-1">Zeitersparnis mit Monitoring</p>
              <p className="font-display font-bold text-sm text-cyan-300">≈ 85 % <span className="text-[10px] text-titanium-500 font-normal">Schätzung</span></p>
            </div>
            <div className="p-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-1">Nachweisstatus</p>
              <p className="font-display font-bold text-sm text-amber-300">
                {report.issues.some(i => i.evidence) ? 'Teilweise dokumentiert' : 'Evidence ausstehend'}
              </p>
            </div>
          </div>
          <p className="px-4 py-2 font-mono text-[9px] text-titanium-700 border-t border-titanium-900">
            Schätzwerte dienen der Priorisierung und ersetzen keine rechtliche Beratung.
          </p>
        </div>
      )}

      {/* Audit Lifecycle Flow */}
      <div className="border border-titanium-900 bg-obsidian-950 px-4 py-5">
        <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-4">Audit Lifecycle</p>
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-none">
          {(['Erkennung', 'Risiko', 'Evidence', 'Maßnahme', 'Monitoring', 'Audit Ready'] as const).map((step, i, arr) => (
            <div key={step} className="flex items-center shrink-0">
              <div className={`px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider border ${i === 0 ? 'border-cyan-700 text-cyan-300 bg-cyan-950' : i === arr.length - 1 ? 'border-emerald-700 text-emerald-300 bg-emerald-950' : 'border-titanium-800 text-titanium-400 bg-obsidian-900'}`}>
                {step}
              </div>
              {i < arr.length - 1 && <span className="text-titanium-700 px-1">↓</span>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-titanium-500 leading-relaxed">
          RealSyncDynamics.AI erkennt technische Findings, dokumentiert Risiken, bereitet Nachweise vor und unterstützt Maßnahmen bis zur Audit-Bereitschaft.
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
              {report.issues.map((iss) => (
                <IssueCard key={iss.id} issue={iss} onExplain={() => setExplainIssue(iss)} />
              ))}
            </ul>
          )}
      </div>

      {/* Nächster Schritt CTA */}
      <div className="border border-titanium-900 bg-obsidian-900 p-4">
        <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-3">Nächster Schritt</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            to={`/pricing?source=audit_cta_monitoring&audit=${report.audit_id}`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-400 text-obsidian-950 text-xs font-bold hover:bg-cyan-300 transition-colors"
          >
            <Activity className="h-3.5 w-3.5" /> Monitoring aktivieren
          </Link>
          <Link
            to={`/pricing?source=audit_cta_evidence&audit=${report.audit_id}`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-titanium-700 text-titanium-100 text-xs font-bold hover:border-titanium-400 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" /> Evidence Vault
          </Link>
          <Link
            to={`/checkout/starter?source=audit_cta_report&audit=${report.audit_id}`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-titanium-700 text-titanium-100 text-xs font-bold hover:border-titanium-400 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" /> Starter buchen →
          </Link>
        </div>
      </div>

      <MonitoringActivationBlock report={report} />

      <NextStepBlock report={report} />

      <DocumentGeneratorBlock auditId={report.audit_id} domain={report.domain} />

      <div className="bg-obsidian-900 border border-titanium-700 p-6 rounded-none">
        <h3 className="font-display font-bold text-titanium-50 text-lg mb-2">So fixen wir das für Dich</h3>
        <p className="text-sm text-titanium-300 mb-4 leading-relaxed">
          RealSync Dynamics liefert die fehlenden DSGVO-Bausteine als SaaS — EU-Datenresidenz, Audit-Log, AVV/DPA-Generator,
          DSGVO-Selfservice. <strong className="text-titanium-50">In 14 Tagen DSGVO-ready</strong>, nicht in 6 Monaten.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            to={`/checkout/starter?source=audit_lp&audit=${report.audit_id}`}
            className="surface-mono inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-none"
          >
            Monitoring aktivieren <ArrowRight className="h-4 w-4" />
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
            <Activity className="h-5 w-5 text-cyan-300" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-wider text-titanium-400 font-bold mb-1">Continuous Runtime</div>
            <h3 className="font-display font-bold text-titanium-50 text-lg mb-1">Drift verhindern statt einmalig aufräumen.</h3>
            <p className="text-sm text-titanium-300 mb-4 leading-relaxed">
              Der Free-Scan zeigt einen Snapshot. Ein neuer Tracker, ein Tag-Manager-Push oder ein vergessenes Plugin
              kann den Score in einer Woche wieder kippen. Die RealSync Runtime monitort kontinuierlich, alertet bei
              Drift und schreibt jeden Befund in die Evidence-Chain.
            </p>
            <Link
              to={`/audit?plan=starter&source=audit-followup&audit=${report.audit_id}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-obsidian-950 text-xs font-bold rounded-none"
            >
              Activate Monitoring <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      <ShareBlock report={report} />

      <AuditCopilotPanel
        issue={explainIssue ?? { id: '', severity: 'info', title: '', detail: '' }}
        domain={report.domain}
        open={!!explainIssue}
        onClose={() => setExplainIssue(null)}
      />
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

function IssueCard({ issue, onExplain }: { issue: Issue; onExplain?: () => void }) {
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
  const impact = ISSUE_BUSINESS_IMPACT[issue.severity];
  const hasEvidence = !!issue.evidence;

  return (
    <li className={`p-4 border ${sevColor[issue.severity]} rounded-none`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {sevLabel[issue.severity]}
        </span>
        {issue.paragraph_ref && (
          <span className="text-[10px] text-titanium-500 font-mono">{issue.paragraph_ref}</span>
        )}
        <span className={`ml-auto font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border ${hasEvidence ? 'border-emerald-800 text-emerald-400 bg-emerald-950' : 'border-titanium-800 text-titanium-500 bg-obsidian-950'}`}>
          {hasEvidence ? 'Evidence verfügbar' : 'Evidence ausstehend'}
        </span>
      </div>

      <div className="font-display font-bold text-titanium-50 mb-1">{issue.title}</div>
      <div className="text-sm text-titanium-300 leading-relaxed mb-3">{issue.detail}</div>

      {/* Business Impact Layer */}
      <div className="border-t border-titanium-900 pt-3 mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-0.5">Geschäftsauswirkung</p>
          <p className="text-xs text-titanium-300 leading-relaxed">{impact.businessImpact}</p>
        </div>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-0.5">Behebungsaufwand</p>
          <p className="text-xs text-titanium-300">{impact.effort}</p>
        </div>
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 mb-0.5">Empfohlene Maßnahme</p>
          <p className="text-xs text-cyan-300">{impact.action}</p>
        </div>
      </div>

      {onExplain && (
        <button
          type="button"
          onClick={onExplain}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold tracking-tight border border-titanium-800 hover:border-titanium-600 bg-obsidian-950 text-titanium-100 hover:text-titanium-50 transition-colors rounded-none"
        >
          <Sparkles className="h-3 w-3 text-violet-300" />
          Erklären lassen
        </button>
      )}
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
      summary: (n) => `${n} Befunde mit hoher Schweregrad-Bewertung. Empfehlung: technische Evidence sichten und mit DSB / Fachjurist priorisieren.` };
    case 'high':     return { label: 'Hohe Priorität', bg: 'bg-obsidian-900', border: 'border-titanium-700', color: 'text-titanium-50',
      summary: (n) => `${n} Befunde mit erhöhter Schweregrad-Bewertung. Empfehlung: zeitnahe Behandlung im Governance-Backlog.` };
    case 'medium':   return { label: 'Verbesserungsbedarf', bg: 'bg-obsidian-900', border: 'border-titanium-800', color: 'text-titanium-100',
      summary: (n) => `${n} Befunde mittlerer Schweregrad-Bewertung. Im regulären Sprint adressierbar.` };
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
 * Primary monetisation block right under the score+findings. Two CTAs
 * that funnel into the existing pricing page with a plan hint and the
 * audit_id pre-filled, so the operator can attribute checkouts to
 * audits when the Stripe surface gets wired up later. trackUpgradeClick
 * is fire-and-forget — failures never block the navigation.
 */
function MonitoringActivationBlock({ report }: { report: Report }) {
  function onClickPlan(plan: 'starter' | 'growth') {
    trackUpgradeClick(plan, { auditId: report.audit_id, source: 'audit_report_view' });
  }
  const starterHref = `/pricing?plan=starter&audit_id=${encodeURIComponent(report.audit_id)}`;
  const growthHref = `/pricing?plan=growth&audit_id=${encodeURIComponent(report.audit_id)}`;
  return (
    <div className="bg-obsidian-900 border border-titanium-700 p-6 rounded-none">
      <div className="flex items-start gap-3 mb-3">
        <Activity className="h-5 w-5 text-titanium-100 shrink-0 mt-0.5" strokeWidth={1.5} />
        <div>
          <div className="text-[10px] uppercase tracking-wider text-titanium-400 font-bold mb-1">
            Continuous Compliance
          </div>
          <h3 className="font-display font-bold text-titanium-50 text-lg">
            Monitoring aktivieren
          </h3>
        </div>
      </div>
      <p className="text-sm text-titanium-300 mb-5 leading-relaxed">
        Die technische Analyse hat mögliche DSGVO-, TTDSG- oder Tracking-Risiken identifiziert.
        Mit kontinuierlichem Monitoring bleiben Änderungen an Tracking, externen Diensten und möglichen
        Compliance-Risiken nachvollziehbar.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Link
          to={starterHref}
          onClick={() => onClickPlan('starter')}
          className="surface-mono inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold rounded-none"
        >
          Starter aktivieren <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          to={growthHref}
          onClick={() => onClickPlan('growth')}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-obsidian-950 border border-titanium-700 hover:border-titanium-200 text-titanium-200 text-sm font-bold rounded-none"
        >
          Growth aktivieren <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

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
        { label: 'Monitoring aktivieren', to: `/pricing?source=audit_report&audit=${report.audit_id}` },
        { label: 'Tarif wählen',         to: `/pricing?source=audit_report&audit=${report.audit_id}` },
      ]
    : [
        { label: 'Monitoring aktivieren', to: `/pricing?source=audit_report&audit=${report.audit_id}` },
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
