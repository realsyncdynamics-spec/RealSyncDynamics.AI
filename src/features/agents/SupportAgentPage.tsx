import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LifeBuoy, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

type TabId = 'ask' | 'knowledge' | 'escalations' | 'faq';

const TABS: { id: TabId; label: string }[] = [
  { id: 'ask', label: 'Support fragen' },
  { id: 'knowledge', label: 'Wissensbasis' },
  { id: 'escalations', label: 'Eskalationen' },
  { id: 'faq', label: 'FAQ-Builder' },
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

// ─── Status-Badge für Fragen ─────────────────────────────────────────────────

const STATUS_CLASS: Record<string, string> = {
  success: 'border-green-800 text-green-400',
  answered: 'border-green-800 text-green-400',
  error: 'border-rose-900 text-rose-400',
  pending: 'border-amber-800 text-amber-400',
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

// ─── Stat-Box (FAQ-Builder) ──────────────────────────────────────────────────

function StatBox({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="border border-titanium-800 bg-obsidian-950 p-4">
      <p className="font-mono text-2xl text-titanium-50">{value ?? '—'}</p>
      <p className="text-[11px] uppercase tracking-widest text-titanium-500 mt-1">{label}</p>
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function SupportAgentPage() {
  const { activeTenantId } = useTenant();
  const [activeTab, setActiveTab] = useState<TabId>('ask');

  // Support fragen
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [myQuestions, setMyQuestions] = useState<AgentActionLog[] | null>(null);
  const [myQuestionsError, setMyQuestionsError] = useState<string | null>(null);
  const [questionsReloadKey, setQuestionsReloadKey] = useState(0);

  // Wissensbasis
  const [knowledge, setKnowledge] = useState<KnowledgeBaseEntry[] | null>(null);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

  // Eskalationen
  const [escalations, setEscalations] = useState<AgentActionLog[] | null>(null);
  const [escalationsError, setEscalationsError] = useState<string | null>(null);

  // FAQ-Builder-Statistiken
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [knowledgeCount, setKnowledgeCount] = useState<number | null>(null);
  const [faqError, setFaqError] = useState<string | null>(null);

  // Eigene Fragen laden (tenant-isoliert, letzte 10)
  useEffect(() => {
    if (activeTab !== 'ask' || !activeTenantId) return;
    let cancelled = false;
    setMyQuestions(null);
    setMyQuestionsError(null);
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from('agent_actions_log')
          .select('id, created_at, action_type, status, input, output, agent_id')
          .eq('tenant_id', activeTenantId)
          .eq('action_type', 'support_question')
          .order('created_at', { ascending: false })
          .limit(10);
        if (!cancelled) {
          if (error) setMyQuestionsError(error.message);
          else setMyQuestions(data ?? []);
        }
      } catch (e) {
        if (!cancelled) setMyQuestionsError((e as Error)?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, activeTenantId, questionsReloadKey]);

  // Wissensbasis laden: globale Einträge (tenant_id NULL) + eigene Tenant-Einträge
  useEffect(() => {
    if (activeTab !== 'knowledge' || !activeTenantId) return;
    let cancelled = false;
    setKnowledge(null);
    setKnowledgeError(null);
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from('agent_knowledge_base')
          .select('id, agent_id, tenant_id, source_type, title, content, tags, created_at')
          .or(`tenant_id.is.null,tenant_id.eq.${activeTenantId}`)
          .order('created_at', { ascending: false });
        if (!cancelled) {
          if (error) setKnowledgeError(error.message);
          else setKnowledge(data ?? []);
        }
      } catch (e) {
        if (!cancelled) setKnowledgeError((e as Error)?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, activeTenantId]);

  // Eskalationen laden (tenant-isoliert)
  useEffect(() => {
    if (activeTab !== 'escalations' || !activeTenantId) return;
    let cancelled = false;
    setEscalations(null);
    setEscalationsError(null);
    (async () => {
      try {
        const { data, error } = await getSupabase()
          .from('agent_actions_log')
          .select('id, created_at, action_type, status, input, output, agent_id')
          .eq('tenant_id', activeTenantId)
          .eq('action_type', 'support_escalation')
          .order('created_at', { ascending: false })
          .limit(50);
        if (!cancelled) {
          if (error) setEscalationsError(error.message);
          else setEscalations(data ?? []);
        }
      } catch (e) {
        if (!cancelled) setEscalationsError((e as Error)?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, activeTenantId]);

  // FAQ-Builder-Statistiken laden
  useEffect(() => {
    if (activeTab !== 'faq' || !activeTenantId) return;
    let cancelled = false;
    setQuestionCount(null);
    setKnowledgeCount(null);
    setFaqError(null);
    (async () => {
      try {
        const [questionsRes, knowledgeRes] = await Promise.all([
          getSupabase()
            .from('agent_actions_log')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', activeTenantId)
            .eq('action_type', 'support_question'),
          getSupabase()
            .from('agent_knowledge_base')
            .select('id', { count: 'exact', head: true })
            .or(`tenant_id.is.null,tenant_id.eq.${activeTenantId}`),
        ]);
        if (!cancelled) {
          const err = questionsRes.error ?? knowledgeRes.error;
          if (err) setFaqError(err.message);
          else {
            setQuestionCount(questionsRes.count ?? 0);
            setKnowledgeCount(knowledgeRes.count ?? 0);
          }
        }
      } catch (e) {
        if (!cancelled) setFaqError((e as Error)?.message ?? String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, activeTenantId]);

  // Frage absenden: es gibt noch kein KI-Backend — die Frage wird als
  // Prüfpfad-Eintrag (agent_actions_log) erfasst und später verarbeitet.
  async function handleSubmitQuestion() {
    if (!activeTenantId || !question.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { error } = await getSupabase()
        .from('agent_actions_log')
        .insert({
          tenant_id: activeTenantId,
          action_type: 'support_question',
          status: 'pending',
          input: { question: question.trim() },
        });
      if (error) {
        setSubmitError(error.message);
      } else {
        setSubmitted(true);
        setQuestion('');
        setQuestionsReloadKey((k) => k + 1);
      }
    } catch (e) {
      setSubmitError((e as Error)?.message ?? String(e));
    } finally {
      setSubmitting(false);
    }
  }

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
          <LifeBuoy className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-titanium-50">RealSync Support Agent</h1>
            <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border border-amber-700 text-amber-400">
              Beta
            </span>
          </div>
          <p className="text-xs text-titanium-500">
            Produktwissen · Onboarding-Begleitung · Ticket-Erstellung
          </p>
        </div>
      </div>

      {/* Tab-Leiste */}
      <div className="flex border-b border-titanium-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors ' +
              (activeTab === tab.id
                ? 'border-[#0052FF] text-titanium-50'
                : 'border-transparent text-titanium-400 hover:text-titanium-200 hover:border-titanium-600')
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Support fragen */}
      {activeTab === 'ask' && (
        <div className="space-y-6">
          {!activeTenantId && <EmptyState label="Kein aktiver Tenant ausgewählt." />}
          {activeTenantId && (
            <div className="border border-titanium-800 bg-obsidian-950 p-4 space-y-3">
              {submitted ? (
                <>
                  <div className="flex items-start gap-2 text-sm text-green-300 bg-green-950/40 border border-green-900 p-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      Deine Frage wurde aufgenommen. Der Support-Agent antwortet in Kürze —
                      Antworten erscheinen in der Wissensbasis.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="text-xs text-titanium-400 hover:text-titanium-100 underline"
                  >
                    Weitere Frage stellen
                  </button>
                </>
              ) : (
                <>
                  <label htmlFor="support-question" className="block text-xs font-mono uppercase tracking-widest text-titanium-500">
                    Deine Frage an den Support-Agent
                  </label>
                  <textarea
                    id="support-question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows={4}
                    placeholder="z. B. Wie richte ich einen neuen Agenten mit Policy Pack ein?"
                    className="w-full bg-obsidian-900 border border-titanium-800 text-sm text-titanium-100 p-3 placeholder:text-titanium-600 focus:outline-none focus:border-[#0052FF]"
                  />
                  {submitError && <ErrorState message={submitError} />}
                  <button
                    type="button"
                    onClick={handleSubmitQuestion}
                    disabled={submitting || !question.trim()}
                    className="px-4 py-2 text-sm font-medium bg-[#0052FF] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
                  >
                    {submitting ? 'Wird gesendet…' : 'Frage senden'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Letzte Fragen */}
          {activeTenantId && (
            <div>
              <h2 className="text-xs font-mono uppercase tracking-widest text-titanium-500 mb-2">
                Deine letzten Fragen
              </h2>
              {myQuestions === null && !myQuestionsError && <LoadingState />}
              {myQuestionsError && <ErrorState message={myQuestionsError} />}
              {myQuestions !== null && myQuestions.length === 0 && (
                <EmptyState label="Noch keine Fragen gestellt." />
              )}
              {myQuestions !== null && myQuestions.length > 0 && (
                <ul className="divide-y divide-titanium-900 border border-titanium-800">
                  {myQuestions.map((q) => (
                    <li key={q.id} className="flex items-start justify-between gap-3 p-3 hover:bg-obsidian-900 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm text-titanium-200 break-words">
                          {typeof q.input?.question === 'string' ? q.input.question : '—'}
                        </p>
                        <p className="font-mono text-[10px] text-titanium-500 mt-1">
                          {formatDate(q.created_at)}
                        </p>
                      </div>
                      <StatusBadge status={q.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Wissensbasis */}
      {activeTab === 'knowledge' && (
        <div>
          {!activeTenantId && <EmptyState label="Kein aktiver Tenant ausgewählt." />}
          {activeTenantId && knowledge === null && !knowledgeError && <LoadingState />}
          {knowledgeError && <ErrorState message={knowledgeError} />}
          {knowledge !== null && knowledge.length === 0 && (
            <EmptyState label="Die Wissensbasis wird mit häufigen Fragen und Produkt-Antworten befüllt." />
          )}
          {knowledge !== null && knowledge.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {knowledge.map((entry) => (
                <div key={entry.id} className="border border-titanium-800 bg-obsidian-950 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-bold text-titanium-100">{entry.title ?? 'Ohne Titel'}</h3>
                    {entry.source_type && (
                      <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 border border-titanium-800 text-titanium-400 shrink-0">
                        {entry.source_type}
                      </span>
                    )}
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

      {/* Eskalationen */}
      {activeTab === 'escalations' && (
        <div>
          {!activeTenantId && <EmptyState label="Kein aktiver Tenant ausgewählt." />}
          {activeTenantId && escalations === null && !escalationsError && <LoadingState />}
          {escalationsError && <ErrorState message={escalationsError} />}
          {escalations !== null && escalations.length === 0 && (
            <EmptyState label="Keine Eskalationen — technische Probleme werden an den Screenshot & Issue Fix Agent übergeben." />
          )}
          {escalations !== null && escalations.length > 0 && (
            <AgentActionLogTable rows={escalations} />
          )}
        </div>
      )}

      {/* FAQ-Builder */}
      {activeTab === 'faq' && (
        <div className="space-y-4">
          {!activeTenantId && <EmptyState label="Kein aktiver Tenant ausgewählt." />}
          {activeTenantId && (
            <>
              <div className="border border-titanium-800 bg-obsidian-950 p-4">
                <h2 className="text-sm font-semibold text-titanium-100 mb-2">Automatischer FAQ-Aufbau</h2>
                <p className="text-sm text-titanium-400">
                  Wiederkehrende Fragen werden automatisch zu FAQ-Einträgen in der
                  Wissensbasis. Der Support-Agent erkennt Muster in den erfassten
                  Fragen und ergänzt die Wissensbasis fortlaufend — so wird jede
                  Antwort für alle Nutzer wiederverwendbar.
                </p>
              </div>
              {faqError && <ErrorState message={faqError} />}
              <div className="grid grid-cols-2 gap-4">
                <StatBox value={questionCount} label="Erfasste Fragen" />
                <StatBox value={knowledgeCount} label="Wissenseinträge" />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
