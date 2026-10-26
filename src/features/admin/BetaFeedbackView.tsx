import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertTriangle, MessageSquare } from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import { getSupabase } from '../../lib/supabase';

interface FeedbackRow {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  route: string;
  text: string;
  created_at: string;
}

export function BetaFeedbackView() {
  return <AuthGate>{() => <BetaFeedbackInner />}</AuthGate>;
}

function BetaFeedbackInner() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    sb.from('beta_feedback')
      .select('id, tenant_id, user_id, route, text, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data, error: e }) => {
        if (e) { setError(e.message); } else { setRows(data ?? []); }
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="flex h-14 items-center gap-3 border-b border-titanium-900 bg-obsidian-900 px-4">
        <Link to="/app/admin" className="p-1.5 text-titanium-400 hover:text-titanium-200">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center bg-gradient-to-br from-amber-600 to-amber-800">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="font-display text-sm font-semibold tracking-tight text-titanium-50">
              Beta-Feedback
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-wider text-titanium-500">
              Admin-Ansicht · neueste zuerst
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-titanium-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade …
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <p className="border border-titanium-800 bg-obsidian-900 p-6 text-center text-sm text-titanium-400">
            Noch kein Feedback eingegangen.
          </p>
        )}
        {rows.map((r) => (
          <article key={r.id} className="border border-titanium-800 bg-obsidian-900 p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] text-titanium-500">{r.route || '/'}</span>
              <span className="font-mono text-[10px] text-titanium-600">
                {new Date(r.created_at).toLocaleString('de-DE')}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-titanium-200">{r.text}</p>
            {r.tenant_id && (
              <p className="font-mono text-[10px] text-titanium-600">
                Mandant: {r.tenant_id}
              </p>
            )}
          </article>
        ))}
      </main>
    </div>
  );
}
