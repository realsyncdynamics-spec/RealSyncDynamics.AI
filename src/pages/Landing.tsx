/**
 * Landing — Enterprise Redesign (Linear / Vercel / Stripe / Resend Niveau).
 *
 * Strikt 7 Sections, maximaler Whitespace, dunkle Premium-Ästhetik.
 * Jede Section: ein klarer CTA. Keine Feature-Listen im Hero.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Database,
  Cpu,
  Server,
  Layers,
  Lock,
  Activity,
  Zap,
  CheckCircle2,
  Globe,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Logo } from '../components/Logo';
import { ArchitectureDiagram } from '../components/ArchitectureDiagram';

export function Landing() {
  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 overflow-x-hidden">
      <Navbar />

      <main>
        <Hero />
        <TrustBar />
        <Frameworks />
        <Pillars />
        <CourtCases />
        <HowItWorks />
        <WhatIsAutomated />
        <UniqueValue />
        <EnterpriseTrust />
        <PricingCompact />
        <FinalCta />
      </main>

      <FooterMinimal />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  1) HERO                                                                 */
/* ─────────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative pt-24 pb-16 sm:pt-40 sm:pb-32 px-4 sm:px-6 lg:px-8">
      {/* Subtle grid background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      {/* Indigo radial glow */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 w-[800px] h-[400px] rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 60%)' }}
      />

      <div className="max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 border border-titanium-800 bg-obsidian-900/60 backdrop-blur text-[11px] font-mono uppercase tracking-[0.2em] text-titanium-400 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Compliance-Infrastruktur · Made in Germany
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-7xl font-display font-bold tracking-tight text-titanium-50 leading-[1.08] sm:leading-[1.05]">
          Compliance,
          <br />
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            programmatisch geführt.
          </span>
        </h1>

        <p className="mt-6 sm:mt-8 max-w-2xl mx-auto text-base sm:text-xl text-titanium-400 leading-relaxed">
          Compliance-Operating-System für regulierte Unternehmen. DSGVO,
          EU&nbsp;AI&nbsp;Act, BAIT &mdash; auditierbar, evidenzbasiert, EU-souverän.
        </p>

        {/* Above-the-fold trust signals — visible on mobile WITHOUT scroll */}
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] sm:text-xs text-titanium-400">
          {['DSGVO + EU AI Act', 'BAIT & MaRisk Ready', 'EU-Hosted Frankfurt', 'ISO 27001 aligned'].map((t) => (
            <li key={t} className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" strokeWidth={2} />
              {t}
            </li>
          ))}
        </ul>

        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/audit"
            className="group inline-flex items-center gap-2 bg-white text-obsidian-950 hover:bg-titanium-200 px-6 py-3 text-sm font-semibold tracking-tight rounded-none transition-colors"
          >
            Audit starten
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            to="/contact-sales?source=hero-demo"
            className="group inline-flex items-center gap-2 border border-titanium-700 bg-obsidian-900/60 backdrop-blur text-titanium-100 hover:border-titanium-500 px-6 py-3 text-sm font-semibold tracking-tight rounded-none transition-colors"
          >
            Demo buchen
          </Link>
        </div>

        <div className="mt-14 sm:mt-24">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}

/**
 * Animated mini-dashboard preview as visual hook.
 * Shows live-counting Compliance-Score + tracker findings.
 */
