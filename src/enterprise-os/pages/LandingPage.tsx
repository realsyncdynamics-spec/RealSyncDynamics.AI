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
    title: 'Monitoring Timeline',
    description: 'Kontinuierliche Überwachung von Cookies, Trackern, Drittanbietern und Zertifikaten in Echtzeit.',
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
      <PublicNav />

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-titanium-800 bg-puzzle-grid">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24 lg:px-8">
          <div>
            <Badge icon={<Sparkles className="h-3 w-3 text-security-400" />} className="mb-6">
              Governance OS · DSGVO + EU AI Act
            </Badge>
            <h1 className="font-display text-4xl font-bold leading-tight text-titanium-50 sm:text-5xl lg:text-6xl">
              Das Betriebssystem für digitale Compliance
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-titanium-400 sm:text-lg">
              RealSync Dynamics AI ist kein Scanner, der einmalig prüft — sondern ein Governance OS, das DSGVO, EU AI Act,
              Website-Compliance und KI-Risiken kontinuierlich überwacht, dokumentiert und automatisiert.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/pricing">
                <Button variant="primary" size="lg" className="w-full sm:w-auto">
                  14 Tage kostenlos starten <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/os/app">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  Plattform live ansehen
                </Button>
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TRUST_POINTS.map((point) => (
                <div key={point.label} className="flex items-center gap-2 border border-titanium-800 bg-obsidian-900/60 px-3 py-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-risk-passed" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-titanium-400">{point.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Live dashboard preview */}
          <div className="relative">
            <div className="border border-titanium-700 bg-obsidian-900 shadow-2xl">
              <div className="flex items-center gap-2 border-b border-titanium-800 bg-obsidian-800 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-risk-critical/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-risk-medium/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-risk-passed/70" />
                <span className="ml-3 font-mono text-[10px] uppercase tracking-wider text-titanium-500">
                  app.realsyncdynamics.ai/app
                </span>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-3 gap-3">
                  <Card className="flex flex-col items-center justify-center gap-2 py-4">
                    <ScoreGauge score={SCORES.overall} label="Gesamt" size={72} />
                  </Card>
                  <Card className="flex flex-col items-center justify-center gap-2 py-4">
                    <ScoreGauge score={SCORES.dsgvo} label="DSGVO" size={72} />
                  </Card>
                  <Card className="flex flex-col items-center justify-center gap-2 py-4">
                    <ScoreGauge score={SCORES.aiAct} label="AI Act" size={72} />
                  </Card>
                </div>
                <Card className="p-3">
                  <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-600">
                    Aktuelle Risiken
                  </p>
                  <div className="space-y-2">
                    {previewRisks.map((risk) => (
                      <div key={risk.id} className="flex items-center justify-between gap-3 border border-titanium-800 bg-obsidian-800/60 px-3 py-2">
                        <span className="truncate text-xs text-titanium-200">{risk.title}</span>
                        <StatusBadge level={risk.level} />
                      </div>
                    ))}
                  </div>
                </Card>
                <Card className="p-3">
                  <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-titanium-600">
                    Websites
                  </p>
                  <div className="space-y-1.5">
                    {WEBSITES.slice(0, 3).map((site) => (
                      <div key={site.id} className="flex items-center justify-between text-xs">
                        <span className="text-titanium-300">{site.domain}</span>
                        <span className="font-mono tabular text-titanium-500">{site.score}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
            <div className="absolute -bottom-6 -right-6 -z-10 h-40 w-40 bg-security-500/10 blur-3xl" />
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
                automatisierten Workflows synchron — kontinuierlich, nicht einmalig.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Kontinuierliches Monitoring statt einmaligem Scan',
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
                  <li>Kontinuierliches Monitoring</li>
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
            <Link to="/pricing">
              <Button variant="primary" size="lg" className="w-full sm:w-auto">
                14 Tage kostenlos starten <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/audit">
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
