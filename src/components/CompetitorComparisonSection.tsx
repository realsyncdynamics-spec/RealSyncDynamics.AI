import { Link } from 'react-router-dom';
import { Check, X, Minus, ArrowRight } from 'lucide-react';

/**
 * CompetitorComparisonSection — wiederverwendbare Vergleichstabelle fuer
 * /cookiebot-alternative, /onetrust-alternative, /dataguard-alternative.
 *
 * Spalten:
 *   Capability  |  RealSyncDynamicsAI  |  Competitor  |  Why it matters
 *
 * Der "Why it matters"-Spalte ist der eigentliche SEO- und Sales-Hebel:
 * Sie sagt nicht nur "was wir koennen", sondern erklaert, *warum* das
 * Capability fuer DSGVO/AI-Act-Compliance entscheidend ist. Damit hebt
 * sich die Page von generischen Feature-Checklisten ab.
 *
 * Tonalitaet: sachlich, vergleichend, professionell — kein Bashing.
 * Ehrliche "partial" / "yes" / "no"-Wertungen mit Begruendung.
 */

export type CapabilitySupport = 'yes' | 'partial' | 'no';

export interface CapabilityRow {
  /** Strategische Capability-Bezeichnung (englisch fuer SEO-Keyword-Match). */
  capability: string;
  /** Unsere Position. Default: 'yes' fuer alle 9 Strategie-Rows. */
  ours: CapabilitySupport;
  /** Position des Wettbewerbers — 'partial' wo Anbieter Teilfunktion abdeckt. */
  theirs: CapabilitySupport;
  /** Kurztext (sichtbar) der Wertung kontextualisiert. Optional. */
  theirsNote?: string;
  /** Erklaerung warum diese Capability DSGVO-/AI-Act-relevant ist. */
  whyItMatters: string;
}

export interface CompetitorComparisonProps {
  /** Eigenname des Wettbewerbers — Spalten-Header. */
  competitorName: string;
  /** Kurzer Positionierungs-Satz unter Tabelle, z.B. "Cookie-CMP" oder "DSB-Beratung". */
  competitorPositioning: string;
  /** 9 strategische Capability-Vergleiche. */
  rows: CapabilityRow[];
  /** Optionale Eyebrow-Zeile. Default: "Vergleich · Compliance-Capabilities" */
  eyebrow?: string;
  /** Optionaler Titel. Default: "RealSyncDynamicsAI vs {competitorName}" */
  headline?: string;
}

const SUPPORT_STYLE: Record<
  CapabilitySupport,
  { label: string; icon: typeof Check; tone: string }
> = {
  yes: { label: 'Ja', icon: Check, tone: 'text-emerald-300' },
  partial: { label: 'Teilweise', icon: Minus, tone: 'text-amber-300' },
  no: { label: 'Nein', icon: X, tone: 'text-red-300' },
};

export function CompetitorComparisonSection({
  competitorName,
  competitorPositioning,
  rows,
  eyebrow = 'Vergleich · Compliance-Capabilities',
  headline,
}: CompetitorComparisonProps) {
  const finalHeadline = headline ?? `RealSyncDynamicsAI vs ${competitorName}`;
  const migrationHref = `/contact-sales?intent=migration&from=${encodeURIComponent(
    competitorName.toLowerCase().replace(/\s+/g, '-'),
  )}`;

  return (
    <section
      id="competitor-comparison"
      className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
            {eyebrow}
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight max-w-3xl mx-auto">
            {finalHeadline}
          </h2>
          <p className="mt-4 text-sm sm:text-base text-silver-300 leading-relaxed max-w-2xl mx-auto">
            Neun Capabilities, die für moderne DSGVO- und AI-Act-Compliance entscheidend sind.
            {' '}{competitorName} ist {competitorPositioning} — RealSyncDynamicsAI ist{' '}
            <strong className="text-titanium-100">automatisierte Compliance-Infrastruktur</strong>.
          </p>
        </div>

        <div className="bg-obsidian-900/80 border border-silver-700/40 rounded-none overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-obsidian-950/80 text-[11px] font-mono uppercase tracking-wider text-silver-400">
                <th className="text-left px-4 py-3 min-w-[180px]">Capability</th>
                <th className="text-center px-4 py-3 w-32 text-titanium-100">RealSyncDynamicsAI</th>
                <th className="text-center px-4 py-3 w-32">{competitorName}</th>
                <th className="text-left px-4 py-3 min-w-[280px]">Why it matters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-silver-700/20">
              {rows.map((row) => {
                const ours = SUPPORT_STYLE[row.ours];
                const theirs = SUPPORT_STYLE[row.theirs];
                const OursIcon = ours.icon;
                const TheirsIcon = theirs.icon;
                return (
                  <tr key={row.capability} className="hover:bg-obsidian-950/40">
                    <td className="px-4 py-3 text-titanium-100 font-medium">
                      {row.capability}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center ${ours.tone}`}>
                        <OursIcon className="h-4 w-4" />
                        <span className="sr-only">{ours.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex flex-col items-center gap-1 ${theirs.tone}`}>
                        <TheirsIcon className="h-4 w-4" />
                        {row.theirsNote && (
                          <span className="text-[10px] font-mono uppercase tracking-wider text-silver-500">
                            {row.theirsNote}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-silver-300 leading-relaxed">
                      {row.whyItMatters}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            to={migrationHref}
            className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-none"
          >
            Von {competitorName} zu kontinuierlicher Compliance wechseln{' '}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/audit?source=competitor-comparison"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-sm font-semibold rounded-none transition-colors"
          >
            Free DSGVO-Audit starten
          </Link>
        </div>

        <p className="mt-4 text-center text-[11px] font-mono uppercase tracking-[0.18em] text-silver-500">
          Vergleich basiert auf öffentlich dokumentierten Funktionen ({competitorName}: Stand 2026-05) ·
          Sachliche Wertung, kein Bashing
        </p>
      </div>
    </section>
  );
}
