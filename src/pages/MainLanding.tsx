import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Code2, FileCheck2, Lock, Scan, ShieldCheck, Snowflake } from 'lucide-react';
import { SEOHead } from '../components/SEOHead';
import { LandingChannelTools } from '../components/landing/LandingChannelTools';
import { LIVE_CAPABILITIES, BUILDING_CAPABILITIES } from '../config/platform-capabilities';
import {
  RUNTIME_PREVIEW_LABEL,
  RUNTIME_PREVIEW_NOTE,
  RUNTIME_PREVIEW_CARDS,
} from '../config/landing-runtime-preview';
import { HERO_HEADLINE } from '../components/governance-frontend/hero-content';
import { EnterpriseAccessSection } from '../components/landing/EnterpriseAccessSection';
import { FrankfurtSkyline } from '../components/landing/FrankfurtSkyline';
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
  // Ein Observer fuer die ganze Seite (siehe useStagedReveal), Parallax nur
  // auf der Hero-Bildebene — nicht auf dem Text darueber, sonst wandert die
  // Headline unter dem Leser weg.
  const revealRoot = useStagedReveal<HTMLElement>();
  const heroImage = useHeroParallax<HTMLDivElement>();

  const startScan = (event: FormEvent) => {
    event.preventDefault();
    const value = domain.trim();
    navigate(value ? `/unified-entry/scan?domain=${encodeURIComponent(value)}` : '/unified-entry/scan');
  };

  return (
    <div className="landing-context min-h-screen bg-[rgb(3,7,18)] text-white antialiased" style={{ backgroundColor: BG, fontFamily: SANS }}>
      <SEOHead
        title="RealSyncDynamics.AI — Das Governance OS für DSGVO & EU AI Act"
        description="Das Governance OS für DSGVO und EU AI Act. Website-Governance, Claude Code Optimizer, Evidence Vault, Policy Packs, auditfähiger Nachweis-Export und kontinuierliches Monitoring in einer Runtime."
        canonical="/"
        ogTitle="Das Governance OS für DSGVO & EU AI Act"
        ogDescription="RealSyncDynamics.AI verbindet DSGVO, EU AI Act, Code-Compliance, Policy-Durchsetzung und auditfähige Nachweise in einer operativen Governance-Runtime."
      />

      <header className="absolute inset-x-0 top-0 z-30"><div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-10"><Link to="/" className="flex items-center gap-2.5"><Snowflake className="h-6 w-6 text-cyan-400" strokeWidth={1.5} /><span className="text-base font-semibold tracking-tight sm:text-lg">RealSync <span className="font-normal text-white/80">Dynamics.AI</span></span></Link><nav className="hidden items-center gap-7 md:flex"><a href="#tools" className="text-sm text-white/65 transition-colors hover:text-white">Tools</a><a href="#platform" className="text-sm text-white/65 transition-colors hover:text-white">Produkt</a><a href="#evidence" className="text-sm text-white/65 transition-colors hover:text-white">Evidence</a><a href="#enterprise" className="hidden text-sm text-white/65 transition-colors hover:text-white lg:block">Enterprise</a><Link to="/ai-act" className="hidden text-sm text-white/65 transition-colors hover:text-white xl:block">EU AI Act</Link><Link to="/sicherheit" className="hidden text-sm text-white/65 transition-colors hover:text-white xl:block">Sicherheit</Link><Link to="/pricing" className="text-sm text-white/65 transition-colors hover:text-white">Preise</Link><Link to="/welcome" className="text-sm text-white/65 transition-colors hover:text-white">Login</Link><Link to="/unified-entry/scan" className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-300">Free Audit starten</Link></nav></div></header>

      <main ref={revealRoot}>
        <section className="relative min-h-[880px] overflow-hidden">
          <div className="absolute inset-0" ref={heroImage}>
            <picture>
              <source srcSet="/europe-globe.webp" type="image/webp" />
              <img src="/europe-globe.jpg" alt="Europa bei Nacht mit digitalen Datenströmen" width={1376} height={768} fetchPriority="high" className="h-full w-full object-cover object-right opacity-90" />
            </picture>
            {/* Morgenlicht und Skyline liegen ueber dem Bild, aber unter den
                Verlaeufen: So bleibt die Textspalte links lesbar, waehrend
                rechts die Stadt gegen den aufhellenden Horizont steht. */}
            <div className="hero-dawn" aria-hidden="true" />
            <FrankfurtSkyline className="hero-skyline" />
            <div className="hero-dawn-rim" aria-hidden="true" />

            {/* Der Verlauf haelt die Textspalte lesbar, gibt den Globus rechts aber
                frei. Vorher lag bis 95% Schwarz darueber — Europa war kaum zu sehen. */}
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/85 to-transparent" />
            {/* Fusspunkt heller als zuvor (from-…/80 statt volldeckend): Die
                Skyline steht sonst in einer schwarzen Wanne statt auf einem
                Horizont. */}
            <div className="absolute inset-0 bg-gradient-to-t from-[rgb(3,7,18)]/80 via-transparent to-black/30" />
            {/* Vignette: zieht den Blick zur Bildmitte, ohne die Kanten zu
                haerten. Mittelpunkt seit dem Neuausleuchten etwas tiefer (52 %
                statt 45 %), damit der Lichtsaum am Horizont im offenen Teil
                liegt und nicht im abgedunkelten Rand. */}
            <div className="absolute inset-0" style={{ background: 'radial-gradient(126% 96% at 66% 52%, transparent 0%, transparent 44%, rgba(3,7,18,.5) 100%)' }} />
          </div>

          <div className="relative z-10 mx-auto grid min-h-[880px] max-w-7xl items-center gap-10 px-6 pb-20 pt-28 lg:grid-cols-[1.05fr_.95fr] lg:px-10">
            <div className="max-w-3xl">
              <Link to="/claude-code-optimizer" className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-cyan-500/30 bg-cyan-500/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.2em] text-cyan-300 transition hover:border-cyan-400/50 hover:bg-cyan-500/10">
                <span className="rounded-full bg-cyan-400 px-1.5 py-0.5 text-[9px] font-semibold text-[rgb(3,7,18)]">NEU</span>
                Claude Code Optimizer <ArrowRight className="h-3 w-3" />
              </Link>

              {/* H1 aus hero-content.ts — nicht hartkodieren. Siehe FE-001 dort. */}
              {/* Seit v5 zwei kurze Zeilen — die tragen `lg:text-7xl`, ohne im Wort
                  umzubrechen. Bei der dreizeiligen v4-Headline ging das nicht. */}
              <h1 className="text-[2.6rem] leading-[.98] tracking-[-.035em] sm:text-6xl lg:text-7xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>
                {HERO_HEADLINE.map((segments, line) => (
                  <span key={line} className="block">
                    {segments.map((segment, i) => (
                      <span key={i} className={segment.accent ? 'hero-shine-accent' : 'hero-shine'}>{segment.text}</span>
                    ))}
                  </span>
                ))}
              </h1>

              <p className="mt-5 font-mono text-[11px] uppercase tracking-[.28em] text-white/35">
                <Scan className="mr-2 inline h-3.5 w-3.5" />KI-Governance &amp; Code-Optimierung
              </p>

              <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg">
                RealSyncDynamics.AI überwacht Websites, KI-Systeme, Code und Nachweise kontinuierlich — Regeln, Prüfungen und Belege auf derselben Governance-Ebene.
              </p>

              <div className="mt-7 grid gap-6 border-t border-white/10 pt-6 sm:grid-cols-3 sm:divide-x sm:divide-white/10">
                {HERO_PILLARS.map(([title, text], i) => (
                  <div key={title} className={i > 0 ? 'sm:pl-6' : undefined}>
                    <p className="font-mono text-[10px] tracking-[.18em] text-cyan-300">{title}</p>
                    <p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/unified-entry/scan" className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-7 py-3.5 font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-300">Kostenlos starten <ArrowRight className="h-4 w-4" /></Link>
                <a href="#platform" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 font-medium text-white transition hover:border-white/50 hover:bg-white/5">Plattform ansehen</a>
              </div>

              <form onSubmit={startScan} className="mt-5 max-w-2xl">
                <div className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-black/35 p-2 backdrop-blur-xl sm:flex-row">
                  <input value={domain} onChange={event => setDomain(event.target.value)} placeholder="Ihre Website für den kostenlosen Governance-Audit" aria-label="Website-URL für Governance-Scan" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/30" />
                  <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-50">Audit starten <ArrowRight className="h-4 w-4" /></button>
                </div>
                <p className="mt-2 text-[10px] text-white/35">URL genügt · kein Account vor dem Einstieg · Ergebnis in wenigen Minuten</p>
              </form>
            </div>

            {/*
              Kartengruppe: zeigt, wie das Dashboard aussieht. Ausdrücklich als
              Beispiel gekennzeichnet — ein anonymer Besucher hat keinen Tenant,
              dort ist nichts messbar. Werte kommen aus landing-runtime-preview.ts.
            */}
            <div className="hidden lg:block">
              <p className="mb-4 text-right font-mono text-[10px] tracking-[.22em] text-cyan-300/70">{RUNTIME_PREVIEW_LABEL}</p>
              <div className="space-y-3">
                {RUNTIME_PREVIEW_CARDS.map((card, i) => (
                  <div
                    key={card.id}
                    className={`${card.offset} landing-hero-card surface-panel max-w-[19rem] rounded-2xl bg-black/45 p-4`}
                    style={{ animationDelay: `${i * 0.9}s` }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full ${card.tone === 'ok' ? 'bg-emerald-400' : 'bg-cyan-400'}`} />
                      <span className="font-mono text-[9px] tracking-[.18em] text-white/45">{card.label}</span>
                    </div>
                    <div className={`mt-2 text-2xl font-semibold ${card.tone === 'ok' ? 'text-emerald-300' : 'text-white'}`}>{card.value}</div>
                    {card.ratio !== undefined && (
                      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.round(card.ratio * 100)}%` }} />
                      </div>
                    )}
                    {card.detail && <p className="mt-2 text-[11px] leading-relaxed text-white/40">{card.detail}</p>}
                  </div>
                ))}
              </div>
              <p className="mt-4 max-w-[19rem] text-[10px] leading-relaxed text-white/35 lg:ml-24">{RUNTIME_PREVIEW_NOTE}</p>
            </div>
          </div>
        </section>

        <LandingChannelTools />

        <section id="platform" className="py-20 md:py-28"><div className="mx-auto max-w-7xl px-6 lg:px-10"><div className="mb-12 max-w-3xl"><p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">DIE PLATTFORM</p><h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Eine Runtime. <span className="text-cyan-400">Vollständige KI-Governance.</span></h2><p className="mt-5 leading-relaxed text-white/55">RealSyncDynamics.AI verbindet Erkennung, Risikobewertung, Policies, Enforcement und Evidence zu einem durchgängigen operativen Kontrollprozess.</p></div><div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-3">{LIVE_CAPABILITIES.map(cap => {
              /* Wo es eine Fachseite gibt, wird die Karte anklickbar. Sechs solcher
                 Seiten lagen bislang ohne Einstieg von der Startseite herum (§14). */
              const body = <><h3 className="text-base font-semibold">{cap.name}</h3><p className="mt-2 text-sm leading-relaxed text-white/50">{cap.description}</p>{cap.learnMorePath && <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-cyan-300">Mehr erfahren <ArrowRight className="h-3.5 w-3.5" /></span>}</>;
              return cap.learnMorePath
                ? <Link key={cap.id} to={cap.learnMorePath} data-reveal data-reveal-group="platform" className="block bg-[rgb(3,7,18)] p-7 transition hover:bg-white/[.03]">{body}</Link>
                : <div key={cap.id} data-reveal data-reveal-group="platform" className="bg-[rgb(3,7,18)] p-7">{body}</div>;
            })}</div>{BUILDING_CAPABILITIES.length > 0 && <div className="mt-10"><p className="font-mono text-[10px] tracking-[.25em] text-white/35">IN ENTWICKLUNG</p><div className="mt-4 grid gap-4 md:grid-cols-3">{BUILDING_CAPABILITIES.map(cap => <div key={cap.id} className="rounded-xl border border-dashed border-white/15 p-5"><div className="flex items-center gap-2"><h3 className="text-sm font-medium text-white/70">{cap.name}</h3><span className="rounded-full border border-white/15 px-2 py-0.5 font-mono text-[9px] tracking-[.12em] text-white/40">GEPLANT</span></div><p className="mt-2 text-xs leading-relaxed text-white/40">{cap.description}</p>{cap.note && <p className="mt-2 text-[11px] leading-relaxed text-white/30">{cap.note}</p>}</div>)}</div><p className="mt-4 text-[11px] text-white/30">Diese Module sind noch nicht in Produktion verfügbar. Wir weisen sie aus, statt sie mitzuverkaufen.</p></div>}</div></section>

        <section id="evidence" className="border-y border-white/10 bg-white/[.02] py-20 md:py-28"><div className="mx-auto max-w-7xl px-6 lg:px-10"><div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><div><p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">EVIDENCE &amp; TRUST</p><h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Compliance, die sich <span className="text-cyan-400">beweisen lässt.</span></h2><p className="mt-5 leading-relaxed text-white/55">PDFs, Logs, Zeitstempel und nachvollziehbare Prüfpfade. Jede Prüfung, jede Entscheidung und jede Änderung landet in derselben Governance-Historie.</p></div><div className="grid gap-3 sm:grid-cols-2"><TrustItem icon={ShieldCheck} title="DSGVO" text="Verarbeitung, Risiko, Policy und Nachweis im laufenden Governance-Prozess." /><TrustItem icon={Lock} title="EU AI Act" text="Risikoklassifikation, Transparenz und Dokumentation für KI-Systeme." /><TrustItem icon={FileCheck2} title="Nachweis-Export" text="Prüfungen und Entscheidungen als auditfähiger Export — für interne Kontrollen und externe Prüfer." /><TrustItem icon={Code2} title="Code Compliance" text="Claude Code prüft und unterstützt konkrete technische Remediation." /></div></div></div></section>

        <section className="py-20 md:py-28"><div className="mx-auto max-w-7xl px-6 lg:px-10"><div className="mb-12 max-w-3xl"><p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">GOVERNANCE RUNTIME</p><h2 className="mt-3 text-4xl tracking-tight sm:text-5xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Von der KI-Nutzung zur <span className="text-cyan-400">kontrollierten KI-Organisation.</span></h2></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{GOVERNANCE_STEPS.map(([no,title,text]) => <div key={no} data-reveal data-reveal-group="runtime" className="surface-panel rounded-2xl p-7"><span className="font-mono text-3xl text-cyan-400/35">{no}</span><h3 className="mt-4 text-lg font-semibold tracking-wide">{title}</h3><p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p></div>)}</div></div></section>

        <EnterpriseAccessSection />

        <section className="border-t border-white/10 bg-black py-20 md:py-28"><div className="mx-auto max-w-4xl px-6 text-center"><p className="font-mono text-[10px] tracking-[.25em] text-cyan-400">ONE GOVERNANCE PLANE</p><h2 className="mt-4 text-4xl tracking-tight sm:text-6xl" style={{ fontFamily: SERIF, fontWeight: 500 }}>Governance statt Checkliste.</h2><p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/55">Compliance statt Selbstauskunft. Evidence statt Behauptung. Enforcement statt Empfehlung.</p><div className="mt-8 flex flex-wrap justify-center gap-3 text-xs text-white/50"><span className="rounded-full border border-white/10 px-4 py-2">DSGVO</span><span className="rounded-full border border-white/10 px-4 py-2">EU AI Act</span><span className="rounded-full border border-white/10 px-4 py-2">Policy Packs</span><span className="rounded-full border border-white/10 px-4 py-2">Evidence Vault</span><span className="rounded-full border border-white/10 px-4 py-2">Claude Code</span><span className="rounded-full border border-white/10 px-4 py-2">Nachweis-Export</span></div><div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/unified-entry/scan" className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-7 py-3.5 font-semibold text-[rgb(3,7,18)] transition hover:bg-cyan-300">Free Audit starten <ArrowRight className="h-4 w-4" /></Link><Link to="/pricing" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-3.5 font-semibold text-white transition hover:border-white/40">Preise ansehen</Link></div></div></section>
      </main>

      <footer className="border-t border-white/10 py-8"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs text-white/40 sm:flex-row lg:px-10"><span>© 2026 RealSync Dynamics.AI</span><div className="flex gap-5"><Link to="/impressum">Impressum</Link><Link to="/datenschutz">Datenschutz</Link><Link to="/agb">AGB</Link></div></div></footer>
    </div>
  );
}

function TrustItem({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) {
  return <div data-reveal data-reveal-group="evidence" className="surface-panel rounded-2xl p-6"><Icon className="h-5 w-5 text-cyan-400" /><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-white/50">{text}</p></div>;
}
