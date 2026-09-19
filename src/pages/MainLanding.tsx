import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, Network, Layers, ShieldCheck, RefreshCw } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { LandingChannelTools } from '../components/landing/LandingChannelTools';
import { LandingPricingSection } from '../components/landing/LandingPricingSection';
import { PublicDarkHeader } from '../components/landing/PublicDarkHeader';
import { EuropeNetworkHero } from '../components/landing/EuropeNetworkHero';
import { LandingModeSwitch } from '../components/landing/LandingModeSwitch';
import {
  MODE_ACCENT,
  MODE_ACCENT_SOFT,
  MODE_BG,
  MODE_BUTTON_INK,
  MODE_GLOW,
  MODE_LINE,
  modeAccent,
  useLandingMode,
} from '../components/landing/landing-mode';
import { EnterpriseAccessSection } from '../components/landing/EnterpriseAccessSection';
import {
  PLATFORM_LIVE_ITEMS,
  STATUS_LABEL,
} from '../product/implementation-status';
import { useStagedReveal } from '../hooks/useStagedReveal';
import {
  LANDING_ACCENT,
  LANDING_ACCENT_SOFT,
  LANDING_BG,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_H1,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SANS,
  LANDING_SERIF,
  LANDING_TEXT,
} from '../components/landing/landing-theme';
import {
  CONTINUOUS_COMPLIANCE_NARRATIVE,
  HERO_DASHBOARD_CTA_LABEL,
  HERO_EYEBROW,
  HERO_HEADLINE,
  HERO_OPERATING_LOOP,
  HERO_PROOF_CHIPS,
  HERO_SCAN_CTA_LABEL,
  HERO_SCAN_CTA_LONG,
  HERO_SUBLINE,
} from '../components/governance-frontend/hero-content';

/**
 * Replit SSOT public `/` — Dark/Gold Europe-network (static), not interactive sphere.
 * KPI strip mirrors Replit chrome as illustrative demo values (not live production metrics).
 */

const KPI_STRIP = [
  { label: 'SYSTEME IM SCOPE', value: '1.284', meta: 'demo' },
  { label: 'EVIDENCE EVENTS', value: '48.902', meta: '+12%' },
  { label: 'KONTROLLABDECKUNG', value: '93,7', meta: '%' },
  { label: 'LETZTER PROOF', value: 'vor 02:14', meta: 'min' },
] as const;

const OS_STEPS = [
  {
    n: '01',
    title: 'Discover',
    text: 'Alle KI-Systeme, Modelle und Abhängigkeiten in einem verlässlichen Inventar.',
    Icon: Network,
  },
  {
    n: '02',
    title: 'Classify',
    text: 'Risiko, Zweck und regulatorischen Status automatisch zuordnen — mit menschlicher Freigabe.',
    Icon: Layers,
  },
  {
    n: '03',
    title: 'Enforce',
    text: 'Kontrollen als laufende Regeln in Ihre Toolchain bringen, nicht als PDF im Ordner.',
    Icon: ShieldCheck,
  },
  {
    n: '04',
    title: 'Prove',
    text: 'Jede Entscheidung, Kontrolle und Ausnahme revisionssicher nachweisen.',
    Icon: RefreshCw,
  },
] as const;

