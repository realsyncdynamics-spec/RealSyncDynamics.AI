import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Code2, FileCheck2, Lock, ShieldCheck } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { LandingChannelTools } from '../components/landing/LandingChannelTools';
import { LandingDarkBand } from '../components/landing/LandingDarkBand';
import { LandingPricingSection } from '../components/landing/LandingPricingSection';
import { LandingRoadmapSection } from '../components/landing/LandingRoadmapSection';
import { PublicDarkHeader } from '../components/landing/PublicDarkHeader';
import { HeroEarthBackdrop } from '../components/landing/HeroEarthBackdrop';
import { GovernanceActivationSection } from '../components/landing/GovernanceActivationSection';
import { OsEntryLink } from '../components/landing/OsEntryLink';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
  LANDING_H1,
  LANDING_H2,
  LANDING_LINE,
  LANDING_MONO,
  LANDING_MUTED,
  LANDING_SANS,
  LANDING_SERIF,
  LANDING_TEXT,
} from '../components/landing/landing-theme';
import {
  HERO_HEADLINE,
  HERO_OPERATING_LOOP,
  HERO_SCAN_CTA_LABEL,
  HERO_SCAN_CTA_PROMISE,
  SCAN_FUNNEL_MESSAGE,
} from '../components/governance-frontend/hero-content';
import { EnterpriseAccessSection } from '../components/landing/EnterpriseAccessSection';
import {
  PLATFORM_LIVE_ITEMS,
  STATUS_LABEL,
} from '../product/implementation-status';
import { useStagedReveal } from '../hooks/useStagedReveal';

/** Drei Säulen unter der Headline — honest, reachable surfaces only. */
const HERO_PILLARS: readonly (readonly [string, string])[] = [
  ['DSGVO-SCAN', 'Öffentlicher Governance Scan mit Bericht — ohne Account.'],
  ['AI-ACT-MODULE', 'Risikoklassifikation und Inventar im Governance OS (/app).'],
  ['EVIDENCE', 'Nachweise und Exports unter /app/evidence — kein Fake-KPI.'],
];

const GOVERNANCE_STEPS = [
  ['01', 'DISCOVER', 'KI-Systeme, Anwendungen und relevante Verarbeitungen erfassen.'],
  ['02', 'ASSESS', 'Risiken gegen DSGVO- und EU-AI-Act-Kriterien bewerten.'],
  ['03', 'GOVERN', 'Policies und Verantwortlichkeiten im Runtime-Kern definieren.'],
  ['04', 'ENFORCE', 'Kontrollen operativ anwenden — wo Module live sind.'],
  ['05', 'EVIDENCE', 'Prüfungen und Entscheidungen nachvollziehbar dokumentieren.'],
  ['06', 'AUDIT', 'Governance-Historie für interne Kontrollen und Audits bereitstellen.'],
];

