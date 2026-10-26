import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useOptionalTenant } from '../../core/access/TenantProvider';
import { getSupabase } from '../../lib/supabase';
import { FEEDBACK_MAX_LENGTH, prepareFeedback, submitBetaFeedback } from '../../features/beta/betaFeedback';
import './beta-feedback.css';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string };

/**
 * „Feedback geben“ in der App (WP-4): Formular statt Umweg über /kontakt.
 * Speichert Text, Seite und Mandant in `beta_feedback`; das Team liest es unter
 * /admin/beta-feedback. Ohne aktiven Mandanten gibt es nichts zuzuordnen —
 * dann erscheint der Knopf nicht.
 */
export function BetaFeedback({ toggleClassName }: { toggleClassName?: string }) {
  const activeTenantId = useOptionalTenant()?.activeTenantId ?? null;
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const panelId = useId();
  const fieldId = useId();
  const hintId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) fieldRef.current?.focus();
  }, [open]);

  if (!activeTenantId) return null;

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const draft = prepareFeedback(text, pathname);
    if (!draft.ok) {
      setStatus({
        kind: 'error',
        message: draft.reason === 'empty'
          ? 'Bitte schreiben Sie kurz, was Ihnen aufgefallen ist.'
          : `Bitte kürzen Sie auf ${FEEDBACK_MAX_LENGTH} Zeichen.`,
      });
      return;
    }
    setStatus({ kind: 'sending' });
    try {
      await submitBetaFeedback(getSupabase(), { tenantId: activeTenantId, text: draft.text, route: draft.route });
      setText('');
      setStatus({ kind: 'sent' });
      setOpen(false);
      toggleRef.current?.focus();
    } catch {
      setStatus({
        kind: 'error',
        message: 'Das Feedback konnte nicht gesendet werden. Bitte versuchen Sie es gleich noch einmal.',
      });
    }
  };

  return (
    <div className="rs-feedback" data-testid="beta-feedback">
      <button
        ref={toggleRef}
        type="button"
        className={toggleClassName ?? 'rs-feedback__toggle'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        Feedback geben
      </button>
      <p className="rs-feedback__status" role="status">
        {status.kind === 'sent' ? 'Danke! Ihr Feedback ist beim Team angekommen.' : ''}
      </p>
      {open && (
        <form id={panelId} className="rs-feedback__panel" onSubmit={onSubmit} onKeyDown={onKeyDown} noValidate>
          <label htmlFor={fieldId} className="rs-feedback__label">
            Was ist Ihnen aufgefallen?
          </label>
          <textarea
            ref={fieldRef}
            id={fieldId}
            className="rs-feedback__field"
            rows={4}
            maxLength={FEEDBACK_MAX_LENGTH}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-describedby={hintId}
            aria-invalid={status.kind === 'error'}
          />
          <p id={hintId} className="rs-feedback__hint">
            Wir speichern Ihren Text, die aktuelle Seite ({pathname}), Ihren Workspace und Ihr Konto.
            Bitte keine Passwörter oder Gesundheitsdaten eintragen. {text.length}/{FEEDBACK_MAX_LENGTH} Zeichen.
          </p>
          {status.kind === 'error' && (
            <p className="rs-feedback__error" role="alert">{status.message}</p>
          )}
          <div className="rs-feedback__actions">
            <button type="submit" className="rs-feedback__send" disabled={status.kind === 'sending'}>
              {status.kind === 'sending' ? 'Wird gesendet …' : 'Senden'}
            </button>
            <button type="button" className="rs-feedback__cancel" onClick={close}>
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
