import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { CTA } from '../content/runtimeVocab';
import { PUBLIC_PRICING_TIERS } from '../config/pricing';
import {
  Snowflake,
  ArrowRight,
  ScanLine,
  ShieldCheck,
  Radar,
  Scale,
  SlidersHorizontal,
  Boxes,
  Network,
  AlertTriangle,
  Check,
  Plus,
  Minus,
  X,
} from 'lucide-react';

/**
 * MainLanding — öffentliche Startseite, optimiert auf Self-Service Trial
 * Conversions (kein Demo-/Sales-Funnel).
 *
 * Funnel: Startseite besuchen → Nutzen verstehen → URL scannen → Ergebnis
 * sehen → 14 Tage testen.
 *
 * Design: ursprüngliches Obsidian-Dark-Theme (rgb(3,7,18)) mit Cyan-Akzent,
 * Plus Jakarta Sans + JetBrains Mono (Metadaten), Earth-at-Night-Hero (Europa).
 *
 * Struktur: Header · Hero (Scan-CTA) · Problem · Lösung · 3 Schritte ·
 *           Vergleich (vs. generische KI-Plattformen) · AI Act & DSGVO ·
 *           Pricing · Free-Trial · Final-CTA · Footer
 */

const BG = 'rgb(3, 7, 18)';
const FONT_STACK = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";

const NAV_LINKS = [
  { label: 'Runtime SaaS', to: '/runtime' },
  { label: 'AI Act & Governance', to: '/ai-act' },
  { label: 'DSGVO Website Audit', to: '/audit' },
  { label: 'Preise', to: '/pricing' },
  { label: 'Ressourcen', to: '/ressourcen' },
];

/**
 * SmartLink — interne Routen ("/...") via react-router-Link (SPA),
 * Anker ("#...") und externe Links via <a>.
 */
function SmartLink({
  to,
  className,
  children,
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
}) {
  if (to.startsWith('/')) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={to} className={className}>
      {children}
    </a>
  );
}

export function MainLanding() {
  return (
    <div className="min-h-screen text-white antialiased" style={{ backgroundColor: BG, fontFamily: FONT_STACK }}>
      {/* Config-driven SEO/OG/JSON-LD — zieht den '/'-Eintrag aus src/config/seo.ts */}
      <SEOHead />
      <Header />
      <Hero />
      <Problem />
      <Solution />
      <Steps />
      <Comparison />
      <Coverage />
      <Pricing />
      <TrialBlock />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ── HEADER ─────────────────────────────────────────────── */
function Header() {
  return (
    <header className="absolute top-0 left-0 right-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-16 sm:h-20 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
          <Snowflake className="w-5 sm:w-6 h-5 sm:h-6 text-cyan-400" strokeWidth={1.5} />
          <span className="text-sm sm:text-lg font-semibold tracking-tight">
            RealSync <span className="font-normal text-white/90">Dynamics.AI</span>
          </span>
        </a>
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
          {NAV_LINKS.map((l) => (
            <SmartLink key={l.label} to={l.to} className="text-sm text-white/70 hover:text-white transition-colors">{l.label}</SmartLink>
          ))}
          <SmartLink to="/app" className="text-sm text-white/70 hover:text-white transition-colors">Login / App</SmartLink>
        </nav>
        <SmartLink to="/audit?source=nav-scan" className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg flex-shrink-0">
          {CTA.scanWebsite}<ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </SmartLink>
      </div>
    </header>
  );
}

/* ── HERO ───────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src="/europe-globe.jpg" alt="Europa-zentrierter Globus bei Nacht — Satellitenperspektive" className="w-full h-full object-cover object-right" />
        <div className="absolute inset-0 bg-gradient-to-r from-[rgb(3,7,18)] via-[rgb(3,7,18)]/85 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[rgb(3,7,18)] via-transparent to-[rgb(3,7,18)]/40" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-10 pt-28 pb-16">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1 sm:py-1.5 mb-6 sm:mb-8 border border-cyan-500/40 bg-cyan-500/5 rounded-full">
            <Radar className="w-3.5 h-3.5 text-cyan-300" />
            <span className="font-mono text-[10px] sm:text-xs tracking-widest text-cyan-300">
              RUNTIME-GOVERNANCE FÜR DSGVO &amp; EU AI ACT
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] sm:leading-[1.05] tracking-tight mb-5 sm:mb-6">
            Die Runtime-AI-Governance-Plattform für den <span className="text-cyan-400">Mittelstand</span>
          </h1>

          <p className="text-base sm:text-lg text-white/75 max-w-xl leading-relaxed mb-3">
            Erfassen, klassifizieren und überwachen Sie KI-Usecases, Websites und digitale
            Workflows — mit AI-Act-Pflichtenmatrix, DSGVO-Checks und auditierbarer Evidenz.
          </p>
          <p className="text-sm text-white/55 max-w-xl leading-relaxed mb-8">
            Während generische KI-Plattformen Produktivität versprechen, sorgt RealSyncDynamics
            dafür, dass KI rechtssicher, nachvollziehbar und prüfbar betrieben wird.
          </p>

          {/* Primärer Conversion-Punkt: URL eingeben → Scan starten */}
          <HeroScanForm />
          <div className="mt-4 flex items-center gap-4">
            <SmartLink
              to="/audit?source=home-hero-trial"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              {CTA.startTrialFree}
              <ArrowRight className="w-3.5 h-3.5" />
            </SmartLink>
          </div>
          <p className="mt-5 font-mono text-[10px] sm:text-xs tracking-wider text-white/40">
            Kein Account nötig · Ergebnis in ~30 Sekunden · EU-gehostet
          </p>
        </div>
      </div>
    </section>
  );
}

