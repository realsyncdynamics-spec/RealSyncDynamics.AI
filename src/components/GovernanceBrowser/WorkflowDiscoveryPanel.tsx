/**
 * WorkflowDiscoveryPanel — Übersicht verfügbarer Workflows.
 *
 * Zeigt demo-Workflows mit Trigger-Config, Status, letztem Run.
 * Quelle: bestehende WorkflowsView Supabase-Abfragen.
 */
import { Clock, Play, Pause, ExternalLink } from 'lucide-react';

interface DemoWorkflow {
  id: string;
  title: string;
  description: string;
  trigger: string;
  is_active: boolean;
  last_run_at: string | null;
  run_count: number;
}

const DEMO_WORKFLOWS: DemoWorkflow[] = [
  {
    id: 'wf-dsgvo-alert',
    title: 'DSGVO-Meldepflicht-Timer',
    description: 'Triggert bei Incident → Status=open. Sendet Warnung an DPO.',
    trigger: 'incident.status → open',
    is_active: true,
    last_run_at: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
    run_count: 47,
  },
  {
    id: 'wf-ai-report',
    title: 'AI-Risk-Wochenbericht',
    description: 'Klassifiziert neue KI-Endpunkte. Läuft jeden Montag um 8:00.',
    trigger: 'cron 0 8 * * MON',
    is_active: false,
    last_run_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    run_count: 12,
  },
  {
    id: 'wf-evidence-chain',
    title: 'Evidence-Chain Verifizierung',
    description: 'Prüft Hash-Chain Integrität nach jedem Audit.',
    trigger: 'audit_run.status → complete',
    is_active: true,
    last_run_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    run_count: 156,
  },
];

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const seconds = (now.getTime() - date.getTime()) / 1000;

  if (seconds < 60) return 'gerade eben';
  if (seconds < 3600) return `vor ${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `vor ${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `vor ${Math.floor(seconds / 86400)}d`;
  return `vor ${Math.floor(seconds / 604800)}w`;
}

export function WorkflowDiscoveryPanel() {
  return (
    <div className="space-y-3">
      {DEMO_WORKFLOWS.map((wf) => (
        <div
          key={wf.id}
          className="border border-titanium-800 bg-obsidian-900 p-4 rounded-none hover:border-titanium-700 transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-titanium-50">{wf.title}</h3>
                {wf.is_active ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 bg-emerald-900/30 text-emerald-300 rounded-none">
                    <Play className="h-2.5 w-2.5" />
                    AKTIV
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 bg-titanium-900/30 text-titanium-400 rounded-none">
                    <Pause className="h-2.5 w-2.5" />
                    PAUSIERT
                  </span>
                )}
              </div>
              <p className="text-xs text-titanium-400 mb-2">{wf.description}</p>

              <div className="flex items-center gap-4 text-xs text-titanium-500">
                <div>
                  <span className="font-mono text-[10px] text-titanium-600">TRIGGER:</span>
                  <p className="text-titanium-400 font-mono text-[10px] mt-0.5">{wf.trigger}</p>
                </div>
                <div>
                  <span className="font-mono text-[10px] text-titanium-600">RUNS:</span>
                  <p className="text-titanium-400 font-mono text-[10px] mt-0.5">{wf.run_count}</p>
                </div>
                {wf.last_run_at && (
                  <div className="flex items-center gap-1 text-titanium-600">
                    <Clock className="h-3 w-3" />
                    <span className="text-[10px]">{formatRelativeTime(wf.last_run_at)}</span>
                  </div>
                )}
              </div>
            </div>

            <a
              href="https://n8n.RealSyncDynamicsAI.de"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 p-2 text-titanium-400 hover:text-cyan-300 hover:bg-obsidian-800 rounded-none transition-colors"
              title="Im n8n-Editor öffnen"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      ))}

      <div className="border border-titanium-800/50 bg-obsidian-900/30 p-4 rounded-none text-center">
        <p className="text-xs text-titanium-500 mb-2">
          💡 Diese Workflows sind Templates. Registrieren Sie sich, um Custom-Workflows zu erstellen.
        </p>
      </div>
    </div>
  );
}
