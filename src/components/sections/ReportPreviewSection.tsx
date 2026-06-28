import { useState } from 'react';
import { Cookie, Code2, Lock, FileWarning, Activity, Layers, FileText, Download, ChevronDown, ChevronUp, Hash, Shield, Wrench, BookOpen } from 'lucide-react';

/**
 * ReportPreviewSection — Mock-Audit-Report + Audit-Bundle/PDF-Vorschau.
 *
 * Step 4 additions:
 *   - AuditBundlePreview: visual PDF-style bundle preview showing what the
 *     downloadable audit package contains (cover page, evidence table, finding
 *     details with fix snippets, chain-of-custody hash).
 *   - Mock "Download PDF" CTA with disabled state (no actual download, just UI).
 *   - All changes stay inside the Audit Result / Report area.
 *
 * Existing sections unchanged:
 *   1. Header-Card: Domain + Risk-Score + Score-Klasse
 *   2. Findings-Verteilung: KRITISCH/MITTEL/INFO mit Counts
 *   3. DSGVO-Kategorie-Breakdown
 *   4. Tracker-Liste
 *   5. Consent-Status
 */

const SAMPLE_DOMAIN = 'beispiel-shop.de';
const SAMPLE_SCORE = 47;
const SAMPLE_SCAN_DATE = '2026-05-10';
const SAMPLE_DURATION_MS = 14_320;
const BUNDLE_HASH = 'sha256:3f9a…d72c';
const BUNDLE_PAGES = 18;
const BUNDLE_EVENTS = 1_248;

const FINDINGS_BREAKDOWN = [
  { severity: 'kritisch', count: 4,  label: 'Kritisch', tone: 'text-red-300 border-red-900/50' },
  { severity: 'mittel',   count: 7,  label: 'Mittel',   tone: 'text-amber-300 border-amber-900/50' },
  { severity: 'info',     count: 12, label: 'Info',      tone: 'text-silver-300 border-silver-700/40' },
  ];

const DSGVO_CATEGORIES = [
  { icon: Cookie,      label: 'Cookies / TTDSG § 25',           findings: 6 },
  { icon: Activity,    label: 'Tracking & Analytics',            findings: 5 },
  { icon: Lock,        label: 'Drittlandtransfer (Schrems II)',  findings: 3 },
  { icon: FileWarning, label: 'Pflichtinformationen',            findings: 2 },
  { icon: Code2,       label: 'Security-Header',                 findings: 4 },
  { icon: Layers,      label: 'Sub-Prozessoren / AVV',           findings: 3 },
  ];

const TRACKERS = [
  { name: 'Google Analytics 4', category: 'Analytics',      preConsent: true,  host: 'googletagmanager.com' },
  { name: 'Meta Pixel',         category: 'Marketing',      preConsent: true,  host: 'connect.facebook.net' },
  { name: 'Google Ads (gtag)', category: 'Marketing',      preConsent: true,  host: 'googletagmanager.com' },
  { name: 'HubSpot Tracker',   category: 'CRM',            preConsent: false, host: 'js.hs-scripts.com' },
  { name: 'Cloudflare CDN',    category: 'Infrastructure', preConsent: false, host: 'cdnjs.cloudflare.com' },
  { name: 'Stripe.js',         category: 'Payments',       preConsent: false, host: 'js.stripe.com' },
  ];

// Audit-Bundle chapter list (what the PDF contains)
const BUNDLE_CHAPTERS = [
  { icon: BookOpen, label: 'Cover & Metadaten',          pages: '1–2',   desc: 'Domain, Scan-Datum, Methodik, Engine-Version' },
  { icon: Shield,   label: 'Executive Summary',          pages: '3–4',   desc: 'Risk-Score, Findings-Übersicht, Empfehlungen' },
  { icon: FileWarning, label: 'Findings im Detail',      pages: '5–12',  desc: '23 Befunde mit Severity, Paragraf-Referenz, Selector' },
  { icon: Wrench,   label: 'Fix-Snippets & Patches',     pages: '13–15', desc: 'Code-Empfehlungen pro Befund (HTML/TS/nginx)' },
  { icon: Hash,     label: 'Evidence-Tabelle',           pages: '16–17', desc: `${BUNDLE_EVENTS} Events · SHA-256-Hashes · Zeitstempel` },
  { icon: FileText, label: 'Chain-of-Custody Nachweis',  pages: '18',    desc: `Ledger-Anker · ${BUNDLE_HASH}` },
  ];

function scoreClass(score: number): { label: string; tone: string; ring: string } {
    if (score >= 80) return { label: 'Konform',     tone: 'text-emerald-300', ring: 'border-emerald-900/40' };
    if (score >= 60) return { label: 'Akzeptabel',  tone: 'text-amber-300',   ring: 'border-amber-900/40' };
    if (score >= 40) return { label: 'Mangelhaft',  tone: 'text-orange-300',  ring: 'border-orange-900/40' };
    return               { label: 'Kritisch',    tone: 'text-red-300',     ring: 'border-red-900/40' };
}

