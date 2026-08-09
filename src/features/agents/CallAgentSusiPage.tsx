import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Phone, Loader2, AlertTriangle, Mic } from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import { AgentActionLogTable } from './components/AgentActionLogTable';

// ─── Typen aus der DB-Schema-Migration ───────────────────────────────────────

interface KnowledgeBaseEntry {
  id: string;
  agent_id: string | null;
  tenant_id: string | null;
  source_type: string | null;
  title: string | null;
  content: string | null;
  tags: string[];
  created_at: string;
}

interface AgentActionLog {
  id: string;
  created_at: string;
  action_type: string;
  status: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  agent_id: string | null;
}

// ─── Tab-Konfiguration ────────────────────────────────────────────────────────

type TabId = 'voice' | 'scripts' | 'logs' | 'tasks' | 'handover';

const TABS: { id: TabId; label: string }[] = [
  { id: 'voice', label: 'Voice-Einstellungen' },
  { id: 'scripts', label: 'Gesprächsskripte' },
  { id: 'logs', label: 'Anruf-Protokolle' },
  { id: 'tasks', label: 'Follow-up-Aufgaben' },
  { id: 'handover', label: 'Übergabe-Regeln' },
];

// ─── Hilfsfunktion: Datum formatieren ────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Lade-Indikator ───────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-titanium-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Lade Daten…</span>
    </div>
  );
}

// ─── Fehlermeldung ────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 text-sm text-rose-300 bg-rose-950/40 border border-rose-900 p-3">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

// ─── Leerer-Zustand ───────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <p className="text-sm text-titanium-500 py-8 text-center">{label}</p>
  );
}

// ─── Status-Badge ─────────────────────────────────────────────────────────────

const STATUS_CLASS: Record<string, string> = {
  success: 'border-green-800 text-green-400',
  done: 'border-green-800 text-green-400',
  error: 'border-rose-900 text-rose-400',
  pending: 'border-amber-800 text-amber-400',
  open: 'border-amber-800 text-amber-400',
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-titanium-600">—</span>;
  const cls = STATUS_CLASS[status.toLowerCase()] ?? 'border-titanium-800 text-titanium-400';
  return (
    <span className={`font-mono text-[10px] uppercase px-1.5 py-0.5 border ${cls}`}>
      {status}
    </span>
  );
}

// ─── Read-only-Zeile (Voice-Einstellungen) ────────────────────────────────────

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <span className="text-xs font-mono uppercase tracking-widest text-titanium-500">{label}</span>
      <span className="text-sm text-titanium-200">{value}</span>
    </div>
  );
}

// ─── Übergabe-Regel-Karte ─────────────────────────────────────────────────────

