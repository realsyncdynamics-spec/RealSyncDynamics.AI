import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, X, ArrowRight, AlertTriangle } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase';
import type { AuditIssue, AuditOverallSeverity } from '../../../types/pilot';

/**
 * Willkommensbanner nach erfolgreicher Pilot-Aktivierung.
 *
 * Erscheint einmalig, wenn das Dashboard mit `?welcome=pilot` aufgerufen wird —
 * also unmittelbar nach dem Sprung aus `Welcome.tsx`. Es gilt für beide
 * Dashboard-Zweige (Free und Paid), deshalb sitzt es im `DashboardRouter` und
 * nicht in einer der beiden Views.
 *
 * Datenquelle für Score und Befunde ist die bestehende SECURITY-DEFINER-RPC
 * `audit_share_get(uuid)` (Migration 20260506150000). Sie liefert ausschließlich
 * non-PII-Felder — kein neuer Lesepfad, keine zusätzliche RLS-Ausnahme nötig.
 */

interface AuditShareRow {
  share_token: string;
  domain: string;
  score: number;
  severity: AuditOverallSeverity;
  issues: AuditIssue[];
  created_at: string;
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
}

function daysRemaining(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function PilotWelcomeBanner({ domain }: { domain: string | null }) {
  const { activeTenantId } = useTenant();
  const [dismissed, setDismissed] = useState(false);
  const [trialEnd, setTrialEnd] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditShareRow | null>(null);

  // Pilot-Ende aus der Subscription — dieselbe Quelle, aus der auch
  // `useEntitlements` den Plan ableitet.
  useEffect(() => {
    if (!activeTenantId || !isSupabaseConfigured()) return;
    let cancelled = false;
    void (async () => {
      const sb = getSupabase();
      const { data } = await sb
        .from('subscriptions')
        .select('trial_end')
        .eq('tenant_id', activeTenantId)
        .maybeSingle();
      if (!cancelled && data?.trial_end) setTrialEnd(data.trial_end);
    })();
    return () => { cancelled = true; };
  }, [activeTenantId]);

  // Zuletzt beanspruchter Audit dieser Domain → Score + Top-Befunde.
  // Die Zeile selbst ist über die neue Tenant-RLS-Policy lesbar
  // (Migration 20260811120000); die Detaildaten kommen aus der Share-RPC.
  useEffect(() => {
    if (!activeTenantId || !domain || !isSupabaseConfigured()) return;
    let cancelled = false;
    void (async () => {
      const sb = getSupabase();
      const { data: row } = await sb
        .from('gdpr_audits')
        .select('id')
        .eq('tenant_id', activeTenantId)
        .not('claimed_at', 'is', null)
        .order('claimed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !row?.id) return;

      const { data: shared } = await sb.rpc('audit_share_get', { p_id: row.id });
      const first = Array.isArray(shared) ? (shared[0] as AuditShareRow | undefined) : undefined;
      if (!cancelled && first) setAudit(first);
    })();
    return () => { cancelled = true; };
  }, [activeTenantId, domain]);

  if (dismissed) return null;

  const remaining = daysRemaining(trialEnd);
  const endLabel = formatDate(trialEnd);
  const topIssues = (audit?.issues ?? [])
    .slice()
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9))
    .slice(0, 3);

  return (
    <div className="border-2 border-cyan-700 bg-obsidian-900 p-6 mb-8" data-testid="pilot-welcome-banner">
      <div className="flex items-start gap-3">
        <ShieldCheck className="h-6 w-6 text-cyan-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-500 mb-1">
            Governance-Runtime-Pilot aktiv
          </p>
          <h2 className="font-display font-bold text-titanium-50 text-xl leading-tight">
            Deine Governance-Runtime für {domain ?? 'deine Domain'} ist jetzt aktiv (14 Tage Pilot)
          </h2>

          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
            {audit && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-titanium-600">
                  Risiko-Score
                </div>
                <div className="font-display font-bold text-2xl text-titanium-50">
                  {audit.score}<span className="text-sm text-titanium-500">/100</span>
                </div>
              </div>
            )}
            {endLabel && (
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-titanium-600">
                  Pilot bis
                </div>
                <div className="font-display font-bold text-2xl text-titanium-50">
                  {endLabel}
                  {remaining !== null && (
                    <span className="ml-2 text-sm text-titanium-500">
                      noch {remaining} {remaining === 1 ? 'Tag' : 'Tage'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {topIssues.length > 0 && (
            <div className="mt-5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-titanium-600 mb-2">
                Wichtigste Befunde
              </div>
              <ul className="space-y-1.5">
                {topIssues.map((issue) => (
                  <li key={issue.id} className="flex items-start gap-2 text-sm text-titanium-300">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{issue.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex flex-col sm:flex-row gap-3">
            <Link
              to="/app/scans"
              className="inline-flex items-center justify-center gap-2 bg-cyan-400 text-obsidian-950 px-5 py-2.5 text-sm font-bold hover:bg-cyan-300 transition-colors"
            >
              Überwachte Domains ansehen <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/app/onboarding"
              className="inline-flex items-center justify-center gap-2 border border-titanium-700 text-titanium-100 px-5 py-2.5 text-sm font-semibold hover:border-titanium-400 transition-colors"
            >
              Governance einrichten
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Hinweis schließen"
          className="p-1.5 text-titanium-500 hover:text-titanium-200 shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
