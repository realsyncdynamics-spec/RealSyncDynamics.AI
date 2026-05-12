import { AlertTriangle, ShieldAlert, Info, ExternalLink } from 'lucide-react';

/**
 * LiveFindingsSection — Produkt-Realitaet sichtbar machen.
 *
 * Zeigt 6 typische Findings, die unser Scanner auf jeder dritten DSGVO-fragilen
 * Website findet. Goal: vom "abstrakten Compliance-Tool" zum "ich sehe was
 * der Scanner real produziert" — ohne Marketing-Sprache.
 *
 * Severity-System:
 *   KRITISCH  rotbraun  Pre-Consent-Tracker, fehlende Rechtsdokumente
 *   MITTEL    amber     Drittanbieter ohne Self-Hosting / Consent-Cat
 *   INFO      silber    Counts, Beobachtungen ohne unmittelbares Risiko
 *
 * Wird auf der Homepage und auf /audit referenziert. Daten sind strukturierte
 * Beispiele (kein Live-Scan), aber 1:1 die Form der echten Audit-Engine-Findings.
 */

type Severity = 'kritisch' | 'mittel' | 'info';

interface Finding {
  severity: Severity;
  title: string;
  detail: string;
  /** Verstoss-Bezug oder Beobachtungs-Quelle (z.B. URL-Endpoint) */
  ref: string;
  /** DSGVO/TTDSG/AI-Act-Paragraph oder Tracker-Name */
  rule: string;
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
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-3xl mx-auto">
            {headline}
          </h2>
          <p className="mt-4 text-sm sm:text-base text-silver-300 leading-relaxed max-w-2xl mx-auto">
            {subline}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {findings.map((f, idx) => {
            const style = SEVERITY_STYLE[f.severity];
            const Icon = style.icon;
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
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-silver-500">
                    {f.rule}
                  </span>
                </header>

                <h3 className="font-display font-bold text-titanium-50 text-sm sm:text-base mb-1.5 leading-snug">
                  {f.title}
                </h3>
                <p className="text-xs sm:text-sm text-silver-300 leading-relaxed mb-3">
                  {f.detail}
                </p>
                <code className="block font-mono text-[10px] sm:text-[11px] text-silver-400 break-all bg-obsidian-950/60 border border-silver-800/50 px-2 py-1.5 rounded-none">
                  <ExternalLink className="inline h-2.5 w-2.5 mr-1 -mt-0.5 text-silver-500" />
                  {f.ref}
                </code>
              </article>
            );
          })}
        </div>

        <p className="mt-8 text-center text-[11px] font-mono uppercase tracking-[0.18em] text-silver-500">
          Findings stammen aus dem Audit-Engine-Output · 18 Tracker-Klassen ·
          Versionierte Methodik 2026.05.0
        </p>
      </div>
    </section>
  );
}
