import { useState } from 'react';
import { SEOHead } from '../components/SEOHead';
import {
  ArrowRight,
  Check,
  Building2,
  Rocket,
  Landmark,
  Radar,
  FileLock2,
  Scale,
  ServerCog,
  Bot,
  ShieldCheck,
  Globe,
  ClipboardList,
  Plus,
  Minus,
} from 'lucide-react';
import {
  SmartLink,
  LandingHeader,
  LandingFooter,
  TRIAL_CTA,
  DEMO_CTA,
  SCAN_CTA,
} from '../components/landing/LandingShell';

/**
 * MainLanding — öffentliche Startseite im „European Enterprise Trust"-Light-Theme.
 *
 * Bildet zwei klar getrennte Buyer Journeys ab:
 *   1. Self-Service-Trial für Mittelstand, KMU & Agenturen (primärer Funnel)
 *   2. Demo-/Enterprise-Leads für regulierte Branchen (sekundärer Funnel)
 *
 * Funnel: Besucher → Nutzen verstehen → URL scannen → DSGVO-/AI-Governance-
 * Ergebnis sehen → 14 Tage testen. Trial-CTA dominiert, Enterprise-Demo bleibt
 * sichtbar sekundär.
 */

const HERO_TRUST = [
  'In Deutschland entwickelt',
  'AI-Act-Pflichtenmatrix inklusive',
  'URL eingeben – Runtime scannt',
  'Exportierbare Reports für DSB, Revision und Aufsicht',
];

export function MainLanding() {
  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased font-sans">
      <SEOHead />
      <LandingHeader />
      <Hero />
      <Splitter />
      <Funnel />
      <Platform />
      <DsgvoBot />
      <Pricing />
      <Standards />
      <Faq />
      <FinalCta />
      <LandingFooter />
    </div>
  );
}

/* ── HERO ───────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 lg:py-28">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-chip border border-petrol-200 bg-petrol-50 px-3 py-1 mb-7">
            <span className="font-mono text-[11px] tracking-widest text-petrol-700 uppercase">
              KI-Governance · DSGVO · EU AI Act
            </span>
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-slate-900">
            Die KI-Governance-Plattform für{' '}
            <span className="text-petrol-700">Mittelstand und regulierte Unternehmen</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed max-w-2xl">
            RealSyncDynamics macht Websites, KI-Usecases und digitale Workflows prüfbar –
            mit DSGVO-Checks, AI-Act-Klassifikation, Runtime-Telemetrie und auditierbarer Evidenz.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <SmartLink
              to={TRIAL_CTA}
              className="group inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 px-7 py-4 text-base font-semibold text-white hover:bg-petrol-600 transition-colors"
            >
              14 Tage kostenlos testen
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </SmartLink>
            <SmartLink
              to={DEMO_CTA}
              className="inline-flex items-center justify-center gap-2 rounded-chip border border-slate-300 bg-white px-7 py-4 text-base font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors"
            >
              Enterprise-Demo anfragen
            </SmartLink>
          </div>

          <ul className="mt-9 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 max-w-2xl">
            {HERO_TRUST.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-slate-600">
                <Check className="mt-0.5 h-4 w-4 text-petrol-600 shrink-0" strokeWidth={2.5} />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── SPLITTER: ZWEI BUYER JOURNEYS ──────────────────────── */
const SPLITTER_CARDS = [
  {
    icon: Rocket,
    label: 'Self-Service SaaS',
    title: 'Mittelstand & KMU',
    text: 'Starten Sie ohne Onboarding-Call. Website scannen, Risiken erkennen und DSGVO-/AI-Act-Maßnahmen direkt ableiten.',
    bullets: [
      'Ab 79 €/Monat',
      '14 Tage kostenlos testen',
      'Website- und KI-Governance in Minuten starten',
      'Exportfähige Reports',
    ],
    cta: 'Jetzt testen',
    to: TRIAL_CTA,
    primary: true,
  },
  {
    icon: Landmark,
    label: 'Enterprise / Private Cloud',
    title: 'Regulierte Branchen',
    text: 'Für Organisationen mit erhöhten Anforderungen an Governance, Nachvollziehbarkeit, Datenresidenz, Auditfähigkeit und interne Kontrollsysteme.',
    bullets: [
      'BAIT, MaRisk, ISO 27001 anschlussfähig',
      'Private Cloud / On-Prem optional',
      'Erweiterte Audit-Logs',
      'Individuelle Integrationen',
    ],
    cta: 'Enterprise-Demo anfragen',
    to: DEMO_CTA,
    primary: false,
  },
];

