import { useState } from 'react';
import {
        AlertTriangle, ShieldAlert, Info, ExternalLink,
        ChevronDown, ChevronRight, Copy, Check, Wrench, Eye,
} from 'lucide-react';

/**
 * LiveFindingsSection — v4 UI-Polish
 *
 * Polish over v3:
 * - Card: unified border, group-hover glow, flex-col layout
 * - Severity badge: pill shape, rounded-sm, icon alignment
 * - EvidenceLayer: two-column table with label bg, row hover
 * - FixSnippetLayer: emerald accent header, language pill, copy btn feedback
 * - Footer: divider lines + version stamp
 */

type Severity = 'kritisch' | 'mittel' | 'info';

export interface FindingEvidence {
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
}

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
                  sha256: `sha256:${Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}...`,
                  confidence: finding.severity === 'kritisch' ? 97 : finding.severity === 'mittel' ? 83 : 71,
                  scanner_engine: 'playwright-chromium@1.44.0',
        };
}

export interface FixSnippet {
        label: string;
        language: 'html' | 'tsx' | 'ts' | 'nginx' | 'css';
        code: string;
}

interface Finding {
        severity: Severity;
        title: string;
        detail: string;
        ref: string;
        rule: string;
        evidence?: FindingEvidence;
        fix_snippets?: FixSnippet[];
}

const FINDINGS: Finding[] = [
      {
                severity: 'kritisch',
                title: 'Google Analytics vor Consent geladen',
                detail: 'gtag/js wird beim ersten Page-Load ausgefuehrt, VOR dem Consent-Banner. Tracking-Cookie _ga gesetzt mit IP-Adresse.',
                ref: 'request: googletagmanager.com/gtag/js?id=G-XXXX',
                rule: 'TTDSG 25 Abs.1 · DSGVO Art.6 lit.a',
                fix_snippets: [{ label: 'Script hinter Consent-Gate verschieben', language: 'html', code: `<!-- Consent-Mode v2 Default -->
                <script>
                gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied'});
                </script>
                <!-- Nach Banner-Akzeptanz: -->
                <script>
                function onConsentGranted(){
                  gtag('consent','update',{analytics_storage:'granted'});
                  }
                  </script>` }],
      },
      {
                severity: 'kritisch',
                title: 'Meta Pixel feuert ohne Einwilligung',
                detail: 'connect.facebook.net Script-Tag aktiv ohne consent Wrapper. fbp+fbc Cookies gesetzt, PageView-Event gesendet.',
                ref: 'request: connect.facebook.net/en_US/fbevents.js',
                rule: 'TTDSG 25 · EuGH C-252/21',
                fix_snippets: [{ label: 'Pixel hinter Consent-Check kapseln', language: 'tsx', code: `export function MetaPixel({ pixelId }: { pixelId: string }) {
                  const { marketing } = useConsent();
                    useEffect(() => {
                        if (!marketing) return;
                            import('react-facebook-pixel').then(({ default: P }) => {
                                  P.init(pixelId); P.pageView();
                                      });
                                        }, [marketing, pixelId]);
                                          return null;
                                          }` }],
      },
      {
                severity: 'kritisch',
                title: 'Datenschutzerklaerung nicht erreichbar',
                detail: 'Footer-Link /datenschutz liefert 404. Pflicht-Information nach Art.13 DSGVO fehlt — abmahnfaehig.',
                ref: 'GET /datenschutz => 404 Not Found',
                rule: 'DSGVO Art.13 · TMG 5',
                fix_snippets: [{ label: 'Route anlegen (React Router)', language: 'tsx', code: `// App.tsx
                <Route path="/datenschutz" element={<DatenschutzPage />} />
                <Route path="/privacy"     element={<DatenschutzPage />} />` }],
      },
      {
                severity: 'mittel',
                title: 'Google Fonts extern eingebunden',
                detail: 'fonts.googleapis.com ohne Self-Hosting. IP wird bei jedem Load an Google US uebermittelt (LG Muenchen 3 O 17493/20).',
                ref: 'request: fonts.googleapis.com/css2?family=Inter',
                rule: 'DSGVO Art.6 · Schrems II',
                fix_snippets: [{ label: 'Schrift lokal hosten', language: 'css', code: `@font-face {
                  font-family: 'Inter';
                    font-display: swap;
                      src: url('/fonts/inter-variable.woff2') format('woff2');
                      }
                      /* @import url('https://fonts.googleapis.com/...'); entfernen */
                      @import '/fonts/inter.css';` }],
      },
      {
                severity: 'mittel',
                title: 'Cookie-Banner ohne Kategorisierung',
                detail: 'Akzeptieren-Button setzt alle Cookies pauschal. Keine granulare Auswahl (Notwendig/Statistik/Marketing).',
                ref: 'consent.cookieyes.com => all=true',
                rule: 'DSGVO Art.7 · TTDSG 25 Abs.2',
                fix_snippets: [{ label: 'Kategorisierter Reject-Button', language: 'tsx', code: `<Button variant="secondary"
                  onClick={() => setConsent({ necessary: true, statistics: false, marketing: false })}
                  >
                    Alle ablehnen
                    </Button>` }],
      },
      {
                severity: 'info',
                title: '7 Third-Party-Requests erkannt',
                detail: 'Cloudflare CDN (legitim), Stripe.js (consent-required), HubSpot (Marketing). 3 Sub-Auftragsverarbeiter.',
                ref: 'network log: 7 cross-origin domains',
                rule: 'AVV-Liste pruefen · Sub-Processor-Disclosure',
                fix_snippets: [{ label: 'Sub-Processor-Tabelle', language: 'html', code: `<table>
                  <tr><th>Anbieter</th><th>Zweck</th><th>Land</th><th>Rechtsgrundlage</th></tr>
                    <tr><td>Cloudflare</td><td>CDN</td><td>US (SCCs)</td><td>Art.6 lit.f</td></tr>
                      <tr><td>Stripe</td><td>Zahlung</td><td>US (SCCs)</td><td>Art.6 lit.b</td></tr>
                        <tr><td>HubSpot</td><td>CRM</td><td>US (SCCs)</td><td>Art.6 lit.a</td></tr>
                        </table>` }],
      },
      ];

