import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Code2, FileCheck2, Lock, ShieldCheck } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { LandingChannelTools } from '../components/landing/LandingChannelTools';
import { LandingDarkBand } from '../components/landing/LandingDarkBand';
import { LandingPricingSection } from '../components/landing/LandingPricingSection';
import { PublicDarkHeader } from '../components/landing/PublicDarkHeader';
import { HeroEarthBackdrop } from '../components/landing/HeroEarthBackdrop';
import {
  LANDING_ACCENT,
  LANDING_BG,
  LANDING_BUTTON,
  LANDING_BUTTON_TEXT,
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
} from '../components/governance-frontend/hero-content';
import { EnterpriseAccessSection } from '../components/landing/EnterpriseAccessSection';
import { LIVE_CAPABILITIES, BUILDING_CAPABILITIES } from '../config/platform-capabilities';
import { useStagedReveal } from '../hooks/useStagedReveal';

/** Drei Säulen unter der Headline. Nur Module, die in Produktion laufen. */
const HERO_PILLARS: readonly (readonly [string, string])[] = [
  ['DSGVO-KONFORM', 'Nachweise, Prozesse und Richtlinien laufen automatisiert mit.'],
  ['AI-ACT-BEREIT', 'Risikobewertung, Transparenz und Dokumentation je KI-System.'],
  ['DURCHGEHEND', 'Wiederkehrende Nachprüfung, Meldungen und Belege statt Stichproben.'],
];

