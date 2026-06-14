import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Activity, AlertTriangle, Loader2, FileLock2,
  ShieldCheck, Bot, ExternalLink, Clock,
} from 'lucide-react';
import { AuthGate } from '../kodee/connections/AuthGate';
import {
  fetchEventById, fetchEvidenceForEvent, fetchAssetById, fetchPolicyById,
  type DbGovernanceEvent, type DbGovernanceEvidence,
  type DbGovernanceAsset, type DbGovernancePolicy,
} from './governanceApi';
import type { GovernanceRiskLevel } from './types';

/**
 * /governance/events/:eventId — single-event drill-down. Reads
 * the event itself, its evidence chain, the linked asset (if
 * any) and the matched policy (if any). All four reads honour
 * tenant-RLS so an event from another tenant returns 404.
 */
export function EventDetailView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<DbGovernanceEvent | null | undefined>(undefined);
  const [evidence, setEvidence] = useState<DbGovernanceEvidence[] | null>(null);
  const [asset, setAsset] = useState<DbGovernanceAsset | null>(null);
  const [policy, setPolicy] = useState<DbGovernancePolicy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    setError(null);
    (async () => {
      try {
        const ev = await fetchEventById(eventId);
        setEvent(ev);
        if (!ev) return;
        const [evs, a, p] = await Promise.all([
          fetchEvidenceForEvent(eventId),
          ev.asset_id ? fetchAssetById(ev.asset_id) : Promise.resolve(null),
          ev.policy_id ? fetchPolicyById(ev.policy_id) : Promise.resolve(null),
        ]);
        setEvidence(evs);
        setAsset(a);
        setPolicy(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen');
      }
    })();
  }, [eventId]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4">
        <Link to="/app/websites" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Event Detail</div>
            <div className="text-[11px] text-titanium-400 font-mono">{eventId}</div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {event === undefined ? (
          <Loader />
        ) : event === null ? (
          <NotFound />
        ) : (
          <Body event={event} evidence={evidence ?? []} asset={asset} policy={policy} />
        )}
      </main>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
      <Loader2 className="h-4 w-4 animate-spin" /> Lade Event…
    </div>
  );
}

function NotFound() {
  return (
    <div className="text-center py-16">
      <AlertTriangle className="h-8 w-8 mx-auto text-titanium-600 mb-3" />
      <h2 className="font-display text-lg font-bold text-titanium-50 mb-1">Event nicht gefunden</h2>
      <p className="text-sm text-titanium-400 mb-4">
        Das Event existiert nicht oder gehört zu einem anderen Tenant.
      </p>
      <Link to="/app/websites" className="text-amber-300 hover:text-amber-200 text-sm font-semibold">
        → Zurück zum Dashboard
      </Link>
    </div>
  );
}

