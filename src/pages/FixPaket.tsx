import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, AlertTriangle, CheckCircle2, Wrench } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/**
 * /fix-paket — public request form for the DSGVO-Fix-Paket Light service.
 *
 * Writes into public.sales_leads via the existing sales-lead Edge Function.
 * That function uses service_role under the hood (RLS-safe), rate-limits
 * 5 submissions per ip-hash per hour, and is shared with /contact-sales.
 * No new table, no new edge function.
 *
 * Funnel-state signal lives in the use_case field (free text, max 50 chars
 * per the function's input cap) — set to 'fix_package_requested'.
 * status stays 'new' (default), which is the only constraint-safe value
 * (CHECK allows: new, contacted, qualified, lost, won).
 */
export function FixPaket() {
  const [params] = useSearchParams();
  const auditIdFromUrl = params.get('audit') ?? '';
  const sourceTag = params.get('source') ?? 'fix-paket';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [message, setMessage] = useState('');
  const [auditId, setAuditId] = useState(auditIdFromUrl);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = 'DSGVO-Fix-Paket Light · RealSyncDynamics.AI';
    return () => {
      document.title = prev;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Embed audit_id + website into the message field so context survives,
      // since the existing sales-lead function does not accept a metadata
      // object directly (we deliberately do not extend that function here).
      const lines: string[] = [];
      lines.push(`Website: ${website.trim()}`);
      if (auditId.trim()) lines.push(`Audit-ID: ${auditId.trim()}`);
      if (sourceTag) lines.push(`Source-Tag: ${sourceTag}`);
      if (message.trim()) lines.push('', message.trim());

      const resp = await fetch(`${SUPABASE_URL}/functions/v1/sales-lead`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim().toLowerCase(),
          use_case: 'fix_package_requested',
          message: lines.join('\n'),
          source: 'fix_package',
          path: '/fix-paket',
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`Anfrage fehlgeschlagen (${resp.status}). ${txt.slice(0, 200)}`);
      }
      setDone(true);
    } catch (e) {
      setError((e as Error).message ?? 'Anfrage fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link
          to="/"
          className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3"
          aria-label="Zur Startseite"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-titanium-500 to-titanium-700 flex items-center justify-center">
            <Wrench className="h-4 w-4 text-titanium-50" />
          </div>
          <div className="font-display font-bold text-sm tracking-tight text-titanium-50">DSGVO-Fix-Paket Light</div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-gold-400 mb-3">
              Zusätzlicher Dienst · projektbasiert
            </div>
            <h1 className="font-display font-bold text-3xl sm:text-4xl text-titanium-50 tracking-tight leading-tight mb-4">
              DSGVO-Fix-Paket Light
            </h1>
            <p className="text-base sm:text-lg text-titanium-300 max-w-2xl mx-auto leading-relaxed">
              Technische Unterstützung bei typischen DSGVO-/TDDDG-Risiken wie Consent, externe Dienste, Fonts,
              Tracking und Datenschutzhinweisen.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 border border-titanium-700 bg-obsidian-900 text-titanium-200 text-xs font-bold uppercase tracking-wider rounded-none">
              Ab 490 € · projektbasiert
            </div>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-10 max-w-xl mx-auto">
            {[
              'Consent-Banner-Härtung (Opt-in, kein Pre-Tracking)',
              'Externe Dienste auf lokales Hosting umstellen (Fonts, Analytics)',
              'Tracking-Inventar mit Paragraphen-Verweisen',
              'Datenschutzhinweise auf erkannte Tools abgleichen',
            ].map((b) => (
              <li
                key={b}
                className="flex items-center gap-2 text-sm text-silver-200 bg-obsidian-900/60 border border-silver-700/30 px-3 py-2 rounded-none"
              >
                <span className="text-gold-400 text-xs">▸</span>
                {b}
              </li>
            ))}
          </ul>

          {done ? (
            <div className="flex items-start gap-3 p-5 bg-obsidian-900 border border-emerald-700 rounded-none">
              <CheckCircle2 className="h-5 w-5 text-emerald-300 shrink-0 mt-0.5" />
              <div>
                <div className="font-display font-bold text-titanium-50 mb-1">Anfrage erhalten</div>
                <p className="text-sm text-titanium-300 leading-relaxed">
                  Unser Team meldet sich mit einem Umsetzungs-Vorschlag innerhalb von 24 Std. Direkter Kanal: <a href="mailto:support@realsyncdynamicsai.de" className="text-security-400 hover:underline">support@realsyncdynamicsai.de</a>.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-obsidian-900 border border-titanium-900 p-6 sm:p-8 rounded-none space-y-4">
              {error && (
                <div className="flex items-start gap-2 text-sm text-red-300 bg-red-950/40 border border-red-900 rounded-none p-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <Field label="Name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vor- und Nachname"
                  className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-titanium-100"
                />
              </Field>

              <Field label="E-Mail" required>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ihre@email.de"
                  autoComplete="email"
                  className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-titanium-100"
                />
              </Field>

              <Field label="Website" required>
                <input
                  type="text"
                  required
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://ihre-domain.de"
                  className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-titanium-100"
                />
              </Field>

              <Field label="Audit-ID (optional)">
                <input
                  type="text"
                  value={auditId}
                  onChange={(e) => setAuditId(e.target.value)}
                  placeholder="UUID aus einem vorherigen Free-Audit"
                  className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-titanium-100 font-mono"
                />
              </Field>

              <Field label="Nachricht">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Welche Risiken priorisieren? Was ist schon angegangen?"
                  rows={4}
                  className="w-full bg-obsidian-950 border border-titanium-900 px-3 py-2.5 text-sm rounded-none outline-none focus:border-titanium-100"
                />
              </Field>

              <button
                type="submit"
                disabled={loading || !email || !website}
                className="surface-mono w-full inline-flex items-center justify-center gap-2 px-6 py-3 disabled:opacity-40 font-bold rounded-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Anfrage wird gesendet …
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Fix-Paket anfragen
                  </>
                )}
              </button>

              <p className="text-[11px] text-titanium-500 leading-relaxed pt-1">
                Unser Team meldet sich innerhalb von 24 Std. mit einem Vorschlag. Verarbeitung gemäß{' '}
                <Link to="/legal/privacy" className="text-titanium-100 hover:underline">
                  Datenschutzerklärung
                </Link>
                .
              </p>
            </form>
          )}

          <p className="mt-8 text-center text-[11px] text-titanium-500 max-w-2xl mx-auto leading-relaxed">
            Diese Leistung ist Unterstützung bei Priorisierung und technischer Umsetzung. Sie ersetzt keine
            individuelle Rechtsberatung und keine vollständige technische Prüfung.
          </p>
        </div>
      </main>

      <footer className="border-t border-titanium-900 px-4 sm:px-6 py-8">
        <div className="max-w-5xl mx-auto text-xs text-titanium-500 flex flex-wrap items-center justify-between gap-3">
          <span>© 2026 RealSync Dynamics · Made in Germany · Hosted in EU</span>
          <Link to="/legal/methodology" className="hover:text-titanium-300">
            Methodik 2026.05.0
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-titanium-400 font-bold mb-1.5">
        {label}
        {required ? <span className="text-red-400 ml-1">*</span> : null}
      </div>
      {children}
    </label>
  );
}