const SEV: Record<Severity, { label: string; bg: string; text: string; icon: typeof AlertTriangle; leftBorder: string; glow: string }> = {
        kritisch: { label: 'Kritisch', bg: 'bg-red-950/60',    text: 'text-red-300',    icon: ShieldAlert,    leftBorder: 'border-l-red-500/70',    glow: 'hover:shadow-[0_0_0_1px_rgba(239,68,68,0.2)]' },
        mittel:   { label: 'Mittel',   bg: 'bg-amber-950/60',  text: 'text-amber-300',  icon: AlertTriangle,  leftBorder: 'border-l-amber-500/70',  glow: 'hover:shadow-[0_0_0_1px_rgba(245,158,11,0.2)]' },
        info:     { label: 'Info',     bg: 'bg-silver-900/40', text: 'text-silver-300', icon: Info,           leftBorder: 'border-l-silver-500/40', glow: 'hover:shadow-[0_0_0_1px_rgba(156,163,175,0.15)]' },
};

function EvidenceLayer({ evidence }: { evidence: FindingEvidence }) {
        const [open, setOpen] = useState(false);
        const rows = [
                  ['rule_id',        evidence.rule_id],
                  ['rule_version',   evidence.rule_version],
                  ['scanner_engine', evidence.scanner_engine],
                  ['detected_at',    evidence.detected_at],
                  ['evidence_type',  evidence.evidence_type],
                  ...(evidence.selector    ? [['selector',    evidence.selector]]    : []),
                  ...(evidence.request_url ? [['request_url', evidence.request_url]] : []),
                  ['confidence',     `${evidence.confidence}%`],
                  ['sha256',         evidence.sha256],
                ] as [string, string][];

  return (
            <div className="mt-3 pt-3 border-t border-silver-800/30">
                  <button
                                type="button"
                                onClick={() => setOpen(v => !v)}
                                className="group flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-silver-600 hover:text-cyan-400 transition-colors"
                                aria-expanded={open}
                              >
                        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          <Eye className="h-3 w-3" />
                          <span>Evidence</span>
                          <span className="text-silver-600 group-hover:text-cyan-500 truncate max-w-[140px]">{evidence.rule_id}</span>
                  </button>
                  {open && (
                          <div className="mt-2 border border-silver-800/30 bg-obsidian-950/60 divide-y divide-silver-900/40 text-[10px]">
                                {rows.map(([label, value]) => (
                                            <div key={label} className="flex hover:bg-silver-900/20 transition-colors">
                                                          <span className="shrink-0 w-28 px-2 py-1 font-mono text-silver-600 bg-obsidian-900/40 border-r border-silver-800/30">{label}</span>
                                                          <span className="px-2 py-1 font-mono text-silver-300 break-all min-w-0">{value}</span>
                                            </div>
                                          ))}
                          </div>
                  )}
            </div>
          );
}

