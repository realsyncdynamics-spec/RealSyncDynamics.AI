/**
 * Governance Workspace — `/app/workspace`.
 *
 * Grok-ähnliche Arbeitsumgebung, deren Umgebung das Governance OS ist:
 *   - Modus „Chat“: Anfrage → `ai-gateway` (feature `governance_ai_workspace`,
 *     EU-lokaler Pfad, Nutzer-JWT, Mandant aus `TenantProvider`).
 *   - Modus „Build“: Übergabe des Auftrags an den bestehenden App Builder
 *     (`/builder/:slug/code`, eigene Entitlement-Prüfung dort).
 *   - Rechte Spalte „REA · Prüfpfad“: der Runtime Evidence Agent belegt jeden
 *     Chat-Aufruf gegen `ai_evidence_events` und die Hash-Kette.
 *
 * Nichts wird simuliert: kein Demo-Verlauf, keine Ersatzantworten, kein
 * Status „belegt“ ohne gefundenen und geprüften Eintrag.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUp, Blocks, FileCheck2, Hash, MessageSquare, Plus, ShieldCheck, Square,
} from 'lucide-react';
import { AiGatewayEdgeClient } from '../../core/ai-gateway/edgeClient';
import { getSupabaseAnonKey, getSupabaseUrl } from '../../lib/supabaseUrl';
import { edgeFunctionUrl, fnFetchInit } from '../../lib/fn-proxy';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';
import { ASSISTANT_UNAVAILABLE } from '../governance/AgentWidget/useAgentChat';
import {
  formatGovernanceAiSystemPrompt,
  loadGovernanceAiGrounding,
  type GovernanceAiGrounding,
} from '../governance/dashboard/governanceAiContext';
import { codeEntryState } from '../build-studio/entry';
import { attestCall, REA_STATUS_LABEL, type ReaReceipt, type ReaStatus } from '../rea/runtimeEvidenceAgent';
import { createSupabaseReaSource } from '../rea/supabaseSource';
import { WorkspaceToolGrid } from './WorkspaceToolGrid';

type Mode = 'chat' | 'build';

interface Turn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  error?: boolean;
  traceId?: string;
  model?: string;
  latencyMs?: number;
  receipt?: ReaReceipt;
  attesting?: boolean;
}

const BUILD_SLUG = 'workspace';

const STATUS_CLASS: Record<ReaStatus, string> = {
  belegt: 'border-emerald-500/60 text-emerald-300',
  protokolliert: 'border-sky-500/60 text-sky-300',
  ausstehend: 'border-amber-500/60 text-amber-300',
  abweichung: 'border-rose-500/70 text-rose-300',
  nicht_verfuegbar: 'border-titanium-600 text-titanium-400',
};

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Nutzer-JWT der aktuellen Sitzung. Ohne Sitzung `null` — der Client sendet
 * dann nichts (401), kein Rückfall auf den Anon-Key.
 */
