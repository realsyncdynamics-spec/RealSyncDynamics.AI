import { useState } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export function FoundingAccessForm() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!SUPABASE_URL) {
      setError('Supabase ist nicht konfiguriert.');
      return;
    }

    const data = new FormData(event.currentTarget);
    const payload = {
      company_name: String(data.get('company_name') || ''),
      contact_email: String(data.get('contact_email') || ''),
      website_url: String(data.get('website_url') || ''),
    };

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/enterprise-ai-os-founding-access`,
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
      setSuccess(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="mt-10 rounded-3xl border border-green-500/30 bg-green-500/10 p-6">
        <h2 className="text-xl font-semibold text-green-300">Founding Access aktiviert</h2>
        <p className="mt-3 text-zinc-300">
          Dein kostenloser Enterprise-Zugang wurde angelegt. Bitte teste die Plattform aktiv und
          sende uns Feedback, Verbesserungsvorschläge und Screenshots von Fehlern.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-10 space-y-5 rounded-3xl border border-white/10 bg-white/[0.03] p-6"
    >
      <div>
        <label htmlFor="company_name" className="text-sm text-zinc-300">Unternehmen</label>
        <input
          id="company_name"
          name="company_name"
          required
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[#d4af37]"
          placeholder="Muster GmbH"
        />
      </div>

      <div>
        <label htmlFor="contact_email" className="text-sm text-zinc-300">E-Mail</label>
        <input
          id="contact_email"
          name="contact_email"
          type="email"
          required
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[#d4af37]"
          placeholder="name@unternehmen.de"
        />
      </div>

      <div>
        <label htmlFor="website_url" className="text-sm text-zinc-300">Website</label>
        <input
          id="website_url"
          name="website_url"
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[#d4af37]"
          placeholder="https://unternehmen.de"
        />
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-[#d4af37] px-6 py-4 font-semibold text-black disabled:opacity-60"
      >
        {loading ? 'Aktiviere …' : 'Founding Access starten'}
      </button>

      <p className="text-xs text-zinc-500">
        Mit der Teilnahme erklärst du dich bereit, Feedback, Verbesserungsvorschläge und
        Screenshots von Fehlern bereitzustellen.
      </p>
    </form>
  );
}