const URL_RE = /^[^\s@]+\.[a-z]{2,}/i;

function HeroScanForm() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || trimmed.includes('@') || !URL_RE.test(trimmed)) {
      setError('Bitte eine Website-Adresse eingeben, z. B. „ihre-firma.de".');
      return;
    }
    setError(null);
    navigate(`/audit?url=${encodeURIComponent(trimmed)}&source=home-hero`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="max-w-xl">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ihre-firma.de"
            aria-label="Website-Adresse zum Scannen"
            className="w-full rounded-lg border border-white/15 bg-white/5 backdrop-blur-md pl-10 pr-3 py-3 text-base text-white placeholder:text-white/40 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-500/20 transition-colors"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-400 px-6 py-3 text-sm font-semibold text-[rgb(3,7,18)] hover:bg-cyan-300 transition-colors whitespace-nowrap"
        >
          {CTA.scanWebsite}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </form>
  );
}

/* ── PROBLEM ────────────────────────────────────────────── */
function Problem() {
  const points = [
    {
      icon: Boxes,
      title: 'KI in Schatten-IT',
      text: 'ChatGPT, Copilot, Chat-Widgets und Agenten ziehen in Teams ein — ohne Inventar, ohne Freigabe, ohne Risikoeinstufung.',
    },
    {
      icon: Network,
      title: 'Unkontrollierte Datenflüsse',
      text: 'Tracker, externe APIs und Modelle verarbeiten personenbezogene Daten. Niemand weiß im Detail, wer was wohin sendet.',
    },
    {
      icon: AlertTriangle,
      title: 'Nachweis fehlt',
      text: 'EU AI Act und DSGVO verlangen Dokumentation und Evidenz. Jährliche PDF-Audits sind am Tag nach dem Export bereits veraltet.',
    },
  ];
  return (
    <Section
      eyebrow="DAS PROBLEM"
      title="KI-Usecases laufen heute unkontrolliert"
      subtitle="In Tools, Agenten und Schatten-IT entstehen täglich neue KI-Anwendungen — schneller, als Governance hinterherkommt."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
        {points.map(({ icon: Icon, title, text }) => (
          <div key={title} className="p-6 sm:p-8 bg-[rgb(3,7,18)]">
            <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 mb-5">
              <Icon className="w-5 h-5 text-white/70" strokeWidth={1.75} />
            </div>
            <h3 className="text-lg font-semibold mb-2.5">{title}</h3>
            <p className="text-sm text-white/60 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── LÖSUNG ─────────────────────────────────────────────── */
function Solution() {
  const points = [
    {
      icon: Radar,
      title: 'Telemetrie',
      text: 'Kontinuierliche Runtime-Erfassung von Websites, KI-Systemen und Datenflüssen. Drift, neue Tracker und Modelle werden erkannt, sobald sie entstehen.',
    },
    {
      icon: Scale,
      title: 'Klassifikation',
      text: 'Jeder Usecase wird automatisch nach EU-AI-Act-Risikoklasse und DSGVO-Bezug eingestuft — inklusive Transparenz- und Dokumentationspflichten.',
    },
    {
      icon: SlidersHorizontal,
      title: 'Controls',
      text: 'Policies werden zur Laufzeit durchgesetzt, nicht nur dokumentiert. Jede Maßnahme landet als kryptografische Evidenz im lückenlosen Prüfpfad.',
    },
  ];
  return (
    <Section
      eyebrow="DIE LÖSUNG"
      title="Runtime Governance statt jährlicher PDF-Audits"
      subtitle="Eine Schicht, die Ihre komplette KI-Landschaft erfasst, einordnet und kontrolliert — in einem Dashboard."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
        {points.map(({ icon: Icon, title, text }) => (
          <div key={title} className="p-6 sm:p-8 bg-[rgb(3,7,18)]">
            <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 mb-5">
              <Icon className="w-5 h-5 text-cyan-400" strokeWidth={1.75} />
            </div>
            <h3 className="text-lg font-semibold mb-2.5">{title}</h3>
            <p className="text-sm text-white/60 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── DREI SCHRITTE ──────────────────────────────────────── */
function Steps() {
  const steps = [
    { no: '01', title: 'URL eingeben', text: 'Geben Sie Ihre Website-Adresse ein — kein Account, kein Setup, keine Kreditkarte.' },
    { no: '02', title: 'Runtime-Scan starten', text: 'Die Engine inventarisiert Tracker, Cookies, Header, KI-Endpunkte und Drittanbieter in Sekunden.' },
    { no: '03', title: 'Bericht erhalten', text: 'Sie sehen Score, Risiken und konkrete Maßnahmen — und können das Monitoring 14 Tage kostenlos testen.' },
  ];
  return (
    <Section
      eyebrow="SO FUNKTIONIERT ES"
      title="Erst scannen. Dann entscheiden."
      subtitle="In drei Schritten vom ersten Besuch zum auditfähigen Ergebnis."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map(({ no, title, text }) => (
          <div key={no} className="relative p-8 border border-white/10 rounded-2xl bg-white/[0.02]">
            <span className="font-mono text-5xl font-bold text-cyan-400/20">{no}</span>
            <h3 className="text-xl font-semibold mt-4 mb-2.5">{title}</h3>
            <p className="text-sm text-white/60 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── VERGLEICH ──────────────────────────────────────────── */
function Comparison() {
  const generic = [
    'Fokus auf Produktivität & Output',
    'Generative Assistenten und Content',
    'Sicherer Modellzugriff für Teams',
    'Kein Nachweis für Aufsicht & Revision',
  ];
  const rsd = [
    'Fokus auf Governance, Risiko & Pflichten',
    'Runtime-Kontrolle statt Einmal-Audit',
    'AI-Act-Pflichtenmatrix & DSGVO-Checks',
    'Auditierbare Evidenz für DSB & Aufsicht',
  ];
  return (
    <Section
      eyebrow="DER UNTERSCHIED"
      title="Warum RealSyncDynamics statt generischer KI-Plattformen?"
      subtitle="Generische KI-Plattformen machen KI produktiv. RealSyncDynamics macht KI rechtssicher und prüfbar — beides ergänzt sich, ersetzt sich aber nicht."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 sm:p-8 border border-white/10 rounded-2xl bg-white/[0.02]">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">Generische KI-Plattform</div>
          <h3 className="mt-1.5 text-lg font-semibold">Sichere generative KI-Produktivität</h3>
          <ul className="mt-5 space-y-3">
            {generic.map((g) => (
              <li key={g} className="flex items-start gap-2.5 text-sm text-white/50">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-white/30" strokeWidth={2.5} />
                {g}
              </li>
            ))}
          </ul>
        </div>
        <div className="p-6 sm:p-8 border border-cyan-500/30 rounded-2xl bg-cyan-500/[0.06]">
          <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">RealSyncDynamics</div>
          <h3 className="mt-1.5 text-lg font-semibold">Governance, Risiko, Pflichten, Runtime-Kontrolle, Evidence</h3>
          <ul className="mt-5 space-y-3">
            {rsd.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-sm text-white/80">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" strokeWidth={2.5} />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

/* ── AI ACT & DSGVO ─────────────────────────────────────── */
function Coverage() {
  const items = [
    {
      q: 'EU AI Act — Pflichtenmatrix & Klassifizierung',
      a: 'Jeder KI-Usecase wird nach Risikoklasse (verboten, hoch, begrenzt, minimal) eingestuft. Daraus leitet die Plattform Transparenz-, Dokumentations- und Aufsichtspflichten ab und führt sie in einer nachvollziehbaren Pflichtenmatrix. AI Act-ready in Tagen, nicht Monaten.',
    },
    {
      q: 'DSGVO — Website- & Datenfluss-Checks',
      a: 'Tracker ohne Consent, fehlende Datenschutzerklärung, Cookies vor Einwilligung, Drittanbieter-Skripte und Pre-Consent-Requests werden mit Paragraphenbezug (u. a. Art. 6, 13, 32 DSGVO, § 25 TTDSG) erkannt und dokumentiert.',
    },
    {
      q: 'Auditierbare Evidenz für DSB, Aufsicht & Revision',
      a: 'Jeder Befund und jede Maßnahme wird signiert in einer lückenlosen Hash-Chain abgelegt. Automatisierte Prüf-Reports lassen sich exportieren — für interne Revision, Datenschutzbeauftragte und Aufsichtsbehörden.',
    },
    {
      q: 'EU-Souveränität & Datenresidenz',
      a: 'Hosting, Verarbeitung und Modelle innerhalb der EU. Optional lokale Modelle (Ollama) für maximale Datenkontrolle. Sensible Keys ausschließlich serverseitig, Mandantentrennung via Row-Level Security.',
    },
  ];
  return (
    <Section
      eyebrow="ABDECKUNG"
      title="AI Act & DSGVO — abgedeckt, nicht versprochen"
      subtitle="Die komplexen Themen im Detail — aufklappbar, wenn Sie tiefer einsteigen möchten."
    >
      <div className="max-w-3xl mx-auto divide-y divide-white/10 border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02]">
        {items.map((it, i) => (
          <Accordion key={it.q} question={it.q} answer={it.a} defaultOpen={i === 0} />
        ))}
      </div>
    </Section>
  );
}

function Accordion({ question, answer, defaultOpen = false }: { question: string; answer: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 sm:px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-sm sm:text-base font-semibold">{question}</span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/60">
          {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </span>
      </button>
      {open && (
        <p className="px-5 sm:px-6 pb-5 text-sm leading-relaxed text-white/60">{answer}</p>
      )}
    </div>
  );
}

/* ── PRICING ────────────────────────────────────────────── */
// Vier self-buchbare Tarife (79 / 249 / 699 / 1.999 €) direkt aus der
// kanonischen Preis-Config — Preise & Checkout-Links bleiben so synchron zu
// Stripe und der /pricing-Seite. Free Audit und Enterprise werden bewusst
// nicht als Karte gerendert (Free = Hero-Scan, Enterprise = separater CTA).
const HOME_TIERS = PUBLIC_PRICING_TIERS.filter((t) => t.id !== 'free');

// CTA-Labels conversion-fokussiert überschreiben — der 249-€-Tarif (Growth)
// ist der hervorgehobene „14 Tage gratis testen"-Einstieg nach dem Free-Scan.
const HOME_CTA_LABEL: Record<string, string> = {
  starter: CTA.startTrialFree,
  growth: CTA.startTrialFree,
  agency: CTA.startTrialFree,
  scale: 'Scale anfragen',
};

function Pricing() {
  return (
    <Section
      eyebrow="PREISE"
      title="Preise, die mit Ihrer Verantwortung skalieren"
      subtitle="Transparent, monatlich kündbar, ohne Setup-Gebühr. Starten Sie self-service — kein Verkaufsgespräch nötig."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {HOME_TIERS.map((t) => {
          const featured = t.highlight;
          return (
            <div
              key={t.id}
              className={`relative flex flex-col p-7 rounded-2xl border ${
                featured ? 'border-cyan-400/60 bg-cyan-500/[0.06]' : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              {featured && (
                <span className="absolute -top-3 left-7 px-3 py-1 text-[10px] font-bold tracking-wider text-[rgb(3,7,18)] bg-cyan-400 rounded-full">BELIEBT</span>
              )}
              <h3 className="text-lg font-semibold mb-1">{t.name}</h3>
              <div className="flex items-baseline gap-1 mb-3">
                <span className="font-mono text-3xl font-bold">{t.priceString} €</span>
                <span className="font-mono text-xs text-white/40">{t.priceSuffix}</span>
              </div>
              <p className="text-sm text-white/60 leading-relaxed mb-5">{t.tagline}</p>
              <ul className="flex-1 space-y-3 mb-7">
                {t.bullets.slice(0, 4).map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-white/70">
                    <Check className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" strokeWidth={2} />{b}
                  </li>
                ))}
              </ul>
              <SmartLink
                to={t.cta.href}
                className={`inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold rounded-lg transition-colors ${
                  featured
                    ? 'text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300'
                    : 'text-white border border-white/20 hover:border-white/40 hover:bg-white/5'
                }`}
              >
                {HOME_CTA_LABEL[t.id] ?? t.cta.label}<ArrowRight className="w-4 h-4" />
              </SmartLink>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-sm text-white/50">
        Enterprise / On-Prem auf Anfrage ·{' '}
        <SmartLink to="/pricing" className="font-semibold text-cyan-400 hover:text-cyan-300">alle Tarife &amp; Details ansehen</SmartLink>.
      </p>
    </Section>
  );
}

/* ── FREE-TRIAL-BLOCK ───────────────────────────────────── */
function TrialBlock() {
  return (
    <section className="relative z-10 py-4">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 p-6 sm:p-7 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] via-white/[0.02] to-transparent">
          <div className="flex items-start gap-3.5">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-cyan-400" strokeWidth={1.75} />
            <div>
              <h3 className="text-lg font-semibold">14 Tage kostenlos testen.</h3>
              <p className="mt-1 text-sm text-white/60 leading-relaxed">
                Kein automatisches Abo. Scan starten, Risiken sehen, Maßnahmen ableiten.
              </p>
            </div>
          </div>
          <SmartLink
            to="/audit?source=home-trial-block"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-6 py-3 text-sm font-semibold text-[rgb(3,7,18)] hover:bg-cyan-300 transition-colors"
          >
            {CTA.scanWebsite}
            <ArrowRight className="h-4 w-4" />
          </SmartLink>
        </div>
      </div>
    </section>
  );
}

/* ── FINAL-CTA ──────────────────────────────────────────── */
function FinalCta() {
  return (
    <section className="relative z-10 py-16 md:py-24">
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.08] via-white/[0.02] to-transparent p-8 sm:p-12 md:p-16 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-extrabold tracking-tight mb-4 sm:mb-5">
            Erst scannen. Dann entscheiden.
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-white/70 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed">
            Runtime-Kontrollen statt jährlicher PDF-Audits — sehen Sie in 30 Sekunden, wo Ihre
            KI- und DSGVO-Risiken liegen.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <SmartLink to="/audit?source=home-final" className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-[rgb(3,7,18)] bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-lg">
              {CTA.scanWebsite}<ArrowRight className="w-4 h-4" />
            </SmartLink>
            <SmartLink to="/audit?source=home-final-trial" className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 text-xs sm:text-sm font-semibold text-white border border-white/20 hover:border-white/40 hover:bg-white/5 transition-colors rounded-lg">
              {CTA.startTrialFree}
            </SmartLink>
          </div>
          <p className="mt-5 font-mono text-[10px] sm:text-xs tracking-wider text-white/40">
            Self-Service · ohne Account · kein Verkaufsgespräch nötig
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── FOOTER ─────────────────────────────────────────────── */
function Footer() {
  const product = [
    { label: 'Runtime SaaS', to: '/runtime' },
    { label: 'AI Act & Governance', to: '/ai-act' },
    { label: 'DSGVO Website Audit', to: '/audit' },
    { label: 'Preise', to: '/pricing' },
    { label: 'Ressourcen', to: '/ressourcen' },
  ];
  const company = [
    { label: 'Über uns', to: '/about' },
    { label: 'Kontakt', to: '/contact-sales' },
    { label: 'Impressum', to: '/impressum' },
    { label: 'Datenschutz', to: '/datenschutz' },
    { label: 'Rechtliches', to: '/agb' },
  ];
  return (
    <footer className="relative z-10 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-10 sm:py-14">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 sm:gap-10">
          <div className="col-span-2 sm:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <Snowflake className="w-5 h-5 text-cyan-400" strokeWidth={1.5} />
              <span className="text-sm sm:text-base font-semibold tracking-tight">RealSync Dynamics.AI</span>
            </Link>
            <p className="text-[11px] sm:text-xs text-white/50 leading-relaxed max-w-xs">
              Europäische Runtime-Governance-Schicht für DSGVO, EU AI Act und auditierbare
              KI-Nutzung.
            </p>
          </div>
          <FooterCol title="Produkt" links={product} />
          <FooterCol title="Unternehmen" links={company} />
        </div>
        <div className="mt-10 sm:mt-12 pt-5 sm:pt-6 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="font-mono text-[10px] sm:text-xs text-white/50">© 2026 RealSync Dynamics</p>
          <p className="font-mono text-[10px] sm:text-xs text-white/40">EU-Hosting · DSGVO · EU AI Act</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <h4 className="font-mono text-[10px] sm:text-[11px] uppercase tracking-widest text-white/40 mb-3 sm:mb-4">{title}</h4>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <SmartLink to={l.to} className="text-xs sm:text-sm text-white/60 hover:text-white transition-colors">{l.label}</SmartLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── HELPERS ────────────────────────────────────────────── */
function Section({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative z-10 py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <div className="max-w-2xl mx-auto text-center mb-10 md:mb-12">
          <p className="font-mono text-[10px] sm:text-xs tracking-[0.25em] text-cyan-400/90 mb-3 sm:mb-4">{eyebrow}</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-3 sm:mb-4">{title}</h2>
          <p className="text-sm sm:text-base text-white/60 leading-relaxed">{subtitle}</p>
        </div>
        {children}
      </div>
    </section>
  );
}
