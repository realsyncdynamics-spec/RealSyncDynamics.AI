import { useState } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

interface ApplicationState {
  company_name: string;
  contact_name: string;
  contact_email: string;
  industry: string;
  website_count: string;
  current_stack: string;
  pain_points: string;
  motivation: string;
}

const INITIAL: ApplicationState = {
  company_name: '',
  contact_name: '',
  contact_email: '',
  industry: '',
  website_count: '',
  current_stack: '',
  pain_points: '',
  motivation: '',
};

const INDUSTRIES = [
  'Agentur',
  'SaaS',
  'E-Commerce',
  'Gesundheitswesen',
  'Bildung',
  'Versicherung',
  'Kanzlei',
  'Steuerberatung',
  'FinTech',
  'Öffentlicher Sektor',
  'Sonstige',
];

interface SuccessState {
  remaining_slots: number;
  duration_days: number;
}

export function BetaApplicationForm() {
  const [state, setState] = useState<ApplicationState>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  function update<K extends keyof ApplicationState>(key: K, value: ApplicationState[K]): void {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!SUPABASE_URL) {
      setError('Supabase ist nicht konfiguriert.');
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      company_name: state.company_name.trim(),
      contact_name: state.contact_name.trim(),
      contact_email: state.contact_email.trim(),
      industry: state.industry.trim() || null,
      website_count: state.website_count.trim() ? Number.parseInt(state.website_count, 10) : null,
      current_stack: state.current_stack.trim() || null,
      pain_points: state.pain_points.trim() || null,
      motivation: state.motivation.trim() || null,
    };

    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/beta-program-apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setSuccess({
        remaining_slots: typeof body.remaining_slots === 'number' ? body.remaining_slots : 0,
        duration_days: typeof body.duration_days === 'number' ? body.duration_days : 365,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="mt-10 border border-[#d4af37]/40 bg-[#d4af37]/5 p-6 font-mono text-white">
        <h2 className="text-sm uppercase tracking-wider text-[#d4af37]">Bewerbung eingegangen</h2>
        <p className="mt-3 text-sm text-zinc-300">
          Wir prüfen jede Bewerbung persönlich und melden uns innerhalb von 48 Stunden zurück.
          Bei Zusage erhalten Sie {success.duration_days} Tage Enterprise-Zugang.
        </p>
        <div className="mt-4 inline-block border border-white/10 bg-black/40 px-3 py-1 text-xs text-zinc-400">
          Verbleibende Plätze nach Ihrer Bewerbung: <span className="text-[#d4af37]">{success.remaining_slots}</span>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-10 space-y-5 border border-white/10 bg-white/[0.02] p-6 font-mono text-white"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs uppercase tracking-wider text-zinc-400">
          Unternehmen *
          <input
            value={state.company_name}
            onChange={(e) => update('company_name', e.target.value)}
            required
            placeholder="Muster GmbH"
            className="mt-1 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]"
          />
        </label>

        <label className="block text-xs uppercase tracking-wider text-zinc-400">
          Ansprechpartner *
          <input
            value={state.contact_name}
            onChange={(e) => update('contact_name', e.target.value)}
            required
            placeholder="Vorname Nachname"
            className="mt-1 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]"
          />
        </label>

        <label className="block text-xs uppercase tracking-wider text-zinc-400">
          E-Mail *
          <input
            type="email"
            value={state.contact_email}
            onChange={(e) => update('contact_email', e.target.value)}
            required
            placeholder="name@unternehmen.de"
            className="mt-1 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]"
          />
        </label>

        <label className="block text-xs uppercase tracking-wider text-zinc-400">
          Branche
          <select
            value={state.industry}
            onChange={(e) => update('industry', e.target.value)}
            className="mt-1 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]"
          >
            <option value="">— bitte wählen —</option>
            {INDUSTRIES.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs uppercase tracking-wider text-zinc-400">
          Anzahl Websites
          <input
            type="number"
            min="0"
            value={state.website_count}
            onChange={(e) => update('website_count', e.target.value)}
            placeholder="z. B. 12"
            className="mt-1 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]"
          />
        </label>

        <label className="block text-xs uppercase tracking-wider text-zinc-400">
          Aktueller Stack
          <input
            value={state.current_stack}
            onChange={(e) => update('current_stack', e.target.value)}
            placeholder="z. B. Usercentrics, Cookiebot, Eigenbau"
            className="mt-1 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]"
          />
        </label>
      </div>

      <label className="block text-xs uppercase tracking-wider text-zinc-400">
        DSGVO- / AI-Act-Probleme
        <textarea
          value={state.pain_points}
          onChange={(e) => update('pain_points', e.target.value)}
          placeholder="Welche Compliance-Themen kosten Sie aktuell am meisten Zeit?"
          className="mt-1 min-h-20 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]"
        />
      </label>

      <label className="block text-xs uppercase tracking-wider text-zinc-400">
        Warum Beta-Partner?
        <textarea
          value={state.motivation}
          onChange={(e) => update('motivation', e.target.value)}
          placeholder="Was möchten Sie mitgestalten? Wofür brauchen Sie die Plattform konkret?"
          className="mt-1 min-h-20 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[#d4af37]"
        />
      </label>

      {error && (
        <div className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#d4af37] px-6 py-4 text-xs font-semibold uppercase tracking-wider text-black disabled:opacity-60"
      >
        {loading ? 'Sende Bewerbung …' : 'Jetzt bewerben'}
      </button>

      <p className="text-[11px] text-zinc-500">
        Mit der Bewerbung erklären Sie sich bereit, im Falle einer Zusage aktiv Feedback,
        Bug-Reports und Screenshots beizusteuern. Wir prüfen jede Bewerbung persönlich.
      </p>
    </form>
  );
}
