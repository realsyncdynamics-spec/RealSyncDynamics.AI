import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface Props {
  source?: string;
  variant?: 'footer' | 'inline';
}

export function NewsletterForm({ source = 'footer', variant = 'footer' }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/newsletter-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), source }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error?.message ?? `HTTP ${resp.status}`);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className={`flex items-start gap-2 text-sm ${variant === 'footer' ? 'text-emerald-300' : 'text-emerald-200 bg-emerald-950/40 border border-emerald-700 p-3 rounded-none'}`}>
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          Fast geschafft — wir haben Dir eine Bestätigungs-Email geschickt.
          Klicke den Link drin, dann bist Du dabei.
        </div>
      </div>
    );
  }

  const isFooter = variant === 'footer';
  return (
    <form onSubmit={handleSubmit} className={isFooter ? 'space-y-2' : 'space-y-3'}>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1 relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-titanium-500" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dein@firma.de"
            disabled={loading}
            className="w-full bg-obsidian-950 border border-titanium-800 pl-9 pr-3 py-2 text-sm rounded-none outline-none focus:border-security-500 disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-security-500 hover:bg-security-600 disabled:opacity-40 text-white text-sm font-bold rounded-none"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Anmelden
        </button>
      </div>
      {error && (
        <div className="flex items-start gap-1.5 text-xs text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{error}
        </div>
      )}
      <p className="text-[11px] text-titanium-500 leading-relaxed">
        DSGVO + AI Act Updates · 1× monatlich · Double-Opt-In gemäß § 7 UWG ·
        jederzeit kündbar via{' '}
        <Link to="/legal/privacy" className="text-security-400 hover:underline">Datenschutz</Link>.
      </p>
    </form>
  );
}
