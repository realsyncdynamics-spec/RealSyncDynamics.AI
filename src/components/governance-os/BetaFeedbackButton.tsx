import { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageSquarePlus, X } from 'lucide-react';
import { BETA } from '../../config/beta';
import { useOptionalTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import {
  FEEDBACK_MAX,
  submitBetaFeedback,
  validateFeedbackText,
} from '../../features/beta/betaFeedbackApi';

/**
 * Feedback-Button für alle /app/*-Flächen (WP-4). Ersetzt den Link auf das
 * allgemeine Kontaktformular: Der Eintrag landet in `beta_feedback` mit
 * Mandant, Nutzer und Route — damit das Team weiß, wo im Produkt etwas
 * hakte. Verschwindet mit `VITE_BETA_PHASE=off`.
 *
 * `variant="link"`: Textlink im Beta-Hinweis. `variant="floating"`: Knopf
 * rechts unten, sichtbar auch wenn der Hinweis ausgeblendet ist.
 */
export function BetaFeedbackButton({ variant = 'floating' }: { variant?: 'floating' | 'link' }) {
  const [open, setOpen] = useState(false);
  if (!BETA.active) return null;
  return (
    <>
      {variant === 'link' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="underline"
          style={{ color: '#d6ae52' }}
          data-testid="beta-feedback-link"
        >
          Feedback geben
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-lg"
          style={{ background: '#121214', borderColor: 'rgba(214,174,82,0.5)', color: '#d6ae52' }}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-testid="beta-feedback-fab"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          Beta-Feedback
        </button>
      )}
      {open && <FeedbackDialog onClose={() => setOpen(false)} />}
    </>
  );
}

type SubmitState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'sent' }
  | { status: 'error'; message: string };

function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const { pathname } = useLocation();
  const tenant = useOptionalTenant();
  const tenantId = tenant?.activeTenantId ?? null;
  const [text, setText] = useState('');
  const [state, setState] = useState<SubmitState>({ status: 'idle' });
  const titleId = useId();
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    areaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const checked = validateFeedbackText(text);
  const canSend = checked.ok && tenantId !== null && state.status !== 'sending' && state.status !== 'sent';

  const send = async () => {
    if (!tenantId || !checked.ok) return;
    setState({ status: 'sending' });
    try {
      const { data } = await getSupabase().auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) throw new Error('Nicht angemeldet – bitte neu einloggen.');
      await submitBetaFeedback({ tenantId, userId, route: pathname, text });
      setState({ status: 'sent' });
    } catch (err) {
      setState({ status: 'error', message: (err as Error)?.message ?? String(err) });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
      data-testid="beta-feedback-dialog"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-lg border p-4 text-sm"
        style={{ background: '#121214', borderColor: 'rgba(214,174,82,0.35)', color: '#f4f4f2' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold">Beta-Feedback</h2>
            <p className="mt-1 text-xs opacity-80">
              Was fehlt, was ist unklar, was funktioniert nicht? Wir speichern Ihre Nachricht mit
              der aktuellen Seite (<code>{pathname.split('?')[0]}</code>) – ohne Inhalte Ihres Workspaces.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Schließen" className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {state.status === 'sent' ? (
          <p className="rounded border border-emerald-700/50 bg-emerald-900/20 px-3 py-2" data-testid="beta-feedback-sent">
            Danke! Ihr Feedback ist angekommen. Das Team liest jede Meldung.
          </p>
        ) : (
          <>
            <label className="block">
              <span className="sr-only">Ihr Feedback</span>
              <textarea
                ref={areaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={FEEDBACK_MAX}
                rows={5}
                placeholder="z. B. „Der Scan zeigt keine Befunde, obwohl Cookies gesetzt werden.“"
                className="w-full rounded border bg-black/40 px-3 py-2 text-sm outline-none focus:border-[#d6ae52]"
                style={{ borderColor: 'rgba(255,255,255,0.15)' }}
                data-testid="beta-feedback-text"
              />
            </label>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs">
              <span className="opacity-60">{text.length}/{FEEDBACK_MAX}</span>
              {tenantId === null && <span className="opacity-80">Feedback ist erst mit aktivem Workspace möglich.</span>}
              {state.status === 'error' && (
                <span role="alert" className="text-rose-300" data-testid="beta-feedback-error">{state.message}</span>
              )}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded border px-3 py-1.5" style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
                Abbrechen
              </button>
              <button
                type="button"
                onClick={send}
                disabled={!canSend}
                className="rounded px-3 py-1.5 font-semibold disabled:opacity-40"
                style={{ background: '#d6ae52', color: '#0a0a0b' }}
                data-testid="beta-feedback-send"
              >
                {state.status === 'sending' ? 'Wird gesendet …' : 'Senden'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
