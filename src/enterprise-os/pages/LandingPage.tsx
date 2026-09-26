import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ShieldCheck,
  Activity,
  Vault,
  Bot,
  AlertTriangle,
  Cpu,
  FileBarChart,
  CheckCircle2,
  Lock,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { PublicNav } from '../layout/PublicNav';
import { PublicFooter } from '../layout/PublicFooter';
import { Button } from '../components/Button';
import { Badge, StatusBadge } from '../components/Badge';
import { Card } from '../components/Card';
import { ScoreGauge } from '../components/ScoreGauge';
import { SCORES, RISKS, WEBSITES } from '../mock/data';
// SSoT für Headline/Loop/CTA-Labels — dieselbe Quelle wie `MainLanding.tsx`
// (Live-`/`). Verhindert Text-Drift zwischen den beiden Hero-Flächen; siehe
// PR-Review zu #1369.
import {
  HERO_DASHBOARD_CTA_LABEL,
  HERO_HEADLINE,
  HERO_OPERATING_LOOP,
  HERO_SCAN_CTA_LABEL,
} from '../../components/governance-frontend/hero-content';

const MODULES = [
  {
    icon: ShieldCheck,
    title: 'Compliance Command Center',
    description: 'Alle DSGVO- und EU-AI-Act-Pflichten an einem Ort — mit Status, Fristen und Verantwortlichkeiten.',
  },
  {
    icon: AlertTriangle,
    title: 'Risk Graph',
    description: 'Automatisch erkannte Risiken über Websites, Tracker und KI-Systeme — priorisiert nach Schweregrad.',
  },
  {
    icon: Vault,
    title: 'Evidence Vault',
    description: 'Signierte, manipulationssichere Nachweise (C2PA) für jeden Prüfpunkt — jederzeit exportierbar.',
  },
  {
    icon: Activity,
    title: 'Monitoring Timeline (Coming Soon)',
    description: 'Geplant: dauerhafte Überwachung von Cookies, Trackern, Drittanbietern und Zertifikaten — heute als Scan-Historie.',
  },
  {
    icon: Cpu,
    title: 'AI Use Case Registry',
    description: 'Erfasst, klassifiziert und überwacht jedes KI-System gemäß EU AI Act — inklusive Risikoklasse.',
  },
  {
    icon: Bot,
    title: 'AI Agent Sidebar',
    description: 'Autonome Compliance-Agenten erkennen Findings, erstellen Reports und schlagen Maßnahmen vor.',
  },
  {
    icon: FileBarChart,
    title: 'Audit Reports',
    description: 'Revisionssichere Berichte für Wirtschaftsprüfer, Aufsichtsbehörden und interne Stakeholder.',
  },
  {
    icon: Lock,
    title: 'Workflows & Automation',
    description: 'Wiederkehrende Compliance-Aufgaben automatisiert — von Scan bis Remediation-Task.',
  },
];

const TRUST_POINTS = [
  { label: 'Hosting & Betrieb in der EU' },
  { label: 'DSGVO-konform by Design' },
  { label: 'EU AI Act Ready' },
  { label: 'C2PA-signierter Prüfpfad' },
];