// ---------------------------------------------------------------------------
// AuditBundlePreview — Step 4 new component
// ---------------------------------------------------------------------------
function AuditBundlePreview() {
    const [open, setOpen] = useState(false);

  return (
        <div className="border border-silver-700/40 bg-obsidian-900/60 mt-6">
          {/* Header bar — always visible */}
              <button
                        type="button"
                        onClick={() => setOpen((o) => !o)}
                        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-obsidian-800/40 transition-colors"
                        aria-expanded={open}
                      >
                      <span className="flex items-center gap-2.5">
                                <FileText className="h-4 w-4 text-gold-400 shrink-0" />
                                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-silver-200">
                                            Audit-Bundle · PDF-Vorschau
                                </span>
                                <span className="font-mono text-[10px] text-silver-500 hidden sm:inline">
                                  {BUNDLE_PAGES} Seiten · {BUNDLE_EVENTS.toLocaleString()} Events · {BUNDLE_HASH}
                                </span>
                      </span>
                      <span className="flex items-center gap-3">
                                <span
                                              className="hidden sm:inline-flex items-center gap-1.5 border border-silver-700/50 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-silver-400 cursor-default select-none"
                                              title="Download verfügbar nach Live-Scan"
                                            >
                                            <Download className="h-3 w-3" />
                                            PDF
                                </span>
                        {open
                                      ? <ChevronUp className="h-4 w-4 text-silver-500" />
                                      : <ChevronDown className="h-4 w-4 text-silver-500" />}
                      </span>
              </button>
        
          {/* Expandable body */}
          {open && (
                  <div className="border-t border-silver-700/30 px-5 py-4">
                    {/* PDF page mock */}
                            <div className="bg-obsidian-950 border border-silver-800/40 p-4 sm:p-6 max-w-2xl font-mono text-[11px]">
                              {/* Cover simulation */}
                                        <div className="border-b border-silver-800/40 pb-4 mb-4">
                                                      <div className="text-[10px] uppercase tracking-[0.25em] text-gold-400 mb-1">
                                                                      RealSyncDynamics.AI — Audit-Report
                                                      </div>
                                                      <div className="text-base font-display font-semibold text-titanium-50 leading-snug">
                                                        {SAMPLE_DOMAIN}
                                                      </div>
                                                      <div className="text-silver-500 mt-1">
                                                                      Scan-Datum: {SAMPLE_SCAN_DATE} &nbsp;·&nbsp; Dauer: {(SAMPLE_DURATION_MS / 1000).toFixed(1)}s
                                                      </div>
                                                      <div className="text-silver-500">
                                                                      Engine: Playwright Chromium &nbsp;·&nbsp; Methodik 2026.05.0
                                                      </div>
                                                      <div className="mt-2 text-emerald-400 text-[10px] uppercase tracking-wider">
                                                                      ● chain sealed · {BUNDLE_HASH}
                                                      </div>
                                        </div>
                            
                              {/* Chapter list (TOC) */}
                                        <div className="text-[10px] uppercase tracking-[0.2em] text-silver-500 mb-2">
                                                      Inhaltsverzeichnis
                                        </div>
                                        <ul className="space-y-1.5">
                                          {BUNDLE_CHAPTERS.map((ch) => (
                                    <li key={ch.label} className="flex items-start gap-3">
                                                      <ch.icon className="h-3.5 w-3.5 text-silver-500 mt-0.5 shrink-0" />
                                                      <span className="flex-1 text-silver-200 leading-snug">{ch.label}</span>
                                                      <span className="text-silver-600 tabular-nums shrink-0">S. {ch.pages}</span>
                                    </li>
                                  ))}
                                        </ul>
                            
                              {/* Evidence snippet */}
                                        <div className="mt-4 border-t border-silver-800/40 pt-4">
                                                      <div className="text-[10px] uppercase tracking-[0.2em] text-silver-500 mb-2">
                                                                      Evidence-Tabelle · Auszug
                                                      </div>
                                                      <table className="w-full text-[10px] border-collapse">
                                                                      <thead>
                                                                                        <tr className="text-silver-600 border-b border-silver-800/40">
                                                                                                            <th className="text-left py-1 pr-3 font-normal">Zeitstempel</th>
                                                                                                            <th className="text-left py-1 pr-3 font-normal">rule_id</th>
                                                                                                            <th className="text-left py-1 pr-3 font-normal">severity</th>
                                                                                                            <th className="text-left py-1 font-normal hidden sm:table-cell">sha256</th>
                                                                                          </tr>
                                                                      </thead>
                                                                      <tbody className="text-silver-300">
                                                                                        <tr className="border-b border-silver-900/40">
                                                                                                            <td className="py-1 pr-3 tabular-nums text-silver-500">07:14:22</td>
                                                                                                            <td className="py-1 pr-3">rule.cookie.reject_button</td>
                                                                                                            <td className="py-1 pr-3 text-amber-400">warning</td>
                                                                                                            <td className="py-1 text-silver-600 hidden sm:table-cell">9f2c…b81</td>
                                                                                          </tr>
                                                                                        <tr className="border-b border-silver-900/40">
                                                                                                            <td className="py-1 pr-3 tabular-nums text-silver-500">07:14:23</td>
                                                                                                            <td className="py-1 pr-3">rule.cookie.consent_mode_v2</td>
                                                                                                            <td className="py-1 pr-3 text-red-400">error</td>
                                                                                                            <td className="py-1 text-silver-600 hidden sm:table-cell">a3d1…f52</td>
                                                                                          </tr>
                                                                                        <tr className="border-b border-silver-900/40">
                                                                                                            <td className="py-1 pr-3 tabular-nums text-silver-500">07:14:27</td>
                                                                                                            <td className="py-1 pr-3">rule.fonts.google_cdn</td>
                                                                                                            <td className="py-1 pr-3 text-red-400">error</td>
                                                                                                            <td className="py-1 text-silver-600 hidden sm:table-cell">c8e4…290</td>
                                                                                          </tr>
                                                                                        <tr>
                                                                                                            <td className="py-1 pr-3 text-silver-600" colSpan={4}>
                                                                                                                                  … {BUNDLE_EVENTS - 3} weitere Events im vollständigen Bundle
                                                                                                              </td>
                                                                                          </tr>
                                                                      </tbody>
                                                      </table>
                                        </div>
                            </div>
                  
                    {/* Download note */}
                            <div className="mt-3 text-[10px] font-mono text-silver-600 flex items-center gap-2">
                                        <Download className="h-3 w-3 shrink-0" />
                                        PDF-Export verfügbar nach Abschluss eines Live-Scans · inkl. Fix-Snippets + Evidence-Hashes
                            </div>
                  </div>
              )}
        </div>
      );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ReportPreviewSectionProps {
    eyebrow?: string;
    headline?: string;
    subline?: string;
}

// ---------------------------------------------------------------------------
// Main section
// ---------------------------------------------------------------------------
export function ReportPreviewSection({
    eyebrow  = 'Audit-Report · Beispiel-Output',
    headline = 'So sieht ein vollständiger Audit-Report aus.',
    subline  = 'Strukturierte Output-Schicht: Risk-Score, Findings-Verteilung, DSGVO-Kategorien, Tracker-Inventar und Consent-Timing — Procurement- und DSB-tauglich.',
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
                                                            <div className="flex items-center gap-2 mb-1">
                                                              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-silver-500">
                                                                Audit-Report
                                                              </div>
                                                              <span className="font-mono text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-amber-800 bg-amber-950 text-amber-400">
                                                                Beispieldaten
                                                              </span>
                                                            </div>
                                                            <div className="font-display font-bold text-titanium-50 text-lg sm:text-xl tracking-tight">
                                                              {SAMPLE_DOMAIN}
                                                            </div>
                                                            <div className="mt-1 text-[11px] font-mono text-silver-500">
                                                                            Scan: {SAMPLE_SCAN_DATE} · Dauer: {(SAMPLE_DURATION_MS / 1000).toFixed(1)}s ·
                                                                            Engine: Playwright Chromium · Methodik 2026.05.0
                                                            </div>
                                              </div>
                                              <div className={`flex items-center gap-3 border ${score.ring} bg-obsidian-950 px-4 py-3`}>
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
                                  <div key={f.severity} className={`bg-obsidian-950/60 border-l-2 ${f.tone} p-3`}>
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
                                    <li key={cat.label} className="flex items-center gap-3 text-sm text-silver-200">
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
                                    <li key={t.name} className="flex items-center gap-2 text-xs sm:text-sm py-1.5 border-b border-silver-800/30 last:border-0">
                                                        <span
                                                                                className={`shrink-0 w-1.5 h-1.5 rounded-full ${t.preConsent ? 'bg-red-400' : 'bg-emerald-400'}`}
                                                                                aria-hidden
                                                                              />
                                                        <span className="text-titanium-100 font-mono text-[12px] truncate">{t.name}</span>
                                                        <span className="text-silver-500 font-mono text-[10px] uppercase tracking-wider">{t.category}</span>
                                                        <span className="ml-auto text-silver-500 font-mono text-[10px] truncate hidden sm:inline">{t.host}</span>
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
                                              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-600">
                                                            Beispieldaten — kein echter Scan · Ihr eigener Report ersetzt diesen Bereich nach dem Audit
                                              </div>
                                  </footer>
                        </div>
                
                  {/* Step 4: Audit-Bundle / PDF-Vorschau */}
                        <AuditBundlePreview />
                </div>
          </section>
        );
}
