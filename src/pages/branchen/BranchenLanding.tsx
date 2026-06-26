import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, type LucideIcon } from 'lucide-react';

/**
 * Branchen-Landing Shell (Komposition).
 *
 * Übernimmt das nachweislich identische Chrome der Branchen-Seiten
 * (HealthTech, LegalTech, FinTech, Public Sector, Steuerberater):
 * themed Header, Hero (Badge + H1 + Lead), finale CTA-Box, Footer und
 * optionales JSON-LD. Der seiten-spezifische, SEO-relevante Body bleibt
 * bewusst als `children` (JSX) erhalten — anders als das daten-getriebene
 * `NicheLanding`-Template, das nur für *uniforme* Seiten passt.
 *
 * Theme-Klassen werden als *literale* Tailwind-Strings übergeben (kein
 * dynamisches Zusammenbauen), damit der Tailwind-Content-Scanner sie sieht.
 */

interface BranchenCtaButton {
  to: string;
  label: string;
  /** primary = security-Fill (mit Pfeil) · secondary = Outline · ghost = Text */
  variant?: 'primary' | 'secondary' | 'ghost';
}

export interface BranchenConfig {
  /** Header-Titel rechts neben dem Icon */
  headerTitle: ReactNode;
  /** Branchen-Icon (Header + Hero-Badge) */
  Icon: LucideIcon;
  /** Literale Tailwind-Gradient-Klassen für die Icon-Box im Header */
  iconGradient: string;
  /** Literale Tailwind-Klassen für die Hero-Badge (border + bg + text) */
  badgeClass: string;
  /** Text in der Hero-Badge */
  badgeText: ReactNode;
  /** H1 — ReactNode, um Highlight-Spans zu erhalten */
  headline: ReactNode;
  /** Lead-Absatz unter der H1 */
  subline: ReactNode;
  cta: {
    heading: ReactNode;
    sub?: ReactNode;
    buttons: BranchenCtaButton[];
  };
  /** Footer-Links. Default: Datenschutz + AVV */
  footerLinks?: Array<{ to: string; label: string }>;
  /** Optionales Article-JSON-LD für SEO */
  jsonLd?: { headline: string; description: string; datePublished: string };
}

const DEFAULT_FOOTER_LINKS = [
  { to: '/legal/privacy', label: 'Datenschutz' },
  { to: '/legal/avv', label: 'AVV' },
];

const CTA_BASE =
  'inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm rounded-none';
const CTA_VARIANTS: Record<NonNullable<BranchenCtaButton['variant']>, string> = {
  primary: 'bg-security-500 hover:bg-security-600 text-white font-bold',
  secondary:
    'bg-obsidian-950 border border-titanium-700 hover:border-security-500 text-titanium-200 font-bold',
  ghost: 'text-titanium-400 hover:text-titanium-200',
};

export function BranchenLanding({
  config,
  children,
}: {
  config: BranchenConfig;
  children: ReactNode;
}) {
  const footerLinks = config.footerLinks ?? DEFAULT_FOOTER_LINKS;

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
        <div className="max-w-3xl mx-auto space-y-10">
          {/* Hero */}
          <div className="text-center">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 border text-xs font-bold uppercase tracking-wider rounded-none mb-5 ${config.badgeClass}`}
            >
              <config.Icon className="h-3 w-3" /> {config.badgeText}
            </div>
            <h1 className="text-3xl sm:text-5xl font-display font-bold text-titanium-50 tracking-tight leading-tight mb-4">
              {config.headline}
            </h1>
            <p className="text-lg text-titanium-300 max-w-xl mx-auto leading-relaxed">
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
              <p className="text-sm text-titanium-300 leading-relaxed mb-4">{config.cta.sub}</p>
            )}
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
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
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 sm:justify-between text-xs text-titanium-500">
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

/** Body-Sektion mit Titel — geteilt von allen Branchen-Seiten. */
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

/** Use-Case-Karten-Grid (2-spaltig) — geteilt von allen Branchen-Seiten. */
export function UseCaseGrid({ items }: { items: Array<{ t: string; d: string }> }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {items.map((u) => (
        <div key={u.t} className="p-3 bg-obsidian-900 border border-titanium-900 rounded-none">
          <div className="font-display font-bold text-titanium-50 text-sm mb-1">{u.t}</div>
          <div className="text-xs text-titanium-400 leading-relaxed">{u.d}</div>
        </div>
      ))}
    </div>
  );
}