function Splitter() {
  return (
    <Section eyebrow="Buyer Journeys" title="Für wen ist RealSyncDynamics?">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {SPLITTER_CARDS.map((c) => (
          <div
            key={c.title}
            className={`flex flex-col rounded-panel border bg-white p-8 ${
              c.primary ? 'border-petrol-300 ring-1 ring-petrol-200' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center gap-3 mb-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-card bg-petrol-50 border border-petrol-100">
                <c.icon className="h-5 w-5 text-petrol-700" strokeWidth={1.75} />
              </span>
              <span className="font-mono text-[11px] tracking-widest text-slate-400 uppercase">{c.label}</span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-slate-900 mb-3">{c.title}</h3>
            <p className="text-slate-600 leading-relaxed mb-6">{c.text}</p>
            <ul className="space-y-3 mb-8 flex-1">
              {c.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 text-petrol-600 shrink-0" strokeWidth={2.5} />
                  {b}
                </li>
              ))}
            </ul>
            <SmartLink
              to={c.to}
              className={`group inline-flex items-center justify-center gap-2 rounded-chip px-6 py-3.5 text-sm font-semibold transition-colors ${
                c.primary
                  ? 'bg-petrol-700 text-white hover:bg-petrol-600'
                  : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              {c.cta}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </SmartLink>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── FUNNEL: URL SCANNEN → ERGEBNIS → TESTEN ────────────── */
const FUNNEL_STEPS = [
  {
    no: '01',
    icon: Globe,
    title: 'URL eingeben',
    text: 'Geben Sie eine Website-Adresse ein. Die Runtime scannt Tracker, Einwilligungen, KI-Komponenten und Datenflüsse.',
  },
  {
    no: '02',
    icon: ClipboardList,
    title: 'Governance-Ergebnis sehen',
    text: 'Sie erhalten priorisierte DSGVO-Risiken, eine AI-Act-Klassifikation und konkrete Maßnahmen — verständlich aufbereitet.',
  },
  {
    no: '03',
    icon: Rocket,
    title: '14 Tage testen',
    text: 'Aktivieren Sie kontinuierliches Monitoring, exportierbare Reports und den AI DSGVO Bot — ohne automatisches Abo.',
  },
];

function Funnel() {
  return (
    <Section
      eyebrow="So funktioniert es"
      title="Von der URL zum prüfbaren Governance-Ergebnis"
      subtitle="Kein Sales-Gespräch nötig. Scannen Sie eine Website, sehen Sie das DSGVO-/AI-Governance-Ergebnis und starten Sie in den 14-Tage-Test."
      tint
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {FUNNEL_STEPS.map((s) => (
          <div key={s.no} className="rounded-panel border border-slate-200 bg-white p-7">
            <div className="flex items-center justify-between mb-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-card bg-petrol-50 border border-petrol-100">
                <s.icon className="h-5 w-5 text-petrol-700" strokeWidth={1.75} />
              </span>
              <span className="font-mono text-3xl font-bold text-slate-200">{s.no}</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">{s.title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{s.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
        <SmartLink
          to={SCAN_CTA}
          className="group inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 px-6 py-3.5 text-sm font-semibold text-white hover:bg-petrol-600 transition-colors"
        >
          Jetzt URL scannen
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </SmartLink>
        <SmartLink
          to={TRIAL_CTA}
          className="inline-flex items-center justify-center gap-2 rounded-chip border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors"
        >
          14 Tage kostenlos testen
        </SmartLink>
      </div>
    </Section>
  );
}

/* ── PLATTFORM / FEATURE-GRID ───────────────────────────── */
const PLATFORM = [
  {
    icon: Radar,
    title: 'Runtime-Telemetrie',
    text: 'Kontinuierliche Überwachung von Websites, Daten- und KI-Systemen — Risiken werden erkannt, sobald sie entstehen.',
  },
  {
    icon: Scale,
    title: 'AI-Act-Klassifikation',
    text: 'Automatische Einstufung von KI-Usecases nach Risikoklasse inklusive Pflichtenmatrix und Dokumentationspflichten.',
  },
  {
    icon: FileLock2,
    title: 'Evidence Vault',
    text: 'Kryptografisch nachvollziehbare Nachweise mit lückenlosem Prüfpfad — auditierbar, unveränderlich, exportierbar.',
  },
  {
    icon: ShieldCheck,
    title: 'DSGVO Website Audit',
    text: 'Tracker, Einwilligungen und Datenflüsse werden geprüft und priorisiert — mit exportierbaren Reports für DSB und Aufsicht.',
  },
  {
    icon: Bot,
    title: 'AI DSGVO Bot',
    text: 'Der Compliance Copilot beantwortet DSGVO- und AI-Act-Fragen, erklärt Scan-Ergebnisse und leitet Maßnahmen ab.',
    to: '/ai-dsgvo-bot',
  },
  {
    icon: ServerCog,
    title: 'Governance-Runtime',
    text: 'Policies werden zur Laufzeit durchgesetzt — nicht nur dokumentiert. Jeder externe Call wird geloggt und bewertet.',
  },
];

function Platform() {
  return (
    <Section
      eyebrow="Die Plattform"
      title="Eine Runtime für prüfbare KI- und Datengovernance"
      subtitle="Vom kontinuierlichen Monitoring bis zum kryptografischen Nachweis — alles in einer auditfähigen Infrastruktur."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PLATFORM.map((p) => {
          const inner = (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-card bg-petrol-50 border border-petrol-100 mb-5">
                <p.icon className="h-5 w-5 text-petrol-700" strokeWidth={1.75} />
              </span>
              <h3 className="flex items-center gap-1.5 text-lg font-semibold text-slate-900 mb-2">
                {p.title}
                {p.to && <ArrowRight className="h-4 w-4 text-petrol-600" />}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">{p.text}</p>
            </>
          );
          return p.to ? (
            <SmartLink
              key={p.title}
              to={p.to}
              className="group rounded-panel border border-slate-200 bg-white p-7 hover:border-petrol-300 hover:bg-petrol-50/30 transition-colors"
            >
              {inner}
            </SmartLink>
          ) : (
            <div key={p.title} className="rounded-panel border border-slate-200 bg-white p-7">
              {inner}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ── AI DSGVO BOT (PRODUKTMODUL) ────────────────────────── */
const BOT_FEATURES = [
  'Beantwortet DSGVO- und AI-Act-Fragen auf Basis der Plattformdaten',
  'Erklärt Scan-Ergebnisse verständlich',
  'Erstellt Maßnahmenvorschläge für Website, KI-Usecases und Workflows',
  'Unterstützt bei Datenschutztexten, TOMs, AVV-Checklisten und internen Richtlinien',
  'Verknüpft Antworten mit Evidence Vault, Reports und Risiko-Klassifikation',
  'Kein Ersatz für Rechtsberatung, sondern Governance-Assistenzsystem',
];

function DsgvoBot() {
  return (
    <section className="bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-chip border border-petrol-500/40 bg-petrol-500/10 px-3 py-1 mb-6">
              <Bot className="h-3.5 w-3.5 text-petrol-300" />
              <span className="font-mono text-[11px] tracking-widest text-petrol-200 uppercase">
                Produktmodul · Compliance Copilot
              </span>
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-5">AI DSGVO Bot</h2>
            <p className="text-lg text-slate-300 leading-relaxed mb-8">
              Der AI DSGVO Bot unterstützt Unternehmen dabei, DSGVO-, AI-Act- und
              Compliance-Fragen strukturiert zu prüfen, Dokumente vorzubereiten,
              Risiken zu erklären und Maßnahmen aus den Runtime-Scans abzuleiten.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <SmartLink
                to="/ai-dsgvo-bot"
                className="group inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-petrol-500 transition-colors"
              >
                AI DSGVO Bot entdecken
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </SmartLink>
              <SmartLink
                to={SCAN_CTA}
                className="inline-flex items-center justify-center gap-2 rounded-chip border border-white/20 px-6 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Website zuerst scannen
              </SmartLink>
            </div>
          </div>
          <div className="rounded-panel border border-white/10 bg-white/[0.04] p-7 sm:p-8">
            <ul className="space-y-4">
              {BOT_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-slate-200 leading-relaxed">
                  <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-card bg-petrol-500/15 border border-petrol-500/30 shrink-0">
                    <Check className="h-3 w-3 text-petrol-300" strokeWidth={3} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-6 pt-5 border-t border-white/10 text-xs text-slate-400 leading-relaxed">
              Der AI DSGVO Bot ersetzt keine anwaltliche Beratung. Er dient der
              strukturierten Vorprüfung, Dokumentation und Governance-Unterstützung.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── PRICING ────────────────────────────────────────────── */
const PRICING = [
  {
    name: 'Free Trial',
    price: '0 €',
    cadence: '14 Tage kostenlos',
    features: ['Website scannen', 'DSGVO-Risiken sehen', 'AI DSGVO Bot testen', 'Kein automatisches Abo'],
    cta: '14 Tage testen',
    to: TRIAL_CTA,
  },
  {
    name: 'Governance Starter',
    price: '79 €',
    cadence: '/Monat',
    features: ['1–3 Domains', 'DSGVO Website Audit', 'Basic Runtime-Telemetry', 'AI DSGVO Bot', 'PDF/CSV Reports'],
    cta: 'Starten',
    to: TRIAL_CTA,
  },
  {
    name: 'Governance Pro',
    price: '149–249 €',
    cadence: '/Monat',
    features: [
      'Mehrere Domains',
      'AI-Act-Pflichtenmatrix',
      'Erweiterte Audit-Logs',
      'Alerts',
      'Mehrmandanten-Support',
      'AI DSGVO Bot erweitert',
    ],
    cta: 'Pro wählen',
    to: TRIAL_CTA,
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'Auf Anfrage',
    cadence: 'Private Cloud / On-Prem',
    features: [
      'Private Cloud / On-Prem',
      'SSO',
      'Individuelle Integrationen',
      'BAIT / MaRisk / ISO 27001 Anschlussfähigkeit',
      'Erweiterte Governance-Workflows',
      'Dedizierte Enterprise-Demo',
    ],
    cta: 'Enterprise-Demo anfragen',
    to: DEMO_CTA,
  },
];

function Pricing() {
  return (
    <Section
      eyebrow="Preise"
      title="Transparente Preise, die mit Ihrer Verantwortung skalieren"
      subtitle="Self-Service ab 79 €/Monat — inklusive AI DSGVO Bot. Für regulierte Anforderungen: Enterprise mit Private Cloud und individuellen Integrationen."
      tint
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {PRICING.map((p) => (
          <div
            key={p.name}
            className={`relative flex flex-col rounded-panel border bg-white p-7 ${
              p.featured ? 'border-petrol-300 ring-1 ring-petrol-200 shadow-sm' : 'border-slate-200'
            }`}
          >
            {p.featured && (
              <span className="absolute -top-3 left-7 rounded-chip bg-petrol-700 px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase">
                Beliebt
              </span>
            )}
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{p.name}</h3>
            <div className="flex items-baseline gap-1.5 mb-6">
              <span className="font-mono text-2xl font-bold text-slate-900">{p.price}</span>
              <span className="font-mono text-xs text-slate-400">{p.cadence}</span>
            </div>
            <ul className="flex-1 space-y-3 mb-7">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <Check className="mt-0.5 h-4 w-4 text-petrol-600 shrink-0" strokeWidth={2} />
                  {f}
                </li>
              ))}
            </ul>
            <SmartLink
              to={p.to}
              className={`inline-flex items-center justify-center gap-2 rounded-chip px-5 py-3 text-sm font-semibold transition-colors ${
                p.featured
                  ? 'bg-petrol-700 text-white hover:bg-petrol-600'
                  : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'
              }`}
            >
              {p.cta}
              <ArrowRight className="h-4 w-4" />
            </SmartLink>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── STANDARDS / TRUST ──────────────────────────────────── */
const STANDARDS = ['DSGVO Art. 32', 'EU AI Act', 'TTDSG', 'BAIT', 'MaRisk', 'ISO 27001', 'EU-Hosting'];

function Standards() {
  return (
    <Section eyebrow="Vertrauen durch Standards" title="Anschlussfähig an regulatorische Anforderungen">
      <div className="flex flex-wrap items-center gap-2.5">
        {STANDARDS.map((s) => (
          <span
            key={s}
            className="font-mono text-xs tracking-wider text-slate-600 rounded-chip border border-slate-200 bg-slate-50 px-3.5 py-1.5"
          >
            {s}
          </span>
        ))}
      </div>
    </Section>
  );
}

/* ── FAQ (ACCORDION) ────────────────────────────────────── */
const FAQ = [
  {
    q: 'Brauche ich für den Start ein Sales-Gespräch?',
    a: 'Nein. Mittelstand und KMU starten im Self-Service: Website scannen, Ergebnis sehen und 14 Tage kostenlos testen — ohne Onboarding-Call und ohne automatisches Abo.',
  },
  {
    q: 'Was unterscheidet den Enterprise-Pfad?',
    a: 'Regulierte Branchen wie Banken, Versicherungen, Behörden, Kanzleien und Gesundheitswesen erhalten Private Cloud / On-Prem, SSO, erweiterte Audit-Logs sowie Anschlussfähigkeit an BAIT, MaRisk und ISO 27001. Hier startet der Weg über eine Enterprise-Demo.',
  },
  {
    q: 'Was kann der AI DSGVO Bot?',
    a: 'Der AI DSGVO Bot (Compliance Copilot) beantwortet DSGVO- und AI-Act-Fragen, erklärt Scan-Ergebnisse, leitet Maßnahmen ab und unterstützt bei Datenschutztexten, TOMs und AVV-Checklisten. Er ersetzt keine anwaltliche Beratung, sondern dient der strukturierten Vorprüfung und Dokumentation.',
  },
  {
    q: 'Wo werden meine Daten verarbeitet?',
    a: 'Hosting, Verarbeitung und Modelle laufen innerhalb der EU. Optional stehen lokale Modelle für maximale Datenkontrolle bereit. Sensible Keys verbleiben serverseitig, jede Tabelle ist mandantengetrennt geschützt.',
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section eyebrow="Häufige Fragen" title="Was Sie vor dem Start wissen sollten" tint>
      <div className="max-w-3xl divide-y divide-slate-200 rounded-panel border border-slate-200 bg-white">
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-base font-semibold text-slate-900">{item.q}</span>
                {isOpen ? (
                  <Minus className="h-5 w-5 text-petrol-600 shrink-0" />
                ) : (
                  <Plus className="h-5 w-5 text-slate-400 shrink-0" />
                )}
              </button>
              {isOpen && (
                <p className="px-6 pb-5 -mt-1 text-sm text-slate-600 leading-relaxed">{item.a}</p>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ── FINAL CTA ──────────────────────────────────────────── */
function FinalCta() {
  return (
    <section className="bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="rounded-panel border border-petrol-200 bg-petrol-50 p-10 sm:p-14 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
            Governance, die ab Minute eins läuft
          </h2>
          <p className="mx-auto max-w-2xl text-base sm:text-lg text-slate-600 leading-relaxed mb-9">
            Scannen Sie eine Website, sehen Sie Ihr DSGVO-/AI-Governance-Ergebnis und
            starten Sie in den 14-Tage-Test. Regulierte Anforderungen? Fordern Sie eine Enterprise-Demo an.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <SmartLink
              to={TRIAL_CTA}
              className="group inline-flex items-center justify-center gap-2 rounded-chip bg-petrol-700 px-8 py-4 text-base font-semibold text-white hover:bg-petrol-600 transition-colors"
            >
              14 Tage kostenlos testen
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </SmartLink>
            <SmartLink
              to={DEMO_CTA}
              className="inline-flex items-center justify-center gap-2 rounded-chip border border-slate-300 bg-white px-8 py-4 text-base font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors"
            >
              <Building2 className="h-4 w-4" />
              Enterprise-Demo anfragen
            </SmartLink>
          </div>
          <p className="mt-6 font-mono text-[11px] tracking-wider text-slate-400">
            Self-Service · ohne automatisches Abo · kein Sales-Gespräch nötig
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── HELPER ─────────────────────────────────────────────── */
function Section({
  id,
  eyebrow,
  title,
  subtitle,
  tint,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  tint?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={tint ? 'bg-slate-50' : 'bg-white'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-2xl mb-12">
          <p className="font-mono text-[11px] tracking-[0.25em] text-petrol-700 uppercase mb-4">{eyebrow}</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">{title}</h2>
          {subtitle && <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">{subtitle}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}
