// Modul-Hub — die Capability-Übersicht des Governance OS (/app/modules).
//
// Produktprinzip: Der Kunde erlebt EIN Produkt. Chatbot, Telefon-Agent,
// Agent Runtime, Website-Builder und Governance-Flächen sind Capabilities
// des Workspaces — aktiviert wird zentral über den Plan (Stripe → Webhook →
// Entitlement), nicht über Einzelverkäufe auf der öffentlichen Website.
//
// Zugriffslogik: ausschließlich Gates aus der Pricing-SSoT
// (`shared/pricing.ts` via `canAccessModule`) — keine eigene Plan-Liste,
// sonst driften Hub und Pricing auseinander (siehe governanceModules.ts).
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { resolvePlan } from '@/shared/pricing';
import {
  canAccessModule,
  minimumPlanLabelForModule,
} from '../../components/governance-os/governanceModules';
import type { GovernanceModule } from '../../components/governance-os/governanceBrowserTypes';
import { useActivePlan } from '../../hooks/useModuleAccess';

function icon(name: string): Icons.LucideIcon {
  return (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Circle;
}

/** Hub-Eintrag: ein Navigations-Modul plus Hub-spezifische Darstellung. */
export interface HubEntry extends GovernanceModule {
  /** Beschriftung der Aktion, wenn das Modul freigeschaltet ist. */
  openLabel: 'Öffnen' | 'Verwalten';
}

export interface HubSection {
  id: string;
  label: string;
  entries: HubEntry[];
}

// Gates spiegeln die Pricing-SSoT: `module`-Gates prüfen `plan.modules`,
// `all` sind Flächen, die jeder Workspace hat (Free Audit eingeschlossen).
export const HUB_SECTIONS: HubSection[] = [
  {
    id: 'ai-automation',
    label: 'AI & Automation',
    entries: [
      {
        id: 'website-chatbot',
        label: 'Website Chatbot',
        icon: 'MessageSquare',
        route: '/app/bots',
        status: 'live',
        gate: { kind: 'module', module: 'website_chat' },
        description: 'Chat auf der eigenen Website — antwortet nur aus dem Unternehmenskontext, jede Antwort im Prüfpfad.',
        openLabel: 'Öffnen',
      },
      {
        id: 'telefon-agent',
        label: 'Telefon-Agent',
        icon: 'Phone',
        route: '/app/agents/susi',
        status: 'live',
        gate: { kind: 'module', module: 'voice' },
        description: 'Sprachkanal mit Speech-to-Text, Text-to-Speech und Übergabe an Menschen.',
        openLabel: 'Öffnen',
      },
      {
        id: 'whatsapp-bot',
        label: 'WhatsApp Bot',
        icon: 'MessageCircle',
        route: '/app/bots',
        status: 'live',
        gate: { kind: 'module', module: 'whatsapp' },
        description: 'WhatsApp-Business-Kanal mit identischem Governance-Protokoll.',
        openLabel: 'Öffnen',
      },
      {
        id: 'agent-runtime',
        label: 'Agent Runtime',
        icon: 'Cpu',
        route: '/app/ai-systems/agents',
        status: 'live',
        gate: { kind: 'module', module: 'automation_engine' },
        description: 'Autonome Agenten mit Identity, Policy, Runtime und Observability.',
        openLabel: 'Öffnen',
      },
    ],
  },
  {
    id: 'website',
    label: 'Website',
    entries: [
      {
        id: 'landingpage-builder',
        label: 'Landingpage Builder',
        icon: 'LayoutTemplate',
        route: '/app/siteos',
        status: 'live',
        gate: { kind: 'all' },
        description: 'SiteOS: Prompt → geprüfter Blueprint → Publish Gate.',
        openLabel: 'Öffnen',
      },
      {
        id: 'websites-domains',
        label: 'Websites & Domains',
        icon: 'Globe',
        route: '/app/websites',
        status: 'live',
        gate: { kind: 'all' },
        description: 'Domains, Scans und Findings je Website.',
        openLabel: 'Verwalten',
      },
    ],
  },
  {
    id: 'governance',
    label: 'Governance',
    entries: [
      {
        id: 'risk',
        label: 'Risk',
        icon: 'AlertTriangle',
        route: '/app/risks',
        status: 'live',
        gate: { kind: 'module', module: 'risk_register' },
        description: 'Zentrales Risikoregister mit Bewertung, Eigentümern und Maßnahmen.',
        openLabel: 'Öffnen',
      },
      {
        id: 'monitoring',
        label: 'Monitoring',
        icon: 'Activity',
        route: '/app/monitoring',
        status: 'live',
        gate: { kind: 'module', module: 'monitoring' },
        description: 'Kontinuierliche Runtime-Überwachung von Assets, Kontrollen und SLOs.',
        openLabel: 'Öffnen',
      },
      {
        id: 'evidence',
        label: 'Evidence',
        icon: 'FileCheck2',
        route: '/app/evidence',
        status: 'live',
        gate: { kind: 'all' },
        description: 'Manipulationssicherer Nachweisspeicher mit Hash-Chain und Prüfpfad.',
        openLabel: 'Öffnen',
      },
      {
        id: 'policies',
        label: 'Policies',
        icon: 'Scale',
        route: '/app/policy-packs',
        status: 'live',
        gate: { kind: 'module', module: 'dsgvo' },
        description: 'Policy Packs: DSGVO, EU AI Act und branchenspezifische Rahmenwerke.',
        openLabel: 'Öffnen',
      },
    ],
  },
];

function EntryRow({ entry, plan, loading }: { entry: HubEntry; plan: string; loading: boolean }) {
  const Icon = icon(entry.icon);
  const active = canAccessModule(entry, plan);

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-obsidian-900 border border-titanium-900 hover:border-titanium-800 transition-colors">
      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-cyan-400' : 'text-titanium-700'}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${active ? 'text-titanium-100' : 'text-titanium-400'}`}>
            {entry.label}
          </span>
          {!active && !loading && (
            <span className="font-mono text-[9px] uppercase tracking-widest text-titanium-600 border border-titanium-800 px-1.5 py-0.5">
              Ab {minimumPlanLabelForModule(entry)}
            </span>
          )}
        </div>
        <p className="text-xs text-titanium-500 truncate">{entry.description}</p>
      </div>
      {loading ? (
        <span className="font-mono text-[10px] text-titanium-700 px-3 py-1.5">…</span>
      ) : active ? (
        <Link
          to={entry.route}
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-titanium-100 border border-titanium-700 hover:border-cyan-400 hover:text-cyan-400 transition-colors"
        >
          {entry.openLabel}
        </Link>
      ) : (
        <Link
          to="/app/billing"
          className="shrink-0 px-3 py-1.5 text-xs font-medium text-obsidian-950 bg-titanium-100 hover:bg-cyan-400 transition-colors"
        >
          Aktivieren
        </Link>
      )}
    </div>
  );
}

