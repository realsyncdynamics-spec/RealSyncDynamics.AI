import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Code2, FileCheck2, Lock, ShieldCheck } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { LandingChannelTools } from '../components/landing/LandingChannelTools';
import { PublicDarkHeader } from '../components/landing/PublicDarkHeader';
import {
  RUNTIME_PREVIEW_LABEL,
  RUNTIME_PREVIEW_NOTE,
  RUNTIME_PREVIEW_CARDS,
} from '../config/landing-runtime-preview';
import {
  HERO_HEADLINE,
  HERO_OPERATING_LOOP,
} from '../components/governance-frontend/hero-content';
import { GovernanceSphereHost } from '../components/governance-frontend/GovernanceSphereHost';
import { EnterpriseAccessSection } from '../components/landing/EnterpriseAccessSection';
import { LIVE_CAPABILITIES, BUILDING_CAPABILITIES } from '../config/platform-capabilities';
import { useStagedReveal } from '../hooks/useStagedReveal';
import { useHeroParallax } from '../hooks/useHeroParallax';

const BG = 'rgb(3, 7, 18)';
const SANS = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

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
  const heroImage = useHeroParallax<HTMLDivElement>();

  const startScan = (event: FormEvent) => {
    event.preventDefault();
    const value = domain.trim();
    // Kanonischer Scan-Einstieg `/audit` (CLAUDE.md §10).
    navigate(value ? `/audit?domain=${encodeURIComponent(value)}` : '/audit');
  };

  return (
    <div className="landing-context min-h-screen bg-[rgb(3,7,18)] text-white antialiased" style={{ backgroundColor: BG, fontFamily: SANS }}>
      <SEOHead
        title="RealSyncDynamics.AI — AI Governance Operating System"
        description="Govern AI. Prove Everything. Operate with Confidence. RealSyncDynamics.AI is the AI Governance OS for DSGVO and EU AI Act — detect, govern, prove, automate."
        canonical="/"
        ogTitle="AI Governance, Running in Real Time"
        ogDescription="RealSyncDynamics.AI — AI Governance Operating System. Detect. Govern. Prove. Automate."
      />

      <PublicDarkHeader overlay />

      <main ref={revealRoot}>
        <section className="relative min-h-[min(100svh,960px)] overflow-hidden lg:min-h-[880px]">
          <div className="absolute inset-0" ref={heroImage}>
            <picture>
              <source srcSet="/europe-globe.webp" type="image/webp" />
              <img
                src="/europe-globe.jpg"
                alt=""
                width={1376}
                height={768}
                fetchPriority="high"
                className="h-full w-full object-cover object-right opacity-55"
                aria-hidden="true"
              />
            </picture>
            <div className="hero-dawn" aria-hidden="true" />
            <div className="hero-dawn-rim" aria-hidden="true" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/88 to-black/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgb(3,7,18)] via-[rgb(3,7,18)]/55 to-black/40" />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 90% at 70% 45%, transparent 0%, transparent 40%, rgba(3,7,18,.65) 100%)',
              }}
              aria-hidden="true"
            />
          </div>

          <div className="relative z-10 mx-auto grid min-h-[min(100svh,960px)] max-w-7xl items-center gap-12 px-6 pb-16 pt-28 sm:pb-20 sm:pt-32 lg:min-h-[880px] lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:px-10 lg:pb-24">
            <div className="max-w-3xl">
              <p className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-[#e8c98a]/40 bg-[#e8c98a]/10 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[.22em] text-[#f3d9a0] sm:mb-8">
                AI Governance Operating System
              </p>

              <h1
                className="text-[2.45rem] leading-[1.02] tracking-[-.035em] sm:text-[3.5rem] sm:leading-[.98] lg:text-[4.1rem] xl:text-7xl"
                style={{ fontFamily: SERIF, fontWeight: 500 }}
              >
                {HERO_HEADLINE.map((segments, line) => (
                  <span key={line} className="block">
                    {segments.map((segment, i) => (
                      <span
                        key={i}
                        className={segment.accent ? 'hero-shine-accent' : 'hero-shine'}
                      >
                        {segment.text}
                      </span>
                    ))}
                  </span>
                ))}
              </h1>

              <p className="mt-4 font-mono text-[11px] tracking-[.22em] text-[#e8c98a]/85 sm:text-xs">
                {HERO_OPERATING_LOOP}
              </p>

              <p className="mt-5 max-w-2xl text-[0.95rem] leading-relaxed text-white/65 sm:mt-6 sm:text-lg sm:leading-[1.65]">
                Govern AI. Prove Everything. Operate with Confidence. Erfassen, bewerten,
                durchsetzen und nachweisen — in einer kontinuierlichen Governance Runtime.
              </p>

              <div className="mt-8 grid gap-5 border-t border-white/10 pt-6 sm:mt-9 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-white/10 sm:pt-7">
                {HERO_PILLARS.map(([title, text], i) => (
                  <div key={title} className={i > 0 ? 'sm:pl-6' : undefined}>
                    <p className="font-mono text-[10px] tracking-[.18em] text-[#e8c98a]">{title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={startScan} className="mt-8 max-w-2xl sm:mt-9">
                <div className="landing-hero-glass flex flex-col gap-2 rounded-2xl border border-white/15 bg-black/40 p-2 backdrop-blur-xl sm:flex-row sm:items-stretch">
                  <input
                    value={domain}
                    onChange={(event) => setDomain(event.target.value)}
                    placeholder="Ihre Website — z. B. firma.de"
                    aria-label="Website-URL für den kostenlosen Governance Scan"
                    className="min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3.5 text-sm text-white outline-none placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-[#e8c98a]/45"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f0e6d2] px-5 py-3.5 text-sm font-semibold text-[#1a1714] transition hover:bg-[#f6efe4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c98a] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(3,7,18)]"
                  >
                    Kostenlosen Governance Scan starten <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2.5 font-mono text-[10px] tracking-[.08em] text-white/35">
                  DSGVO · EU AI Act · Sicherheit · Barrierefreiheit · SEO — kein Account nötig
                </p>
              </form>

              <div className="mt-5 flex flex-wrap gap-3 sm:mt-6">
                <a
                  href="#platform"
                  className="inline-flex items-center gap-2 rounded-full border border-[#e8c98a]/55 bg-[#e8c98a]/[0.06] px-7 py-3.5 font-medium text-[#f3d9a0] transition hover:border-[#e8c98a]/75 hover:bg-[#e8c98a]/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8c98a]/60"
                >
                  Explore the Governance OS <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              {/* Compact runtime preview strip on small screens — still demo-labeled. */}
              <div className="mt-10 lg:hidden">
                <p className="mb-3 font-mono text-[10px] tracking-[.22em] text-[#e8c98a]/80">
                  {RUNTIME_PREVIEW_LABEL}
                </p>
                <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {RUNTIME_PREVIEW_CARDS.slice(0, 4).map((card, i) => (
                    <div
                      key={card.id}
                      className="landing-hero-card surface-panel w-[11.5rem] shrink-0 rounded-2xl bg-black/45 p-3.5"
                      style={{ animationDelay: `${i * 0.35}s` }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${card.tone === 'ok' ? 'bg-emerald-400' : 'bg-[#e8c98a]'}`}
                        />
                        <span className="font-mono text-[9px] tracking-[.18em] text-white/45">
                          {card.label}
                        </span>
                      </div>
                      <div
                        className={`mt-2 text-xl font-semibold ${card.tone === 'ok' ? 'text-emerald-300' : 'text-white'}`}
                      >
                        {card.value}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 max-w-md text-[10px] leading-relaxed text-white/35">
                  {RUNTIME_PREVIEW_NOTE}
                </p>
              </div>
            </div>

            <div className="relative">
              <div
                className="pointer-events-none absolute -inset-8 -z-10 rounded-[2rem] bg-[radial-gradient(ellipse_at_55%_40%,rgba(232,201,138,0.10),transparent_65%)]"
                aria-hidden="true"
              />
              <GovernanceSphereHost />
            </div>
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