const GOVERNANCE_STEPS = [
  ['01', 'DISCOVER', 'KI-Systeme, Anwendungen, Datenflüsse und relevante Verarbeitungsvorgänge erfassen.'],
  ['02', 'ASSESS', 'Risiken bewerten und Systeme gegen Governance-, DSGVO- und EU-AI-Act-Kriterien prüfen.'],
  ['03', 'GOVERN', 'Verbindliche Policies, Verantwortlichkeiten und Kontrollanforderungen zentral definieren.'],
  ['04', 'ENFORCE', 'Governance-Regeln operativ durchsetzen und Abweichungen kontrolliert behandeln.'],
  ['05', 'EVIDENCE', 'Prüfungen, Entscheidungen, Änderungen und Kontrollen nachvollziehbar dokumentieren.'],
  ['06', 'AUDIT', 'Eine konsistente Governance-Historie für Management, interne Kontrollen und Audits bereitstellen.'],
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
          className="relative isolate min-h-[min(88vh,820px)] overflow-hidden border-b border-[#e4cfa2]/10 lg:min-h-[min(86vh,780px)]"
        >
          {/* Full-bleed Earth + universe — scenery only, no interaction */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <HeroEarthBackdrop />
          </div>

          <div className="relative mx-auto flex max-w-[900px] flex-col items-center px-[4vw] pb-[52px] pt-[36px] text-center lg:pb-[58px] lg:pt-[40px]">
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
              className="relative mt-[14px] mb-3 text-[clamp(42px,5.8vw,72px)] leading-[0.94] tracking-[-.04em] lg:mt-[16px] lg:mb-3.5"
              style={{ fontFamily: LANDING_SERIF, fontWeight: 500 }}
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
              className="max-w-[560px] text-[14px] leading-[1.55] lg:text-[15px] lg:leading-[1.6]"
              style={{ color: 'rgba(242,238,230,0.78)' }}
            >
              Govern AI. Prove Everything. Operate with Confidence.
              <br />
              Erfassen, bewerten, durchsetzen und nachweisen — in einer kontinuierlichen Governance
              Runtime.
            </p>

            <div
              className="value-grid my-[18px] mb-[14px] grid w-full max-w-[720px] gap-0 border-y sm:grid-cols-3 lg:my-[20px] lg:mb-[16px]"
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
                  className="inline-flex items-center justify-center gap-2 rounded-full px-[18px] py-[11px] text-[11px] font-semibold transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2] lg:py-[12px]"
                  style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
                >
                  Kostenlosen Governance Scan starten <span aria-hidden="true">→</span>
                </button>
              </div>
              <p
                className="mt-1.5 px-1 text-[8px] tracking-[.08em]"
                style={{ fontFamily: LANDING_MONO, color: '#6e7077' }}
              >
                DSGVO · EU AI Act · Sicherheit · Barrierefreiheit · SEO kein Account nötig
              </p>
            </form>

            <a
              href="#runtime"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border px-[20px] py-[11px] text-[13px] font-medium transition hover:bg-[#e4cfa2]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4cfa2]/60 lg:mt-5"
              style={{ borderColor: `${LANDING_ACCENT}80`, color: '#e8dfd2' }}
            >
              Explore the Governance OS <span aria-hidden="true">→</span>
            </a>
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
                  Vollständige KI-Governance.
                </em>
              </h2>
              <p className="mt-[17px] max-w-[760px] text-[13px] leading-[1.7]" style={{ color: LANDING_MUTED }}>
                RealSyncDynamics.AI verbindet Erkennung, Risikobewertung, Policies, Enforcement und
                Evidence zu einem durchgängigen operativen Kontrollprozess.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden border border-[#e4cfa2]/15 bg-[#e4cfa2]/08 md:grid-cols-2 lg:grid-cols-3">
              {LIVE_CAPABILITIES.map((cap) => {
                const body = (
                  <>
                    <h3 className="text-base font-semibold" style={{ color: LANDING_TEXT }}>
                      {cap.name}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: LANDING_MUTED }}>
                      {cap.description}
                    </p>
                    {cap.learnMorePath && (
                      <span
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium"
                        style={{ color: LANDING_ACCENT }}
                      >
                        Mehr erfahren <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </>
                );
                return cap.learnMorePath ? (
                  <Link
                    key={cap.id}
                    to={cap.learnMorePath}
                    data-reveal
                    data-reveal-group="platform"
                    className="block p-7 transition hover:bg-[#e4cfa2]/5"
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
            {BUILDING_CAPABILITIES.length > 0 && (
              <div className="mt-10">
                <p
                  className="text-[10px] tracking-[.25em] text-[#9a9aa1]/70"
                  style={{ fontFamily: LANDING_MONO }}
                >
                  IN ENTWICKLUNG
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {BUILDING_CAPABILITIES.map((cap) => (
                    <div key={cap.id} className="border border-dashed border-[#e4cfa2]/25 p-5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-[#e8ddc8]/90">{cap.name}</h3>
                        <span
                          className="border border-[#e4cfa2]/22 px-2 py-0.5 text-[9px] tracking-[.12em] text-[#9a9aa1]"
                          style={{ fontFamily: LANDING_MONO }}
                        >
                          GEPLANT
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-[#9a9aa1]">{cap.description}</p>
                      {cap.note && (
                        <p className="mt-2 text-[11px] leading-relaxed text-[#9a9aa1]/80">{cap.note}</p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[11px] text-[#9a9aa1]/80">
                  Diese Module sind noch nicht in Produktion verfügbar. Wir weisen sie aus, statt sie
                  mitzuverkaufen.
                </p>
              </div>
            )}
          </div>
        </section>

        <section id="evidence" className="border-y border-[#e4cfa2]/10 py-[92px]" style={{ backgroundColor: 'rgba(228,207,162,0.03)' }}>
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

        <section id="runtime" className="py-[92px]">
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

        <EnterpriseAccessSection />

        <section className="border-t border-[#e4cfa2]/10 bg-black/80 py-[92px]">
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
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed" style={{ color: 'rgba(242,238,230,0.72)' }}>
              Eine Checkliste beruhigt bis zum nächsten Audit. Die Runtime hält den Nachweis, wenn
              Aufsicht, Kunde oder Board fragt.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/audit"
                className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 font-semibold transition hover:brightness-105"
                style={{ backgroundColor: LANDING_BUTTON, color: LANDING_BUTTON_TEXT }}
              >
                Kostenlosen Governance Scan starten <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/pricing"
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
          <Link to="/impressum" className="hover:text-[#f2eee6]">
            Impressum
          </Link>
          <span aria-hidden="true" className="text-[#9a9aa1]/55">
            |
          </span>
          <Link to="/datenschutz" className="hover:text-[#f2eee6]">
            Datenschutz
          </Link>
          <span aria-hidden="true" className="text-[#9a9aa1]/55">
            |
          </span>
          <Link to="/agb" className="hover:text-[#f2eee6]">
            AGB
          </Link>
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
