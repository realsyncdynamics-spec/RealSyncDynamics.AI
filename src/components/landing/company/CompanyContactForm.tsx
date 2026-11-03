import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ensureCsrfCookie } from '../../../lib/csrf';
import { edgeFunctionUrl, fnFetchInit, shouldUseFnProxy } from '../../../lib/fn-proxy';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MESSAGE = 4000;
const FALLBACK_MAIL = 'info@realsyncdynamicsai.de';

export interface CompanyContactValues {
  name: string;
  email: string;
  company: string;
  message: string;
}

type Errors = Partial<Record<keyof CompanyContactValues, string>>;

/** Referenz: nur die E-Mail ist Pflicht; Nachricht max. 4000 Zeichen. */
export function validateCompanyContact(form: CompanyContactValues): Errors {
  const errors: Errors = {};
  if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Bitte eine gültige E-Mail-Adresse angeben.';
  if (form.message.length > MAX_MESSAGE) errors.message = `Maximal ${MAX_MESSAGE} Zeichen.`;
  return errors;
}

export interface CompanyContactPrefill {
  text: string;
  /** Erhöht sich bei jeder neuen Übernahme, damit gleiche Texte erneut greifen. */
  nonce: number;
}

const EMPTY: CompanyContactValues = { name: '', email: '', company: '', message: '' };

/**
 * Kontaktformular der Unternehmens-Landing v5 (Referenz `#cform`).
 * Versand wie ContactSales.tsx: same-origin `/api/fn/sales-lead` + CSRF in
 * Produktion, lokal direkt `functions/v1/sales-lead`; der Schlüssel kommt nur
 * aus `src/lib/fn-proxy` (die Referenz hatte ihn hartkodiert — hier nicht).
 * Kein plan_key → generischer Kontakt-Lead mit `source: company-landing`.
 */
export function CompanyContactForm({ prefill }: { prefill?: CompanyContactPrefill | null }) {
  const [form, setForm] = useState<CompanyContactValues>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');
  const [hp, setHp] = useState('');
  const autoMessage = useRef(false);

  // Vorlage aus dem Dialog übernehmen, solange die Nachricht leer oder selbst vorbelegt ist.
  useEffect(() => {
    if (!prefill) return;
    setForm((f) => {
      if (f.message && !autoMessage.current) return f;
      autoMessage.current = Boolean(prefill.text);
      return { ...f, message: prefill.text };
    });
  }, [prefill]);

  function update<K extends keyof CompanyContactValues>(key: K, value: string) {
    if (key === 'message') autoMessage.current = false;
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (hp) return; // Honeypot: Bots füllen das versteckte Feld.
    const found = validateCompanyContact(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setNote(found.email ?? found.message ?? '');
      return;
    }
    setSending(true);
    setNote('Wird gesendet …');
    try {
      if (shouldUseFnProxy()) await ensureCsrfCookie();
      const url = edgeFunctionUrl('sales-lead');
      const resp = await fetch(
        url,
        fnFetchInit(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim() || undefined,
            email: form.email.trim(),
            company: form.company.trim() || undefined,
            message: form.message.trim().slice(0, MAX_MESSAGE) || undefined,
            source: 'company-landing',
            use_case: 'kontakt',
            path: '/unternehmen',
          }),
        }),
      );
      const body = (await resp.json().catch(() => ({}))) as { ok?: boolean };
      if (resp.ok && body.ok !== false) {
        setNote('Danke – Ihre Nachricht ist angekommen. Wir melden uns per E-Mail.');
        setForm(EMPTY);
        autoMessage.current = false;
      } else if (resp.status === 429) {
        setNote('Zu viele Anfragen. Bitte später erneut versuchen.');
      } else {
        setNote(`Senden fehlgeschlagen. Schreiben Sie uns direkt an ${FALLBACK_MAIL}.`);
      }
    } catch {
      setNote(`Keine Verbindung. Schreiben Sie uns direkt an ${FALLBACK_MAIL}.`);
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="cform rv" onSubmit={onSubmit} noValidate aria-describedby="c-privacy">
      <div className="row2">
        <div className="field">
          <label htmlFor="c-name">Name</label>
          <input id="c-name" name="name" type="text" autoComplete="name" value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="c-mail">E-Mail</label>
          <input
            id="c-mail"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? 'c-mail-err' : undefined}
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
          />
          {errors.email && (
            <span id="c-mail-err" className="err">
              {errors.email}
            </span>
          )}
        </div>
      </div>
      <div className="field">
        <label htmlFor="c-co">Unternehmen</label>
        <input id="c-co" name="company" type="text" autoComplete="organization" value={form.company} onChange={(e) => update('company', e.target.value)} />
      </div>
      <input
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />
      <div className="field">
        <label htmlFor="c-msg">Nachricht</label>
        <textarea
          id="c-msg"
          name="message"
          maxLength={MAX_MESSAGE}
          aria-invalid={errors.message ? true : undefined}
          value={form.message}
          onChange={(e) => update('message', e.target.value)}
        />
      </div>
      <button className="btn" type="submit" disabled={sending}>
        Nachricht senden
      </button>
      <small role="status" aria-live="polite" data-testid="contact-note">
        {note}
      </small>
      <small id="c-privacy">
        Wir verwenden Ihre Angaben ausschließlich zur Bearbeitung dieser Anfrage – kein Newsletter, keine Weitergabe. Details in der{' '}
        <Link to="/datenschutz">Datenschutzerklärung</Link>.
      </small>
    </form>
  );
}