export function MainLanding() {
  const revealRoot = useStagedReveal<HTMLElement>();
  const { mode, setMode } = useLandingMode();

  return (
    <div
      className="landing-context relative min-h-screen antialiased"
      data-landing-mode={mode}
      style={{
        backgroundColor: MODE_BG,
        color: LANDING_TEXT,
        fontFamily: LANDING_SANS,
      }}
    >
      <SEOHead
        title="RealSyncDynamics.AI — AI Compliance Operations OS für Europa"
        description="AI Compliance Operations OS für Europa. Entdecken. Klassifizieren. Durchsetzen. Beweisen. Free Audit starten."
        canonical="/"
        ogTitle="AI Compliance Operations OS für Europa"
        ogDescription="RealSyncDynamics.AI — Governance-Infrastruktur für Europa. Free Audit starten."
      />

      <PublicDarkHeader overlay modeSwitch={<LandingModeSwitch mode={mode} onChange={setMode} />} />

      <main ref={revealRoot} className="relative z-10">
        {/* ── Hero ── */}
        <section
          id="product"
          className="relative min-h-[min(100svh,880px)] overflow-hidden border-b border-white/[0.06]"
        >
          <EuropeNetworkHero />

          <div className="relative z-10 mx-auto flex min-h-[min(100svh,880px)] max-w-[1280px] flex-col justify-center px-[4vw] pb-16 pt-28 sm:pb-20 sm:pt-32">
            <div className="max-w-xl lg:max-w-[34rem]">
              <p
                className="mb-6 text-[10px] font-medium tracking-[0.22em]"
                style={{ fontFamily: LANDING_MONO, color: MODE_ACCENT }}
              >
                {HERO_EYEBROW}
              </p>

              <h1
                className="leading-[0.98] tracking-[-0.035em]"
                style={{ fontSize: LANDING_H1, fontWeight: 600 }}
              >
                {HERO_HEADLINE.map((segments, line) => (
                  <span key={line} className="block">
                    {segments.map((segment, i) =>
                      segment.accent ? (
                        <em
                          key={i}
                          className="not-italic"
                          style={{
                            fontFamily: LANDING_SERIF,
                            fontWeight: 500,
                            color: MODE_ACCENT_SOFT,
                            fontStyle: 'italic',
                          }}
                        >
                          {segment.text}
                        </em>
                      ) : (
                        <span key={i} style={{ color: LANDING_TEXT }}>
                          {segment.text}
                        </span>
                      ),
                    )}
                  </span>
                ))}
              </h1>

              <p className="mt-6 max-w-md text-[15px] leading-[1.65]" style={{ color: '#c8c4bc' }}>
                <span style={{ color: LANDING_TEXT }}>{HERO_OPERATING_LOOP}</span>{' '}
                {HERO_SUBLINE}
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  id="audit-cta"
                  data-hero-cta="audit"
                  to="/audit"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[13px] font-semibold transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsd-accent,#d6ad68)]"
                  style={{
                    backgroundColor: MODE_ACCENT,
                    color: MODE_BUTTON_INK,
                    boxShadow: MODE_GLOW,
                  }}
                >
                  {HERO_SCAN_CTA_LONG} <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/evidence"
                  className="inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-[13px] font-medium transition hover:bg-[var(--rsd-accent,#d6ad68)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rsd-accent,#d6ad68)]/50"
                  style={{ borderColor: modeAccent(40), color: LANDING_TEXT }}
                >
                  {HERO_DASHBOARD_CTA_LABEL} <ArrowDownRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Trust row */}
              <ul
                className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t pt-6"
                style={{ borderColor: MODE_LINE }}
                aria-label="Compliance-Standards"
              >
                {HERO_PROOF_CHIPS.map((chip) => (
                  <li
                    key={chip}
                    className="text-[10px] tracking-[0.16em]"
                    style={{ fontFamily: LANDING_MONO, color: LANDING_MUTED }}
                  >
                    {chip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── KPI strip (Replit chrome — illustrative demo values) ── */}
        <section
          aria-label="Illustrative operating metrics"
          className="border-b border-white/[0.06] bg-[#0e0e10]/90"
          data-demo-kpis="true"
        >
          <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-px sm:grid-cols-4">
            {KPI_STRIP.map((kpi) => (
              <div key={kpi.label} className="px-[4vw] py-7 sm:px-8">
                <p
                  className="text-[9px] tracking-[0.2em]"
                  style={{ fontFamily: LANDING_MONO, color: LANDING_MUTED }}
                >
                  {kpi.label}
                </p>
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="text-[1.65rem] font-semibold tracking-tight" style={{ color: LANDING_TEXT }}>
                    {kpi.value}
                  </span>
                  <span
                    className="text-[10px] tracking-[0.12em]"
                    style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
                  >
                    {kpi.meta}
                  </span>
                </p>
              </div>
            ))}
          </div>
          <p className="sr-only">
            Kennzahlen sind illustrative Demo-Werte der Replit-Referenz, keine Live-Produktionsmetriken.
          </p>
        </section>

        {/* ── Das Betriebssystem ── */}
        <section id="runtime" className="border-b border-white/[0.06] py-[72px] lg:py-[88px]">
          <div className="mx-auto grid max-w-[1280px] gap-12 px-[4vw] lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <div>
              <p
                className="text-[10px] tracking-[0.22em]"
                style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
              >
                01 — DAS BETRIEBSSYSTEM
              </p>
              <h2
                className="mt-4 max-w-md text-[clamp(1.75rem,1.1rem+2vw,2.5rem)] leading-[1.12] tracking-[-0.03em]"
                style={{ fontWeight: 600, color: LANDING_TEXT }}
              >
                Compliance, die mit Ihrem Modell Schritt hält.
              </h2>
              <p className="mt-5 max-w-md text-[14px] leading-[1.7]" style={{ color: LANDING_MUTED }}>
                Regulierte KI ist kein einmaliges Projekt. {CONTINUOUS_COMPLIANCE_NARRATIVE}
              </p>
              <Link
                to="/governance-runtime"
                className="mt-7 inline-flex items-center gap-2 text-[13px] font-medium transition hover:brightness-110"
                style={{ color: LANDING_ACCENT_SOFT }}
              >
                So entsteht der Proof <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {OS_STEPS.map(({ n, title, text, Icon }) => (
                <div key={n} className="flex items-start gap-4 py-5 sm:gap-5">
                  <span
                    className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center border"
                    style={{ borderColor: `${LANDING_ACCENT}55`, color: LANDING_ACCENT }}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2">
                      <span
                        className="text-[10px] tracking-[0.16em]"
                        style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
                      >
                        {n}
                      </span>
                      <span className="text-[15px] font-semibold" style={{ color: LANDING_TEXT }}>
                        {title}
                      </span>
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: LANDING_MUTED }}>
                      {text}
                    </p>
                  </div>
                  <ArrowRight className="mt-2 h-4 w-4 shrink-0 opacity-40" style={{ color: LANDING_ACCENT }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <LandingChannelTools />

        {/* Live platform modules — registry-backed */}
        <section id="platform" className="border-t border-white/[0.06] py-[72px]">
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <p
              className="text-[10px] tracking-[0.22em]"
              style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
            >
              LIVE MODULE
            </p>
            <h2
              className="mt-3 text-[clamp(1.75rem,1.1rem+2vw,2.5rem)] tracking-[-0.03em]"
              style={{ fontWeight: 600 }}
            >
              Module, die live erreichbar sind.
            </h2>
            <div className="mt-10 grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-3">
              {PLATFORM_LIVE_ITEMS.map((cap) => {
                const body = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold" style={{ color: LANDING_TEXT }}>
                        {cap.name}
                      </h3>
                      <span
                        className="shrink-0 border px-2 py-0.5 text-[8px] tracking-[0.12em]"
                        style={{
                          fontFamily: LANDING_MONO,
                          borderColor: `${LANDING_ACCENT}40`,
                          color: LANDING_ACCENT,
                        }}
                      >
                        {STATUS_LABEL.live}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: LANDING_MUTED }}>
                      {cap.description}
                    </p>
                  </>
                );
                return cap.route ? (
                  <Link
                    key={cap.id}
                    to={cap.route}
                    data-reveal
                    data-reveal-group="platform"
                    className="block p-7 transition hover:bg-white/[.03]"
                    style={{ backgroundColor: LANDING_BG }}
                  >
                    {body}
                  </Link>
                ) : (
                  <div
                    key={cap.id}
                    data-reveal
                    data-reveal-group="platform"
                    className="p-7"
                    style={{ backgroundColor: LANDING_BG }}
                  >
                    {body}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="evidence" className="border-t border-white/[0.06] py-[72px]">
          <div className="mx-auto max-w-[1280px] px-[4vw]">
            <p
              className="text-[10px] tracking-[0.22em]"
              style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
            >
              EVIDENCE
            </p>
            <h2
              className="mt-3 max-w-xl text-[clamp(1.75rem,1.1rem+2vw,2.5rem)] tracking-[-0.03em]"
              style={{ fontWeight: 600 }}
            >
              Compliance, die sich beweisen lässt.
            </h2>
            <p className="mt-4 max-w-2xl text-[14px] leading-relaxed" style={{ color: LANDING_MUTED }}>
              Prüfungen, Entscheidungen und Änderungen landen in derselben Governance-Historie —
              exportierbar für Aufsicht, Board und Audit.
            </p>
            <Link
              to="/evidence"
              className="mt-7 inline-flex items-center gap-2 text-[13px] font-medium"
              style={{ color: LANDING_ACCENT_SOFT }}
            >
              {HERO_DASHBOARD_CTA_LABEL} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <LandingPricingSection />
        <EnterpriseAccessSection />

        <section className="border-t border-white/[0.06] bg-black/60 py-[80px]">
          <div className="mx-auto max-w-3xl px-[4vw] text-center">
            <h2
              className="text-[clamp(2rem,1.2rem+2.5vw,3rem)] tracking-tight"
              style={{ fontWeight: 600 }}
            >
              Governance statt Checkliste.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed" style={{ color: '#c8c4bc' }}>
              Eine Checkliste beruhigt bis zum nächsten Audit. Die Runtime hält den Nachweis, wenn
              Aufsicht, Kunde oder Board fragt.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/audit"
                className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[13px] font-semibold transition hover:brightness-110"
                style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
              >
                {HERO_SCAN_CTA_LABEL} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 text-[13px] font-medium"
                style={{ borderColor: `${LANDING_ACCENT}66`, color: LANDING_ACCENT }}
              >
                Preise ansehen
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer
        className="relative z-10 flex flex-col items-center justify-between gap-4 border-t border-white/[0.07] px-[4vw] py-[28px] text-[9px] sm:flex-row"
        style={{ fontFamily: LANDING_MONO, color: '#62666e' }}
      >
        <span>© 2026 RealSync Dynamics.AI</span>
        <div className="flex gap-5">
          <Link to="/impressum" className="hover:text-[#f2eee6]">
            Impressum
          </Link>
          <Link to="/datenschutz" className="hover:text-[#f2eee6]">
            Datenschutz
          </Link>
          <Link to="/agb" className="hover:text-[#f2eee6]">
            AGB
          </Link>
        </div>
      </footer>
    </div>
  );
}
