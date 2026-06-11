import { useMemo, useState } from 'react';
import {
  computeTriage,
  type FeedbackSeverity,
  type FeedbackType,
} from '../../lib/enterprise-ai-os/feedback-triage';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

type Step = 1 | 2 | 3 | 4;

interface FormState {
  type: FeedbackType;
  title: string;
  module: string;
  location: string;
  screenshot_url: string;
  expected_behavior: string;
  actual_behavior: string;
  steps_to_reproduce: string;
  severity: FeedbackSeverity;
  description: string;
}

const INITIAL: FormState = {
  type: 'bug',
  title: '',
  module: '',
  location: '',
  screenshot_url: '',
  expected_behavior: '',
  actual_behavior: '',
  steps_to_reproduce: '',
  severity: 'medium',
  description: '',
};

const PRIORITY_LABELS: Record<string, string> = {
  p0: 'P0 — sofort',
  p1: 'P1 — heute',
  p2: 'P2 — diese Woche',
  p3: 'P3 — Backlog',
};

function captureContext(): { page_url: string; user_agent: string; viewport: string } {
  if (typeof window === 'undefined') {
    return { page_url: '', user_agent: '', viewport: '' };
  }
  return {
    page_url: window.location.href,
    user_agent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
}

export function EnterpriseFeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<FormState>(INITIAL);
  const [success, setSuccess] = useState<{ priority: string; triage_score: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const triagePreview = useMemo(
    () =>
      computeTriage({
        type: state.type,
        severity: state.severity,
        module: state.module,
        location: state.location,
        steps_to_reproduce: state.steps_to_reproduce,
        screenshot_url: state.screenshot_url,
        page_url: typeof window !== 'undefined' ? window.location.href : null,
      }),
    [state],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function reset(): void {
    setState(INITIAL);
    setStep(1);
    setSuccess(null);
    setError(null);
  }

  function buildDescription(): string {
    const parts = [
      state.description?.trim(),
      state.actual_behavior && `Tatsächliches Verhalten: ${state.actual_behavior.trim()}`,
      state.expected_behavior && `Erwartetes Verhalten: ${state.expected_behavior.trim()}`,
      state.steps_to_reproduce && `Schritte:\n${state.steps_to_reproduce.trim()}`,
    ].filter(Boolean);
    // Fallback, falls Beschreibung leer bleibt — aus Triage-Feldern zusammenbauen.
    return parts.join('\n\n') || state.actual_behavior || state.title;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!SUPABASE_URL) {
      setError('Supabase ist nicht konfiguriert.');
      return;
    }

    const ctx = captureContext();
    const payload = {
      type: state.type,
      severity: state.severity,
      title: state.title.trim(),
      description: buildDescription(),
      module: state.module.trim() || null,
      location: state.location.trim() || null,
      screenshot_url: state.screenshot_url.trim() || null,
      expected_behavior: state.expected_behavior.trim() || null,
      actual_behavior: state.actual_behavior.trim() || null,
      steps_to_reproduce: state.steps_to_reproduce.trim() || null,
      page_url: ctx.page_url || null,
      user_agent: ctx.user_agent || null,
      viewport: ctx.viewport || null,
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
      setSuccess({
        priority: body?.triage?.priority ?? triagePreview.priority,
        triage_score: body?.triage?.triage_score ?? triagePreview.triage_score,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const canAdvanceFrom1 = state.title.trim().length > 0;
  const canSubmit = state.title.trim().length > 0;

  return (
    <div className="fixed bottom-5 right-5 z-50 font-mono">
      {open && (
        <div className="mb-4 w-[380px] border border-white/10 bg-[#080b12] p-5 text-white shadow-2xl">
          {success ? (
            <div>
              <h3 className="text-sm uppercase tracking-wider text-[#d4af37]">
                Feedback aufgenommen
              </h3>
              <p className="mt-3 text-sm text-zinc-300">
                Dein Bericht wurde priorisiert und im Triage-Backlog abgelegt.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 border border-white/10 bg-white/[0.03] p-3 text-xs">
                <div>
                  <div className="text-zinc-500">Priorität</div>
                  <div className="mt-1 text-[#d4af37]">
                    {PRIORITY_LABELS[success.priority] ?? success.priority}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500">Triage-Score</div>
                  <div className="mt-1 text-[#d4af37]">{success.triage_score}/100</div>
                </div>
              </div>
              <button
                type="button"
                onClick={reset}
                className="mt-4 w-full border border-white/20 px-4 py-2 text-xs uppercase tracking-wider text-zinc-300 hover:bg-white/5"
              >
                Weiteren Report senden
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm uppercase tracking-wider text-[#d4af37]">
                  Feedback · Schritt {step}/4
                </h3>
                <div className="text-[10px] text-zinc-500">
                  {PRIORITY_LABELS[triagePreview.priority]}
                </div>
              </div>

              <div className="flex gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className={`h-1 flex-1 ${n <= step ? 'bg-[#d4af37]' : 'bg-white/10'}`}
                  />
                ))}
              </div>

              {step === 1 && (
                <div className="space-y-3">
                  <label className="block text-xs uppercase tracking-wider text-zinc-400">
                    Typ
                    <select
                      value={state.type}
                      onChange={(e) => update('type', e.target.value as FeedbackType)}
                      className="mt-1 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    >
                      <option value="bug">Fehler</option>
                      <option value="improvement">Verbesserung</option>
                      <option value="feature_request">Feature-Wunsch</option>
                      <option value="security_issue">Security-Thema</option>
                      <option value="ux_feedback">UX-Feedback</option>
                    </select>
                  </label>

                  <label className="block text-xs uppercase tracking-wider text-zinc-400">
                    Kurz-Titel
                    <input
                      value={state.title}
                      onChange={(e) => update('title', e.target.value)}
                      required
                      placeholder="z. B. Risk-Dashboard lädt leer"
                      className="mt-1 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    />
                  </label>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3">
                  <label className="block text-xs uppercase tracking-wider text-zinc-400">
                    Wo? · Modul
                    <input
                      value={state.module}
                      onChange={(e) => update('module', e.target.value)}
                      placeholder="z. B. AI Registry, Cookie-Scan, Governance"
                      className="mt-1 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    />
                  </label>

                  <label className="block text-xs uppercase tracking-wider text-zinc-400">
                    Wo? · genauer Ort (optional)
                    <input
                      value={state.location}
                      onChange={(e) => update('location', e.target.value)}
                      placeholder="z. B. Tabelle Zeile 3, Button 'Speichern'"
                      className="mt-1 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    />
                  </label>

                  <label className="block text-xs uppercase tracking-wider text-zinc-400">
                    Screenshot-URL (optional)
                    <input
                      value={state.screenshot_url}
                      onChange={(e) => update('screenshot_url', e.target.value)}
                      placeholder="https://..."
                      className="mt-1 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    />
                  </label>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-3">
                  <label className="block text-xs uppercase tracking-wider text-zinc-400">
                    Erwartetes Verhalten
                    <textarea
                      value={state.expected_behavior}
                      onChange={(e) => update('expected_behavior', e.target.value)}
                      placeholder="Was hätte passieren sollen?"
                      className="mt-1 min-h-16 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    />
                  </label>

                  <label className="block text-xs uppercase tracking-wider text-zinc-400">
                    Tatsächliches Verhalten
                    <textarea
                      value={state.actual_behavior}
                      onChange={(e) => update('actual_behavior', e.target.value)}
                      placeholder="Was ist passiert?"
                      className="mt-1 min-h-16 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    />
                  </label>

                  <label className="block text-xs uppercase tracking-wider text-zinc-400">
                    Reproduktion (Schritte)
                    <textarea
                      value={state.steps_to_reproduce}
                      onChange={(e) => update('steps_to_reproduce', e.target.value)}
                      placeholder={'1. Login\n2. Klick auf …\n3. Fehler erscheint'}
                      className="mt-1 min-h-20 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    />
                  </label>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-3">
                  <label className="block text-xs uppercase tracking-wider text-zinc-400">
                    Kritikalität
                    <select
                      value={state.severity}
                      onChange={(e) => update('severity', e.target.value as FeedbackSeverity)}
                      className="mt-1 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    >
                      <option value="low">Niedrig — kosmetisch</option>
                      <option value="medium">Mittel — stört Workflow</option>
                      <option value="high">Hoch — blockiert Workflow</option>
                      <option value="critical">Kritisch — Datenverlust/Security</option>
                    </select>
                  </label>

                  <label className="block text-xs uppercase tracking-wider text-zinc-400">
                    Zusatz-Notiz (optional)
                    <textarea
                      value={state.description}
                      onChange={(e) => update('description', e.target.value)}
                      placeholder="Kontext, Konsequenz, Workaround …"
                      className="mt-1 min-h-16 w-full border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                    />
                  </label>

                  <div className="border border-[#d4af37]/30 bg-[#d4af37]/5 p-3 text-xs">
                    <div className="text-zinc-400">Auto-Triage Vorschau</div>
                    <div className="mt-1 text-[#d4af37]">
                      {PRIORITY_LABELS[triagePreview.priority]} · Score {triagePreview.triage_score}/100
                    </div>
                    {triagePreview.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {triagePreview.tags.map((tag) => (
                          <span
                            key={tag}
                            className="border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-zinc-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => (s - 1) as Step)}
                    className="flex-1 border border-white/20 px-3 py-2 text-xs uppercase tracking-wider text-zinc-300 hover:bg-white/5"
                  >
                    Zurück
                  </button>
                )}
                {step < 4 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => (s + 1) as Step)}
                    disabled={step === 1 && !canAdvanceFrom1}
                    className="flex-1 bg-[#d4af37] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-black disabled:opacity-50"
                  >
                    Weiter
                  </button>
                )}
                {step === 4 && (
                  <button
                    type="submit"
                    disabled={loading || !canSubmit}
                    className="flex-1 bg-[#d4af37] px-3 py-2 text-xs font-semibold uppercase tracking-wider text-black disabled:opacity-50"
                  >
                    {loading ? 'Sende …' : 'Report absenden'}
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-[#d4af37] px-5 py-3 text-xs font-semibold uppercase tracking-wider text-black shadow-lg"
      >
        Feedback
      </button>
    </div>
  );
}
