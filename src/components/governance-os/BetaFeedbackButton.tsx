import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getSupabase } from '../../lib/supabase';
import { useTenant } from '../../core/access/TenantProvider';

type State = 'idle' | 'open' | 'sending' | 'done' | 'error';

export function BetaFeedbackButton() {
  const { activeTenantId } = useTenant();
  const { pathname } = useLocation();
  const [state, setState] = useState<State>('idle');
  const [text, setText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setState('sending');
    try {
      const sb = getSupabase();
      const { data: { user } } = await sb.auth.getUser();
      const { error } = await sb
        .from('beta_feedback')
        .insert({
          tenant_id: activeTenantId ?? null,
          user_id:   user?.id ?? null,
          route:     pathname,
          text:      trimmed,
        });
      if (error) throw error;
      setText('');
      setState('done');
    } catch (e) {
      setErrorMsg((e as Error).message ?? 'Unbekannter Fehler');
      setState('error');
    }
  }

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={() => setState('open')}
        className="underline"
        style={{ color: '#d6ae52' }}
      >
        Feedback geben
      </button>
    );
  }

  if (state === 'done') {
    return (
      <span style={{ color: '#d6ae52' }}>
        Danke für Ihr Feedback!
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1" style={{ minWidth: '220px' }}>
      <textarea
        autoFocus
        rows={2}
        maxLength={1000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Kurzes Feedback (max. 1000 Zeichen)"
        className="w-full rounded border px-2 py-1 text-xs text-titanium-100 bg-obsidian-900 border-titanium-700 resize-none outline-none focus:border-security-500"
        disabled={state === 'sending'}
      />
      {state === 'error' && (
        <span className="text-[10px] text-red-400">{errorMsg}</span>
      )}
      <span className="flex gap-2">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={state === 'sending' || !text.trim()}
          className="px-2 py-0.5 text-xs rounded bg-security-500 text-white disabled:opacity-50"
        >
          {state === 'sending' ? 'Sendet …' : 'Senden'}
        </button>
        <button
          type="button"
          onClick={() => { setState('idle'); setText(''); setErrorMsg(''); }}
          className="px-2 py-0.5 text-xs rounded border border-titanium-700 text-titanium-300"
        >
          Abbrechen
        </button>
      </span>
    </span>
  );
}
