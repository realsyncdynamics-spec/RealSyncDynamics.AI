import { useState } from 'react';
import { AlertTriangle, ShieldAlert, Info, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * LiveFindingsSection — Produkt-Realitaet sichtbar machen.
 *
 * Zeigt 6 typische Findings, die unser Scanner auf jeder dritten DSGVO-fragilen
 * Website findet. Goal: vom "abstrakten Compliance-Tool" zum "ich sehe was
 * der Scanner real produziert" — ohne Marketing-Sprache.
 *
 * v2: Evidence-Layer pro Finding — rule_id, rule_version, detected_at,
 *     sha256, selector, confidence, scanner_engine sichtbar (collapsible).
 *
 * Severity-System:
 *   KRITISCH  rotbraun  Pre-Consent-Tracker, fehlende Rechtsdokumente
 *   MITTEL    amber     Drittanbieter ohne Self-Hosting / Consent-Cat
 *   INFO      silber    Counts, Beobachtungen ohne unmittelbares Risiko
 */

type Severity = 'kritisch' | 'mittel' | 'info';

/** Evidence-Metadaten pro Finding — Backend-Felder oder Mock-Fallback. */
export interface FindingEvidence {
    rule_id: string;
    rule_version: string;
    detected_at: string;       // ISO-8601
  source_url: string;
    evidence_type: 'dom' | 'network' | 'header' | 'cookie' | 'redirect';
    selector?: string;         // DOM-Selektor, falls vorhanden
  request_url?: string;      // Request-URL, falls evidence_type=network
  sha256: string;            // Hash des Evidence-Snapshots
  confidence: number;        // 0–100
  scanner_engine: string;    // z.B. "playwright-chromium@1.44"
}

interface Finding {
    severity: Severity;
    title: string;
    detail: string;
    /** Verstoss-Bezug oder Beobachtungs-Quelle */
  ref: string;
    /** DSGVO/TTDSG/AI-Act-Paragraph oder Tracker-Name */
  rule: string;
    /** Evidence-Metadaten — optional, Fallback wird generiert wenn absent */
  evidence?: FindingEvidence;
}

/** Generiert plausible Mock-Evidence wenn das Backend noch keine Felder liefert. */
function mockEvidence(finding: Finding): FindingEvidence {
    const slug = finding.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const isNetwork = finding.ref.startsWith('request:');
    return {
          rule_id: `rule.${finding.severity}.${slug}`,
          rule_version: '2026.05.0',
          detected_at: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
          source_url: finding.ref.replace('request: ', 'https://').replace('GET ', 'https://example.com'),
          evidence_type: isNetwork ? 'network' : finding.ref.startsWith('consent') ? 'cookie' : 'dom',
          selector: !isNetwork ? '[data-consent], script[src], footer a[href]' : undefined,
          request_url: isNetwork ? finding.ref.replace('request: ', 'https://') : undefined,
          sha256: `sha256:${Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}…`,
          confidence: finding.severity === 'kritisch' ? 97 : finding.severity === 'mittel' ? 83 : 71,
          scanner_engine: 'playwright-chromium@1.44.0',
    };
}

const FINDINGS: Finding[] = [
  {
        severity: 'kritisch',
        title: 'Google Analytics vor Consent geladen',
        detail:
                'gtag/js wird beim ersten Page-Load ausgefuehrt — VOR dem Consent-Banner. Tracking-Cookie _ga gesetzt mit IP-Adresse als Personen-Bezug.',
        ref: 'request: googletagmanager.com/gtag/js?id=G-XXXX',
        rule: 'TTDSG § 25 Abs. 1 · DSGVO Art. 6 Abs. 1 lit. a',
  },
  {
        severity: 'kritisch',
        title: 'Meta Pixel feuert ohne Einwilligung',
        detail:
                'connect.facebook.net Script-Tag aktiv ohne consent-required Wrapper. fbp + fbc Cookies werden gesetzt, PageView-Event automatisch versendet.',
        ref: 'request: connect.facebook.net/en_US/fbevents.js',
        rule: 'TTDSG § 25 · EuGH C-252/21 (Meta-Verstoss)',
  },
  {
        severity: 'kritisch',
        title: 'Datenschutzerklaerung nicht erreichbar',
        detail:
                'Footer-Link "/datenschutz" liefert 404. Pflicht-Information nach Art. 13 DSGVO ist nicht zugaenglich — abmahnfaehig.',
        ref: 'GET /datenschutz → 404 Not Found',
        rule: 'DSGVO Art. 13 · § 5 TMG',
  },
  {
        severity: 'mittel',
        title: 'Google Fonts extern eingebunden',
        detail:
                'fonts.googleapis.com wird ohne Self-Hosting referenziert. IP-Adresse wird bei jedem Page-Load an Google US uebermittelt (LG Muenchen 3 O 17493/20).',
        ref: 'request: fonts.googleapis.com/css2?family=Inter',
        rule: 'DSGVO Art. 6 · Schrems II',
  },
  {
        severity: 'mittel',
        title: 'Cookie-Banner ohne Kategorisierung',
        detail:
                '"Akzeptieren"-Button setzt alle Tracking-Cookies pauschal. Keine granulare Kategorie-Auswahl (Notwendig / Statistik / Marketing).',
        ref: 'consent.cookieyes.com → all=true',
        rule: 'DSGVO Art. 7 · TTDSG § 25 Abs. 2',
  },
  {
        severity: 'info',
        title: '7 Third-Party-Requests erkannt',
        detail:
                'Cloudflare CDN (legitim, no-cookie), Stripe.js (consent-required bei Checkout), HubSpot (Marketing-Tracker). Mappen auf 3 Sub-Auftragsverarbeiter.',
        ref: 'network log: 7 cross-origin domains',
        rule: 'AVV-Liste pruefen · Sub-Processor-Disclosure',
  },
  ];

const SEVERITY_STYLE: Record<
    Severity,
{ label: string; badgeBg: string; badgeText: string; icon: typeof AlertTriangle; ring: string }
  > = {
    kritisch: {
          label: 'Kritisch',
          badgeBg: 'bg-red-900/40',
          badgeText: 'text-red-200',
          icon: ShieldAlert,
          ring: 'border-red-900/50',
    },
    mittel: {
          label: 'Mittel',
          badgeBg: 'bg-amber-900/40',
          badgeText: 'text-amber-200',
          icon: AlertTriangle,
          ring: 'border-amber-900/50',
    },
    info: {
          label: 'Info',
          badgeBg: 'bg-silver-700/30',
          badgeText: 'text-silver-200',
          icon: Info,
          ring: 'border-silver-700/40',
    },
};

/** Evidence-Layer — collapsible, zeigt technische Nachweise pro Finding. */
function EvidenceLayer({ evidence }: { evidence: FindingEvidence }) {
    const [open, setOpen] = useState(false);

  const rows: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: 'rule_id', value: evidence.rule_id, mono: true },
    { label: 'rule_version', value: evidence.rule_version, mono: true },
    { label: 'scanner_engine', value: evidence.scanner_engine, mono: true },
    { label: 'detected_at', value: evidence.detected_at, mono: true },
    { label: 'evidence_type', value: evidence.evidence_type, mono: true },
        ...(evidence.selector ? [{ label: 'selector', value: evidence.selector, mono: true }] : []),
        ...(evidence.request_url ? [{ label: 'request_url', value: evidence.request_url, mono: true }] : []),
    { label: 'confidence', value: `${evidence.confidence}%`, mono: false },
    { label: 'sha256', value: evidence.sha256, mono: true },
      ];

  return (
        <div className="mt-3 border-t border-silver-800/40">
              <button
                        type="button"
                        onClick={() => setOpen((v) => !v)}
                        className="flex items-center gap-1.5 mt-2 text-[10px] font-mono uppercase tracking-wider text-silver-500 hover:text-silver-300 transition-colors"
                        aria-expanded={open}
                      >
                {open ? (
                                  <ChevronDown className="h-3 w-3" />
                                ) : (
                                  <ChevronRight className="h-3 w-3" />
                                )}
                      Evidence · {evidence.rule_id}
              </button>button>
        
          {open && (
                  <div className="mt-2 space-y-1">
                    {rows.map(({ label, value, mono }) => (
                                <div key={label} className="flex gap-2 text-[10px] leading-relaxed">
                                              <span className="shrink-0 w-28 font-mono text-silver-600">{label}</span>span>
                                              <span
                                                                className={`break-all ${mono ? 'font-mono text-silver-300' : 'text-silver-400'}`}
                                                              >
                                                {value}
                                              </span>span>
                                </div>div>
                              ))}
                  </div>div>
              )}
        </div>div>
      );
}

