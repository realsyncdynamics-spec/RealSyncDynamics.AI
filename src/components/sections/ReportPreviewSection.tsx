import { Cookie, Code2, Lock, FileWarning, Activity, Layers } from 'lucide-react';

/**
 * ReportPreviewSection — Mock-Audit-Report mit echtem Daten-Layout.
 *
 * Zeigt Procurement-Tauglichkeit: Risk-Score, Findings-Verteilung,
 * DSGVO-Kategorien, Tracker-Liste, Consent-Status. So sieht ein echter
 * Audit-Report-Output aus — nur dass wir hier statisches Mock-Daten zeigen,
 * statt einen Live-Scan zu rendern.
 *
 * Architektur:
 *   1. Header-Card: Domain + Risk-Score + Score-Klasse
 *   2. Findings-Verteilung: KRITISCH/MITTEL/INFO mit Counts
 *   3. DSGVO-Kategorie-Breakdown: Tracking, Drittlandtransfer, Cookies, Forms, ...
 *   4. Tracker-Liste: konkrete Drittanbieter-Anbindungen
 *   5. Consent-Status: pre-consent vs post-consent Counts
 *
 * Goal: jemand der Compliance-Software einkauft (DSB, IT-Leiter, Procurement)
 * sieht "OK, das ist strukturiert, das ist auditierbar".
 */

const SAMPLE_DOMAIN = 'beispiel-shop.de';
const SAMPLE_SCORE = 47;
const SAMPLE_SCAN_DATE = '2026-05-10';
const SAMPLE_DURATION_MS = 14_320;

const FINDINGS_BREAKDOWN = [
  { severity: 'kritisch', count: 4, label: 'Kritisch', tone: 'text-red-300 border-red-900/50' },
  { severity: 'mittel', count: 7, label: 'Mittel', tone: 'text-amber-300 border-amber-900/50' },
  { severity: 'info', count: 12, label: 'Info', tone: 'text-silver-300 border-silver-700/40' },
];

const DSGVO_CATEGORIES = [
  { icon: Cookie, label: 'Cookies / TTDSG § 25', findings: 6 },
  { icon: Activity, label: 'Tracking & Analytics', findings: 5 },
  { icon: Lock, label: 'Drittlandtransfer (Schrems II)', findings: 3 },
  { icon: FileWarning, label: 'Pflichtinformationen', findings: 2 },
  { icon: Code2, label: 'Security-Header', findings: 4 },
  { icon: Layers, label: 'Sub-Prozessoren / AVV', findings: 3 },
];

const TRACKERS = [
  { name: 'Google Analytics 4', category: 'Analytics', preConsent: true, host: 'googletagmanager.com' },
  { name: 'Meta Pixel', category: 'Marketing', preConsent: true, host: 'connect.facebook.net' },
  { name: 'Google Ads (gtag)', category: 'Marketing', preConsent: true, host: 'googletagmanager.com' },
  { name: 'HubSpot Tracker', category: 'CRM', preConsent: false, host: 'js.hs-scripts.com' },
  { name: 'Cloudflare CDN', category: 'Infrastructure', preConsent: false, host: 'cdnjs.cloudflare.com' },
  { name: 'Stripe.js', category: 'Payments', preConsent: false, host: 'js.stripe.com' },
];

function scoreClass(score: number): { label: string; tone: string; ring: string } {
  if (score >= 80) return { label: 'Konform', tone: 'text-emerald-300', ring: 'border-emerald-900/40' };
  if (score >= 60) return { label: 'Akzeptabel', tone: 'text-amber-300', ring: 'border-amber-900/40' };
  if (score >= 40) return { label: 'Mangelhaft', tone: 'text-orange-300', ring: 'border-orange-900/40' };
  return { label: 'Kritisch', tone: 'text-red-300', ring: 'border-red-900/40' };
}

export interface ReportPreviewSectionProps {
  /** Eyebrow-Zeile. Default: "Audit-Report · Beispiel-Output" */
  eyebrow?: string;
  /** Headline. Default: "So sieht ein vollstaendiger Audit-Report aus." */
  headline?: string;
  /** Sub-Copy. Default beschreibt strukturelle Vorteile. */
  subline?: string;
}

