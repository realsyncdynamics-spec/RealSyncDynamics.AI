/**
 * GovernanceBrowserPage — öffentliche, read-only Sicht auf die Governance-OS-Architektur.
 *
 * Zeigt Agenten, Approvals, Evidence, Risiken, Workflows, Connectoren der Demo-Org
 * (DemoAI GmbH). Alle Daten aus statischen Fixtures — keine Auth nötig.
 *
 * Tabs navigieren zwischen Übersichten; Daten werden aus bestehenden Views eingebettet.
 */
import React, { useState, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock, Bot, CheckCircle2, AlertTriangle, GitMerge, Plug, ArrowRight, X,
} from 'lucide-react';
import { DEMO_AI_GMBH } from '../lib/demo/demoAiGmbhFixture';
import { DEMO_AGENTS } from '../features/governance/agents/demoAgents';
import { AgentCard } from '../features/governance/agents/AgentCard';
import { BrowserNav } from '../components/GovernanceBrowser/BrowserNav';
import { AgentPeekPanel } from '../components/GovernanceBrowser/AgentPeekPanel';
import { WorkflowDiscoveryPanel } from '../components/GovernanceBrowser/WorkflowDiscoveryPanel';
import { ApprovalsView } from '../features/governance/ApprovalsView';
import { AuditorConsoleView } from '../features/governance/AuditorConsoleView';
import { ConnectorsView } from '../features/governance/ConnectorsView';

type Tab = 'agents' | 'approvals' | 'evidence' | 'risks' | 'workflows' | 'connectors';

export function GovernanceBrowserPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('agents');

  return (
    <div className="flex flex-col h-screen bg-obsidian-950 text-titanium-100">
      {/* Lock Banner */}
      <div className="shrink-0 border-b border-titanium-800 bg-obsidian-900/50 px-4 sm:px-6 py-3 flex items-center gap-2 text-xs text-titanium-400">
        <Lock className="h-3.5 w-3.5" />
        <span>Öffentliche Governance Browser Vorschau von {DEMO_AI_GMBH.org.name}</span>
        <button
          onClick={() => navigate('/welcome?source=governance-browser')}
          className="ml-auto text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2"
        >
          Kostenlos registrieren
        </button>
      </div>

      {/* Header */}
      <div className="shrink-0 border-b border-titanium-800 bg-obsidian-900 px-4 sm:px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-display font-bold text-2xl text-titanium-50 mb-2">
            Governance Browser
          </h1>
          <p className="text-sm text-titanium-400">
            Erkennen Sie alle Agenten, Freigaben, Nachweise und Workflows, die in der Governance OS laufen.
          </p>
        </div>
      </div>

      {/* Nav Tabs */}
      <BrowserNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-6xl mx-auto">
          {activeTab === 'agents' && (
            <div>
              <h2 className="font-display font-bold text-lg text-titanium-50 mb-4 flex items-center gap-2">
                <Bot className="h-5 w-5 text-cyan-300" />
                Governance-Agenten ({DEMO_AGENTS.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {DEMO_AGENTS.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'approvals' && (
            <div>
              <h2 className="font-display font-bold text-lg text-titanium-50 mb-4 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                Freigaben (Approvals)
              </h2>
              <Suspense fallback={<div className="text-titanium-400">Laden …</div>}>
                <ApprovalsView />
              </Suspense>
            </div>
          )}

          {activeTab === 'evidence' && (
            <div>
              <h2 className="font-display font-bold text-lg text-titanium-50 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-security-300" />
                Evidence & Audit Trail
              </h2>
              <Suspense fallback={<div className="text-titanium-400">Laden …</div>}>
                <AuditorConsoleView />
              </Suspense>
            </div>
          )}

          {activeTab === 'risks' && (
            <div>
              <h2 className="font-display font-bold text-lg text-titanium-50 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-300" />
                Risiken & KI-Einstufungen
              </h2>
              <div className="space-y-3">
                {DEMO_AI_GMBH.aiSystems.map((ai) => (
                  <div key={ai.id} className="border border-titanium-800 bg-obsidian-900 p-4 rounded-none">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-titanium-50">{ai.name}</h3>
                        <p className="text-xs text-titanium-400 mt-1">{ai.description}</p>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-1 rounded-none ${
                          ai.class === 'high-risk'
                            ? 'bg-red-900/30 text-red-300'
                            : ai.class === 'limited-risk'
                              ? 'bg-amber-900/30 text-amber-300'
                              : 'bg-emerald-900/30 text-emerald-300'
                        }`}
                      >
                        {ai.class === 'high-risk' ? 'HIGH-RISK' : ai.class === 'limited-risk' ? 'LIMITED' : 'MINIMAL'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'workflows' && (
            <div>
              <h2 className="font-display font-bold text-lg text-titanium-50 mb-4 flex items-center gap-2">
                <GitMerge className="h-5 w-5 text-blue-300" />
                Workflows (n8n)
              </h2>
              <WorkflowDiscoveryPanel />
            </div>
          )}

          {activeTab === 'connectors' && (
            <div>
              <h2 className="font-display font-bold text-lg text-titanium-50 mb-4 flex items-center gap-2">
                <Plug className="h-5 w-5 text-purple-300" />
                Connectoren
              </h2>
              <Suspense fallback={<div className="text-titanium-400">Laden …</div>}>
                <ConnectorsView />
              </Suspense>
            </div>
          )}
        </div>
      </div>

      {/* Footer CTA */}
      <div className="shrink-0 border-t border-titanium-800 bg-obsidian-900 px-4 sm:px-6 py-4">
        <button
          onClick={() => navigate('/welcome?source=governance-browser-cta')}
          className="w-full flex items-center justify-center gap-2 bg-cyan-400 text-obsidian-950 px-6 py-3 text-sm font-semibold rounded-none hover:bg-cyan-300 transition-colors"
        >
          Vollständigen Governance Browser kostenlos testen
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
