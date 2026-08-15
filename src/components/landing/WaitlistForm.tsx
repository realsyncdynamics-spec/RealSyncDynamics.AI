import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';

/**
 * WaitlistForm — Anmeldeformular der Warteliste (/warteliste).
 *
 * Sendet an die Edge Function `waitlist-join` (verify_jwt = false), die als
 * einzige Instanz schreibend auf `waitlist_signups` zugreift. Der Browser
 * bekommt weder Service-Role-Key noch direkten Tabellenzugriff.
 *
 * Die zurueckgegebene Position kommt aus der Datenbank (BIGSERIAL) — es wird
 * nie eine Zahl geschaetzt oder hochgezaehlt. Ohne erreichbares Backend zeigt
 * das Formular einen Fehler statt einer falschen Erfolgsmeldung.
 */

/**
 * Lazy statt Modul-Konstante: die Env wird erst beim Absenden gelesen, damit
 * Tests sie stubben koennen und ein spaet injizierter Wert nicht ignoriert wird.
 */
function supabaseUrl(): string | undefined {
  return import.meta.env.VITE_SUPABASE_URL as string | undefined;
}

export const WAITLIST_INTERESTS = [
  { value: 'runtime', label: 'Governance Runtime' },
  { value: 'siteos', label: 'SiteOS / Website-Ebene' },
  { value: 'evidence', label: 'Evidence Vault' },
  { value: 'provenance', label: 'Herkunftsnachweis (C2PA)' },
  { value: 'audit', label: 'DSGVO-Audit' },
  { value: 'other', label: 'Etwas anderes' },
] as const;

const TEAM_SIZES = ['1-9', '10-49', '50-249', '250-999', '1000+'] as const;

interface Props {
  /** Herkunft der Anmeldung, landet in `waitlist_signups.source`. */
  source?: string;
  /** Kompaktvariante ohne Firmen-/Rollenfelder — z. B. fuer den finalen CTA. */
  compact?: boolean;
  /** id fuer Sprungmarken (#warteliste-formular). */
  id?: string;
}

export function WaitlistForm({ source = 'warteliste', compact = false, id }: Props) {
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ position: number; already: boolean } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const baseUrl = supabaseUrl();
    if (!baseUrl) {
      setError('Die Anmeldung ist gerade nicht erreichbar. Bitte schreiben Sie uns direkt.');
      return;
    }

    const data = new FormData(event.currentTarget);
    // utm_*-Parameter aus der aktuellen URL uebernehmen — die Zuordnung von
    // Kampagne zu Anmeldung passiert serverseitig, nicht ueber Cookies.
    const utm: Record<string, string> = {};
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
      const value = params.get(key);
      if (value) utm[key] = value;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/functions/v1/waitlist-join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: String(data.get('email') ?? '').trim().toLowerCase(),
          company: String(data.get('company') ?? '').trim() || undefined,
          role: String(data.get('role') ?? '').trim() || undefined,
          interest: String(data.get('interest') ?? 'runtime'),
          team_size: String(data.get('team_size') ?? '') || undefined,
          note: String(data.get('note') ?? '').trim() || undefined,
          source,
          referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
          utm,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error?.message ?? `Anmeldung fehlgeschlagen (HTTP ${res.status}).`);
      }
      setResult({ position: payload.position, already: Boolean(payload.already_registered) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div
        id={id}
        className="rounded-panel border border-petrol-200 bg-petrol-50 p-7 sm:p-8"
        role="status"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card border border-petrol-200 bg-white">
            <CheckCircle2 className="h-5 w-5 text-petrol-700" strokeWidth={1.75} />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {result.already ? 'Sie stehen bereits auf der Liste' : 'Sie sind auf der Warteliste'}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Ihre Position:{' '}
              <span className="font-mono text-base font-semibold text-petrol-700">
                #{result.position}
              </span>
              . Wir melden uns per E-Mail, sobald ein Platz frei wird — ohne Newsletter,
              ohne Weitergabe an Dritte.
            </p>
            <p className="mt-4 text-sm text-slate-600">
              Bis dahin können Sie den{' '}
              <Link to="/audit?source=warteliste-success" className="font-semibold text-petrol-700 hover:underline">
                kostenlosen DSGVO-Website-Scan
              </Link>{' '}
              nutzen — der ist ohne Warteliste verfügbar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      id={id}
      onSubmit={handleSubmit}
      className="rounded-panel border border-slate-200 bg-white p-6 sm:p-8"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className={compact ? 'sm:col-span-2' : ''}>
          <label htmlFor="wl-email" className="mb-2 block text-sm font-medium text-slate-700">
            Geschäftliche E-Mail <span className="text-petrol-700">*</span>
          </label>
          <input
            id="wl-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="name@unternehmen.de"
            disabled={loading}
            className="w-full rounded-chip border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-petrol-600 disabled:opacity-60"
          />
        </div>

        {!compact && (
          <>
            <div>
              <label htmlFor="wl-company" className="mb-2 block text-sm font-medium text-slate-700">
                Unternehmen
              </label>
              <input
                id="wl-company"
                name="company"
                autoComplete="organization"
                placeholder="Muster GmbH"
                disabled={loading}
                className="w-full rounded-chip border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-petrol-600 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="wl-role" className="mb-2 block text-sm font-medium text-slate-700">
                Ihre Rolle
              </label>
              <input
                id="wl-role"
                name="role"
                autoComplete="organization-title"
                placeholder="z. B. Datenschutzbeauftragte:r, CTO"
                disabled={loading}
                className="w-full rounded-chip border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-petrol-600 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="wl-team" className="mb-2 block text-sm font-medium text-slate-700">
                Mitarbeitende
              </label>
              <select
                id="wl-team"
                name="team_size"
                defaultValue=""
                disabled={loading}
                className="w-full rounded-chip border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition-colors focus:border-petrol-600 disabled:opacity-60"
              >
                <option value="">Keine Angabe</option>
                {TEAM_SIZES.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className={compact ? 'sm:col-span-2' : ''}>
          <label htmlFor="wl-interest" className="mb-2 block text-sm font-medium text-slate-700">
            Worauf warten Sie?
          </label>
          <select
            id="wl-interest"
            name="interest"
            defaultValue="runtime"
            disabled={loading}
            className="w-full rounded-chip border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition-colors focus:border-petrol-600 disabled:opacity-60"
          >
            {WAITLIST_INTERESTS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {!compact && (
          <div className="sm:col-span-2">
            <label htmlFor="wl-note" className="mb-2 block text-sm font-medium text-slate-700">
              Was möchten Sie zuerst lösen? <span className="text-slate-400">(optional)</span>
            </label>
            <textarea
              id="wl-note"
              name="note"
              rows={3}
              maxLength={2000}
              placeholder="z. B. KI-Inventar für den AI Act aufbauen, Consent-Setup prüfen, Nachweise für die Aufsicht sammeln"
              disabled={loading}
              className="w-full resize-y rounded-panel border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-petrol-600 disabled:opacity-60"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-2.5 rounded-chip border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-chip bg-petrol-700 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-petrol-600 disabled:opacity-60 sm:w-auto"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? 'Wird eingetragen …' : 'Auf die Warteliste'}
        {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
      </button>

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Wir nutzen Ihre Angaben ausschließlich, um Sie über die Freigabe zu informieren —
        kein Newsletter, keine Weitergabe an Dritte, jederzeit widerrufbar. Hosting in
        Frankfurt. Details in der{' '}
        <Link to="/datenschutz" className="text-petrol-700 hover:underline">Datenschutzerklärung</Link>.
      </p>
    </form>
  );
}