export function ReportPreviewSection({
  eyebrow = 'Audit-Report · Beispiel-Output',
  headline = 'So sieht ein vollständiger Audit-Report aus.',
  subline = 'Strukturierte Output-Schicht: Risk-Score, Findings-Verteilung, DSGVO-Kategorien, Tracker-Inventar und Consent-Timing — Procurement- und DSB-tauglich.',
}: ReportPreviewSectionProps = {}) {
  const score = scoreClass(SAMPLE_SCORE);
  const totalFindings = FINDINGS_BREAKDOWN.reduce((s, f) => s + f.count, 0);
  const preConsentCount = TRACKERS.filter((t) => t.preConsent).length;

  return (
    <section
      id="report-preview"
      className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20 bg-obsidian-950/50"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
            {eyebrow}
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-3xl mx-auto">
            {headline}
          </h2>
          <p className="mt-4 text-sm sm:text-base text-silver-300 leading-relaxed max-w-2xl mx-auto">
            {subline}
          </p>
        </div>

        <div className="bg-obsidian-900/80 border border-silver-700/40 rounded-none">
          {/* Header: Domain + Risk-Score */}
          <header className="border-b border-silver-700/30 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-silver-500 mb-1">
                Audit-Report
              </div>
              <div className="font-display font-bold text-titanium-50 text-lg sm:text-xl tracking-tight">
                {SAMPLE_DOMAIN}
              </div>
              <div className="mt-1 text-[11px] font-mono text-silver-500">
                Scan: {SAMPLE_SCAN_DATE} · Dauer: {(SAMPLE_DURATION_MS / 1000).toFixed(1)}s ·
                Engine: Playwright Chromium · Methodik 2026.05.0
              </div>
            </div>
            <div
              className={`flex items-center gap-3 border ${score.ring} bg-obsidian-950 px-4 py-3`}
            >
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-silver-500">
                  Risk-Score
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-display font-bold tabular-nums ${score.tone}`}>
                    {SAMPLE_SCORE}
                  </span>
                  <span className="text-xs font-mono text-silver-500">/100</span>
                </div>
                <div className={`text-[11px] font-mono uppercase tracking-wider ${score.tone}`}>
                  {score.label}
                </div>
              </div>
            </div>
          </header>

          {/* Findings-Verteilung */}
          <div className="border-b border-silver-700/30 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-silver-300">
                Findings · {totalFindings} gesamt
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {FINDINGS_BREAKDOWN.map((f) => (
                <div
                  key={f.severity}
                  className={`bg-obsidian-950/60 border-l-2 ${f.tone} p-3`}
                >
                  <div className={`text-2xl font-display font-bold tabular-nums ${f.tone.split(' ')[0]}`}>
                    {f.count}
                  </div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-silver-500 mt-1">
                    {f.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DSGVO-Kategorien + Tracker grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-silver-700/30">
            <div className="p-5 sm:p-6">
              <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-silver-300 mb-3">
                DSGVO-Kategorien
              </div>
              <ul className="space-y-2">
                {DSGVO_CATEGORIES.map((cat) => (
                  <li
                    key={cat.label}
                    className="flex items-center gap-3 text-sm text-silver-200"
                  >
                    <cat.icon className="h-3.5 w-3.5 text-titanium-100 shrink-0" />
                    <span className="flex-1 leading-snug">{cat.label}</span>
                    <span className="font-mono text-xs text-silver-400 tabular-nums">
                      {cat.findings} {cat.findings === 1 ? 'Befund' : 'Befunde'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-5 sm:p-6">
              <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-silver-300 mb-3">
                Tracker-Inventar · {TRACKERS.length} erkannt
              </div>
              <ul className="space-y-1.5">
                {TRACKERS.map((t) => (
                  <li
                    key={t.name}
                    className="flex items-center gap-2 text-xs sm:text-sm py-1.5 border-b border-silver-800/30 last:border-0"
                  >
                    <span
                      className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                        t.preConsent ? 'bg-red-400' : 'bg-emerald-400'
                      }`}
                      aria-hidden
                    />
                    <span className="text-titanium-100 font-mono text-[12px] truncate">
                      {t.name}
                    </span>
                    <span className="text-silver-500 font-mono text-[10px] uppercase tracking-wider">
                      {t.category}
                    </span>
                    <span className="ml-auto text-silver-500 font-mono text-[10px] truncate hidden sm:inline">
                      {t.host}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-[10px] font-mono uppercase tracking-wider text-silver-500 flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  Pre-Consent ({preConsentCount})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Nach Consent ({TRACKERS.length - preConsentCount})
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="border-t border-silver-700/30 p-4 sm:p-5 text-center">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-silver-500">
              Beispiel-Output · echte Reports inkl. Code-Snippet-Empfehlungen + PDF-Export
            </div>
          </footer>
        </div>
      </div>
    </section>
  );
}
