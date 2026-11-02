import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ensureCsrfCookie } from '../../../lib/csrf';
import { edgeFunctionUrl, fnFetchInit, shouldUseFnProxy } from '../../../lib/fn-proxy';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  name: string;
  email: string;
  company: string;
  message: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

export function validateCompanyContact(form: FormState): Errors {
  const errors: Errors = {};
  if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Bitte eine gültige E-Mail-Adresse angeben.';
  if (form.message.trim().length < 10) errors.message = 'Bitte mindestens 10 Zeichen schreiben.';
  if (form.message.length > 2000) errors.message = 'Maximal 2000 Zeichen.';
  return errors;
}

/**
 * Kontaktformular der Unternehmens-Landing.
 * Gleiches Muster wie ContactSales.tsx: same-origin `/api/fn/sales-lead` + CSRF
 * in Produktion, lokal direkt `functions/v1/sales-lead` (Schlüssel nur über
 * `src/lib/fn-proxy`, nie hartkodiert). Kein plan_key → generischer Kontakt-Lead.
 */
export function CompanyContactForm() {
  const [form, setForm] = useState<FormState>({ name: '', email: '', company: '', message: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [serverError, setServerError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateCompanyContact(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setStatus('sending');
    setServerError(null);
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
            message: form.message.trim(),
            source: 'unternehmen',
            path: '/unternehmen',
          }),
        }),
      );
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(body.error?.message ?? `HTTP ${resp.status}`);
      }
      setStatus('done');
    } catch (err) {
      setServerError((err as Error).message);
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div role="status" className="rounded-none border border-emerald-900 bg-obsidian-900 p-6">
        <p className="font-display text-lg font-semibold text-titanium-50">Danke – Ihre Nachricht ist angekommen.</p>
        <p className="mt-2 text-sm text-titanium-300">Wir antworten per E-Mail.</p>
      </div>
    );
  }

  const field =
    'mt-1 w-full rounded-none border border-obsidian-600 bg-obsidian-950 px-3 py-2 text-sm text-titanium-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-security-400';

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-describedby="kontakt-dsgvo">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm text-titanium-200">
          Name (optional)
          <input className={field} name="name" autoComplete="name" value={form.name} onChange={(e) => update('name', e.target.value)} />
        </label>
        <label className="text-sm text-titanium-200">
          Unternehmen (optional)
          <input className={field} name="company" autoComplete="organization" value={form.company} onChange={(e) => update('company', e.target.value)} />
        </label>
      </div>
      <label className="text-sm text-titanium-200">
        E-Mail
        <input
          className={field}
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'kontakt-email-err' : undefined}
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
        />
        {errors.email && <span id="kontakt-email-err" className="mt-1 block text-xs text-red-400">{errors.email}</span>}
      </label>
      <label className="text-sm text-titanium-200">
        Nachricht
        <textarea
          className={`${field} min-h-[8rem]`}
          name="message"
          required
          maxLength={2000}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? 'kontakt-message-err' : undefined}
          value={form.message}
          onChange={(e) => update('message', e.target.value)}
        />
        {errors.message && <span id="kontakt-message-err" className="mt-1 block text-xs text-red-400">{errors.message}</span>}
      </label>
      <p id="kontakt-dsgvo" className="text-xs leading-relaxed text-titanium-400">
        Wir verwenden Ihre Angaben ausschließlich zur Bearbeitung dieser Anfrage. Details in der{' '}
        <Link to="/datenschutz" className="text-security-400 underline">Datenschutzerklärung</Link>.
      </p>
      {status === 'error' && (
        <p role="alert" className="text-sm text-red-400">
          Senden fehlgeschlagen{serverError ? ` (${serverError})` : ''}. Bitte später erneut versuchen.
        </p>
      )}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="justify-self-start rounded-none border border-security-400 bg-security-400/10 px-5 py-2 text-sm font-semibold text-titanium-50 hover:bg-security-400/20 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-security-400"
      >
        {status === 'sending' ? 'Wird gesendet …' : 'Nachricht senden'}
      </button>
    </form>
  );
}
