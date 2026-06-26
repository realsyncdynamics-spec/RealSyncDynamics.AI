import { Link, useParams, Navigate } from 'react-router-dom';
import { Snowflake, ArrowRight, ArrowLeft, Check, AlertTriangle } from 'lucide-react';
import { SEOHead } from '../../components/SEOHead';
import { LANDING_INDUSTRIES, findLandingIndustry } from '../../content/landingIndustries';

/**
 * /branchen/:slug — datengetriebene Branchen-Detailseite im Landing-Design
 * (Obsidian-Hintergrund, Cyan-Akzent, Plus Jakarta Sans). Quelle: zentrale
 * Konfiguration in src/content/landingIndustries.ts. Bricht nichts an der
 * bestehenden /branchen-Übersicht oder den Bespoke-Landings (/healthtech …).
 */

const BG = 'rgb(3, 7, 18)';
const FONT_STACK = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

export function IndustryDetail() {
  const { slug } = useParams();
  const industry = findLandingIndustry(slug);

  // Unbekannter Slug → zurück zur Übersicht (kein toter Deep-Link).
  if (!industry) return <Navigate to="/branchen" replace />;

  const { icon: Icon, eyebrow, headline, intro, refs, risks, value, title } = industry;
  const others = LANDING_INDUSTRIES.filter((i) => i.slug !== industry.slug).slice(0, 6);

  return (
    <div className="min-h-screen text-white antialiased" style={{ backgroundColor: BG, fontFamily: FONT_STACK }}>
      <SEOHead
        title={`${title} — Compliance & KI-Governance`}
        description={intro}
        canonical={`/branchen/${industry.slug}`}
      />

      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <Snowflake className="w-5 h-5 text-cyan-400" strokeWidth={1.5} />
            <span className="text-sm sm:text-base font-semibold tracking-tight">
              RealSync <span className="font-normal text-white/90">Dynamics.AI</span>
            </span>
          </Link>
          <Link to="/branchen" className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />Alle Branchen
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 pt-14 sm:pt-20 pb-10">
        <div className="inline-flex items-center gap-2.5 px-3 py-1.5 mb-6 border border-cyan-500/40 bg-cyan-500/5 rounded-full">
          <Icon className="w-4 h-4 text-cyan-400" strokeWidth={1.75} />
          <span className="font-mono text-[10px] sm:text-xs tracking-widest text-cyan-300">{eyebrow}</span>
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.1] mb-5 max-w-3xl">
          {headline}
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-white/70 max-w-2xl leading-relaxed mb-7">{intro}</p>

        {/* Regulatorische Bezugspunkte */}
        <div className="flex flex-wrap gap-2 mb-9">
          {refs.map((r) => (
            <span key={r} className="font-mono text-[11px] sm:text-xs tracking-wider text-white/70 px-2.5 py-1 border border-white/15 bg-white/[0.03] rounded-md">
              {r}
            </span>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <Link to="/audit" className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg">
            Kostenloses Audit starten<ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/contact-sales" className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg">
            Mit Sales sprechen
          </Link>
        </div>
      </section>

      {/* Risiken + Wert */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-10 grid lg:grid-cols-2 gap-6">
        <div className="p-7 border border-white/10 rounded-2xl bg-white/[0.02]">
          <h2 className="font-mono text-[11px] tracking-[0.25em] text-cyan-400/90 mb-5">TYPISCHE RISIKEN</h2>
          <ul className="space-y-3.5">
            {risks.map((r) => (
              <li key={r} className="flex items-start gap-3 text-sm text-white/70">
                <AlertTriangle className="w-4 h-4 text-amber-400/80 mt-0.5 shrink-0" strokeWidth={1.75} />{r}
              </li>
            ))}
          </ul>
        </div>
        <div className="p-7 border border-cyan-500/20 rounded-2xl bg-cyan-500/[0.04]">
          <h2 className="font-mono text-[11px] tracking-[0.25em] text-cyan-400/90 mb-5">WIE REALSYNC HILFT</h2>
          <ul className="space-y-5">
            {value.map((v) => (
              <li key={v.title} className="flex items-start gap-3">
                <Check className="w-4 h-4 text-cyan-400 mt-1 shrink-0" strokeWidth={2} />
                <div>
                  <h3 className="text-sm font-semibold mb-1">{v.title}</h3>
                  <p className="text-[13px] text-white/60 leading-relaxed">{v.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Weitere Branchen */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-12 border-t border-white/10">
        <h2 className="font-mono text-[11px] tracking-[0.25em] text-cyan-400/90 mb-6">WEITERE BRANCHEN</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {others.map(({ slug: s, icon: OtherIcon, title: t }) => (
            <Link key={s} to={`/branchen/${s}`} className="group flex items-center gap-3 p-4 border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/20 transition-colors rounded-xl">
              <OtherIcon className="w-4 h-4 text-cyan-400 shrink-0" strokeWidth={1.75} />
              <span className="text-xs sm:text-sm text-white/80 group-hover:text-white transition-colors">{t}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer-CTA */}
      <section className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 lg:px-10 py-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <p className="text-sm sm:text-base text-white/70 max-w-xl">
            Sehen Sie Ihren Governance Complexity Score für {title} — ohne Account, in unter fünf Minuten.
          </p>
          <Link to="/audit" className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg whitespace-nowrap">
            Kostenloses Audit<ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
