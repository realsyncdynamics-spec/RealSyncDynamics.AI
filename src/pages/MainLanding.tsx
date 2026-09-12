import { Link } from 'react-router-dom';
import { ArrowRight, Code2, FileCheck2, Lock, ShieldCheck } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { LandingChannelTools } from '../components/landing/LandingChannelTools';
import { LandingDarkBand } from '../components/landing/LandingDarkBand';
import { LandingPricingSection } from '../components/landing/LandingPricingSection';
import { LandingRoadmapSection } from '../components/landing/LandingRoadmapSection';
import { PublicDarkHeader } from '../components/landing/PublicDarkHeader';
import { OsEntryLink } from '../components/landing/OsEntryLink';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SANS,
  LANDING_SERIF,
  LANDING_TEXT,
} from '../components/landing/landing-theme';
import {
  HERO_DASHBOARD_CTA_LABEL,
  HERO_HEADLINE,
  HERO_OPERATING_LOOP,
  HERO_SCAN_CTA_LABEL,
  HERO_SUBLINE,
} from '../components/governance-frontend/hero-content';
import { HeroEarthBackdrop } from '../components/landing/HeroEarthBackdrop';
import { EnterpriseAccessSection } from '../components/landing/EnterpriseAccessSection';
import {
  PLATFORM_LIVE_ITEMS,
  STATUS_LABEL,
} from '../product/implementation-status';
import { useStagedReveal } from '../hooks/useStagedReveal';

const GOVERNANCE_STEPS = [
  ['01', 'DISCOVER', 'KI-Systeme, Anwendungen, Datenflüsse und relevante Verarbeitungsvorgänge erfassen.'],
  ['02', 'ASSESS', 'Risiken bewerten und Systeme gegen Governance-, DSGVO- und EU-AI-Act-Kriterien prüfen.'],
  ['03', 'GOVERN', 'Verbindliche Policies, Verantwortlichkeiten und Kontrollanforderungen zentral definieren.'],
  ['04', 'ENFORCE', 'Governance-Regeln operativ durchsetzen und Abweichungen kontrolliert behandeln.'],
  ['05', 'EVIDENCE', 'Prüfungen, Entscheidungen, Änderungen und Kontrollen nachvollziehbar dokumentieren.'],
  ['06', 'AUDIT', 'Eine konsistente Governance-Historie für Management, interne Kontrollen und Audits bereitstellen.'],
];

