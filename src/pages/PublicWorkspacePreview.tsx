import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Globe, Bot, AlertTriangle, ClipboardCheck, FileCheck2,
  Activity, Users, Settings, ArrowRight, Brain, Server, ShieldCheck,
} from 'lucide-react';
import { AiCore } from '../components/visual/AiCore';
import { AiOsHeroSection } from '../components/sections/AiOsHeroSection';

interface Tile {
  id: string;
  label: string;
  description: string;
  icon: typeof Globe;
  color: 'cyan' | 'blue' | 'orange' | 'emerald' | 'purple' | 'amber' | 'rose' | 'indigo' | 'violet';
}

const TILES: Tile[] = [
  {
    id: 'websites',
    label: 'Websites',
    description: 'Übersicht und Management aller Website-Assets',
    icon: Globe,
    color: 'cyan',
  },
  {
    id: 'ai-systems',
    label: 'KI-Systeme',
    description: 'Registrierung und Dokumentation von KI-Systemen',
    icon: Bot,
    color: 'blue',
  },
  {
    id: 'risks',
    label: 'Risiken',
    description: 'Identifikation und Bewertung von Compliance-Risiken',
    icon: AlertTriangle,
    color: 'orange',
  },
  {
    id: 'compliance',
    label: 'Compliance',
    description: 'Dokumentation und Einhaltung von Vorgaben',
    icon: ClipboardCheck,
    color: 'emerald',
  },
  {
    id: 'evidence',
    label: 'Evidence',
    description: 'Herkunftsnachweis und Audit-Trails (C2PA)',
    icon: FileCheck2,
    color: 'purple',
  },
  {
    id: 'monitoring',
    label: 'Monitoring',
    description: 'Echtzeit-Überwachung und Drift-Erkennung',
    icon: Activity,
    color: 'amber',
  },
  {
    id: 'ai-governance',
    label: 'KI-Governance',
    description: 'EU AI Act-Register, Klassifizierung und Controls',
    icon: Brain,
    color: 'violet',
  },
  {
    id: 'team',
    label: 'Team',
    description: 'Zusammenarbeit und Mitgliederverwaltung',
    icon: Users,
    color: 'rose',
  },
  {
    id: 'settings',
    label: 'Einstellungen',
    description: 'Konfiguration und Organisationsoptionen',
    icon: Settings,
    color: 'indigo',
  },
];

const COLOR_MAP: Record<string, { bg: string; icon: string; hover: string }> = {
  cyan:   { bg: 'bg-cyan-950/30',    icon: 'text-cyan-400',     hover: 'hover:bg-cyan-950/50' },
  blue:   { bg: 'bg-security-950/30', icon: 'text-security-400', hover: 'hover:bg-security-950/50' },
  orange: { bg: 'bg-orange-950/30',  icon: 'text-orange-400',   hover: 'hover:bg-orange-950/50' },
  emerald:{ bg: 'bg-emerald-950/30', icon: 'text-emerald-400',  hover: 'hover:bg-emerald-950/50' },
  purple: { bg: 'bg-purple-950/30',  icon: 'text-purple-400',   hover: 'hover:bg-purple-950/50' },
  amber:  { bg: 'bg-amber-950/30',   icon: 'text-amber-400',    hover: 'hover:bg-amber-950/50' },
  violet: { bg: 'bg-violet-950/30',  icon: 'text-violet-400',   hover: 'hover:bg-violet-950/50' },
  rose:   { bg: 'bg-rose-950/30',    icon: 'text-rose-400',     hover: 'hover:bg-rose-950/50' },
  indigo: { bg: 'bg-indigo-950/30',  icon: 'text-indigo-400',   hover: 'hover:bg-indigo-950/50' },
};

const TRUST_ITEMS = [
  { icon: Server,      label: 'EU-Hosting · Frankfurt' },
  { icon: ShieldCheck, label: 'DSGVO + EU AI Act konform' },
  { icon: FileCheck2,  label: 'C2PA Evidence Chain' },
  { icon: Brain,       label: 'On-Premise-fähig' },
] as const;

