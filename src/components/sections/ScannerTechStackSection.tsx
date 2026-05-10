import { Globe, Clock, Network, Cookie, FileLock, MapPin } from 'lucide-react';

/**
 * ScannerTechStackSection — Technische Glaubwuerdigkeit sichtbar machen.
 *
 * Sechs konkrete Technologie-Bausteine, mit denen die Audit-Engine arbeitet.
 * Goal: Procurement / DSB / Tech-Lead sieht "OK, das ist nicht Marketing,
 * das ist real Engineering" — und versteht, warum unsere Findings belastbar
 * sind (Headless-Browser statt DOM-Scrape, Timing-Analyse statt Heuristik).
 *
 * Begleitet LiveFindings (was wir finden) + ReportPreview (wie der Output
 * strukturiert ist). Diese Section antwortet auf "wie funktioniert das?".
 */

interface TechItem {
  icon: typeof Globe;
  label: string;
  detail: string;
  /** Konkrete Tech-Referenz, optional */
  tag?: string;
}

const TECH_STACK: TechItem[] = [
  {
    icon: Globe,
    label: 'Playwright Rendering Engine',
    detail:
      'Headless-Browser simuliert echtes Nutzerverhalten — fuehrt JavaScript aus, wartet auf Hydration, klickt synthetisch. Kein statischer DOM-Scrape, sonst entgehen alle dynamisch geladenen Tracker.',
    tag: 'Microsoft Playwright · Chromium 130',
  },
  {
    icon: Clock,
    label: 'Consent Timing Analyse',
    detail:
      'Misst, welche Tracker vor dem ersten Consent-Event feuern. Pro Request: exakter Timestamp gegen User-Interaction-Marker — der haeufigste DSGVO-Verstoss bei Cookie-Banner-Setups.',
    tag: 'Network-Trace · Performance-API · Click-Synthesis',
  },
  {
    icon: Network,
    label: 'Third-Party Detection',
    detail:
      'Klassifiziert alle externen Requests nach Zweck, Land und Rechtsgrundlage. Match gegen kuratierte Tracker-Registry (18 Klassen, versionierte Releases) — mit AVV- und Schrems-II-Status pro Treffer.',
    tag: 'Tracker-Registry 2026.05.0',
  },
  {
    icon: Cookie,
    label: 'Cookie-Klassifikation',
    detail:
      'Automatische Einordnung jedes gesetzten Cookies nach Kategorie (notwendig / Praeferenzen / Statistik / Marketing), Lebensdauer und Uebertragungsland. Setzungs-Zeitpunkt vor/nach Consent protokolliert.',
    tag: 'TTDSG § 25 · ePrivacy-RL · IAB TCF v2.2',
  },
  {
    icon: FileLock,
    label: 'Audit-Trail Logging',
    detail:
      'Alle Findings signiert, versioniert und revisionssicher. Snapshot + SHA-256-Hash + Timestamp + Methodik-Version persistiert. Reproduzierbar gegenueber Aufsichtsbehoerden auch nach 6+ Monaten.',
    tag: 'Evidence Vault · SHA-256 · ISO-8601',
  },
  {
    icon: MapPin,
    label: 'EU-Hosting Made in Germany',
    detail:
      'Keine Drittlanduebermittlung. Scanner laeuft in Frankfurt (Hetzner), Postgres in eu-central-1 (Supabase). Sub-Prozessoren-Liste oeffentlich, AVV nach Art. 28 DSGVO inklusive.',
    tag: 'Frankfurt · BSI C5-Track · ISO 27001',
  },
];

export interface ScannerTechStackSectionProps {
  eyebrow?: string;
  headline?: string;
  subline?: string;
}

export function ScannerTechStackSection({
  eyebrow = 'Technologie',
  headline = 'Wie der Scanner arbeitet und warum Findings belastbar sind.',
  subline = 'Sechs Technologie-Bausteine, mit denen die Audit-Engine Findings produziert. Wer Compliance-Software einkauft, will wissen wie die Erkennung funktioniert — hier ist sie.',
}: ScannerTechStackSectionProps = {}) {
  return (
    <section
      id="scanner-tech-stack"
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-silver-700/30">
          {TECH_STACK.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.label}
                className="bg-obsidian-900/80 p-5 sm:p-6 hover:bg-obsidian-900 transition-colors"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-gold-400 shrink-0" />
                  <h3 className="font-display font-bold text-titanium-50 text-base sm:text-lg leading-snug">
                    {item.label}
                  </h3>
                </div>
                <p className="text-sm text-silver-300 leading-relaxed mb-3">
                  {item.detail}
                </p>
                {item.tag && (
                  <div className="font-mono text-[10px] uppercase tracking-wider text-silver-500 border-t border-silver-800/50 pt-2 mt-2">
                    {item.tag}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <p className="mt-8 text-center text-[11px] font-mono uppercase tracking-[0.18em] text-silver-500">
          Stack ist Teil der Methodik 2026.05.0 · vollstaendig unter{' '}
          <a href="/legal/methodology" className="hover:text-titanium-200">
            /legal/methodology
          </a>{' '}
          dokumentiert
        </p>
      </div>
    </section>
  );
}