export function MainLanding() {
  const revealRoot = useStagedReveal<HTMLElement>();

  return (
    <div
      className="landing-context relative min-h-screen antialiased"
      style={{
        backgroundColor: LANDING_BG,
        color: LANDING_TEXT,
        fontFamily: LANDING_SANS,
        backgroundImage: 'radial-gradient(circle at 78% 28%, #111823 0, #05070b 38%, #04060a 100%)',
      }}
    >
      <SEOHead
        title="RealSyncDynamics.AI — AI Compliance Operations OS for Europe"
        description="AI Compliance Operations OS for Europe. Runtime governance for regulated AI systems. Continuous evidence. EU-native by design."
        canonical="/"
        ogTitle="AI Compliance Operations OS for Europe"
        ogDescription="RealSyncDynamics.AI — AI Compliance Operations OS for Europe. Free Audit starten. Continuous evidence."
      />

      {/* Restrained ambient — scenery stays behind type, no muddy gold wash */}
      <div
        className="pointer-events-none fixed right-[-12vw] top-[18vh] h-[34vw] w-[34vw] rounded-full opacity-[0.05] blur-[110px]"
        style={{ background: '#b49a6b' }}
        aria-hidden="true"
      />

      <PublicDarkHeader />

      <main ref={revealRoot} className="relative z-10">
        <section
          id="product"
          className="relative isolate flex min-h-[calc(100svh-76px)] overflow-hidden border-b border-[#e4cfa2]/10"
        >
          {/* Europe night full-bleed — pointer-events none; no Sphere HUD */}
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
            <HeroEarthBackdrop />
          </div>

          <div className="relative mx-auto flex w-full max-w-[1500px] flex-1 items-center px-[4vw] py-10 lg:py-12">
            {/* Fold lock (Dominik 1:1): H1 → loop → body → CTA pair */}
            <div className="hero-copy relative z-10 max-w-[38rem] lg:max-w-[42rem]">
              <h1
                className="text-[clamp(2.1rem,3.8vw,3.35rem)] leading-[1.05] tracking-[-0.035em]"
                style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}
              >
                {HERO_HEADLINE.map((segments, line) => (
                  <span
                    key={line}
                    className={`block ${line === 0 ? 'whitespace-nowrap' : ''}`}
                  >
                    {segments.map((segment, i) =>
                      segment.accent ? (
                        <em
                          key={i}
                          className="hero-shine-accent not-italic"
                          style={{ color: LANDING_ACCENT, fontStyle: 'normal' }}
                        >
                          {segment.text}
                        </em>
                      ) : (
                        <span key={i} className="hero-shine">
                          {segment.text}
                        </span>
                      ),
                    )}
                  </span>
                ))}
              </h1>

              <p
                className="mt-5 text-[11px] font-medium tracking-[0.2em]"
                style={{ fontFamily: LANDING_MONO, color: '#9a9178' }}
              >
                {HERO_OPERATING_LOOP}
              </p>

              <p
                className="mt-5 max-w-[34rem] text-[15px] leading-[1.55] sm:text-[16px]"
                style={{ color: 'rgba(246,242,233,0.78)' }}
              >
                {HERO_SUBLINE}
              </p>

              <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-3.5">
                <Link
                  to="/audit"
                  id="scan"
                  data-hero-cta
                  className="landing-cta-glow inline-flex items-center justify-center gap-2 rounded-full px-[26px] py-[14px] text-[14px] font-semibold transition hover:brightness-[1.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]"
                  style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
                >
                  {HERO_SCAN_CTA_LABEL} <span aria-hidden="true">→</span>
                </Link>
                <OsEntryLink
                  to="/app"
                  data-hero-cta
                  className="inline-flex items-center justify-center gap-2 rounded-full border px-[24px] py-[13px] text-[14px] font-medium transition hover:bg-[#e4cfa2]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]/60"
                  style={{
                    borderColor: 'rgba(232,221,200,0.55)',
                    backgroundColor: 'rgba(8,10,14,0.55)',
                    color: LANDING_TEXT,
                  }}
                >
                  {HERO_DASHBOARD_CTA_LABEL}
                </OsEntryLink>
              </div>
            </div>
          </div>
        </section>

        <LandingChannelTools />

        <LandingDarkBand />

        <section id="platform" className="py-[92px]">
          <div className="mx-auto max-w-[1500px] px-[4vw]">
            <div className="mb-14 max-w-3xl">
              <p
                className="inline-block rounded-full border px-[11px] py-[7px] text-[9px] font-medium tracking-[.23em]"
                style={{
                  fontFamily: LANDING_MONO,
                  color: LANDING_ACCENT,
                  borderColor: `${LANDING_ACCENT}47`,
                }}
              >
                DIE PLATTFORM
              </p>
              <h2
                className="mt-[22px] text-[clamp(40px,5vw,65px)] leading-none tracking-[-.035em]"
                style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}
              >
                Eine Runtime.{' '}
                <em className="not-italic" style={{ color: LANDING_ACCENT }}>
                  Module, die live erreichbar sind.
                </em>
              </h2>
              <p className="mt-[17px] max-w-[760px] text-[13px] leading-[1.7]" style={{ color: LANDING_MUTED }}>
                Nur Capabilities mit Status LIVE aus dem Product-Registry. Preview und Coming Soon
                stehen unter{' '}
                <a href="#roadmap" className="underline decoration-[#e4cfa2]/40 underline-offset-2">
                  Roadmap
                </a>
                .
              </p>
            </div>
            <div className="grid gap-px overflow-hidden border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-3">
              {PLATFORM_LIVE_ITEMS.map((cap) => {
                const body = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold" style={{ color: LANDING_TEXT }}>
                        {cap.name}
                      </h3>
                      <span
                        className="shrink-0 border px-2 py-0.5 text-[8px] tracking-[.12em]"
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
                    {cap.route && (
                      <span
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium"
                        style={{ color: LANDING_ACCENT }}
                      >
                        Öffnen <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    )}
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

        <section id="evidence" className="border-y border-white/[0.06] bg-white/[.02] py-[92px]">
          <div className="mx-auto max-w-[1500px] px-[4vw]">
            <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div>
                <p
                  className="inline-block rounded-full border px-[11px] py-[7px] text-[9px] font-medium tracking-[.23em]"
                  style={{
                    fontFamily: LANDING_MONO,
                    color: LANDING_ACCENT,
                    borderColor: `${LANDING_ACCENT}47`,
                  }}
                >
                  EVIDENCE &amp; TRUST
                </p>
                <h2
                  className="mt-[22px] text-[clamp(40px,5vw,65px)] leading-none tracking-[-.035em]"
                  style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}
                >
                  Compliance, die sich{' '}
                  <em className="not-italic" style={{ color: LANDING_ACCENT }}>
                    beweisen lässt.
                  </em>
                </h2>
                <p className="mt-5 leading-relaxed" style={{ color: LANDING_MUTED }}>
                  PDFs, Logs, Zeitstempel und nachvollziehbare Prüfpfade. Jede Prüfung, jede
                  Entscheidung und jede Änderung landet in derselben Governance-Historie.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TrustItem
                  icon={ShieldCheck}
                  title="DSGVO"
                  text="Verarbeitung, Risiko, Policy und Nachweis im laufenden Governance-Prozess."
                />
                <TrustItem
                  icon={Lock}
                  title="EU AI Act"
                  text="Risikoklassifikation, Transparenz und Dokumentation für KI-Systeme."
                />
                <TrustItem
                  icon={FileCheck2}
                  title="Nachweis-Export"
                  text="Prüfungen und Entscheidungen als auditfähiger Export — für interne Kontrollen und externe Prüfer."
                />
                <TrustItem
                  icon={Code2}
                  title="Code Compliance"
                  text="Claude Code prüft und unterstützt konkrete technische Remediation."
                />
              </div>
            </div>
          </div>
        </section>

        <section className="py-[92px]">
          <div className="mx-auto max-w-[1500px] px-[4vw]">
            <div className="mb-12 max-w-3xl">
              <p
                className="inline-block rounded-full border px-[11px] py-[7px] text-[9px] font-medium tracking-[.23em]"
                style={{
                  fontFamily: LANDING_MONO,
                  color: LANDING_ACCENT,
                  borderColor: `${LANDING_ACCENT}47`,
                }}
              >
                GOVERNANCE RUNTIME
              </p>
              <h2
                className="mt-[22px] text-[clamp(40px,5vw,65px)] leading-none tracking-[-.035em]"
                style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}
              >
                Von der KI-Nutzung zur{' '}
                <em className="not-italic" style={{ color: LANDING_ACCENT }}>
                  kontrollierten KI-Organisation.
                </em>
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {GOVERNANCE_STEPS.map(([no, title, text]) => (
                <div
                  key={no}
                  data-reveal
                  data-reveal-group="runtime"
                  className="surface-panel p-7"
                >
                  <span
                    className="text-3xl"
                    style={{ fontFamily: LANDING_MONO, color: `${LANDING_ACCENT}59` }}
                  >
                    {no}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold tracking-wide" style={{ color: LANDING_TEXT }}>
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: LANDING_MUTED }}>
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <LandingPricingSection />

        <LandingRoadmapSection />

        <EnterpriseAccessSection />

        <section className="border-t border-white/[0.06] bg-black/80 py-[92px]">
          <div className="mx-auto max-w-3xl px-[4vw] text-center">
            <p
              className="text-[10px] tracking-[.25em]"
              style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
            >
              WARUM JETZT
            </p>
            <h2
              className="hero-shine mt-4 text-[clamp(40px,5vw,60px)] tracking-tight"
              style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}
            >
              Governance statt Checkliste.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed" style={{ color: '#e8dcc4' }}>
              Eine Checkliste beruhigt bis zum nächsten Audit. Die Runtime hält den Nachweis, wenn
              Aufsicht, Kunde oder Board fragt.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/audit"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 font-semibold transition hover:brightness-105"
                style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
              >
                {HERO_SCAN_CTA_LABEL} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/app"
                className="inline-flex items-center justify-center gap-2 border px-7 py-3.5 font-medium transition hover:bg-[#e4cfa2]/10"
                style={{ borderColor: `${LANDING_ACCENT}66`, color: LANDING_ACCENT }}
              >
                {HERO_DASHBOARD_CTA_LABEL}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer
        className="relative z-10 flex flex-col items-center justify-between gap-4 border-t border-white/[0.07] px-[4vw] py-[30px] text-[9px] sm:flex-row"
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

function TrustItem({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof ShieldCheck;
  title: string;
  text: string;
}) {
  return (
    <div data-reveal data-reveal-group="evidence" className="surface-panel p-6">
      <Icon className="h-5 w-5" style={{ color: LANDING_ACCENT }} />
      <h3 className="mt-4 font-semibold" style={{ color: LANDING_TEXT }}>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: LANDING_MUTED }}>
        {text}
      </p>
    </div>
  );
}
