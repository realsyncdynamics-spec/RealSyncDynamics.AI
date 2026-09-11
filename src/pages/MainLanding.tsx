import { Link } from 'react-router-dom';
import { ArrowRight, Code2, FileCheck2, Lock, ShieldCheck } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { LandingChannelTools } from '../components/landing/LandingChannelTools';
import { PublicDarkHeader } from '../components/landing/PublicDarkHeader';
import { HeroNetworkArcs } from '../components/landing/HeroNetworkArcs';
import {
  HERO_HEADLINE,
  HERO_OPERATING_LOOP,
  HERO_SUPPORT,
} from '../components/governance-frontend/hero-content';
import { GovernanceSphereHost } from '../components/governance-frontend/GovernanceSphereHost';
import { EnterpriseAccessSection } from '../components/landing/EnterpriseAccessSection';
import { LIVE_CAPABILITIES, BUILDING_CAPABILITIES } from '../config/platform-capabilities';
import { useStagedReveal } from '../hooks/useStagedReveal';
import { useHeroParallax } from '../hooks/useHeroParallax';

const BG = 'rgb(2, 6, 14)';
const SANS = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";
const CYAN = '#22d3ee';

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
  const heroImage = useHeroParallax<HTMLDivElement>();

  return (
    <div className="landing-context min-h-screen text-white antialiased" style={{ backgroundColor: BG, fontFamily: SANS }}>
      <SEOHead
        title="RealSyncDynamics.AI — AI Compliance Operations OS for Europe"
        description="Runtime governance for regulated AI systems. Continuous evidence. EU-native by design. Discover → Classify → Enforce → Prove."
        canonical="/"
        ogTitle="AI Compliance Operations OS for Europe"
        ogDescription="Runtime governance for regulated AI systems. Continuous evidence. EU-native by design."
      />

      <PublicDarkHeader overlay />

      <main ref={revealRoot}>
        {/* Full-bleed night-Earth hero — one composition, brand + headline + support + CTAs */}
        <section className="relative min-h-[100svh] overflow-hidden">
          <div className="absolute inset-0" ref={heroImage}>
            <picture>
              <source srcSet="/europe-night-hero.webp" type="image/webp" />
              <img
                src="/europe-night-hero.jpg"
                alt=""
                width={2400}
                height={1350}
                fetchPriority="high"
                className="hero-europe-night h-full w-full scale-[1.04] object-cover object-[62%_42%]"
                aria-hidden="true"
              />
            </picture>
            <HeroNetworkArcs className="hero-network-arcs" />
            {/* Soft left wash for type — keep night lights open on the right */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/45 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgb(2,6,14)] via-transparent to-black/30" />
          </div>

          <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl items-center px-6 pb-20 pt-28 sm:pb-24 sm:pt-32 lg:px-10">
            <div className="max-w-xl lg:max-w-2xl">
              <h1
                className="text-[2.55rem] leading-[1.05] tracking-[-.03em] sm:text-[3.6rem] sm:leading-[1.02] lg:text-[4.25rem]"
                style={{ fontFamily: SERIF, fontWeight: 500 }}
              >
                {HERO_HEADLINE.map((segments, line) => (
                  <span key={line} className="block">
                    {segments.map((segment, i) => (
                      <span
                        key={i}
                        className={segment.accent ? 'hero-shine-accent' : 'hero-shine'}
                        style={segment.accent ? { fontFamily: SANS, fontWeight: 600 } : undefined}
                      >
                        {segment.text}
                      </span>
                    ))}
                  </span>
                ))}
              </h1>

              <p
                className="mt-5 font-mono text-[11px] uppercase tracking-[.28em] sm:text-xs"
                style={{ color: CYAN }}
              >
                {HERO_OPERATING_LOOP}
              </p>

              <p className="mt-5 max-w-lg text-base leading-relaxed text-white/85 sm:mt-6 sm:text-lg sm:leading-[1.6]">
                {HERO_SUPPORT}
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:items-center">
                <Link
                  to="/audit"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#22d3ee] px-7 py-3.5 text-sm font-semibold text-[#041016] transition hover:bg-[#67e8f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22d3ee] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Free Audit starten <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/welcome"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/35 bg-black/35 px-7 py-3.5 text-sm font-medium text-white backdrop-blur-sm transition hover:border-white/55 hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  Live Dashboard ansehen
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Governance Sphere — below hero so first viewport stays one composition */}
        <section className="border-t border-white/10 bg-black/40 py-16 md:py-20" aria-label="Governance Sphere">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <GovernanceSphereHost />
          </div>
        </section>

        <LandingChannelTools />

        <section id="platform" className="py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="mb-14 max-w-3xl">
              <p className="font-mono text-[10px] tracking-[.25em] text-[#e8c98a]">DIE PLATTFORM</p>
              <h2
                className="mt-4 text-[2rem] tracking-tight sm:text-5xl"
                style={{ fontFamily: SERIF, fontWeight: 500 }}
              >
                Eine Runtime. <span className="text-[#e8c98a]">Vollständige KI-Governance.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/55">
                RealSyncDynamics.AI verbindet Erkennung, Risikobewertung, Policies, Enforcement und
                Evidence zu einem durchgängigen operativen Kontrollprozess.
              </p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-3">
              {LIVE_CAPABILITIES.map((cap) => {
                const body = (
                  <>
                    <h3 className="text-base font-semibold">{cap.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/50">{cap.description}</p>
                    {cap.learnMorePath && (
                      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#e8c98a]">
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
                    className="block bg-[rgb(3,7,18)] p-7 transition hover:bg-white/[.03]"
                  >
                    {body}
                  </Link>
                ) : (
                  <div
                    key={cap.id}
                    data-reveal
                    data-reveal-group="platform"
                    className="bg-[rgb(3,7,18)] p-7"
                  >
                    {body}
                  </div>
                );
              })}
            </div>
            {BUILDING_CAPABILITIES.length > 0 && (
              <div className="mt-10">
                <p className="font-mono text-[10px] tracking-[.25em] text-white/35">IN ENTWICKLUNG</p>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  {BUILDING_CAPABILITIES.map((cap) => (
                    <div key={cap.id} className="rounded-xl border border-dashed border-white/15 p-5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-white/70">{cap.name}</h3>
                        <span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[9px] tracking-[.12em] text-white/40">
                          GEPLANT
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-white/40">{cap.description}</p>
                      {cap.note && (
                        <p className="mt-2 text-[11px] leading-relaxed text-white/30">{cap.note}</p>
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[11px] text-white/30">
                  Diese Module sind noch nicht in Produktion verfügbar. Wir weisen sie aus, statt sie
                  mitzuverkaufen.
                </p>
              </div>
            )}
          </div>
        </section>

        <section id="evidence" className="border-y border-white/10 bg-white/[.02] py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
              <div>
                <p className="font-mono text-[10px] tracking-[.25em] text-[#e8c98a]">
                  EVIDENCE &amp; TRUST
                </p>
                <h2
                  className="mt-3 text-4xl tracking-tight sm:text-5xl"
                  style={{ fontFamily: SERIF, fontWeight: 500 }}
                >
                  Compliance, die sich <span className="text-[#e8c98a]">beweisen lässt.</span>
                </h2>
                <p className="mt-5 leading-relaxed text-white/55">
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

        <section className="py-24 md:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-10">
            <div className="mb-12 max-w-3xl">
              <p className="font-mono text-[10px] tracking-[.25em] text-[#e8c98a]">
                GOVERNANCE RUNTIME
              </p>
              <h2
                className="mt-3 text-4xl tracking-tight sm:text-5xl"
                style={{ fontFamily: SERIF, fontWeight: 500 }}
              >
                Von der KI-Nutzung zur{' '}
                <span className="text-[#e8c98a]">kontrollierten KI-Organisation.</span>
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {GOVERNANCE_STEPS.map(([no, title, text]) => (
                <div
                  key={no}
                  data-reveal
                  data-reveal-group="runtime"
                  className="surface-panel rounded-2xl p-7"
                >
                  <span className="font-mono text-3xl text-[#e8c98a]/35">{no}</span>
                  <h3 className="mt-4 text-lg font-semibold tracking-wide">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <EnterpriseAccessSection />

        <section className="border-t border-white/10 bg-black/80 py-24 md:py-32">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <p className="font-mono text-[10px] tracking-[.25em] text-[#e8c98a]">WARUM JETZT</p>
            <h2
              className="hero-shine mt-4 text-4xl tracking-tight sm:text-6xl"
              style={{ fontFamily: SERIF, fontWeight: 500 }}
            >
              Governance statt Checkliste.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#e8dcc4]">
              Eine Checkliste beruhigt bis zum nächsten Audit. Die Runtime hält den Nachweis, wenn
              Aufsicht, Kunde oder Board fragt. Einstieg über die neue Präsenz — bleiben über das
              Abo.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 text-xs text-white/50">
              <span className="rounded-full border border-white/10 px-4 py-2">DSGVO</span>
              <span className="rounded-full border border-white/10 px-4 py-2">EU AI Act</span>
              <span className="rounded-full border border-white/10 px-4 py-2">Policy Packs</span>
              <span className="rounded-full border border-white/10 px-4 py-2">Evidence Vault</span>
              <span className="rounded-full border border-white/10 px-4 py-2">Claude Code</span>
              <span className="rounded-full border border-white/10 px-4 py-2">Nachweis-Export</span>
            </div>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#f0e6d2] px-7 py-3.5 font-semibold text-[#1a1714] transition hover:bg-[#f6efe4]"
              >
                Preise ansehen <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs text-white/40 sm:flex-row lg:px-10">
          <span>© 2026 RealSync Dynamics.AI</span>
          <div className="flex gap-5">
            <Link to="/impressum">Impressum</Link>
            <Link to="/datenschutz">Datenschutz</Link>
            <Link to="/agb">AGB</Link>
          </div>
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
    <div data-reveal data-reveal-group="evidence" className="surface-panel rounded-2xl p-6">
      <Icon className="h-5 w-5 text-[#e8c98a]" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p>
    </div>
  );
}