export function MainLanding() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('');
  const revealRoot = useStagedReveal<HTMLElement>();

  const startScan = (event: FormEvent) => {
    event.preventDefault();
    const value = domain.trim();
    // Kanonischer Scan-Einstieg `/audit` (CLAUDE.md §10).
    navigate(value ? `/audit?domain=${encodeURIComponent(value)}` : '/audit');
  };

  return (
    <div
      className="landing-context relative min-h-screen antialiased"
      style={{
        backgroundColor: LANDING_BG,
        color: LANDING_TEXT,
        fontFamily: LANDING_SANS,
        backgroundImage: 'radial-gradient(circle at 70% 15%, #111823 0, #05070b 34%, #04060a 100%)',
      }}
    >
      <SEOHead
        title="RealSyncDynamics.AI — AI Governance Runtime"
        description="AI Governance, Running in Real Time. Governance OS für DSGVO und EU AI Act — Detect, Govern, Prove, Automate."
        canonical="/"
        ogTitle="AI Governance, Running in Real Time"
        ogDescription="RealSyncDynamics.AI — AI Governance Operating System. Detect. Govern. Prove. Automate."
      />

      {/* Ambient gold/teal blurs (Dominik Dark/Gold reference) */}
      <div
        className="pointer-events-none fixed right-[-18vw] top-[10vh] h-[40vw] w-[40vw] rounded-full opacity-[0.08] blur-[100px]"
        style={{ background: '#b49a6b' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed left-[-25vw] top-[45vh] h-[40vw] w-[40vw] rounded-full opacity-[0.08] blur-[100px]"
        style={{ background: '#236e91' }}
        aria-hidden="true"
      />

      <PublicDarkHeader />

      <main ref={revealRoot} className="relative z-10">
        <section
          id="product"
          className="relative isolate min-h-[min(92vh,900px)] overflow-hidden border-b border-[#e4cfa2]/10 lg:min-h-[min(90vh,860px)]"
        >
          {/* Full-bleed photoreal Earth — scenery only, no interaction */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <HeroEarthBackdrop />
          </div>

          {/* Dense centered stack over the globe — no empty black bands */}
          <div className="relative mx-auto flex max-w-[820px] flex-col items-center px-[4vw] pb-[40px] pt-[24px] text-center lg:pb-[44px] lg:pt-[28px]">
            <div
              className="inline-block rounded-full border px-[11px] py-[6px] text-[9px] font-medium tracking-[.23em]"
              style={{
                fontFamily: LANDING_MONO,
                color: LANDING_ACCENT,
                borderColor: `${LANDING_ACCENT}47`,
              }}
            >
              AI GOVERNANCE OPERATING SYSTEM
            </div>

            <h1
              className="relative mt-[12px] mb-2.5 max-w-[18ch] leading-[1.08] tracking-[-.03em] lg:mt-[14px] lg:mb-3"
              style={{ fontFamily: LANDING_SERIF, fontWeight: 500, fontSize: LANDING_H1 }}
            >
              <span className="hero-shine-glow" aria-hidden="true">
                {HERO_HEADLINE.map((segments, line) => (
                  <span key={`glow-${line}`} className="block">
                    {segments.map((segment) => segment.text).join('')}
                  </span>
                ))}
              </span>
              {HERO_HEADLINE.map((segments, line) => (
                <span key={line} className="block">
                  {segments.map((segment, i) =>
                    segment.accent ? (
                      <em
                        key={i}
                        className="hero-shine-accent"
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
              className="mb-3 text-[10px] tracking-[.2em] lg:mb-3.5"
              style={{ fontFamily: LANDING_MONO, color: '#b6a77f' }}
            >
              {HERO_OPERATING_LOOP}
            </p>

            <p
              className="mb-2 max-w-[540px] text-[13px] font-medium leading-[1.45] lg:text-[14px]"
              style={{ color: '#e8dfd2' }}
            >
              {SCAN_FUNNEL_MESSAGE}
            </p>

            <p
              className="max-w-[520px] text-[13px] leading-[1.55] lg:text-[14px]"
              style={{ color: 'rgba(242,238,230,0.78)' }}
            >
              Govern AI. Prove Everything. Operate with Confidence.
              <br />
              Kein Cookie-Scanner — AI Governance OS: Scan → Build → Automate → Govern.
            </p>

            <div
              className="value-grid my-[14px] mb-[12px] grid w-full max-w-[680px] gap-0 border-y sm:grid-cols-3 lg:my-[16px] lg:mb-[14px]"
              style={{ borderColor: LANDING_LINE }}
            >
              {HERO_PILLARS.map(([title, text], i) => (
                <article
                  key={title}
                  className={`px-3 py-[12px] sm:px-5 lg:py-[14px] ${i > 0 ? 'sm:border-l' : ''}`}
                  style={{ borderColor: LANDING_LINE }}
                >
                  <b
                    className="text-[8px] font-medium tracking-[.18em]"
                    style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
                  >
                    {title}
                  </b>
                  <p className="mt-1.5 text-[11px] leading-[1.5]" style={{ color: '#898a91' }}>
                    {text}
                  </p>
                </article>
              ))}
            </div>

            <form id="scan" onSubmit={startScan} className="w-full max-w-[620px]">
              <div
                className="flex flex-col gap-0 rounded-full border p-1 sm:flex-row sm:items-stretch"
                style={{
                  borderColor: LANDING_LINE,
                  backgroundColor: 'rgba(7,9,13,0.72)',
                }}
              >
                <input
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  type="url"
                  placeholder="Ihre Website –"
                  aria-label="Ihre Website"
                  className="min-w-0 flex-1 bg-transparent px-4 py-3 text-center text-[13px] text-[#f2eee6] outline-none placeholder:text-[#9a9aa1]/70 focus-visible:ring-2 focus-visible:ring-[#e4cfa2]/45 sm:rounded-full sm:text-left lg:py-3.5"
                />
                <button
                  type="submit"
                  data-hero-cta
                  className="inline-flex items-center justify-center gap-2 rounded-full px-[18px] py-[11px] text-[11px] font-semibold shadow-[0_0_0_1px_rgba(228,207,162,0.35)] transition hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2] lg:py-[12px]"
                  style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
                >
                  {HERO_SCAN_CTA_LABEL} <span aria-hidden="true">→</span>
                </button>
              </div>
              <p
                className="mt-2 px-1 text-[11px] leading-snug"
                style={{ color: '#e8dfd2' }}
              >
                {HERO_SCAN_CTA_PROMISE}
              </p>
              <p
                className="mt-1 px-1 text-[8px] tracking-[.08em]"
                style={{ fontFamily: LANDING_MONO, color: '#6e7077' }}
              >
                Self-Service Website/SaaS · Guided Activation Enterprise · kein Account fürs erste Ergebnis
              </p>
            </form>

            <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-center lg:mt-5">
              <Link
                to="/welcome?next=/app/dashboard"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-[20px] py-[11px] text-[13px] font-medium transition hover:bg-[#e4cfa2]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]/60"
                style={{ borderColor: `${LANDING_ACCENT}80`, color: '#e8dfd2' }}
              >
                Explore the Governance OS <span aria-hidden="true">→</span>
              </Link>
              <OsEntryLink
                to="/app/activation"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-[20px] py-[11px] text-[13px] font-medium transition hover:bg-[#e4cfa2]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]/60"
                style={{ borderColor: `${LANDING_ACCENT}55`, color: '#cbb892' }}
              >
                Guided Activation <span aria-hidden="true">→</span>
              </OsEntryLink>
            </div>
          </div>
        </section>

        <LandingChannelTools />

        <LandingDarkBand />

        <GovernanceActivationSection />

        <section id="platform" className="py-[64px] lg:py-[72px]">
          <div className="mx-auto max-w-[1500px] px-[4vw]">
            <div className="mb-10 max-w-3xl">
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
                className="mt-[18px] leading-[1.05] tracking-[-.03em]"
                style={{ fontFamily: LANDING_SERIF, fontWeight: 500, fontSize: LANDING_H2 }}
              >
                Eine Runtime.{' '}
                <em className="not-italic" style={{ color: LANDING_ACCENT }}>
                  Module, die live erreichbar sind.
                </em>
              </h2>
              <p className="mt-[14px] max-w-[640px] text-[13px] leading-[1.65]" style={{ color: LANDING_MUTED }}>
                Nur Capabilities mit Status LIVE aus dem Product-Registry. Preview und Coming Soon
                stehen unter{' '}
                <a href="#roadmap" className="underline decoration-[#e4cfa2]/40 underline-offset-2">
                  Roadmap
                </a>
                .
              </p>
            </div>
            <div className="grid gap-px overflow-hidden border border-[#e4cfa2]/15 bg-[#e4cfa2]/08 md:grid-cols-2 lg:grid-cols-3">
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
                    className="block p-6 transition hover:bg-[#e4cfa2]/5"
                    style={{ backgroundColor: LANDING_BG }}
                  >
                    {body}
                  </Link>
                ) : (
                  <div
                    key={cap.id}
                    data-reveal
                    data-reveal-group="platform"
                    className="p-6"
                    style={{ backgroundColor: LANDING_BG }}
                  >
                    {body}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="evidence" className="border-y border-[#e4cfa2]/10 py-[64px] lg:py-[72px]" style={{ backgroundColor: 'rgba(228,207,162,0.03)' }}>
          <div className="mx-auto max-w-[1500px] px-[4vw]">
            <div className="grid gap-10 lg:grid-cols-[.85fr_1.15fr] lg:items-end">
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
                  className="mt-[18px] leading-[1.05] tracking-[-.03em]"
                  style={{ fontFamily: LANDING_SERIF, fontWeight: 500, fontSize: LANDING_H2 }}
                >
                  Compliance, die sich{' '}
                  <em className="not-italic" style={{ color: LANDING_ACCENT }}>
                    beweisen lässt.
                  </em>
                </h2>
                <p className="mt-4 max-w-md text-[13px] leading-relaxed" style={{ color: LANDING_MUTED }}>
                  PDFs, Logs und Prüfpfade — wo Evidence-Module live sind. Keine Fake-Metriken.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <OsEntryLink
                    to="/app/evidence"
                    className="inline-flex items-center gap-2 rounded-full px-[18px] py-[12px] text-[11px] font-semibold transition hover:brightness-110"
                    style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
                  >
                    Evidence öffnen <ArrowRight className="h-3.5 w-3.5" />
                  </OsEntryLink>
                  <Link
                    to="/evidence-vault"
                    className="inline-flex items-center gap-2 rounded-full border px-[18px] py-[12px] text-[11px] font-semibold transition hover:bg-[#e4cfa2]/10"
                    style={{ borderColor: `${LANDING_ACCENT}80`, color: '#e8dfd2' }}
                  >
                    Fachseite Evidence Vault
                  </Link>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TrustItem
                  icon={ShieldCheck}
                  title="DSGVO"
                  text="Scan und Governance-Prozess für Verarbeitung, Risiko und Nachweis."
                />
                <TrustItem
                  icon={Lock}
                  title="EU AI Act"
                  text="Risikoklassifikation und Dokumentation für KI-Systeme im /app."
                />
                <TrustItem
                  icon={FileCheck2}
                  title="Nachweis-Export"
                  text="Exports und Evidence-Flächen unter /app/evidence."
                />
                <TrustItem
                  icon={Code2}
                  title="Code Optimizer"
                  text="Code-Risiken über AI Gateway prüfen — Route live, kein KPI-Claim."
                />
              </div>
            </div>
          </div>
        </section>

        <section id="operating-loop" className="py-[64px] lg:py-[72px]">
          <div className="mx-auto max-w-[1500px] px-[4vw]">
            <div className="mb-8 max-w-3xl">
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
                className="mt-[18px] leading-[1.05] tracking-[-.03em]"
                style={{ fontFamily: LANDING_SERIF, fontWeight: 500, fontSize: LANDING_H2 }}
              >
                Von der KI-Nutzung zur{' '}
                <em className="not-italic" style={{ color: LANDING_ACCENT }}>
                  kontrollierten Organisation.
                </em>
              </h2>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/governance-runtime"
                  className="inline-flex items-center gap-2 rounded-full px-[18px] py-[12px] text-[11px] font-semibold transition hover:brightness-110"
                  style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
                >
                  Runtime-Fachseite <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <OsEntryLink
                  to="/app/modules"
                  className="inline-flex items-center gap-2 rounded-full border px-[18px] py-[12px] text-[11px] font-semibold transition hover:bg-[#e4cfa2]/10"
                  style={{ borderColor: `${LANDING_ACCENT}80`, color: '#e8dfd2' }}
                >
                  Module im Workspace öffnen
                </OsEntryLink>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {GOVERNANCE_STEPS.map(([no, title, text]) => (
                <div
                  key={no}
                  data-reveal
                  data-reveal-group="runtime"
                  className="surface-panel p-5"
                >
                  <span
                    className="text-2xl"
                    style={{ fontFamily: LANDING_MONO, color: `${LANDING_ACCENT}59` }}
                  >
                    {no}
                  </span>
                  <h3 className="mt-3 text-base font-semibold tracking-wide" style={{ color: LANDING_TEXT }}>
                    {title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed" style={{ color: LANDING_MUTED }}>
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

        <section className="border-t border-[#e4cfa2]/10 bg-black/80 py-[64px] lg:py-[72px]">
          <div className="mx-auto max-w-3xl px-[4vw] text-center">
            <p
              className="text-[10px] tracking-[.25em]"
              style={{ fontFamily: LANDING_MONO, color: LANDING_ACCENT }}
            >
              WARUM JETZT
            </p>
            <h2
              className="hero-shine mt-4 tracking-tight"
              style={{ fontFamily: LANDING_SERIF, fontWeight: 500, fontSize: LANDING_H2 }}
            >
              Governance statt Checkliste.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[14px] leading-relaxed" style={{ color: 'rgba(242,238,230,0.72)' }}>
              Eine Checkliste beruhigt bis zum nächsten Audit. Die Runtime hält den Nachweis, wenn
              Aufsicht, Kunde oder Board fragt — für die Module, die heute live sind.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/audit"
                className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 font-semibold transition hover:brightness-105"
                style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
              >
                {HERO_SCAN_CTA_LABEL} <ArrowRight className="h-4 w-4" />
              </Link>
              <OsEntryLink
                to="/app/activation"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 font-medium transition hover:bg-[#e4cfa2]/10"
                style={{ borderColor: `${LANDING_ACCENT}80`, color: '#e8dfd2' }}
              >
                Guided Activation
              </OsEntryLink>
              <Link
                to="/#pricing"
                className="inline-flex items-center justify-center gap-2 rounded-full border px-7 py-3.5 font-medium transition hover:bg-[#e4cfa2]/10"
                style={{ borderColor: `${LANDING_ACCENT}80`, color: '#e8dfd2' }}
              >
                Preise ansehen
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer
        className="relative z-10 flex flex-col items-center justify-center gap-4 border-t border-[#e4cfa2]/12 px-[4vw] py-[28px] text-[11px] sm:flex-row sm:justify-between"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        <span>© 2026 RealSync Dynamics.AI</span>
        <nav aria-label="Rechtliches" className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
          {[
            { label: 'Impressum', to: '/impressum' },
            { label: 'AGB', to: '/agb' },
            { label: 'Datenschutz', to: '/datenschutz' },
            { label: 'Widerruf', to: '/legal/widerruf' },
            { label: 'Kontakt', to: '/kontakt' },
            { label: 'Roadmap', to: '/roadmap' },
          ].map((item, idx, arr) => (
            <span key={item.to} className="inline-flex items-center gap-x-3">
              <Link to={item.to} className="hover:text-[#f2eee6]">
                {item.label}
              </Link>
              {idx < arr.length - 1 && (
                <span aria-hidden="true" className="text-[#9a9aa1]/55">
                  |
                </span>
              )}
            </span>
          ))}
        </nav>
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
