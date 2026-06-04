import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe, Bot, AlertTriangle, ClipboardCheck, FileCheck2,
  Activity, Users, Settings, ArrowRight, Lock, Zap,
} from 'lucide-react';
import { DemoDashboard } from '../components/DemoDashboard';
import { useDemoMode } from '../core/demo/DemoModeProvider';

interface Tile {
  id: string;
  label: string;
  description: string;
  icon: typeof Globe;
  color: 'cyan' | 'blue' | 'orange' | 'emerald' | 'purple' | 'amber' | 'rose' | 'indigo';
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
    description: 'Echtzeit-Überwachung und Performance-Metriken',
    icon: Activity,
    color: 'amber',
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
  cyan: { bg: 'bg-cyan-950/30', icon: 'text-cyan-400', hover: 'hover:bg-cyan-950/50' },
  blue: { bg: 'bg-security-950/30', icon: 'text-security-400', hover: 'hover:bg-security-950/50' },
  orange: { bg: 'bg-orange-950/30', icon: 'text-orange-400', hover: 'hover:bg-orange-950/50' },
  emerald: { bg: 'bg-emerald-950/30', icon: 'text-emerald-400', hover: 'hover:bg-emerald-950/50' },
  purple: { bg: 'bg-purple-950/30', icon: 'text-purple-400', hover: 'hover:bg-purple-950/50' },
  amber: { bg: 'bg-amber-950/30', icon: 'text-amber-400', hover: 'hover:bg-amber-950/50' },
  rose: { bg: 'bg-rose-950/30', icon: 'text-rose-400', hover: 'hover:bg-rose-950/50' },
  indigo: { bg: 'bg-indigo-950/30', icon: 'text-indigo-400', hover: 'hover:bg-indigo-950/50' },
};

export function PublicWorkspacePreview() {
  const navigate = useNavigate();
  const { isDemoMode, setDemoMode } = useDemoMode();
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    if (showDemo && !isDemoMode) {
      setDemoMode(true);
    }
  }, [showDemo, isDemoMode, setDemoMode]);

  if (showDemo && isDemoMode) {
    return (
      <div className="flex flex-col h-screen bg-obsidian-950">
        <div className="flex-1 overflow-y-auto">
          <DemoDashboard />
        </div>
        <div className="shrink-0 flex justify-center gap-3 p-4 bg-obsidian-900 border-t border-titanium-800">
          <button
            onClick={() => setShowDemo(false)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-titanium-700 text-titanium-100 rounded-none hover:bg-obsidian-800 transition-colors"
          >
            ← Zurück zu Übersicht
          </button>
          <button
            onClick={() => navigate('/welcome?source=demo-action-blocked')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-cyan-400 text-obsidian-950 rounded-none hover:bg-cyan-300 transition-colors"
          >
            Kostenlos registrieren
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-obsidian-900 to-obsidian-950 border-b border-titanium-900 px-4 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="h-5 w-5 text-security-400" />
            <span className="text-xs font-mono uppercase tracking-wider text-titanium-500">Öffentliche Vorschau</span>
          </div>
          <h1 className="font-display font-bold text-3xl sm:text-4xl mb-2 text-titanium-50">
            Governance OS
          </h1>
          <p className="text-titanium-400 max-w-2xl mb-6">
            Europäisches Governance Operating System für Unternehmen, Agenturen und Behörden. Websites, AI Registry, Risk Register, Evidence Chain und Compliance in einer einheitlichen Oberfläche.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowDemo(true)}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-cyan-400 text-obsidian-950 font-medium rounded-none hover:bg-cyan-300 transition-colors"
            >
              <Zap className="h-4 w-4" />
              Live Demo anschauen
            </button>
            <button
              onClick={() => navigate('/audit?source=public-workspace')}
              className="flex items-center justify-center gap-2 px-6 py-2.5 border border-titanium-700 text-titanium-100 font-medium rounded-none hover:bg-obsidian-800 transition-colors"
            >
              Audit starten
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tiles Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TILES.map((tile) => {
            const Icon = tile.icon;
            const colors = COLOR_MAP[tile.color];

            return (
              <div
                key={tile.id}
                className={`p-6 border border-titanium-800 rounded-none ${colors.bg} ${colors.hover} transition-colors cursor-default group`}
              >
                <div className={`h-10 w-10 rounded-none ${colors.icon} text-opacity-80 group-hover:text-opacity-100 mb-4 transition-all`}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold text-titanium-50 mb-1">{tile.label}</h3>
                <p className="text-sm text-titanium-400 leading-snug">{tile.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Info */}
      <div className="bg-obsidian-900 border-t border-titanium-900 px-4 py-8 mt-12">
        <div className="max-w-6xl mx-auto text-center text-sm text-titanium-500">
          <p>Dies ist eine öffentliche Vorschau der Governance-OS-Plattform. Melden Sie sich an, um Zugriff auf alle Features zu erhalten.</p>
        </div>
      </div>
    </div>
  );
}
