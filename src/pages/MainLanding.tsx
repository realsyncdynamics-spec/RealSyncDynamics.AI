import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SEOHead } from '../components/SEOHead';
import { LandingNavbar } from '../components/LandingNavbar';
import { CTA } from '../content/runtimeVocab';
import {
  ArrowRight,
  ScanLine,
  ShieldCheck,
  Radar,
  Scale,
  SlidersHorizontal,
  Boxes,
  AlertTriangle,
  Network,
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
 * Design: „European Enterprise Trust" Light-Theme (siehe CLAUDE.md) — ruhig,
 * viel Weißraum, Slate-Neutrals auf Weiß, Petrol als einzige Akzentfarbe,
 * Monospace für Metadaten. Navigation/Footer zentral via LandingNavbar.
 *
 * Struktur: Navbar · Hero (Scan-CTA) · Problem · Lösung · 3 Schritte ·
 *           Vergleich (vs. generische KI-Plattformen) · AI Act & DSGVO ·
 *           Pricing · Free-Trial · Final-CTA · Footer
 */

export function MainLanding() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased font-sans">
      {/* Config-driven SEO/OG/JSON-LD — zieht den '/'-Eintrag aus src/config/seo.ts */}
      <SEOHead />
      <LandingNavbar />
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

/* ── HERO ───────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-5xl mx-auto px-5 sm:px-6 lg:px-8 pt-28 sm:pt-32 lg:pt-36 pb-16 sm:pb-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-chip border border-petrol-200 bg-petrol-50 px-3 py-1 text-xs font-semibold tracking-tight text-petrol-700">
          <Radar className="h-3.5 w-3.5" />
          Runtime-Governance für DSGVO &amp; EU AI Act
        </span>

        <h1 className="mt-6 font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.08] tracking-tight text-slate-900">
          Die Runtime-AI-Governance-Plattform<br className="hidden sm:block" />{' '}
          für den <span className="text-petrol-700">Mittelstand</span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600">
          Erfassen, klassifizieren und überwachen Sie KI-Usecases, Websites und digitale
          Workflows – mit AI-Act-Pflichtenmatrix, DSGVO-Checks und auditierbarer Evidenz.
        </p>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
          Während generische KI-Plattformen Produktivität versprechen, sorgt RealSyncDynamics
          dafür, dass KI rechtssicher, nachvollziehbar und prüfbar betrieben wird.
        </p>

        {/* Primärer Conversion-Punkt: URL eingeben → Scan starten */}
        <div className="mx-auto mt-9 max-w-xl">
          <HeroScanForm />
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/audit?source=home-hero-trial"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-petrol-700 hover:text-petrol-600 transition-colors"
            >
              {CTA.startTrialFree}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <p className="mt-4 font-mono text-[11px] tracking-wide text-slate-400">
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
    <form onSubmit={onSubmit} noValidate className="text-left">
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            inputMode="url"
            autoComplete="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ihre-firma.de"
            aria-label="Website-Adresse zum Scannen"
            className="w-full rounded-card border border-slate-300 bg-white pl-10 pr-3 py-3 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-petrol-500 focus:ring-2 focus:ring-petrol-100 transition-colors"
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 px-6 py-3 text-sm font-semibold text-white hover:bg-petrol-600 transition-colors whitespace-nowrap"
        >
          {CTA.scanWebsite}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
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
      eyebrow="Das Problem"
      title="KI-Usecases laufen heute unkontrolliert"
      subtitle="In Tools, Agenten und Schatten-IT entstehen täglich neue KI-Anwendungen — schneller, als Governance hinterherkommt."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {points.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-panel border border-slate-200 bg-white p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-card bg-slate-100 text-slate-600">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
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
      tone="muted"
      eyebrow="Die Lösung"
      title="Runtime Governance statt jährlicher PDF-Audits"
      subtitle="Eine Schicht, die Ihre komplette KI-Landschaft erfasst, einordnet und kontrolliert — Ihre komplette KI-Landschaft in einem Dashboard."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {points.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-panel border border-slate-200 bg-white p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-card bg-petrol-50 text-petrol-700">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
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
      eyebrow="So funktioniert es"
      title="Erst scannen. Dann entscheiden."
      subtitle="In drei Schritten vom ersten Besuch zum auditfähigen Ergebnis."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {steps.map(({ no, title, text }) => (
          <div key={no} className="rounded-panel border border-slate-200 bg-white p-6">
            <span className="font-mono text-2xl font-bold text-petrol-700/30">{no}</span>
            <h3 className="mt-3 text-lg font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
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
      tone="muted"
      eyebrow="Der Unterschied"
      title="Warum RealSyncDynamics statt generischer KI-Plattformen?"
      subtitle="Generische KI-Plattformen machen KI produktiv. RealSyncDynamics macht KI rechtssicher und prüfbar — beides ergänzt sich, ersetzt sich aber nicht."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        <div className="rounded-panel border border-slate-200 bg-white p-6 sm:p-7">
          <div className="text-xs font-mono uppercase tracking-widest text-slate-400">Generische KI-Plattform</div>
          <h3 className="mt-1.5 text-lg font-semibold text-slate-900">Sichere generative KI-Produktivität</h3>
          <ul className="mt-5 space-y-3">
            {generic.map((g) => (
              <li key={g} className="flex items-start gap-2.5 text-sm text-slate-500">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" strokeWidth={2.5} />
                {g}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-panel border-2 border-petrol-200 bg-petrol-50/40 p-6 sm:p-7">
          <div className="text-xs font-mono uppercase tracking-widest text-petrol-600">RealSyncDynamics</div>
          <h3 className="mt-1.5 text-lg font-semibold text-slate-900">Governance, Risiko, Pflichten, Runtime-Kontrolle, Evidence</h3>
          <ul className="mt-5 space-y-3">
            {rsd.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-sm text-slate-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-petrol-700" strokeWidth={2.5} />
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
      eyebrow="Abdeckung"
      title="AI Act & DSGVO — abgedeckt, nicht versprochen"
      subtitle="Die komplexen Themen im Detail — aufklappbar, wenn Sie tiefer einsteigen möchten."
    >
      <div className="mx-auto max-w-3xl divide-y divide-slate-200 rounded-panel border border-slate-200 bg-white">
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
        className="flex w-full items-center justify-between gap-4 px-5 sm:px-6 py-4 text-left"
      >
        <span className="text-sm sm:text-base font-semibold text-slate-900">{question}</span>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500">
          {open ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </span>
      </button>
      {open && (
        <p className="px-5 sm:px-6 pb-5 text-sm leading-relaxed text-slate-600">{answer}</p>
      )}
    </div>
  );
}

/* ── PRICING ────────────────────────────────────────────── */
type Plan = {
  name: string;
  price: string;
  cadence: string;
  audience: string;
  bullets: string[];
  cta: string;
  to: string;
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    name: 'Starter',
    price: '79 €',
    cadence: '/ Monat',
    audience: 'Für KMU, Agenturen, Websites und erste AI-Usecases.',
    bullets: ['AI-Inventar & Klassifikation', 'Basic Runtime-Telemetry', 'Exportfähige Reports'],
    cta: '14 Tage kostenlos testen',
    to: '/checkout/starter?source=home-pricing',
  },
  {
    name: 'Pro',
    price: '149–249 €',
    cadence: '/ Monat',
    audience: 'Für mehrere Domains, Teams und laufende Compliance.',
    bullets: ['AI-Act-Pflichtenmatrix', 'Erweiterte Audit-Logs & Alerts', 'Mehrmandanten-Support'],
    cta: '14 Tage kostenlos testen',
    to: '/checkout/growth?source=home-pricing',
    featured: true,
  },
  {
    name: 'Enterprise / On-Prem',
    price: 'auf Anfrage',
    cadence: '',
    audience: 'Für regulierte Branchen, Private Cloud und interne Integrationen.',
    bullets: ['Private Cloud / On-Prem', 'Individuelle Integrationen', 'Erweiterte Governance-Workflows'],
    cta: CTA.enterprise,
    to: '/contact-sales?tier=enterprise&source=home-pricing',
  },
];

function Pricing() {
  return (
    <Section
      tone="muted"
      eyebrow="Preise"
      title="Preise, die mit Ihrer Verantwortung skalieren"
      subtitle="Transparent, monatlich kündbar, ohne Setup-Gebühr. Starten Sie self-service — kein Verkaufsgespräch nötig."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 items-stretch">
        {PLANS.map((p) => {
          const featured = !!p.featured;
          return (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-panel border bg-white p-6 sm:p-7 ${
                featured ? 'border-2 border-petrol-300 shadow-md' : 'border-slate-200'
              }`}
            >
              {featured && (
                <span className="absolute -top-3 left-6 rounded-chip bg-petrol-700 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                  Beliebt
                </span>
              )}
              <h3 className="text-base font-semibold text-slate-900">{p.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold text-slate-900">{p.price}</span>
                {p.cadence && <span className="font-mono text-xs text-slate-400">{p.cadence}</span>}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{p.audience}</p>
              <ul className="mt-5 flex-1 space-y-3">
                {p.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-petrol-700" strokeWidth={2.5} />
                    {b}
                  </li>
                ))}
              </ul>
              <Link
                to={p.to}
                className={`mt-7 inline-flex items-center justify-center gap-2 rounded-chip px-5 py-3 text-sm font-semibold transition-colors ${
                  featured
                    ? 'bg-petrol-700 text-white hover:bg-petrol-600'
                    : 'border border-slate-300 text-slate-900 hover:border-petrol-400 hover:text-petrol-700'
                }`}
              >
                {p.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">
        Alle Tarife und Details auf der{' '}
        <Link to="/pricing" className="font-semibold text-petrol-700 hover:text-petrol-600">
          Preisübersicht
        </Link>
        .
      </p>
    </Section>
  );
}

/* ── FREE-TRIAL-BLOCK ───────────────────────────────────── */
function TrialBlock() {
  return (
    <section className="bg-white py-4">
      <div className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 rounded-panel border border-petrol-200 bg-petrol-50/50 p-6 sm:p-7">
          <div className="flex items-start gap-3.5">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-petrol-700" strokeWidth={1.75} />
            <div>
              <h3 className="text-lg font-semibold text-slate-900">14 Tage kostenlos testen.</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Kein automatisches Abo. Scan starten, Risiken sehen, Maßnahmen ableiten.
              </p>
            </div>
          </div>
          <Link
            to="/audit?source=home-trial-block"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-chip bg-petrol-700 px-6 py-3 text-sm font-semibold text-white hover:bg-petrol-600 transition-colors"
          >
            {CTA.scanWebsite}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── FINAL-CTA ──────────────────────────────────────────── */
function FinalCta() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-5 sm:px-6 lg:px-8 text-center">
        <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
          Erst scannen. Dann entscheiden.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
          Runtime-Kontrollen statt jährlicher PDF-Audits — sehen Sie in 30 Sekunden, wo Ihre
          KI- und DSGVO-Risiken liegen.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/audit?source=home-final"
            className="inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 px-7 py-3.5 text-sm font-semibold text-white hover:bg-petrol-600 transition-colors"
          >
            {CTA.scanWebsite}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/audit?source=home-final-trial"
            className="inline-flex items-center justify-center gap-2 rounded-chip border border-slate-300 px-7 py-3.5 text-sm font-semibold text-slate-900 hover:border-petrol-400 hover:text-petrol-700 transition-colors"
          >
            {CTA.startTrialFree}
          </Link>
        </div>
        <p className="mt-5 font-mono text-[11px] tracking-wide text-slate-400">
          Self-Service · ohne Account · kein Verkaufsgespräch nötig
        </p>
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
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8 py-12 sm:py-14">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
          <div className="sm:col-span-1">
            <Link to="/" className="font-display text-base font-bold tracking-tight">
              <span className="text-slate-900">RealSync</span>
              <span className="ml-0.5 font-medium text-slate-400">Dynamics.AI</span>
            </Link>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-slate-500">
              Europäische Runtime-Governance-Schicht für DSGVO, EU AI Act und auditierbare
              KI-Nutzung.
            </p>
          </div>
          <FooterCol title="Produkt" links={product} />
          <FooterCol title="Unternehmen" links={company} />
        </div>
        <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-slate-200 pt-6">
          <p className="font-mono text-[11px] text-slate-400">© 2026 RealSync Dynamics</p>
          <p className="font-mono text-[11px] text-slate-400">EU-Hosting · DSGVO · EU AI Act</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <h4 className="font-mono text-[11px] uppercase tracking-widest text-slate-400">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link to={l.to} className="text-sm text-slate-600 hover:text-petrol-700 transition-colors">
              {l.label}
            </Link>
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
  tone = 'default',
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  tone?: 'default' | 'muted';
}) {
  return (
    <section className={tone === 'muted' ? 'bg-slate-50 py-16 sm:py-20' : 'bg-white py-16 sm:py-20'}>
      <div className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 sm:mb-12 max-w-2xl text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-petrol-600">{eyebrow}</p>
          <h2 className="mt-3 font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">
            {title}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">{subtitle}</p>
        </div>
        {children}
      </div>
    </section>
  );
}
