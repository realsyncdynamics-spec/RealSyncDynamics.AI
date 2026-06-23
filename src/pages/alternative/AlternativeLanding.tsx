import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, X, Minus, type LucideIcon } from 'lucide-react';

/**
 * Alternative-Landing Shell (Komposition).
 *
 * Eigener Seitentyp neben `BranchenLanding`: Wettbewerbs-Vergleichsseiten
 * (OneTrust, Cookiebot, Usercentrics, DataGuard, Borlabs, Proliance).
 * Übernimmt das identische Chrome (themed Header, Hero, finale CTA-Box,
 * Footer, optionales JSON-LD) per Config; der seiten-spezifische Body
 * bleibt als `children`. Exportiert zusätzlich die wiederkehrenden Bausteine
 * `Section`, `ComparisonTable` und `WarningCallout`.
 *
 * Theme-Klassen sind *literale* Tailwind-Strings (purge-safe). Container
 * ist `max-w-4xl` (Vergleichstabellen sind breiter als Branchen-Content).
 */

interface AltCtaButton {
  to: string;
  label: string;
  /** primary = security-Fill (mit Pfeil) · secondary = Outline · ghost = Text */
  variant?: 'primary' | 'secondary' | 'ghost';
}

export interface AlternativeConfig {
  headerTitle: ReactNode;
  /** Header-Icon (links oben) */
  Icon: LucideIcon;
  /** Literale Tailwind-Gradient-Klassen für die Header-Icon-Box */
  iconGradient: string;
  /** Hero-Badge-Icon (kann vom Header-Icon abweichen, z. B. Euro/Globe) */
  badgeIcon: LucideIcon;
  /** Literale Tailwind-Klassen für die Hero-Badge (border + bg + text) */
  badgeClass: string;
  badgeText: ReactNode;
  headline: ReactNode;
  subline: ReactNode;
  /** Lead-Breite — Default max-w-xl */
  sublineMaxWidth?: string;
  cta: {
    heading: ReactNode;
    sub?: ReactNode;
    buttons: AltCtaButton[];
  };
  /** Footer-Links. Default: Datenschutz + AVV */
  footerLinks?: Array<{ to: string; label: string }>;
  jsonLd?: { headline: string; description: string; datePublished: string };
}

const DEFAULT_FOOTER_LINKS = [
  { to: '/legal/privacy', label: 'Datenschutz' },
  { to: '/legal/avv', label: 'AVV' },
];

const CTA_BASE =
  'inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm rounded-none';
const CTA_VARIANTS: Record<NonNullable<AltCtaButton['variant']>, string> = {
  primary: 'bg-security-500 hover:bg-security-600 text-white font-bold',
  secondary:
    'bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 font-bold',
  ghost: 'text-titanium-400 hover:text-titanium-200',
};

export function AlternativeLanding({
  config,
  children,
}: {
  config: AlternativeConfig;
  children: ReactNode;
}) {
  const footerLinks = config.footerLinks ?? DEFAULT_FOOTER_LINKS;
  const sublineMaxWidth = config.sublineMaxWidth ?? 'max-w-xl';

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link
          to="/"
          className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-none ${config.iconGradient} flex items-center justify-center`}
          >
            <config.Icon className="h-4 w-4 text-white" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">
            {config.headerTitle}
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Hero */}
          <div className="text-center">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 border text-xs font-bold uppercase tracking-wider rounded-none mb-5 ${config.badgeClass}`}
            >
              <config.badgeIcon className="h-3 w-3" /> {config.badgeText}
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              {config.headline}
            </h1>
            <p
              className={`text-lg text-titanium-300 ${sublineMaxWidth} mx-auto leading-relaxed`}
            >
              {config.subline}
            </p>
          </div>

          {/* Seiten-spezifischer Body */}
          {children}

          {/* Finale CTA-Box */}
          <div className="mt-12 p-6 sm:p-8 bg-obsidian-900 border border-security-700 rounded-none">
            <h2 className="font-display font-bold text-titanium-50 text-xl mb-2">
              {config.cta.heading}
            </h2>
            {config.cta.sub && (
              <p className="text-sm text-titanium-300 mb-4 leading-relaxed">{config.cta.sub}</p>
            )}
            <div
              className={
                config.cta.sub
                  ? 'flex flex-col sm:flex-row gap-2'
                  : 'flex flex-col sm:flex-row gap-2 mt-4'
              }
            >
              {config.cta.buttons.map((btn) => {
                const variant = btn.variant ?? 'secondary';
                return (
                  <Link
                    key={btn.to + btn.label}
                    to={btn.to}
                    className={`${CTA_BASE} ${CTA_VARIANTS[variant]}`}
                  >
                    {btn.label}
                    {variant === 'primary' && <ArrowRight className="h-4 w-4" />}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-titanium-900 mt-12 py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-3">
            {footerLinks.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-titanium-300">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>

      {config.jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: config.jsonLd.headline,
              description: config.jsonLd.description,
              datePublished: config.jsonLd.datePublished,
              inLanguage: 'de-DE',
              author: { '@type': 'Organization', name: 'RealSync Dynamics' },
            }),
          }}
        />
      )}
    </div>
  );
}

/** Body-Sektion mit Titel. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-display font-bold text-titanium-50 mb-3">{title}</h2>
      <div className="prose prose-invert max-w-none text-titanium-300 text-sm sm:text-base leading-relaxed space-y-3">
        {children}
      </div>
    </section>
  );
}

/** Amber Warnhinweis-Callout (z. B. „Ehrlicher Hinweis"). */
export function WarningCallout({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 bg-amber-950/20 border border-amber-900 rounded-none">
      <p className="text-sm text-amber-200 leading-relaxed">{children}</p>
    </div>
  );
}

export interface ComparisonRow {
  /** Feature-Bezeichnung */
  f: string;
  /** Wert beim Wettbewerber */
  o: string;
  /** Wert bei RealSync */
  r: string;
}

/** Feature-Direktvergleich (Wettbewerber vs. RealSync). */
export function ComparisonTable({
  competitor,
  rows,
}: {
  competitor: string;
  rows: ComparisonRow[];
}) {
  return (
    <div className="bg-obsidian-900 border border-titanium-900 rounded-none overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-obsidian-950 text-[11px] font-bold text-titanium-400 uppercase tracking-wider">
          <tr>
            <th className="text-left px-4 py-3">Feature</th>
            <th className="text-center px-4 py-3 w-32">{competitor}</th>
            <th className="text-center px-4 py-3 w-32 text-emerald-300">RealSync</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-titanium-900">
          {rows.map((row) => (
            <tr key={row.f} className="hover:bg-obsidian-950">
              <td className="px-4 py-3 text-titanium-200">{row.f}</td>
              <td className="px-4 py-3 text-center">{cell(row.o)}</td>
              <td className="px-4 py-3 text-center">{cell(row.r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function cell(v: string): ReactNode {
  if (v === 'yes') return <Check className="h-4 w-4 text-emerald-400 inline" />;
  if (v === 'no') return <X className="h-4 w-4 text-red-400 inline" />;
  if (v === 'partial') return <Minus className="h-4 w-4 text-amber-400 inline" />;
  return <span className="text-xs text-titanium-300">{v}</span>;
}
