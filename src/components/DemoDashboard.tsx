/**
 * DemoDashboard — öffentliche Read-Only-Vorschau von DemoAI GmbH.
 *
 * Zeigt echte Governance-OS-Daten ohne Login, mit Lock-Banner und
 * Registrierungs-Prompts bei gesperrten Aktionen.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock, ArrowRight, AlertTriangle, CheckCircle2, Clock,
  BarChart3, Zap, Shield, Bot, FileText,
} from 'lucide-react';
import { useDemoMode } from '../core/demo/DemoModeProvider';

export function DemoDashboard() {
  const navigate = useNavigate();
  const { demoWorkspace } = useDemoMode();
  const org = demoWorkspace.org;
  const risks = demoWorkspace.risks;
  const compliance = demoWorkspace.compliance;
  const monitoring = demoWorkspace.monitoring;
  const aiSystems = demoWorkspace.aiSystems;

  const risksByStatus = {
    open: risks.filter((r) => r.status === 'open').length,
    inProgress: risks.filter((r) => r.status === 'in-progress').length,
    resolved: risks.filter((r) => r.status === 'resolved').length,
  };

  const handleBlockedAction = () => {
    navigate('/welcome?source=demo-action-blocked');
  };

  return (
    <div className="flex flex-col h-full bg-obsidian-950">
      {/* Lock-Banner */}
      <div className="shrink-0 border-b border-titanium-800 bg-obsidian-900/50 px-4 sm:px-6 py-3 flex items-center gap-2 text-xs text-titanium-400">
        <Lock className="h-3.5 w-3.5" />
        <span>Öffentliche Demo-Vorschau von {org.name}</span>
        <button
          onClick={handleBlockedAction}
          className="ml-auto text-cyan-400 hover:text-cyan-300 font-semibold underline underline-offset-2"
        >
          Kostenlos registrieren
        </button>
      </div>

      {/* Hero Stats */}
      <div className="shrink-0 border-b border-titanium-800 px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <p className="text-titanium-500 text-sm mb-1">Governance Score</p>
              <div className="flex items-baseline gap-3">
                <span className="font-display font-bold text-4xl text-titanium-50">{org.governanceScore}</span>
                <span className="text-sm text-emerald-400">
                  <span className="inline-flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5" />↑ {org.trend}
                  </span>
                </span>
              </div>
            </div>
            <p className="text-titanium-400 max-w-2xl text-sm">{org.description}</p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border border-titanium-800 bg-obsidian-900 p-3 rounded-none">
              <p className="text-titanium-500 text-xs mb-1">Offene Risiken</p>
              <p className="font-display font-bold text-xl text-amber-300">{risksByStatus.open}</p>
            </div>
            <div className="border border-titanium-800 bg-obsidian-900 p-3 rounded-none">
              <p className="text-titanium-500 text-xs mb-1">In Bearbeitung</p>
              <p className="font-display font-bold text-xl text-blue-300">{risksByStatus.inProgress}</p>
            </div>
            <div className="border border-titanium-800 bg-obsidian-900 p-3 rounded-none">
              <p className="text-titanium-500 text-xs mb-1">AI-Systeme</p>
              <p className="font-display font-bold text-xl text-cyan-300">{aiSystems.length}</p>
            </div>
            <div className="border border-titanium-800 bg-obsidian-900 p-3 rounded-none">
              <p className="text-titanium-500 text-xs mb-1">Scans (24h)</p>
              <p className="font-display font-bold text-xl text-emerald-300">{monitoring.scansLast24h}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Risk Register */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
              <h2 className="font-display font-bold text-lg text-titanium-50">Risk Register</h2>
              <span className="ml-auto text-xs text-titanium-500">{risks.length} Risiken insgesamt</span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {risks.slice(0, 8).map((risk) => (
                <div
                  key={risk.id}
                  className="border border-titanium-800 bg-obsidian-900 p-3 flex items-start gap-3 hover:border-titanium-700 transition-colors"
                >
                  <div
                    className={`h-3 w-3 mt-0.5 rounded-full shrink-0 ${
                      risk.severity === 'critical' ? 'bg-red-500' :
                      risk.severity === 'high' ? 'bg-orange-400' :
                      risk.severity === 'medium' ? 'bg-yellow-400' :
                      'bg-blue-400'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-titanium-100 font-medium">{risk.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-titanium-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {risk.daysOpen}d
                      </span>
                      <span className={`px-2 py-0.5 rounded-none text-[10px] font-mono ${
                        risk.status === 'open' ? 'bg-amber-900/30 text-amber-300' :
                        risk.status === 'in-progress' ? 'bg-blue-900/30 text-blue-300' :
                        'bg-emerald-900/30 text-emerald-300'
                      }`}>
                        {risk.status === 'open' ? 'OFFEN' :
                         risk.status === 'in-progress' ? 'IN BEARBEITUNG' :
                         'GELÖST'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* AI Registry */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Bot className="h-5 w-5 text-cyan-300" />
              <h2 className="font-display font-bold text-lg text-titanium-50">AI Registry</h2>
            </div>
            <div className="space-y-2">
              {aiSystems.map((ai) => (
                <div
                  key={ai.id}
                  className="border border-titanium-800 bg-obsidian-900 p-3 flex items-start gap-3"
                >
                  <div
                    className={`h-2.5 w-2.5 mt-1 rounded-full shrink-0 ${
                      ai.class === 'high-risk' ? 'bg-red-500' :
                      ai.class === 'limited-risk' ? 'bg-yellow-400' :
                      'bg-green-400'
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-titanium-100">{ai.name}</p>
                    <p className="text-xs text-titanium-400 mt-0.5">{ai.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] font-mono px-2 py-1 rounded-none ${
                      ai.status === 'compliant' ? 'bg-emerald-900/30 text-emerald-300' :
                      'bg-amber-900/30 text-amber-300'
                    }`}>
                      {ai.status === 'compliant' ? 'KONFORM' : 'NICHT KONFORM'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Compliance Status */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-security-300" />
              <h2 className="font-display font-bold text-lg text-titanium-50">Compliance Status</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border border-titanium-800 bg-obsidian-900 p-4">
                <p className="text-sm text-titanium-500 mb-3">DSGVO</p>
                <div className="flex items-end gap-4">
                  <div>
                    <p className="font-display font-bold text-3xl text-cyan-300">{compliance.dsgvo.percent}%</p>
                    <p className="text-xs text-titanium-500 mt-1">{compliance.dsgvo.open} offene Punkte</p>
                  </div>
                  <div className="flex-1 h-2 bg-titanium-800">
                    <div className="h-full bg-cyan-400" style={{ width: `${compliance.dsgvo.percent}%` }} />
                  </div>
                </div>
              </div>
              <div className="border border-titanium-800 bg-obsidian-900 p-4">
                <p className="text-sm text-titanium-500 mb-3">EU AI Act</p>
                <div className="flex items-end gap-4">
                  <div>
                    <p className="font-display font-bold text-3xl text-purple-300">{compliance.aiAct.percent}%</p>
                    <p className="text-xs text-titanium-500 mt-1">{compliance.aiAct.open} offene Punkte</p>
                  </div>
                  <div className="flex-1 h-2 bg-titanium-800">
                    <div className="h-full bg-purple-400" style={{ width: `${compliance.aiAct.percent}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Monitoring */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-emerald-300" />
              <h2 className="font-display font-bold text-lg text-titanium-50">Monitoring (24h)</h2>
            </div>
            <div className="border border-titanium-800 bg-obsidian-900 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-titanium-400">Scans durchgeführt</span>
                <span className="font-display font-bold text-titanium-50">{monitoring.scansLast24h}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-titanium-400">Neue Tracker erkannt</span>
                <span className="font-display font-bold text-amber-300">{monitoring.newTrackersDetected}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-titanium-400">Consent-Drifts</span>
                <span className="font-display font-bold text-orange-300">{monitoring.consentDrifts}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="shrink-0 border-t border-titanium-800 bg-obsidian-900 px-4 sm:px-6 py-4">
        <button
          onClick={handleBlockedAction}
          className="w-full flex items-center justify-center gap-2 bg-cyan-400 text-obsidian-950 px-6 py-3 text-sm font-semibold rounded-none hover:bg-cyan-300 transition-colors"
        >
          Vollständigen Governance OS kostenlos testen
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
