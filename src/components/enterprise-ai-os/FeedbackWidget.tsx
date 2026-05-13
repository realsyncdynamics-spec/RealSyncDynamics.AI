import { useState } from 'react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export function EnterpriseFeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!SUPABASE_URL) {
      setError('Supabase ist nicht konfiguriert.');
      return;
    }

    const data = new FormData(event.currentTarget);
    const payload = {
      type: String(data.get('type') || 'bug'),
      severity: String(data.get('severity') || 'medium'),
      title: String(data.get('title') || ''),
      description: String(data.get('description') || ''),
      module: String(data.get('module') || ''),
      screenshot_url: String(data.get('screenshot_url') || ''),
    };

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/enterprise-ai-os-feedback`,
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

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-4 w-[340px] rounded-3xl border border-white/10 bg-[#080b12] p-5 text-white shadow-2xl">
          {success ? (
            <div>
              <h3 className="font-semibold text-[#d4af37]">Danke für dein Feedback</h3>
              <p className="mt-2 text-sm text-zinc-400">Dein Bericht wurde gespeichert.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <h3 className="font-semibold text-[#d4af37]">Feedback senden</h3>

              <select name="type" className="w-full rounded-xl bg-black/40 px-3 py-2 text-sm">
                <option value="bug">Fehler</option>
                <option value="improvement">Verbesserung</option>
                <option value="feature_request">Feature-Wunsch</option>
                <option value="security_issue">Security-Thema</option>
                <option value="ux_feedback">UX Feedback</option>
              </select>

              <select name="severity" className="w-full rounded-xl bg-black/40 px-3 py-2 text-sm" defaultValue="medium">
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
                <option value="critical">Kritisch</option>
              </select>

              <input
                name="title"
                required
                placeholder="Kurzbeschreibung"
                className="w-full rounded-xl bg-black/40 px-3 py-2 text-sm"
              />

              <textarea
                name="description"
                required
                placeholder="Was ist passiert?"
                className="min-h-24 w-full rounded-xl bg-black/40 px-3 py-2 text-sm"
              />

              <input
                name="module"
                placeholder="Modul, z.B. AI Registry"
                className="w-full rounded-xl bg-black/40 px-3 py-2 text-sm"
              />

              <input
                name="screenshot_url"
                placeholder="Screenshot-Link optional"
                className="w-full rounded-xl bg-black/40 px-3 py-2 text-sm"
              />

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-[#d4af37] px-4 py-3 font-semibold text-black disabled:opacity-60"
              >
                {loading ? 'Sende …' : 'Feedback senden'}
              </button>
            </form>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full bg-[#d4af37] px-5 py-3 font-semibold text-black shadow-lg"
      >
        Feedback
      </button>
    </div>
  );
}