async function currentAccessToken(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

function userGatewayClient(): AiGatewayEdgeClient {
  return new AiGatewayEdgeClient({
    supabaseUrl: getSupabaseUrl(),
    apiKey: getSupabaseAnonKey(),
    authToken: currentAccessToken,
    endpoint: edgeFunctionUrl('ai-gateway'),
    fetchImpl: (input, init) => fetch(input, fnFetchInit(String(input), init)),
  });
}

function short(hex: string | undefined | null, n = 12): string {
  if (!hex) return '—';
  return hex.length > n ? `${hex.slice(0, n)}…` : hex;
}

export function GovernanceWorkspace() {
  const navigate = useNavigate();
  const { activeTenantId, tenants } = useTenant();
  const tenantName = tenants.find((t) => t.tenantId === activeTenantId)?.name ?? 'Workspace';
  const [mode, setMode] = useState<Mode>('chat');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [grounding, setGrounding] = useState<GovernanceAiGrounding | null>(null);
  /** Laufende Anfrage; nur sie darf den Ladezustand zurücksetzen. */
  const activeRequestRef = useRef<number | null>(null);
  const requestSeqRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, sending]);

  useEffect(() => {
    if (!activeTenantId) {
      setGrounding(null);
      return;
    }
    let cancelled = false;
    loadGovernanceAiGrounding(activeTenantId).then((g) => {
      if (!cancelled) setGrounding(g);
    });
    return () => { cancelled = true; };
  }, [activeTenantId]);

  const receipts = useMemo(
    () => turns.filter((t) => t.role === 'assistant' && (t.receipt || t.attesting)),
    [turns],
  );
  const canSend = input.trim().length > 0 && !sending;

  const patchTurn = (id: string, patch: Partial<Turn>) =>
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const startBuild = (prompt: string) => {
    const state = codeEntryState(prompt);
    if (!state) {
      setBuildError('Auftrag ist leer oder zu lang (max. 8.000 Zeichen).');
      return;
    }
    setBuildError(null);
    navigate(`/builder/${BUILD_SLUG}/code`, { state });
  };

  const sendChat = async (message: string) => {
    if (!activeTenantId) {
      setTurns((prev) => [...prev, { id: newId(), role: 'assistant', content: 'Kein verifizierter Mandant. Bitte Workspace wählen.', error: true }]);
      return;
    }
    const userTurn: Turn = { id: newId(), role: 'user', content: message };
    const history = [...turns.filter((t) => !t.error), userTurn]
      .slice(-12)
      .map((t) => `${t.role === 'user' ? 'Nutzer' : 'Governance AI'}: ${t.content}`)
      .join('\n\n');
    setTurns((prev) => [...prev, userTurn]);
    setSending(true);
    const requestId = ++requestSeqRef.current;
    activeRequestRef.current = requestId;
    const isCurrent = () => activeRequestRef.current === requestId;
    const traceId = newId();

    try {
      const client = userGatewayClient();
      const res = await client.generate({
        feature: 'governance_ai_workspace',
        task_type: 'chat',
        model_profile: 'fast-local',
        input: history,
        system_prompt: formatGovernanceAiSystemPrompt(grounding),
        max_tokens: 1200,
        temperature: 0.25,
        tenant_id: activeTenantId,
        trace_id: traceId,
      });
      // Abgebrochen oder überholt: Antwort verwerfen. Der Gateway-Aufruf
      // selbst läuft serverseitig zu Ende (eigener Timeout im Client).
      if (!isCurrent()) return;
      const answerId = newId();
      const effectiveTrace = typeof res.trace_id === 'string' && res.trace_id ? res.trace_id : traceId;
      setTurns((prev) => [...prev, {
        id: answerId,
        role: 'assistant',
        content: String(res.output ?? '').trim() || 'Keine Antwort generiert.',
        traceId: effectiveTrace,
        model: res.model,
        latencyMs: res.latency_ms,
        attesting: true,
      }]);
      // REA: Herkunftsnachweis nachgelagert belegen (blockiert die Antwort nicht).
      void attestCall(createSupabaseReaSource(getSupabase()), {
        tenantId: activeTenantId,
        traceId: effectiveTrace,
        input: history,
      }).then((receipt) => patchTurn(answerId, { receipt, attesting: false }));
    } catch {
      if (isCurrent()) {
        setTurns((prev) => [...prev, { id: newId(), role: 'assistant', content: ASSISTANT_UNAVAILABLE, error: true }]);
      }
    } finally {
      if (isCurrent()) {
        activeRequestRef.current = null;
        setSending(false);
        textareaRef.current?.focus();
      }
    }
  };

  const submit = () => {
    const message = input.trim();
    if (!message || sending) return;
    setInput('');
    if (mode === 'build') startBuild(message);
    else void sendChat(message);
  };

  const stop = () => {
    // Antwort der laufenden Anfrage wird verworfen (s. isCurrent).
    activeRequestRef.current = null;
    setSending(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // Dieselbe Eingabekomponente: auf der Startfläche oben, im Chatverlauf unten.
  // Kein zweiter Eingabestatus, Modellaufruf oder Governance-Pfad.
  const composer = (
<div className="shrink-0 px-4 pb-5">
          <div className="mx-auto max-w-3xl border border-titanium-700 bg-obsidian-900 focus-within:border-security-500">
            <label htmlFor="workspace-input" className="sr-only">Auftrag</label>
            <textarea
              id="workspace-input"
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder={mode === 'chat' ? 'Frag das Governance OS …' : 'Beschreibe die App, die gebaut werden soll …'}
              className="w-full resize-none bg-transparent px-4 pt-3 text-sm text-titanium-100 outline-none placeholder:text-titanium-600 max-h-40"
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <div role="radiogroup" aria-label="Modus" className="flex border border-titanium-700 font-mono text-[11px]">
                {(['chat', 'build'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => setMode(m)}
                    className={`px-3 py-1 ${mode === m ? 'bg-security-500 text-white' : 'text-titanium-400 hover:text-titanium-100'}`}
                  >
                    {m === 'chat' ? 'Chat' : 'Build'}
                  </button>
                ))}
              </div>
              {sending ? (
                <button type="button" onClick={stop} className="h-8 w-8 flex items-center justify-center border border-titanium-600 text-titanium-200" aria-label="Abbrechen">
                  <Square className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSend}
                  aria-label={mode === 'chat' ? 'Senden' : 'An App Builder übergeben'}
                  className={`h-8 w-8 flex items-center justify-center ${canSend ? 'bg-security-500 text-white hover:bg-security-600' : 'bg-obsidian-700 text-titanium-600'}`}
                >
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
          {buildError && <p role="alert" className="mx-auto max-w-3xl mt-2 text-xs text-rose-300">{buildError}</p>}
          <p className="mx-auto max-w-3xl mt-2 text-center text-[10px] text-titanium-600">
            KI kann Fehler machen. Rechtliche Entscheidungen und Veröffentlichungen prüfen.
          </p>
        </div>
  );

  return (
    <div className="h-screen bg-obsidian-950 text-titanium-200 flex overflow-hidden" data-testid="governance-workspace">
      {/* Linke Leiste */}
      <aside className="hidden md:flex w-[240px] shrink-0 flex-col border-r border-titanium-800 bg-obsidian-900">
        <div className="px-4 h-14 flex items-center border-b border-titanium-800">
          <Link to="/app" className="text-sm font-semibold text-titanium-50 tracking-tight">
            RealSync Dynamics <span className="text-security-400">&amp; AI</span>
          </Link>
        </div>
        <div className="p-3">
          <button
            type="button"
            onClick={() => { setTurns([]); setBuildError(null); }}
            className="w-full flex items-center gap-2 border border-titanium-700 px-3 py-2 text-sm text-titanium-100 hover:bg-obsidian-800"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Neue Sitzung
          </button>
        </div>
        <nav className="px-2 space-y-px text-sm" aria-label="Workspace">
          <Link to="/app/assistant" className="flex items-center gap-2 px-3 py-2 text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800"><MessageSquare className="h-4 w-4" aria-hidden="true" /> Governance AI</Link>
          <Link to="/build" className="flex items-center gap-2 px-3 py-2 text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800"><Blocks className="h-4 w-4" aria-hidden="true" /> Build-Projekte</Link>
          <Link to="/app/evidence" className="flex items-center gap-2 px-3 py-2 text-titanium-400 hover:text-titanium-100 hover:bg-obsidian-800"><FileCheck2 className="h-4 w-4" aria-hidden="true" /> Evidence</Link>
        </nav>
        <div className="mt-auto border-t border-titanium-800 p-3 font-mono text-[11px] text-titanium-500">
          <div className="truncate text-titanium-300">{tenantName}</div>
          <div className="mt-1">
            {grounding
              ? `${grounding.incidents.length} Vorfälle · ${grounding.evidence.length} Nachweise · ${grounding.findings.length} Findings`
              : 'kein Mandantenkontext'}
          </div>
        </div>
      </aside>

      {/* Mitte */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 shrink-0 border-b border-titanium-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-titanium-50 font-medium">Governance Workspace</span>
            <span className="text-titanium-600">/</span>
            <span className="text-titanium-400 truncate">{tenantName}</span>
          </div>
          <div className="font-mono text-[11px] text-titanium-500 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-security-400" aria-hidden="true" /> EU-lokal · Prüfpfad aktiv
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-10">
            {turns.length === 0 ? (
              <div className="space-y-8" data-testid="workspace-start">
                <div className="text-center">
                  <h1 className="text-3xl font-semibold tracking-tight text-titanium-50">
                    Fragen Sie alles, erstellen Sie alles
                  </h1>
                  <p className="mt-3 mx-auto max-w-lg text-sm text-titanium-400">
                    {mode === 'chat'
                      ? 'Vorhandenes Governance AI Gateway mit REA-Prüfpfad. Nicht freigegebene Werkzeuge bleiben gesperrt.'
                      : 'Der Auftrag wird an den bestehenden App Builder übergeben. Seine Berechtigungen und Freigaben bleiben unverändert.'}
                  </p>
                </div>
                {composer}
                <WorkspaceToolGrid
                  onChat={() => { setMode('chat'); textareaRef.current?.focus(); }}
                  onBuild={() => { setMode('build'); textareaRef.current?.focus(); }}
                  onPrompt={(nextMode, prompt) => {
                    setMode(nextMode);
                    setInput(prompt);
                    textareaRef.current?.focus();
                  }}
                />
              </div>
            ) : (
              <ol className="space-y-6">
                {turns.map((t) => (
                  <li key={t.id} className={t.role === 'user' ? 'flex justify-end' : ''}>
                    <div
                      role={t.error ? 'alert' : undefined}
                      className={
                        t.role === 'user'
                          ? 'max-w-[85%] border border-titanium-700 bg-obsidian-800 px-4 py-3 text-sm text-titanium-100 whitespace-pre-wrap'
                          : t.error
                            ? 'border border-rose-500/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200'
                            : 'text-sm leading-7 text-titanium-200 whitespace-pre-wrap'
                      }
                    >
                      {t.content}
                      {t.role === 'assistant' && !t.error && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-titanium-500">
                          <span>trace {short(t.traceId, 8)}</span>
                          {t.model && <span>· {t.model}</span>}
                          {typeof t.latencyMs === 'number' && <span>· {t.latencyMs} ms</span>}
                          {t.attesting && <span className="border border-titanium-700 px-1.5">REA prüft …</span>}
                          {t.receipt && (
                            <span className={`border px-1.5 ${STATUS_CLASS[t.receipt.status]}`}>
                              {REA_STATUS_LABEL[t.receipt.status]}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
                {sending && <li className="font-mono text-xs text-titanium-500">Gateway antwortet …</li>}
                <div ref={bottomRef} />
              </ol>
            )}
          </div>
        </div>

        {/* Nach dem ersten Turn bleibt die unveränderte Eingabe am unteren Rand. */}
        {turns.length > 0 && composer}
      </main>

      {/* REA-Spalte */}
      <aside className="hidden xl:flex w-[320px] shrink-0 flex-col border-l border-titanium-800 bg-obsidian-900" aria-label="REA Prüfpfad">
        <div className="h-14 px-4 flex items-center justify-between border-b border-titanium-800">
          <span className="text-xs font-semibold text-titanium-100">REA · Prüfpfad</span>
          <Hash className="h-4 w-4 text-titanium-500" aria-hidden="true" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {receipts.length === 0 && (
            <p className="text-xs text-titanium-500">
              Noch keine Aufrufe. Nach jeder Antwort sucht der Runtime Evidence Agent den Evidence-Eintrag,
              vergleicht die Prüfsumme und prüft die Hash-Kette.
            </p>
          )}
          {receipts.map((t) => {
            const r = t.receipt;
            return (
              <div key={t.id} className="border border-titanium-800 bg-obsidian-950 p-3 font-mono text-[11px]" data-testid="rea-receipt">
                <div className="flex items-center justify-between">
                  <span className="text-titanium-400">trace {short(t.traceId, 8)}</span>
                  {r ? (
                    <span className={`border px-1.5 ${STATUS_CLASS[r.status]}`}>{REA_STATUS_LABEL[r.status]}</span>
                  ) : (
                    <span className="border border-titanium-700 px-1.5 text-titanium-400">prüft …</span>
                  )}
                </div>
                {r && (
                  <dl className="mt-2 grid grid-cols-[88px_1fr] gap-x-2 gap-y-1 text-titanium-500">
                    <dt>Grund</dt><dd className="font-sans text-titanium-300">{r.reason}</dd>
                    <dt>input sha256</dt><dd className="text-titanium-300">{short(r.localInputSha256)}</dd>
                    {r.inputHashMatches !== undefined && (<><dt>Abgleich</dt><dd className={r.inputHashMatches ? 'text-emerald-300' : 'text-rose-300'}>{r.inputHashMatches ? 'identisch' : 'abweichend'}</dd></>)}
                    {r.chainIndex !== undefined && (<><dt>chain_index</dt><dd className="text-titanium-300">{r.chainIndex}</dd></>)}
                    {r.eventHashHex && (<><dt>event_hash</dt><dd className="text-titanium-300">{short(r.eventHashHex)}</dd></>)}
                    {r.chain && (<><dt>Kette</dt><dd className="text-titanium-300">hash {r.chain.hashOk ? 'ok' : 'fehler'} · link {r.chain.linkOk === null ? 'n/a' : r.chain.linkOk ? 'ok' : 'fehler'}</dd></>)}
                    {r.verdict && (<><dt>verdict</dt><dd className="text-titanium-300">{r.verdict}</dd></>)}
                    {r.residency && (<><dt>residency</dt><dd className="text-titanium-300">{r.residency}{r.providerRegion ? ` · ${r.providerRegion}` : ''}</dd></>)}
                    {typeof r.totalTokens === 'number' && (<><dt>tokens</dt><dd className="text-titanium-300">{r.totalTokens}</dd></>)}
                  </dl>
                )}
              </div>
            );
          })}
        </div>
        <p className="border-t border-titanium-800 p-3 text-[10px] leading-4 text-titanium-600">
          Gespeichert werden nur Länge und Prüfsumme des Eingabetexts, keine Inhalte. „Belegt“ erscheint nur,
          wenn Eintrag, Prüfsumme und Kette übereinstimmen.
        </p>
      </aside>
    </div>
  );
}