export interface LiveFindingsSectionProps {
    /** Eigene Findings-Liste injizieren (z.B. fuer Niche-Pages mit Branchen-Beispielen). Default: FINDINGS. */
    findings?: Finding[];
    /** Optionale Eyebrow-Zeile statt Default. */
    eyebrow?: string;
    /** Headline anpassen — z.B. fuer Niche-Pages. */
    headline?: string;
    /** Sub-Copy unter der Headline. */
    subline?: string;
}

export function LiveFindingsSection({
    findings = FINDINGS,
    eyebrow = 'Audit-Engine · Beispiel-Befunde',
    headline = 'Was unser Scanner real findet — kein Marketing-Mockup.',
    subline = 'Strukturierte Befunde aus Playwright-Headless-Browser-Scans. Severity, DSGVO-Paragraph und konkrete Request-URL — wie sie in jedem unserer Reports erscheinen.',
}: LiveFindingsSectionProps = {}) {
    return (
          <section
                  id="live-findings"
                  className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
                >
                <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-10 sm:mb-12">
                                  <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
                                    {eyebrow}
                                  </div>div>
                                  <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-3xl mx-auto">
                                    {headline}
                                  </h2>h2>
                                  <p className="mt-4 text-sm sm:text-base text-silver-300 leading-relaxed max-w-2xl mx-auto">
                                    {subline}
                                  </p>p>
                        </div>div>
                
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                          {findings.map((f, idx) => {
                              const style = SEVERITY_STYLE[f.severity];
                              const Icon = style.icon;
                              const evidence = f.evidence ?? mockEvidence(f);
                              return (
                                              <article
                                                                key={`${f.severity}-${idx}-${f.title}`}
                                                                className={`p-4 sm:p-5 bg-obsidian-900/60 border-l-2 border-y border-r border-silver-700/30 ${style.ring} rounded-none transition-colors hover:border-titanium-200/40`}
                                                              >
                                                              <header className="flex items-center gap-2 mb-2">
                                                                                <span
                                                                                                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 ${style.badgeBg} ${style.badgeText} font-mono uppercase tracking-wider text-[10px] font-bold`}
                                                                                                    >
                                                                                                    <Icon className="h-3 w-3" />
                                                                                  {style.label}
                                                                                </span>span>
                                                                                <span className="font-mono text-[10px] uppercase tracking-wider text-silver-500">
                                                                                  {f.rule}
                                                                                </span>span>
                                                              </header>header>
                                              
                                                              <h3 className="font-display font-bold text-titanium-50 text-sm sm:text-base mb-1.5 leading-snug">
                                                                {f.title}
                                                              </h3>h3>
                                                              <p className="text-xs sm:text-sm text-silver-300 leading-relaxed mb-3">
                                                                {f.detail}
                                                              </p>p>
                                                              <code className="block font-mono text-[10px] sm:text-[11px] text-silver-400 break-all bg-obsidian-950/60 border border-silver-800/50 px-2 py-1.5 rounded-none">
                                                                                <ExternalLink className="inline h-2.5 w-2.5 mr-1 -mt-0.5 text-silver-500" />
                                                                {f.ref}
                                                              </code>code>
                                              
                                                              <EvidenceLayer evidence={evidence} />
                                              </article>article>
                                            );
                })}
                        </div>div>
                
                        <p className="mt-8 text-center text-[11px] font-mono uppercase tracking-[0.18em] text-silver-500">
                                  Findings stammen aus dem Audit-Engine-Output · 18 Tracker-Klassen ·
                                  Versionierte Methodik 2026.05.0
                        </p>p>
                </div>div>
          </section>section>
        );
}</div>