function Body({
  event, evidence, asset, policy,
}: {
  event: DbGovernanceEvent;
  evidence: DbGovernanceEvidence[];
  asset: DbGovernanceAsset | null;
  policy: DbGovernancePolicy | null;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="border border-titanium-900 bg-obsidian-900/60 p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-titanium-500 mb-1">
              {event.event_type} · {event.event_source}
            </div>
            <h1 className="font-display font-bold text-titanium-50 text-2xl tracking-tight leading-tight">
              {event.title}
            </h1>
          </div>
          <RiskBadge level={event.risk_level} />
        </div>
        {event.summary && (
          <p className="text-sm text-titanium-300 leading-relaxed">{event.summary}</p>
        )}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
          <Meta label="Erfasst" value={new Date(event.created_at).toLocaleString('de-DE')} icon={<Clock className="h-3 w-3" />} />
          {event.vendor      && <Meta label="Vendor"     value={event.vendor} />}
          {event.model_name  && <Meta label="Model"      value={event.model_name} />}
          {event.actor_email && <Meta label="Actor"      value={event.actor_email} />}
        </div>
        {event.data_types && event.data_types.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {event.data_types.map((dt) => (
              <span key={dt} className="text-[10px] font-mono uppercase tracking-wider bg-titanium-900/60 text-titanium-300 border border-titanium-800 px-1.5 py-0.5">
                {dt}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Policy decision */}
      {(policy || event.policy_action) && (
        <Section icon={<ShieldCheck className="h-4 w-4" />} title="Policy Decision">
          <div className="space-y-2">
            {policy ? (
              <>
                <div className="text-titanium-50 font-semibold">{policy.name}</div>
                {policy.description && (
                  <p className="text-[13px] text-titanium-300 leading-relaxed">{policy.description}</p>
                )}
                <div className="text-[11px] font-mono uppercase tracking-wider text-titanium-400">
                  {policy.policy_type} · severity {policy.severity}
                </div>
                {Object.keys(policy.condition ?? {}).length > 0 && (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-500 mt-2 mb-1">Condition</div>
                    <pre className="bg-obsidian-950 border border-titanium-900 text-[12px] font-mono text-titanium-300 p-3 overflow-x-auto">
{JSON.stringify(policy.condition, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-titanium-400">
                Caller-supplied <code>policy_action</code> — keine tenant-Policy gematcht.
              </div>
            )}
            {event.policy_action && (
              <div className="pt-2">
                <span className={`inline-block border px-2 py-1 text-[11px] font-mono uppercase tracking-wider ${actionCls(event.policy_action)}`}>
                  Aktion · {event.policy_action}
                </span>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Linked asset */}
      {asset && (
        <Section icon={<Bot className="h-4 w-4" />} title="Linked Asset">
          <Link
            to={`/governance/assets/${asset.id}`}
            className="block border border-titanium-900 bg-obsidian-950/60 p-3 hover:border-amber-500/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-titanium-50 font-semibold">{asset.name}</div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5">
                  {asset.asset_type} · {asset.ai_act_class} · {asset.status}
                </div>
                {asset.vendor && (
                  <div className="text-[11px] text-titanium-500 mt-0.5">Vendor: {asset.vendor}</div>
                )}
              </div>
              <div className="flex items-center gap-2 text-titanium-400">
                <span className={`font-mono text-sm font-bold ${scoreClass(asset.risk_score)}`}>
                  {asset.risk_score}/100
                </span>
                <ExternalLink className="h-3.5 w-3.5" />
              </div>
            </div>
          </Link>
        </Section>
      )}

      {/* Payload */}
      {Object.keys(event.payload ?? {}).length > 0 && (
        <Section icon={<Activity className="h-4 w-4" />} title="Payload">
          <pre className="bg-obsidian-950 border border-titanium-900 text-[12px] font-mono text-titanium-300 p-3 overflow-x-auto">
{JSON.stringify(event.payload, null, 2)}
          </pre>
        </Section>
      )}

      {/* Evidence chain */}
      <Section icon={<FileLock2 className="h-4 w-4" />} title={`Evidence (${evidence.length})`}>
        {evidence.length === 0 ? (
          <div className="text-sm text-titanium-500">Keine Evidence-Artefakte zu diesem Event.</div>
        ) : (
          <ul className="space-y-2">
            {evidence.map((ev) => (
              <li key={ev.id} className="border border-titanium-900 bg-obsidian-950/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-titanium-50 font-semibold text-sm">{ev.title}</div>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-titanium-400 mt-0.5">
                      {ev.evidence_type} · {new Date(ev.created_at).toLocaleString('de-DE')}
                    </div>
                    {ev.content_hash && (
                      <div className="text-[11px] font-mono text-amber-300 mt-1 break-all">
                        {ev.content_hash}
                      </div>
                    )}
                    {ev.previous_hash && (
                      <div className="text-[11px] font-mono text-titanium-500 mt-0.5 break-all">
                        ← {ev.previous_hash}
                      </div>
                    )}
                  </div>
                  {ev.storage_path && (
                    <code className="text-[11px] font-mono text-titanium-500 text-right shrink-0">
                      {ev.storage_path}
                    </code>
                  )}
                </div>
                {Object.keys(ev.metadata ?? {}).length > 0 && (
                  <pre className="mt-2 bg-obsidian-900 border border-titanium-900 text-[11px] font-mono text-titanium-400 p-2 overflow-x-auto">
{JSON.stringify(ev.metadata, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/* ── Helpers ─────────────────────────────────────────────────── */

function Section({
  icon, title, children,
}: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="border border-titanium-900 bg-obsidian-900/60">
      <header className="px-4 py-3 border-b border-titanium-900 flex items-center gap-2 text-titanium-200">
        {icon}
        <h2 className="font-display font-bold text-titanium-50 text-sm tracking-wider uppercase">{title}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Meta({
  label, value, icon,
}: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="border border-titanium-900 bg-obsidian-950/40 px-2.5 py-1.5">
      <div className="text-[9px] font-mono uppercase tracking-wider text-titanium-500 flex items-center gap-1">
        {icon}{label}
      </div>
      <div className="text-[12px] text-titanium-200 font-mono mt-0.5 truncate">{value}</div>
    </div>
  );
}

function RiskBadge({ level }: { level: GovernanceRiskLevel }) {
  const cls =
    level === 'critical' ? 'text-red-300 border-red-500/60 bg-red-500/10' :
    level === 'high'     ? 'text-amber-300 border-amber-500/60 bg-amber-500/10' :
    level === 'medium'   ? 'text-yellow-200 border-yellow-500/50 bg-yellow-500/10' :
    level === 'low'      ? 'text-sky-300 border-sky-500/50 bg-sky-500/10' :
                           'text-titanium-300 border-titanium-700 bg-titanium-800/30';
  return (
    <span className={`shrink-0 border px-2 py-1 text-[10px] font-mono uppercase tracking-wider ${cls}`}>
      {level}
    </span>
  );
}

function actionCls(action: string): string {
  return action === 'block'            ? 'border-red-500/60 bg-red-500/10 text-red-300'    :
         action === 'require_approval' ? 'border-sky-500/60 bg-sky-500/10 text-sky-300'    :
         action === 'warn'             ? 'border-amber-500/60 bg-amber-500/10 text-amber-300' :
         action === 'log'              ? 'border-titanium-700 bg-titanium-800/30 text-titanium-300' :
                                         'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
}

function scoreClass(score: number) {
  if (score >= 80) return 'text-red-300';
  if (score >= 60) return 'text-amber-300';
  if (score >= 40) return 'text-yellow-300';
  return 'text-emerald-300';
}