export function PublicWorkspacePreview() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      {/* Hero — Europa-Erde-Centerpiece (verbindliches Zielbild) */}
      <AiOsHeroSection />

      {/* Trust Strip */}
      <div className="border-b border-titanium-900 bg-obsidian-900">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            {TRUST_ITEMS.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-titanium-500 text-xs font-mono">
                <Icon className="h-3.5 w-3.5 text-security-400 shrink-0" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Governance Complexity Score — Einstieg über Governance-Abdeckung statt Webseiten-Anzahl */}
      <div className="border-b border-titanium-900 bg-obsidian-950">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-security-400 mb-1">
              Governance Complexity Score
            </div>
            <p className="text-sm text-titanium-300 max-w-xl">
              Sie wählen Governance-Abdeckung, nicht „Anzahl Webseiten". Acht Fragen zeigen
              Ihre Komplexität, Risiken und das passende Paket.
            </p>
          </div>
          <button
            onClick={() => navigate('/governance-score')}
            className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 border border-titanium-700 text-titanium-100 text-sm font-semibold hover:bg-obsidian-800 transition-colors"
          >
            Score ermitteln
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Feature Tiles */}
      <div className="max-w-6xl mx-auto px-4 py-14 sm:py-16">
        <div className="mb-8">
          <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-titanium-500 mb-2">
            Plattform-Module
          </div>
          <h2 className="font-display font-bold text-xl text-titanium-100">
            Alles. In einer Oberfläche.
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TILES.map((tile) => {
            const Icon = tile.icon;
            const colors = COLOR_MAP[tile.color];

            return (
              <div
                key={tile.id}
                className={`p-6 border border-titanium-800 ${colors.bg} ${colors.hover} transition-colors cursor-default group`}
              >
                <div className={`mb-4 ${colors.icon}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold text-titanium-50 mb-1">{tile.label}</h3>
                <p className="text-sm text-titanium-400 leading-snug">{tile.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Value Prop Section */}
      <div className="border-t border-titanium-900 bg-obsidian-900">
        <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                label: 'Erkennen',
                copy: 'Policy Engine erkennt Risiken, Datenschutzdrift und AI-Act-Verstöße automatisch — per API, Scanner oder Agent.',
              },
              {
                label: 'Monitoren',
                copy: 'Kontinuierliche Überwachung aller Assets. Webhooks, Alerts und Risk-Score-Recalculation ohne manuellen Aufwand.',
              },
              {
                label: 'Beweisen',
                copy: 'Jede Entscheidung wird in einem kryptografisch gesicherten Evidence-Trail (C2PA + SHA-256 Hash Chain) festgehalten.',
              },
            ].map(({ label, copy }) => (
              <div key={label} className="border-l-2 border-security-600 pl-5">
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-security-400 mb-2">
                  {label}
                </div>
                <p className="text-sm text-titanium-400 leading-relaxed">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Runtime-Kern — der bisherige Watchmaker-AiCore lebt als Technologie-
          Detail weiter (nicht gelöscht, nur in eine Produktsektion verschoben). */}
      <div className="border-t border-titanium-900 bg-obsidian-950">
        <div className="max-w-6xl mx-auto px-4 py-14 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="flex justify-center lg:justify-start order-2 lg:order-1">
            <AiCore size={300} />
          </div>
          <div className="order-1 lg:order-2">
            <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-security-400 mb-2">
              Runtime-Kern
            </div>
            <h2 className="font-display font-bold text-2xl text-titanium-50 mb-3">
              Ein deterministischer Compliance-Motor — kein Black-Box-Modell.
            </h2>
            <p className="text-titanium-300 leading-relaxed mb-5 max-w-xl">
              Policy Engine, Evidence-Chain und Monitoring laufen als nachvollziehbarer
              Runtime-Kern. Jede Entscheidung ist reproduzierbar und auditierbar.
            </p>
            <Link
              to="/runtime"
              className="inline-flex items-center gap-2 text-sm font-semibold text-security-400 hover:text-security-300 transition-colors"
            >
              Runtime ansehen <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="border-t border-titanium-900 px-4 py-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-titanium-500 max-w-md">
            Kostenlos starten — keine Kreditkarte erforderlich.
            EU-Hosting. DSGVO-konform by design.
          </p>
          <button
            onClick={() => navigate('/app')}
            className="shrink-0 flex items-center gap-2 px-6 py-2.5 bg-security-600 text-white text-sm font-semibold hover:bg-security-500 transition-colors"
          >
            Dashboard öffnen
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
