import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DiscoveryIntakeForm } from '../components/enterprise-ai-os/DiscoveryIntakeForm';

interface PendingSystem {
  id: string;
  tenant_id: string | null;
  name: string;
  provider: string;
  model: string | null;
  usage_context: string | null;
  department: string | null;
  risk_level: 'minimal' | 'limited' | 'high' | 'prohibited' | 'unknown';
  contains_personal_data: boolean;
  contains_sensitive_data: boolean;
  external_usage: boolean;
  intake_source: string;
  created_at: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

const RISK_BADGE: Record<string, string> = {
  prohibited: 'bg-red-500/20 text-red-300 border-red-500/40',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
  limited: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  minimal: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  unknown: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40',
};

export function EnterpriseAiOsDiscovery() {
  const [pending, setPending] = useState<PendingSystem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!SUPABASE_URL) {
      setError('Supabase ist nicht konfiguriert.');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/enterprise-ai-os-discovery-pending?limit=100`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setPending((body?.pending ?? []) as PendingSystem[]);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return (
    <main className="min-h-screen bg-[#05070d] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-full border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-1.5 text-xs text-[#d4af37]">
              Enterprise AI OS · Discovery
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              KI-System melden + Self-Assessment
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-zinc-400">
              Manueller Intake für KI-Systeme im Unternehmen. Jede Meldung erzeugt einen
              ungeprüften Registry-Eintrag und triggert automatisch Risk Classification + Policy
              Enforcement + Audit Agents. Human Review bleibt erforderlich für jede Freigabe.
            </p>
          </div>
          <Link
            to="/dashboard/enterprise-ai-os"
            className="rounded-2xl border border-white/15 px-4 py-2 text-sm text-white"
          >
            ← Dashboard
          </Link>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="text-lg font-semibold">Neues KI-System melden</h2>
            <div className="mt-4">
              <DiscoveryIntakeForm onSuccess={() => void reload()} />
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold">Ungeprüfte KI-Systeme</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {pending.length} Einträge · approved=false · Risk Classification angewandt
            </p>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {loading && (
                <div className="text-sm text-zinc-500">Lade …</div>
              )}

              {!loading && pending.length === 0 && !error && (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-zinc-500">
                  Aktuell keine ungeprüften Systeme. Sobald Self-Assessment, Browser-Intake oder
                  Connector-Sync Findings erzeugen, erscheinen sie hier zur Review.
                </div>
              )}

              {pending.map((sys) => (
                <div
                  key={sys.id}
                  className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4 first:mt-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{sys.name}</div>
                      <div className="text-xs text-zinc-500">
                        {sys.provider}{sys.model ? ` · ${sys.model}` : ''}
                        {sys.department ? ` · ${sys.department}` : ''}
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${
                        RISK_BADGE[sys.risk_level] ?? RISK_BADGE.unknown
                      }`}
                    >
                      {sys.risk_level}
                    </span>
                  </div>
                  {sys.usage_context && (
                    <p className="mt-2 text-xs text-zinc-400">{sys.usage_context}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
                    {sys.contains_sensitive_data && (
                      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-red-300">sensitive data</span>
                    )}
                    {sys.contains_personal_data && (
                      <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-orange-300">personal data</span>
                    )}
                    {sys.external_usage && (
                      <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-blue-300">external</span>
                    )}
                    <span className="rounded-full bg-zinc-500/15 px-2 py-0.5 text-zinc-300">{sys.intake_source}</span>
                  </div>
                  <div className="mt-3 text-[11px] text-zinc-500">
                    Eingereicht: {new Date(sys.created_at).toLocaleString('de-DE')}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <p className="mt-10 text-xs text-zinc-500">
          Hinweis: Dieses System unterstützt Governance, Dokumentation und Risikomanagement. Es
          ersetzt keine individuelle Rechtsberatung. Genehmigung (approval) erfolgt manuell durch
          autorisierte Reviewer.
        </p>
      </div>
    </main>
  );
}
