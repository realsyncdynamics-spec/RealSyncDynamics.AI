import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Globe, Bot, AlertTriangle, ClipboardCheck, FileCheck2,
  Activity, Users, Settings, ArrowRight, Brain, Server, ShieldCheck,
} from 'lucide-react';

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
      {/* Hero */}
      <div className="bg-gradient-to-b from-obsidian-900 to-obsidian-950 border-b border-titanium-900 px-4 py-14 sm:py-20">
        <div className="max-w-6xl mx-auto">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 border border-titanium-800 bg-obsidian-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-titanium-400">Governance OS</span>
          </div>

          <h1 className="font-display font-bold text-4xl sm:text-5xl mb-4 text-titanium-50 leading-tight">
            Das Governance OS<br className="hidden sm:block" />
            <span className="text-security-400"> für moderne Teams.</span>
          </h1>
          <p className="text-titanium-300 text-lg max-w-2xl mb-3 leading-relaxed">
            Websites, KI-Systeme, Risiken und Compliance —
            in einer einheitlichen, EU-souveränen Oberfläche.
          </p>
          <p className="text-titanium-500 text-sm max-w-xl mb-8 font-mono">
            Automatisch erkennen · Kontinuierlich monitoren · Immer nachweisbar
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/app')}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-security-600 text-white font-semibold hover:bg-security-500 transition-colors"
            >
              Dashboard öffnen
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => navigate('/audit?source=public-workspace')}
              className="flex items-center justify-center gap-2 px-6 py-3 border border-titanium-700 text-titanium-100 font-medium hover:bg-obsidian-800 transition-colors"
            >
              Kostenlos prüfen
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              to="/docs"
              className="flex items-center justify-center gap-2 px-6 py-3 text-titanium-400 hover:text-titanium-200 text-sm font-medium transition-colors"
            >
              Dokumentation →
            </Link>
          </div>
        </div>
      </div>

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