function DashboardPreview() {
  const score = useAnimatedNumber(87, 1800);
  const findings = useAnimatedNumber(12, 1200);
  const audits = useAnimatedNumber(1247, 2200);

  return (
    <div className="relative max-w-3xl mx-auto">
      <div
        aria-hidden="true"
        className="absolute -inset-1 rounded-none blur-2xl opacity-30"
        style={{
          background:
            'linear-gradient(110deg, #6366f1 0%, #a78bfa 50%, transparent 100%)',
        }}
      />
      <div className="relative bg-obsidian-900/80 backdrop-blur border border-titanium-800 rounded-none">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-titanium-900 text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">
          <span className="w-2 h-2 rounded-full bg-red-500/60" />
          <span className="w-2 h-2 rounded-full bg-amber-500/60" />
          <span className="w-2 h-2 rounded-full bg-emerald-500/60" />
          <span className="ml-3">realsyncdynamicsai.de · audit-engine 2026.05.0</span>
        </div>

        <div className="grid grid-cols-3 divide-x divide-titanium-900">
          <Stat label="Compliance-Score" value={`${score}`} suffix="/ 100" accent="emerald" />
          <Stat label="Open Findings" value={`${findings}`} suffix="" accent="amber" />
          <Stat label="Audits gesamt" value={audits.toLocaleString('de-DE')} suffix="" accent="indigo" />
        </div>

        <div className="px-5 py-4 border-t border-titanium-900 flex items-center justify-between text-[11px] font-mono">
          <span className="text-titanium-500">tracker-db: 2026.05.0 · sources: EasyList · Disconnect.me</span>
          <span className="text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            live
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: string;
  suffix: string;
  accent: 'emerald' | 'amber' | 'indigo';
}) {
  const color =
    accent === 'emerald' ? 'text-emerald-300' : accent === 'amber' ? 'text-amber-300' : 'text-indigo-300';
  return (
    <div className="px-5 py-6 sm:py-8">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">{label}</div>
      <div className={`mt-2 font-display font-bold text-2xl sm:text-4xl ${color} tabular-nums`}>
        {value}
        {suffix && <span className="text-titanium-500 text-sm font-medium ml-1">{suffix}</span>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  2) TRUST BAR                                                            */
/* ─────────────────────────────────────────────────────────────────────── */

function TrustBar() {
  const items = [
    { Icon: Globe, label: 'EU-Hosting · Frankfurt' },
    { Icon: ShieldCheck, label: 'ISO 27001 aligned' },
    { Icon: Lock, label: 'DSGVO Art. 5 · DSGVO Art. 32' },
  ];
  return (
    <section className="border-y border-titanium-900/60 bg-obsidian-950/50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-12">
          {items.map(({ Icon, label }) => (
            <div key={label} className="flex items-center justify-center gap-3 text-titanium-500">
              <Icon className="h-5 w-5 text-titanium-400" strokeWidth={1.5} />
              <span className="text-xs font-mono uppercase tracking-[0.18em]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  3) PILLARS                                                              */
/* ─────────────────────────────────────────────────────────────────────── */

function Pillars() {
  const pillars = [
    {
      Icon: Cpu,
      title: 'EU AI Act',
      sub: 'Annex III Klassifikation',
      body: 'Indikative Risiko-Einstufung, Transparenz-Pflichten nach Art. 52, Conformity-Assessment-Vorlage. Keine Auto-Endurteile — versionierte Decision Trees.',
      to: '/ai-act-faq',
      cta: 'Annex III erkunden',
    },
    {
      Icon: ShieldCheck,
      title: 'DSGVO Compliance',
      sub: 'Art. 5 / 28 / 30 / 32 / 35',
      body: 'AVV, VVT, DSFA, TOM-Vorlagen mit branchenspezifischen Use-Cases. 72h-Meldepflicht-Timer mit Aufsichtsbehörden je Bundesland.',
      to: '/legal/methodology',
      cta: 'Methodik einsehen',
    },
    {
      Icon: Database,
      title: 'Daten & Infrastruktur',
      sub: 'EU-Souverän · Audit-Trail',
      body: 'Postgres mit RLS, append-only Audit-Log, optionaler EU-local AI-Stack via Ollama. Kein US-Cloud-Default-Pfad.',
      to: '/security',
      cta: 'Security-Posture',
    },
  ];

  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="Drei Säulen"
          title={<>Compliance, in drei klar trennbaren Domänen.</>}
        />

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-px bg-titanium-900">
          {pillars.map((p) => (
            <Link
              key={p.title}
              to={p.to}
              className="group relative bg-obsidian-950 hover:bg-obsidian-900 transition-colors p-8 sm:p-10"
            >
              <p.Icon className="h-6 w-6 text-indigo-400" strokeWidth={1.5} />
              <div className="mt-6 text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">
                {p.sub}
              </div>
              <h3 className="mt-2 font-display font-bold text-2xl tracking-tight text-titanium-50">
                {p.title}
              </h3>
              <p className="mt-4 text-sm text-titanium-400 leading-relaxed">{p.body}</p>
              <div className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-titanium-200 group-hover:text-white">
                {p.cta}
                <ArrowUpRight className="h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  4) HOW IT WORKS                                                         */
/* ─────────────────────────────────────────────────────────────────────── */

function HowItWorks() {
  const steps = [
    {
      step: '01',
      title: 'Audit',
      body: 'Real-Browser-Scan mit Tracker-DB-Match, Cookie-Banner-Heuristik, Subpages-Crawl.',
    },
    {
      step: '02',
      title: 'Analyse',
      body: 'Versionierte Rule Engine evaluiert Findings, Confidence-Score per Rule, Evidence-Layer persistiert Beweise.',
    },
    {
      step: '03',
      title: 'Dokumente',
      body: 'AVV, VVT, DSFA, TOM, AI-Act-Klassifikation als Block-komponierte Vorlagen — vor Export gated durch Human-Verification.',
    },
  ];

  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-obsidian-900/30">
      <div className="max-w-5xl mx-auto">
        <SectionHeader
          eyebrow="Workflow"
          title={<>Drei Schritte vom Scan zum Dokument.</>}
        />

        <div className="mt-16 relative">
          {/* Connecting line */}
          <div
            aria-hidden="true"
            className="hidden md:block absolute top-6 left-[8.33%] right-[8.33%] h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            {steps.map((s) => (
              <div key={s.step} className="relative text-center md:text-left">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-indigo-500/40 bg-obsidian-950 text-indigo-300 font-mono text-sm font-bold relative z-10">
                  {s.step}
                </div>
                <h3 className="mt-6 font-display font-bold text-xl tracking-tight text-titanium-50">
                  {s.title}
                </h3>
                <p className="mt-3 text-sm text-titanium-400 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 text-center">
          <Link
            to="/legal/methodology"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-titanium-300 hover:text-titanium-50 underline-offset-4 hover:underline"
          >
            Wie unsere Methodik im Detail funktioniert
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  5) UNIQUE VALUE                                                         */
/* ─────────────────────────────────────────────────────────────────────── */

function UniqueValue() {
  const items = [
    {
      Icon: Layers,
      title: 'Rule Engine',
      body: 'Versionierte JSON-Regeln pro Norm. Keine if/else-Kaskaden. Audit-Trail über jede Engine-Version.',
    },
    {
      Icon: Activity,
      title: 'Evidence Layer',
      body: 'Append-only Beweis-Items pro Finding: Screenshot, Network-Log, DOM-Snapshot, Cookie-Dump.',
    },
    {
      Icon: Lock,
      title: 'Immutable Audit Logs',
      body: 'Postgres-Trigger blockiert UPDATE/DELETE. Pflicht-Nachweis für BAIT, MaRisk, AI-Act-High-Risk.',
    },
    {
      Icon: Zap,
      title: 'Real-Time Monitoring',
      body: 'Auto-Re-Audits bei Site-Changes. Webhook-Notifications bei neuen Trackern, Sub-Processor-Veränderungen.',
    },
  ];

  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="Was uns einmalig macht"
          title={<>Defensible Assets statt Feature-Sammlung.</>}
        />

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-px bg-titanium-900">
          {items.map((it) => (
            <div key={it.title} className="bg-obsidian-950 p-8 sm:p-10">
              <it.Icon className="h-5 w-5 text-purple-400" strokeWidth={1.5} />
              <h3 className="mt-5 font-display font-bold text-xl tracking-tight text-titanium-50">
                {it.title}
              </h3>
              <p className="mt-3 text-sm text-titanium-400 leading-relaxed">{it.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  6) ENTERPRISE TRUST                                                     */
/* ─────────────────────────────────────────────────────────────────────── */

function EnterpriseTrust() {
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-obsidian-900/30">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-10">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">
              Architektur · Enterprise-ready
            </div>
            <h2 className="mt-3 font-display font-bold text-3xl sm:text-5xl tracking-tight text-titanium-50">
              Tenant-Isolation auf jeder Schicht.
            </h2>
          </div>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 border border-emerald-700/60 bg-emerald-950/20 text-emerald-300 text-[11px] font-mono uppercase tracking-[0.18em]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            SOC 2-ready
          </span>
        </div>

        <ArchitectureDiagram />

        <div className="mt-12 flex items-center gap-6 flex-wrap">
          <Link
            to="/security"
            className="group inline-flex items-center gap-2 text-sm font-medium text-titanium-100 hover:text-white"
          >
            Volle Security-Posture ansehen
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            to="/legal/sub-processors"
            className="text-sm text-titanium-500 hover:text-titanium-300 underline-offset-4 hover:underline"
          >
            Sub-Processors-Liste
          </Link>
          <Link
            to="/grenzen"
            className="text-sm text-titanium-500 hover:text-titanium-300 underline-offset-4 hover:underline"
          >
            Grenzen automatisierter Compliance
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  7) FINAL CTA                                                            */
/* ─────────────────────────────────────────────────────────────────────── */

function FinalCta() {
  const [email, setEmail] = useState('');
  return (
    <section className="py-32 sm:py-40 px-4 sm:px-6 lg:px-8 relative">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-20 blur-3xl"
        style={{
          background: 'radial-gradient(circle at 50% 50%, #6366f1 0%, transparent 60%)',
        }}
      />

      <div className="max-w-3xl mx-auto text-center">
        <h2 className="font-display font-bold text-4xl sm:text-6xl tracking-tight text-titanium-50 leading-[1.05]">
          Starte deine
          <br />
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Compliance-Journey.
          </span>
        </h2>
        <p className="mt-6 text-lg text-titanium-400">
          Erster Audit in 30 Sekunden — kostenlos, ohne Account.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!email) return;
            const url = `/audit?email=${encodeURIComponent(email)}`;
            window.location.assign(url);
          }}
          className="mt-10 flex flex-col sm:flex-row gap-2 max-w-lg mx-auto"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vorname.name@firma.de"
            className="flex-1 bg-obsidian-900 border border-titanium-800 text-titanium-50 px-4 py-3 text-sm rounded-none focus:border-indigo-500 outline-none placeholder:text-titanium-600"
            aria-label="E-Mail für Audit"
          />
          <button
            type="submit"
            className="group inline-flex items-center justify-center gap-2 bg-white text-obsidian-950 hover:bg-titanium-200 px-6 py-3 text-sm font-semibold tracking-tight rounded-none transition-colors"
          >
            Audit starten
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </form>

        <p className="mt-4 text-[11px] font-mono text-titanium-600 uppercase tracking-[0.18em]">
          Keine Kreditkarte · Kein Account · DSGVO-konform
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  FRAMEWORKS STRIP                                                        */
/* ─────────────────────────────────────────────────────────────────────── */

function Frameworks() {
  const items = [
    { code: 'DSGVO', sub: 'EU 2016/679' },
    { code: 'EU AI Act', sub: '2024/1689' },
    { code: 'BAIT', sub: 'BaFin' },
    { code: 'MaRisk', sub: 'AT 7.2' },
    { code: 'TTDSG', sub: '§ 25' },
    { code: 'BDSG', sub: '§ 26 / § 38' },
  ];
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">
            Native Coverage
          </div>
          <h2 className="mt-3 font-display font-bold text-2xl sm:text-3xl tracking-tight text-titanium-50">
            Sechs Frameworks. Eine Plattform.
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-titanium-900">
          {items.map((it) => (
            <div
              key={it.code}
              className="bg-obsidian-950 hover:bg-obsidian-900 transition-colors p-5 text-center"
            >
              <div className="font-display font-bold text-base text-titanium-50">{it.code}</div>
              <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.18em] text-titanium-500">
                {it.sub}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  COURT CASES                                                             */
/* ─────────────────────────────────────────────────────────────────────── */

function CourtCases() {
  const cases = [
    {
      court: 'LG München I',
      year: '2022',
      norm: 'Google Fonts',
      penalty: '€ 100 / Anlassfall',
      ref: 'Az. 3 O 17493/20',
    },
    {
      court: 'LfDI BaWü',
      year: '2023',
      norm: 'Newsletter ohne DOI',
      penalty: '€ 50 000',
      ref: 'Tätigkeitsbericht 2023',
    },
    {
      court: 'DSB Österreich',
      year: '2022',
      norm: 'Google Analytics',
      penalty: 'Untersagungsverfügung',
      ref: 'GZ. D155.027 / 22',
    },
    {
      court: 'BfDI · BVerwG',
      year: '2023',
      norm: 'Verschlüsselung Art. 32',
      penalty: '€ 105 000',
      ref: '6 C 23.21 / 2023',
    },
  ];
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-obsidian-900/30">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="Realer Enforcement-Druck"
          title={<>Vier Bescheide, die zeigen warum es jetzt eilt.</>}
        />
        <p className="mt-6 max-w-2xl text-titanium-400 text-base leading-relaxed">
          Aufsichtsbehörden setzen DSGVO seit 2022 spürbar durch. Die folgenden Fälle
          haben Präzedenz für Standard-Verstöße geschaffen, denen 80&nbsp;% der DACH-Sites ausgesetzt sind.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-px bg-titanium-900">
          {cases.map((c) => (
            <div key={c.ref} className="bg-obsidian-950 p-6 sm:p-8">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <span className="font-display font-bold text-titanium-50 text-lg">{c.court}</span>
                <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-500">
                  {c.year}
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-3 flex-wrap">
                <span className="text-titanium-300 text-sm">{c.norm}</span>
                <span className="text-amber-300 font-mono font-bold text-sm">{c.penalty}</span>
              </div>
              <div className="mt-4 text-[11px] font-mono uppercase tracking-[0.18em] text-titanium-600">
                {c.ref}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/audit"
            className="inline-flex items-center gap-2 text-sm font-medium text-titanium-200 hover:text-titanium-50 underline-offset-4 hover:underline"
          >
            Bin ich einem dieser Risiken ausgesetzt? Audit starten
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  WHAT IS AUTOMATED                                                       */
/* ─────────────────────────────────────────────────────────────────────── */

function WhatIsAutomated() {
  const items = [
    'Cookie- & Tracker-Erkennung (URL-Pattern + DOM)',
    'Datenschutzerklärung-Generation (Block-System)',
    'AVV-Vorlagen pro Sub-Processor',
    'Risiko-Klassifikation (AI Act Annex III)',
    'Audit-Protokolle (append-only)',
    'Continuous-Compliance-Monitoring',
    'TOMs & DSFA-Workflows',
    '72h-Meldepflicht-Timer mit Aufsichtsbehörden je Bundesland',
  ];

  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <SectionHeader
          eyebrow="Was die Plattform ohne Aufwand erledigt"
          title={<>Acht operative Routinen — automatisiert.</>}
        />
        <ul className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {items.map((it) => (
            <li key={it} className="flex items-start gap-3 text-titanium-300">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" strokeWidth={1.5} />
              <span className="text-base">{it}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  PRICING COMPACT                                                         */
/* ─────────────────────────────────────────────────────────────────────── */

function PricingCompact() {
  const tiers = [
    {
      name: 'Starter',
      price: 'Kostenlos',
      sub: 'Self-Service',
      features: ['8 Free-Tools', 'Audit für 1 Domain', 'Methodik einsehbar'],
      to: '/audit',
      cta: 'Jetzt loslegen',
      highlight: false,
    },
    {
      name: 'Professional',
      price: '€ 149',
      sub: 'pro Monat / System',
      features: ['Alle Tools mit Dashboard', 'API + Webhooks', 'Continuous Monitoring', 'Sub-Processor-Notification'],
      to: '/pricing?tier=pro',
      cta: 'Pilot starten',
      highlight: true,
    },
    {
      name: 'Enterprise',
      price: 'Anfrage',
      sub: 'Custom · SLA · DPA',
      features: ['Unlimited Systeme', 'Multi-Tenant für Agenturen', 'On-Premise möglich', 'SLA 99.9 %'],
      to: '/contact-sales?intent=enterprise',
      cta: 'Sales kontaktieren',
      highlight: false,
    },
  ];

  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-obsidian-900/30">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="Preise"
          title={<>Drei Tiers. Klar abgegrenzt. Keine Setup-Fees.</>}
        />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-px bg-titanium-900">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`relative p-8 sm:p-10 ${
                t.highlight
                  ? 'bg-obsidian-900 ring-1 ring-indigo-500/40'
                  : 'bg-obsidian-950'
              }`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-8 inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em] bg-indigo-500 text-white">
                  Empfohlen
                </span>
              )}
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">
                {t.name}
              </div>
              <div className="mt-3 font-display font-bold text-3xl sm:text-4xl text-titanium-50 tracking-tight">
                {t.price}
              </div>
              <div className="mt-1 text-xs text-titanium-500">{t.sub}</div>

              <ul className="mt-6 space-y-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-titanium-300">
                    <CheckCircle2 className="h-4 w-4 text-titanium-500 shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                to={t.to}
                className={`mt-8 inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold tracking-tight rounded-none transition-colors ${
                  t.highlight
                    ? 'bg-white text-obsidian-950 hover:bg-titanium-200'
                    : 'border border-titanium-700 text-titanium-100 hover:border-titanium-500'
                }`}
              >
                {t.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-titanium-300 hover:text-titanium-50 underline-offset-4 hover:underline"
          >
            Volle Pricing-Details ansehen
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  Shared UI                                                               */
/* ─────────────────────────────────────────────────────────────────────── */

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: React.ReactNode }) {
  return (
    <div className="max-w-2xl">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-titanium-500">{eyebrow}</div>
      <h2 className="mt-3 font-display font-bold text-3xl sm:text-5xl tracking-tight text-titanium-50 leading-[1.05]">
        {title}
      </h2>
    </div>
  );
}

function FooterMinimal() {
  return (
    <footer className="border-t border-titanium-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <Logo size={22} />
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-titanium-500">
            <Link to="/legal/methodology" className="hover:text-titanium-300">Methodik</Link>
            <Link to="/grenzen" className="hover:text-titanium-300">Grenzen</Link>
            <Link to="/security" className="hover:text-titanium-300">Security</Link>
            <Link to="/legal/privacy" className="hover:text-titanium-300">Datenschutz</Link>
            <Link to="/impressum" className="hover:text-titanium-300">Impressum</Link>
            <Link to="/legal/sub-processors" className="hover:text-titanium-300">Sub-Processors</Link>
            <Link to="/legal/avv" className="hover:text-titanium-300">AVV</Link>
            <Link to="/changelog" className="hover:text-titanium-300">Changelog</Link>
          </div>
        </div>

        {/* Haftungsausschluss */}
        <div className="mt-10 p-5 border border-amber-900/40 bg-amber-950/10 rounded-none">
          <div className="flex items-start gap-3">
            <Server className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" strokeWidth={1.5} />
            <p className="text-[12px] text-amber-200/80 leading-relaxed">
              <strong className="text-amber-200">Haftungsausschluss · Anwalts-Validierung.</strong>{' '}
              RealSync Dynamics liefert automatisiert generierte Vorlagen und Methodik-basierte
              Klassifikationen — keine individuelle Rechtsberatung im Sinne des RDG. Outputs sind
              nicht durch externen Datenschutz-Anwalt validiert; vor produktivem Einsatz empfehlen
              wir anwaltliche Prüfung. Methodik und Grenzen sind transparent unter{' '}
              <Link to="/legal/methodology" className="text-amber-300 hover:text-amber-200 underline-offset-4 hover:underline">
                /legal/methodology
              </Link>{' '}
              und{' '}
              <Link to="/grenzen" className="text-amber-300 hover:text-amber-200 underline-offset-4 hover:underline">
                /grenzen
              </Link>{' '}
              dokumentiert. Bei juristischer Pflicht-Prüfung vermitteln wir Partner-Anwälte über{' '}
              <Link
                to="/contact-sales?source=footer-disclaimer"
                className="text-amber-300 hover:text-amber-200 underline-offset-4 hover:underline"
              >
                Kontakt
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono text-titanium-600 uppercase tracking-[0.18em]">
          <span>© 2026 RealSync Dynamics · Made in Germany · Hosted in EU</span>
          <Link to="/legal/methodology" className="hover:text-titanium-400">
            Methodik 2026.05.0
          </Link>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */
/*  Hooks                                                                   */
/* ─────────────────────────────────────────────────────────────────────── */

/**
 * Animiert eine Zahl von 0 auf das Ziel mit easing — für Hero-Stats.
 */
function useAnimatedNumber(target: number, durationMs = 1500) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start: number | null = null;
    let frame = 0;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(1, elapsed / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}