export function LandingPage() {
  const previewRisks = RISKS.filter((r) => r.level === 'critical' || r.level === 'high').slice(0, 2);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <PublicNav overlay />

      {/* HERO — visual direction based on the supplied 16:9 Europe governance reference */}
      <section className="relative isolate min-h-[760px] overflow-hidden border-b border-titanium-800 bg-[#0A0A0B]">
        <img
          src="/europe-globe.webp"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center opacity-95"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0A0B]/95 via-[#0A0A0B]/72 to-[#0A0A0B]/12" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0B]/80 via-transparent to-[#0A0A0B]/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_46%,rgba(255,179,71,0.16),transparent_32%)]" />

        <div className="relative mx-auto flex min-h-[760px] max-w-7xl items-center px-4 pb-20 pt-32 sm:px-6 lg:px-8">
          <div className="max-w-4xl">
            <div className="mb-7 inline-flex items-center gap-2 border border-white/15 bg-black/25 px-3 py-2 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-[#FFB347]" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70">
                AI Governance Operations OS · Europe
              </span>
            </div>

            <h1 className="max-w-4xl text-5xl font-semibold leading-[0.96] tracking-[-0.045em] text-white sm:text-6xl lg:text-[76px]">
              {HERO_HEADLINE.map((segments, line) => (
                <span key={line} className="block">
                  {segments.map((segment, index) =>
                    segment.accent ? (
                      <span key={index} className="text-[#FFB347]">
                        {segment.text}
                      </span>
                    ) : (
                      <span key={index}>{segment.text}</span>
                    ),
                  )}
                </span>
              ))}
            </h1>

            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-white/65 sm:text-xs">
              {HERO_OPERATING_LOOP.split(' → ').map((word, index, words) => (
                <React.Fragment key={word}>
                  <span>{word}</span>
                  {index < words.length - 1 && <span className="text-[#FFB347]">→</span>}
                </React.Fragment>
              ))}
            </div>

            <p className="mt-8 max-w-2xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
              Runtime Governance für regulierte KI-Systeme. Kontinuierliche Evidence für DSGVO und EU AI Act — EU-native by design.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/os/audit">
                <Button variant="primary" size="lg" className="min-w-[220px] shadow-[0_8px_40px_rgba(255,179,71,0.24)]">
                  {HERO_SCAN_CTA_LABEL} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/os/app">
                <Button variant="secondary" size="lg" className="min-w-[220px] border-white/35 bg-white/10 text-white backdrop-blur-md hover:bg-white/15">
                  {HERO_DASHBOARD_CTA_LABEL}
                </Button>
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-5 text-[11px] text-white/55">
              <span>DSGVO</span><span>EU AI Act</span><span>Evidence Vault</span><span>AI Agents</span><span>SiteOS</span>
            </div>
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section className="border-b border-titanium-800 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-security-400">
              Module
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold text-titanium-50 sm:text-4xl">
              Ein OS, nicht 12 Insellösungen
            </h2>
            <p className="mt-4 text-base text-titanium-400">
              Jedes Modul greift auf dieselben Daten zu — Risiken, Nachweise und Status sind immer konsistent.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map((mod) => (
              <Card key={mod.title} className="p-5 transition-colors hover:border-titanium-600">
                <span className="flex h-10 w-10 items-center justify-center border border-security-500/30 bg-security-500/10 text-security-400">
                  <mod.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-sm font-semibold text-titanium-50">{mod.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-titanium-400">{mod.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* POSITIONING — Scanner vs OS */}
      <section className="border-b border-titanium-800 bg-obsidian-900/40 py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-security-400">
                Positionierung
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold text-titanium-50 sm:text-4xl">
                Mehr als ein DSGVO-Scanner
              </h2>
              <p className="mt-4 text-base leading-relaxed text-titanium-400">
                Klassische Scanner liefern einen Schnappschuss und einen PDF-Report. RealSync Dynamics AI bleibt aktiv:
                erkennt neue Risiken, sammelt Nachweise, klassifiziert KI-Systeme und hält Ihr Compliance-Team mit
                automatisierten Workflows synchron. Dauerhafte Überwachung ist Coming Soon.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Kontinuierliches Monitoring statt einmaligem Scan (Coming Soon)',
                  'C2PA-signierte Evidence statt unbeglaubigter Screenshots',
                  'EU AI Act Risikoklassifizierung pro KI-System',
                  'Autonome Agenten statt manueller Checklisten',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-risk-passed" />
                    <span className="text-sm text-titanium-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-600">Klassischer Scanner</p>
                <ul className="mt-4 space-y-2.5 text-sm text-titanium-500">
                  <li>Einmaliger Scan</li>
                  <li>Statischer PDF-Report</li>
                  <li>Keine KI-Klassifizierung</li>
                  <li>Manuelle Nachverfolgung</li>
                </ul>
              </Card>
              <Card className="border-security-500/40 bg-security-500/5 p-5">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-security-400">Governance OS</p>
                <ul className="mt-4 space-y-2.5 text-sm text-titanium-200">
                  <li>Kontinuierliches Monitoring (Coming Soon)</li>
                  <li>Lebendiges Evidence Vault</li>
                  <li>EU AI Act Use Case Registry</li>
                  <li>Autonome Compliance-Agenten</li>
                </ul>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="border-b border-titanium-800 py-16 lg:py-20">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-security-400">Trust & Souveränität</p>
          <h2 className="mt-2 font-display text-3xl font-bold text-titanium-50 sm:text-4xl">
            Entwickelt & betrieben in der EU
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="flex flex-col items-center gap-3 p-6">
              <MapPin className="h-6 w-6 text-security-400" />
              <p className="font-display text-sm font-semibold text-titanium-50">EU-Datenresidenz</p>
              <p className="text-xs text-titanium-400">Alle Daten verbleiben auf Infrastruktur innerhalb der Europäischen Union.</p>
            </Card>
            <Card className="flex flex-col items-center gap-3 p-6">
              <ShieldCheck className="h-6 w-6 text-security-400" />
              <p className="font-display text-sm font-semibold text-titanium-50">DSGVO & EU AI Act</p>
              <p className="text-xs text-titanium-400">Konzipiert nach Privacy-by-Design — abgestimmt auf aktuelle Aufsichtspraxis.</p>
            </Card>
            <Card className="flex flex-col items-center gap-3 p-6">
              <Vault className="h-6 w-6 text-security-400" />
              <p className="font-display text-sm font-semibold text-titanium-50">Lückenloser Prüfpfad</p>
              <p className="text-xs text-titanium-400">C2PA-signierte Herkunftsnachweise für jeden Compliance-Beleg.</p>
            </Card>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-bold text-titanium-50 sm:text-4xl">
            Starten Sie noch heute mit Ihrem Governance OS
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-titanium-400">
            Self-Service-Setup in wenigen Minuten. Keine Kreditkarte für die ersten 14 Tage erforderlich.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/os/pricing">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                14 Tage kostenlos starten <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/os/audit">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                Kostenlosen DSGVO-Check starten
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
