import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useSupabaseAuth } from '../supabase/SupabaseAuthContext';
import { useTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import type { ModelProfile } from '../../core/ai-gateway/types';

type Turn = { role: 'user' | 'assistant'; text: string };
type GatewayResult = {
  ok?: boolean;
  output?: unknown;
  raw_text?: string;
  model?: string;
  provider?: string;
  trace_id?: string;
  usage?: { total_tokens?: number };
  error?: { code?: string; message?: string };
};

const PROFILES: { id: ModelProfile; label: string }[] = [
  { id: 'fast-local', label: 'Schnell · lokal' },
  { id: 'quality-local', label: 'Qualität · lokal' },
];

function responseText(value: GatewayResult): string | null {
  if (typeof value.output === 'string') return value.output;
  if (typeof value.raw_text === 'string') return value.raw_text;
  return null;
}

/** Beta: no persistence, no fake models, no automatic provider fallback. */
export default function AiStudioPlayground() {
  const { session } = useSupabaseAuth();
  const tenant = useTenant();
  const requestEpoch = useRef(0);
  const [profile, setProfile] = useState<ModelProfile>('fast-local');
  const [instruction, setInstruction] = useState('');
  const [prompt, setPrompt] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [meta, setMeta] = useState('');
  // Invalidate displayed messages when the account or tenant changes.
  useEffect(() => {
    requestEpoch.current += 1;
    setBusy(false);
    setTurns([]);
    setPrompt('');
    setError('');
    setMeta('');
  }, [tenant.activeTenantId, session?.user.id]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const input = prompt.trim();
    const tenantId = tenant.activeTenantId;
    if (!input || !tenantId || !session?.access_token || busy) return;
    setError('');
    setBusy(true);
    const epoch = ++requestEpoch.current;
    setPrompt('');
    const previous = turns;
    setTurns([...previous, { role: 'user', text: input }]);
    try {
      // The gateway's native op accepts a single input string. Include history
      // explicitly; do not claim server-side session persistence.
      const context = [...previous, { role: 'user', text: input }].map(
        (turn) => `${turn.role === 'user' ? 'Nutzer' : 'Assistent'}: ${turn.text}`,
      ).join('\n\n');
      const { data, error: invokeError } = await getSupabase().functions.invoke<GatewayResult>('ai-gateway', {
        body: {
          op: 'generate',
          tenant_id: tenantId,
          feature: 'ai_studio',
          task_type: 'chat',
          model_profile: profile,
          input: context,
          system_prompt: instruction.trim() || undefined,
        },
      });
      if (invokeError) throw invokeError;
      if (!data || data.ok === false) throw new Error(data?.error?.message || 'KI-Gateway nicht verfügbar.');
      const answer = responseText(data);
      if (answer === null) throw new Error('KI-Gateway hat keine lesbare Textantwort geliefert.');
      // Guard stale responses after tenant/account navigation.
      const current = await getSupabase().auth.getSession();
      if (epoch !== requestEpoch.current || current.data.session?.user.id !== session.user.id) return;
      setTurns((value) => [...value, { role: 'assistant', text: answer }]);
      setMeta([data.provider, data.model, data.trace_id && `Trace ${data.trace_id}`, data.usage?.total_tokens != null && `${data.usage.total_tokens} Tokens`].filter(Boolean).join(' · '));
    } catch (failure) {
      if (epoch === requestEpoch.current) setError(failure instanceof Error ? failure.message : 'Unbekannter Gateway-Fehler');
    } finally {
      if (epoch === requestEpoch.current) setBusy(false);
    }
  };

  const ready = Boolean(session?.access_token && tenant.activeTenantId && !tenant.loading);
  return (
    <main className="min-h-[75vh] bg-[#0e141b] text-slate-100 p-4 md:p-8">
      <header className="mb-7 flex flex-wrap gap-4 justify-between items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">RealSync Dynamics AI · Beta</p>
          <h1 className="text-3xl font-semibold mt-2">AI Studio</h1>
          <p className="text-sm text-slate-400 mt-2">Lokaler Modell-Playground über das geschützte Governance-Gateway.</p>
        </div>
        <Link className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800" to="/build">App Builder öffnen ↗</Link>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
        <section className="rounded-2xl border border-slate-700 bg-[#141d27] overflow-hidden">
          <div className="flex justify-between items-center border-b border-slate-700 px-5 py-3">
            <span className="font-medium">Playground</span>
            <button type="button" className="text-xs text-slate-300 underline" onClick={() => { setTurns([]); setMeta(''); setError(''); }} disabled={busy}>Neuer Chat</button>
          </div>
          <div aria-live="polite" className="min-h-[320px] max-h-[56vh] overflow-y-auto p-5 space-y-4">
            {turns.length === 0 && <p className="text-slate-400 text-sm">Schreibe eine Nachricht, um das verfügbare lokale KI-Modell zu testen.</p>}
            {turns.map((turn, index) => <div key={index} className={`max-w-[90%] whitespace-pre-wrap rounded-xl p-4 text-sm ${turn.role === 'user' ? 'ml-auto bg-emerald-900/50' : 'bg-slate-800'}`}><strong className="block mb-1">{turn.role === 'user' ? 'Du' : 'KI'}</strong>{turn.text}</div>)}
            {busy && <p role="status" className="text-sm text-emerald-200">Gateway-Anfrage läuft …</p>}
          </div>
          <form onSubmit={send} className="border-t border-slate-700 p-4">
            <label htmlFor="studio-prompt" className="sr-only">Nachricht</label>
            <textarea id="studio-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={12000} rows={3} placeholder="Nachricht eingeben …" className="w-full resize-y rounded-lg bg-slate-900 p-3 text-sm border border-slate-600 focus:outline-emerald-400" />
            <div className="flex justify-between gap-3 mt-3 items-center">
              <span className="text-xs text-slate-400">Sitzung nur im Arbeitsspeicher; keine gespeicherten Chats.</span>
              <button disabled={!ready || !prompt.trim() || busy} className="rounded-lg bg-emerald-300 disabled:opacity-40 px-5 py-2 font-medium text-slate-950" type="submit">Senden</button>
            </div>
            {!ready && <p role="status" className="text-sm mt-2 text-amber-200">Kein aktiver Mandant oder keine gültige Sitzung vorhanden.</p>}
            {error && <p role="alert" className="text-sm mt-2 text-rose-300">{error}</p>}
            {meta && <p className="text-xs mt-2 text-slate-400">{meta}</p>}
          </form>
        </section>
        <aside className="rounded-2xl border border-slate-700 bg-[#141d27] p-5 space-y-5 self-start">
          <h2 className="font-semibold">Konfiguration</h2>
          <label className="block text-sm" htmlFor="studio-model">Modellprofil</label>
          <select id="studio-model" value={profile} onChange={(e) => setProfile(e.target.value as ModelProfile)} className="w-full rounded-lg bg-slate-900 border border-slate-600 p-3 text-sm">
            {PROFILES.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
          </select>
          <p className="text-xs text-slate-400">Profil ist kein garantiert verfügbares Modell. Verfügbarkeit bestimmt der Server.</p>
          <label className="block text-sm" htmlFor="studio-system">Systemanweisung</label>
          <textarea id="studio-system" value={instruction} maxLength={8000} onChange={(e) => setInstruction(e.target.value)} rows={6} className="w-full rounded-lg bg-slate-900 border border-slate-600 p-3 text-sm" placeholder="Verhalten der KI festlegen …" />
          <p className="text-xs text-slate-400">Keine API-Schlüssel im Browser. Cloud-Fallback ist deaktiviert. Generierter Code wird hier nicht ausgeführt.</p>
        </aside>
      </div>
    </main>
  );
}