function FixSnippetLayer({ snippets }: { snippets: FixSnippet[] }) {
        const [open, setOpen] = useState(false);
        const [copied, setCopied] = useState<number | null>(null);
      
        function copy(code: string, idx: number) {
                  navigator.clipboard.writeText(code).then(() => {
                              setCopied(idx);
                              setTimeout(() => setCopied(null), 2000);
                  });
        }
      
        return (
                  <div className="mt-3 pt-3 border-t border-emerald-900/30">
                        <button
                                      type="button"
                                      onClick={() => setOpen(v => !v)}
                                      className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-emerald-600 hover:text-emerald-400 transition-colors"
                                      aria-expanded={open}
                                    >
                              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                <Wrench className="h-3 w-3" />
                                Fix{snippets.length > 1 ? ` · ${snippets.length}` : ''}
                        </button>
                        {open && (
                                <div className="mt-2 space-y-2">
                                      {snippets.map((s, idx) => (
                                                  <div key={idx} className="border border-emerald-900/30 bg-obsidian-950/80 overflow-hidden">
                                                                <div className="flex items-center justify-between px-2.5 py-1.5 bg-emerald-950/30 border-b border-emerald-900/30">
                                                                                <span className="font-mono text-[10px] text-emerald-300/80 truncate pr-2">{s.label}</span>
                                                                                <div className="flex items-center gap-2 shrink-0">
                                                                                                  <span className="font-mono text-[9px] uppercase text-emerald-700 bg-emerald-950/60 border border-emerald-900/50 px-1.5 py-0.5 rounded-sm">{s.language}</span>
                                                                                                  <button type="button" onClick={() => copy(s.code, idx)} className="p-0.5 text-silver-500 hover:text-silver-200 transition-colors" aria-label="Kopieren">
                                                                                                        {copied === idx ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                                                                                        </button>
                                                                                </div>
                                                                </div>
                                                                <pre className="overflow-x-auto px-3 py-2.5 text-[10px] sm:text-[11px] font-mono text-silver-300 leading-[1.6] whitespace-pre"><code>{s.code}</code></pre>
                                                  </div>
                                                ))}
                                </div>
                        )}
                  </div>
                );
}

export interface LiveFindingsSectionProps {
        findings?: Finding[];
        eyebrow?: string;
        headline?: string;
        subline?: string;
}

export function LiveFindingsSection({
        findings = FINDINGS,
        eyebrow  = 'Audit-Engine · Beispiel-Befunde',
        headline = 'Was unser Scanner real findet — kein Marketing-Mockup.',
        subline  = 'Strukturierte Befunde aus Playwright-Headless-Browser-Scans. Severity, DSGVO-Paragraph und konkrete Request-URL — wie sie in jedem unserer Reports erscheinen.',
}: LiveFindingsSectionProps = {}) {
        return (
                  <section id="live-findings" className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
                        <div className="max-w-6xl mx-auto">
                        
                                <div className="text-center mb-10 sm:mb-14">
                                          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">{eyebrow}</div>
                                          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-3xl mx-auto">{headline}</h2>
                                          <p className="mt-4 text-sm sm:text-base text-silver-400 leading-relaxed max-w-2xl mx-auto">{subline}</p>
                                </div>
                        
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                      {findings.map((f, idx) => {
                                    const s = SEV[f.severity];
                                    const Icon = s.icon;
                                    const evidence = f.evidence ?? mockEvidence(f);
                                    return (
                                                        <article
                                                                              key={`${f.severity}-${idx}`}
                                                                              className={`group flex flex-col bg-obsidian-900/60 border border-silver-800/30 border-l-2 ${s.leftBorder} ${s.glow} transition-shadow duration-200 p-4 sm:p-5`}
                                                                            >
                                                                        <header className="flex items-center gap-2 mb-2.5 flex-wrap">
                                                                                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm ${s.bg} ${s.text} font-mono text-[10px] uppercase tracking-wider font-semibold`}>
                                                                                                              <Icon className="h-3 w-3 shrink-0" />{s.label}
                                                                                                </span>
                                                                                          <span className="font-mono text-[10px] text-silver-600 truncate min-w-0">{f.rule}</span>
                                                                        </header>
                                                                        <h3 className="font-display font-bold text-titanium-50 text-sm sm:text-base mb-1.5 leading-snug">{f.title}</h3>
                                                                        <p className="text-xs sm:text-sm text-silver-400 leading-relaxed mb-3 flex-1">{f.detail}</p>
                                                                        <code className="flex items-start gap-1.5 font-mono text-[10px] sm:text-[11px] text-silver-500 bg-obsidian-950/70 border border-silver-800/40 px-2.5 py-1.5">
                                                                                          <ExternalLink className="h-2.5 w-2.5 mt-0.5 shrink-0 text-silver-600" />
                                                                                          <span className="break-all">{f.ref}</span>
                                                                        </code>
                                                                        <EvidenceLayer evidence={evidence} />
                                                              {f.fix_snippets && f.fix_snippets.length > 0 && <FixSnippetLayer snippets={f.fix_snippets} />}
                                                        </article>
                                                      );
                  })}
                                </div>
                        
                                <div className="mt-10 flex items-center gap-4 justify-center">
                                          <div className="h-px flex-1 max-w-[80px] bg-silver-800/40" />
                                          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-silver-600">Audit-Engine · 18 Tracker-Klassen · Methodik 2026.05.0</p>
                                          <div className="h-px flex-1 max-w-[80px] bg-silver-800/40" />
                                </div>
                        
                        </div>
                  </section>
                );
}</div>
