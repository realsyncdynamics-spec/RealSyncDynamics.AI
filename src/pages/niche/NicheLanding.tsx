import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, type LucideIcon } from 'lucide-react';
import { Logo } from '../../components/Logo';

/**
 * Niche-Landing Template.
 *
 * Strategie-getriebene Conversion-Landings pro Zielsegment (SaaS,
 * Agenturen, Praxen). Jede Niche-Page ist ein dünner Wrapper, der
 * eine NicheConfig in dieses Template kippt. Vermeidet 3x duplizierte
 * Hero-/Section-/FAQ-Strukturen.
 *
 * Bewusst NICHT als HeroOnly-Variante gebaut — Niche-Landings sind
 * eine andere UX-Bühne (long-form, scrollend, segment-spezifischer
 * Sprache). Modale aus HeroOnly werden hier nicht eingeblendet.
 */
export interface NicheConfig {
  segment: string;                  // Internal name, z. B. „SaaS"
  eyebrow: string;                  // „FÜR SAAS-PLATTFORMEN"
  headline: string;                 // H1
  subline: string;                  // Lead-Paragraph
  primaryCtaLabel?: string;         // „Compliance-Check starten"
  primaryCtaHref: string;           // /audit?source=…
  painCards: Array<{
    Icon: LucideIcon;
    title: string;
    body: string;
  }>;
  checksTitle: string;              // „Was wir konkret prüfen"
  checks: Array<{
    title: string;
    body: string;
  }>;
  faqTitle?: string;                // Default „Häufige Fragen"
  faqs: Array<{
    q: string;
    a: string;
  }>;
}

export function NicheLanding({ config }: { config: NicheConfig }) {
  const primaryLabel = config.primaryCtaLabel ?? 'Jetzt kostenlosen Compliance-Check starten';
  const faqTitle = config.faqTitle ?? 'Häufige Fragen';

  return (
    <div className="bg-hero-only min-h-screen flex flex-col text-titanium-50">
      {/* Top bar */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="inline-flex items-center gap-2 text-xs sm:text-sm text-silver-300 hover:text-titanium-50">
          <ArrowLeft className="h-3.5 w-3.5" /> Zurück
        </Link>
        <Link
          to={config.primaryCtaHref}
          className="surface-gold inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-none"
        >
          Audit starten <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <div className="mb-8 flex flex-col items-center gap-3">
            <div className="logo-pulse">
              <Logo size={48} iconOnly />
            </div>
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400">
              {config.eyebrow}
            </div>
          </div>

          <h1 className="font-display font-bold text-3xl sm:text-5xl text-titanium-50 tracking-tight leading-[1.05] mb-5">
            {config.headline}
          </h1>
          <p className="text-base sm:text-lg text-silver-300 leading-relaxed max-w-2xl mx-auto mb-9">
            {config.subline}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to={config.primaryCtaHref}
              className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-bold rounded-none"
            >
              {primaryLabel} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/cookie-scanner"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-silver-500 hover:border-gold-400 text-silver-100 hover:text-titanium-50 text-base font-semibold rounded-none transition-colors"
            >
              Cookie-Scanner ausprobieren
            </Link>
          </div>

          <div className="mt-7 text-[11px] sm:text-xs font-mono uppercase tracking-[0.18em] text-silver-500">
            EU-Datenresidenz · AVV inklusive · Vollständiges Audit-Log · Made in Germany
          </div>
        </div>
      </section>

      {/* Pain-Cards */}
      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              Typische Risiken
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
              Wo {config.segment}-Unternehmen unsichtbare Compliance-Lücken haben
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {config.painCards.map((card) => (
              <div
                key={card.title}
                className="p-5 sm:p-6 bg-obsidian-900/60 border border-silver-700/30 hover:border-gold-400/60 rounded-none transition-colors"
              >
                <card.Icon className="h-5 w-5 text-gold-400 mb-3" />
                <h3 className="font-display font-bold text-titanium-50 text-base sm:text-lg mb-2 leading-snug">
                  {card.title}
                </h3>
                <p className="text-sm text-silver-300 leading-relaxed">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Checks */}
      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              Audit-Inhalt
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
              {config.checksTitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            {config.checks.map((check, idx) => (
              <div
                key={check.title}
                className="relative p-5 sm:p-6 bg-obsidian-900/60 border border-silver-700/30 hover:border-gold-400/60 rounded-none transition-colors"
              >
                <div className="absolute -top-3 left-5 inline-flex items-center justify-center w-8 h-8 bg-gold-400 text-obsidian-950 font-display font-bold text-sm tabular-nums">
                  {idx + 1}
                </div>
                <h3 className="font-display font-bold text-titanium-50 text-base sm:text-lg mb-2 mt-2 leading-snug">
                  {check.title}
                </h3>
                <p className="text-sm text-silver-300 leading-relaxed">{check.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              FAQ
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-4xl text-titanium-50 tracking-tight leading-tight">
              {faqTitle}
            </h2>
          </div>

          <div className="space-y-3">
            {config.faqs.map((item) => (
              <details
                key={item.q}
                className="group p-5 bg-obsidian-900/60 border border-silver-700/30 hover:border-gold-400/60 rounded-none transition-colors"
              >
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                  <span className="font-display font-bold text-titanium-50 text-base leading-snug">
                    {item.q}
                  </span>
                  <span className="text-gold-400 text-xl leading-none transition-transform group-open:rotate-45 select-none">
                    +
                  </span>
                </summary>
                <p className="text-sm text-silver-300 leading-relaxed mt-3">{item.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              to={config.primaryCtaHref}
              className="surface-gold inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold rounded-none"
            >
              {primaryLabel} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Cross-niche footer */}
      <footer className="border-t border-silver-700/30 px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-wider text-silver-500">
          <div>© 2026 RealSync Dynamics · Made in Germany · EU-Hosted</div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/fuer-saas"        className="hover:text-titanium-50">SaaS</Link>
            <Link to="/fuer-agenturen"   className="hover:text-titanium-50">Agenturen</Link>
            <Link to="/fuer-praxen"      className="hover:text-titanium-50">Praxen</Link>
            <Link to="/cookie-scanner"   className="hover:text-titanium-50 text-gold-400">Cookie-Scanner</Link>
            <Link to="/ai-act-workflows" className="hover:text-titanium-50 text-gold-400">AI-Act Inventar</Link>
            <Link to="/legal/privacy"    className="hover:text-titanium-50">Datenschutz</Link>
            <Link to="/impressum"        className="hover:text-titanium-50">Impressum</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