function HandoverRuleCard({ trigger, target }: { trigger: string; target: string }) {
  return (
    <div className="border border-titanium-800 bg-obsidian-950 p-4 space-y-1">
      <p className="text-sm text-titanium-200">{trigger}</p>
      <p className="font-mono text-[11px] uppercase tracking-widest text-cyan-400">
        → {target}
      </p>
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function CallAgentSusiPage() {
  const { activeTenantId } = useTenant();
  const [activeTab, setActiveTab] = useState<TabId>('voice');

  // Gesprächsskripte
  const [scripts, setScripts] = useState<KnowledgeBaseEntry[] | null>(null);
  const [scriptsError, setScriptsError] = useState<string | null>(null);

  // Anruf-Protokolle
  const [callLogs, setCallLogs] = useState<AgentActionLog[] | null>(null);
  const [callLogsError, setCallLogsError] = useState<string | null>(null);

  // Follow-up-Aufgaben
  const [tasks, setTasks] = useState<AgentActionLog[] | null>(null);
  const [tasksError, setTasksError] = useState<string | null>(null);

  // Gesprächsskripte laden: globale Einträge (tenant_id NULL) + eigene Tenant-Einträge
  useEffect(() => {
    if (activeTab !== 'scripts' || !activeTenantId) return;
    let cancelled = false;
    setScripts(null);
    setScriptsError(null);
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from('agent_knowledge_base')
          .select('id, agent_id, tenant_id, source_type, title, content, tags, created_at')
          .eq('source_type', 'call_script')
          .or(`tenant_id.is.null,tenant_id.eq.${activeTenantId}`)
          .order('created_at', { ascending: false });
        if (!cancelled) {
          if (error) setScriptsError(error.message);
          else setScripts(data ?? []);
        }
      } catch (e) {
        if (!cancelled) setScriptsError((e as Error)?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, activeTenantId]);

  // Anruf-Protokolle laden (tenant-isoliert)
  useEffect(() => {
    if (activeTab !== 'logs' || !activeTenantId) return;
    let cancelled = false;
    setCallLogs(null);
    setCallLogsError(null);
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from('agent_actions_log')
          .select('id, created_at, action_type, status, input, output, agent_id')
          .eq('tenant_id', activeTenantId)
          .eq('action_type', 'voice_call')
          .order('created_at', { ascending: false })
          .limit(50);
        if (!cancelled) {
          if (error) setCallLogsError(error.message);
          else setCallLogs(data ?? []);
        }
      } catch (e) {
        if (!cancelled) setCallLogsError((e as Error)?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, activeTenantId]);

  // Follow-up-Aufgaben laden (tenant-isoliert)
  useEffect(() => {
    if (activeTab !== 'tasks' || !activeTenantId) return;
    let cancelled = false;
    setTasks(null);
    setTasksError(null);
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from('agent_actions_log')
          .select('id, created_at, action_type, status, input, output, agent_id')
          .eq('tenant_id', activeTenantId)
          .eq('action_type', 'call_followup')
          .order('created_at', { ascending: false })
          .limit(50);
        if (!cancelled) {
          if (error) setTasksError(error.message);
          else setTasks(data ?? []);
        }
      } catch (e) {
        if (!cancelled) setTasksError((e as Error)?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, activeTenantId]);

  return (
    <div className="space-y-6">
      {/* Navigation zurück */}
      <Link
        to="/app/agents"
        className="inline-flex items-center gap-1.5 text-xs text-titanium-400 hover:text-titanium-100"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Zurück zu Agents
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-9 w-9 border border-titanium-800 bg-obsidian-950 text-cyan-400">
          <Phone className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-titanium-50">Call Agent Susi</h1>
            <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border border-amber-700 text-amber-400">
              Beta
            </span>
          </div>
          <p className="text-xs text-titanium-500">
            Voice-Layer · ElevenLabs · Deutsche weibliche Stimme mit Fallback
          </p>
        </div>
      </div>

      {/* Tab-Leiste */}
      <div className="flex border-b border-titanium-800 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ' +
              (activeTab === tab.id
                ? 'border-[#0052FF] text-titanium-50'
                : 'border-transparent text-titanium-400 hover:text-titanium-200 hover:border-titanium-600')
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Voice-Einstellungen */}
      {activeTab === 'voice' && (
        <div className="space-y-4">
          <div className="border border-titanium-800 bg-obsidian-950 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-titanium-100">Stimmen-Auswahl</h2>
            </div>
            <p className="text-sm text-titanium-400">
              Bevorzugte Stimme: ElevenLabs „Susi" (falls im verbundenen Account
              verfügbar) — sonst automatische Auswahl einer klaren weiblichen
              deutschen Stimme über die ElevenLabs Voice Search API.
            </p>
          </div>

          <div className="border border-titanium-800 bg-obsidian-950">
            <div className="flex items-center justify-between gap-3 p-3 border-b border-titanium-900">
              <span className="text-xs font-mono uppercase tracking-widest text-titanium-500">
                ElevenLabs-Integration
              </span>
              <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 border border-amber-800 text-amber-400">
                Nicht konfiguriert
              </span>
            </div>
            <p className="text-xs text-titanium-500 p-3">
              Der <span className="font-mono">ELEVENLABS_API_KEY</span> wird als
              Edge-Function-Secret hinterlegt (<span className="font-mono">supabase secrets set</span>) —
              niemals im Frontend. Alle Voice-Calls laufen serverseitig über Edge Functions.
            </p>
          </div>

          <div className="border border-titanium-800 bg-obsidian-950 divide-y divide-titanium-900">
            <SettingRow label="Sprache" value="Deutsch (de-DE)" />
            <SettingRow label="Geschlecht" value="Weiblich" />
            <SettingRow label="Stil" value="Klar & professionell" />
          </div>
        </div>
      )}

      {/* Gesprächsskripte */}
      {activeTab === 'scripts' && (
        <div>
          {!activeTenantId && <EmptyState label="Kein aktiver Tenant ausgewählt." />}
          {activeTenantId && scripts === null && !scriptsError && <LoadingState />}
          {scriptsError && <ErrorState message={scriptsError} />}
          {scripts !== null && scripts.length === 0 && (
            <EmptyState label="Noch keine Gesprächsskripte hinterlegt. Skripte definieren Begrüßung, Befund-Erklärung und Follow-up-Struktur." />
          )}
          {scripts !== null && scripts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scripts.map((entry) => (
                <div key={entry.id} className="border border-titanium-800 bg-obsidian-950 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-titanium-100">{entry.title ?? 'Ohne Titel'}</h3>
                    <span className="font-mono text-[10px] text-titanium-500 shrink-0">
                      {formatDate(entry.created_at)}
                    </span>
                  </div>
                  {entry.content && (
                    <p className="text-xs text-titanium-400 line-clamp-4">{entry.content}</p>
                  )}
                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.tags.map((tag) => (
                        <span key={tag} className="font-mono text-[10px] px-1.5 py-0.5 border border-titanium-800 text-titanium-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Anruf-Protokolle */}
      {activeTab === 'logs' && (
        <div>
          {!activeTenantId && <EmptyState label="Kein aktiver Tenant ausgewählt." />}
          {activeTenantId && callLogs === null && !callLogsError && <LoadingState />}
          {callLogsError && <ErrorState message={callLogsError} />}
          {callLogs !== null && callLogs.length === 0 && (
            <EmptyState label="Keine Anrufe protokolliert." />
          )}
          {callLogs !== null && callLogs.length > 0 && (
            <AgentActionLogTable rows={callLogs} />
          )}
        </div>
      )}

      {/* Follow-up-Aufgaben */}
      {activeTab === 'tasks' && (
        <div>
          {!activeTenantId && <EmptyState label="Kein aktiver Tenant ausgewählt." />}
          {activeTenantId && tasks === null && !tasksError && <LoadingState />}
          {tasksError && <ErrorState message={tasksError} />}
          {tasks !== null && tasks.length === 0 && (
            <EmptyState label="Keine offenen Follow-up-Aufgaben. Aufgaben werden automatisch aus Gesprächszusammenfassungen extrahiert." />
          )}
          {tasks !== null && tasks.length > 0 && (
            <ul className="divide-y divide-titanium-900 border border-titanium-800">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-start justify-between gap-3 p-3 hover:bg-obsidian-900 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm text-titanium-200 break-words">
                      {typeof task.input?.summary === 'string' ? task.input.summary : 'Follow-up-Aufgabe'}
                    </p>
                    <p className="font-mono text-[10px] text-titanium-500 mt-1">
                      {formatDate(task.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={task.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Übergabe-Regeln */}
      {activeTab === 'handover' && (
        <div className="space-y-4">
          <p className="text-sm text-titanium-400">
            Susi übergibt Gespräche regelbasiert an spezialisierte Agents —
            jede Übergabe wird im Prüfpfad (<span className="font-mono">agent_actions_log</span>) dokumentiert.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <HandoverRuleCard
              trigger="Technisches Problem erkannt"
              target="Screenshot & Issue Fix Agent"
            />
            <HandoverRuleCard
              trigger="Automatisierungswunsch erkannt"
              target="Automation Governance Agent"
            />
            <HandoverRuleCard
              trigger="Produktfrage"
              target="RealSync Support Agent"
            />
          </div>
          <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-950/40 border border-amber-900 p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Keine Rechtsberatung am Telefon — nur strukturierte Produkt- und
              Befund-Erklärung.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