/**
 * Capability-Übersicht des Workspaces: was ist im Plan aktiv (→ Öffnen),
 * was nicht (→ Aktivieren über das zentrale Billing). Kein manuelles
 * Freischalten — nach Stripe-Checkout aktualisiert der Webhook die
 * Entitlements und die Fläche ist sofort verfügbar.
 */
export function ModulesHubView() {
  const { plan, loading } = useActivePlan();
  const planName = resolvePlan(plan)?.name ?? 'Free Audit';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-600 mb-1">
            Governance OS
          </p>
          <h1 className="text-xl font-bold text-titanium-50">Module</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-titanium-400">
            Plan: <span className="text-titanium-100">{loading ? '…' : planName}</span>
          </span>
          <Link
            to="/app/billing"
            className="px-3 py-1.5 text-xs font-medium text-titanium-300 border border-titanium-800 hover:border-titanium-600 hover:text-titanium-100 transition-colors"
          >
            Plan ändern
          </Link>
        </div>
      </div>

      {HUB_SECTIONS.map((section) => (
        <section key={section.id} aria-label={section.label}>
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-titanium-600 mb-2">
            {section.label}
          </h2>
          <div className="space-y-1.5">
            {section.entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} plan={plan} loading={loading} />
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-titanium-600 border-t border-titanium-900 pt-4">
        Aktivierung läuft zentral über den Plan: Upgrade → Stripe → Webhook →
        Entitlement — die Fläche ist danach sofort verfügbar, ohne manuelles Freischalten.
      </p>
    </div>
  );
}
