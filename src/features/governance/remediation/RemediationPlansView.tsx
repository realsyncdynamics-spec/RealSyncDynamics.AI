import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, ChevronRight, AlertTriangle } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { listRemediationPlans } from './api';
import type { RemediationPlan, RemediationStatus } from './types';
import { RemediationReviewBanner } from './RemediationReviewBanner';

const STATUS_LABEL: Record<RemediationStatus, string> = {
  draft:            'Entwurf',
  review_required:  'Review erforderlich',
  approved:         'Freigegeben',
  rejected:         'Abgelehnt',
  applied:          'Angewendet',
};

const STATUS_TONE: Record<RemediationStatus, string> = {
  draft:            'text-titanium-300 border-titanium-700',
  review_required:  'text-amber-200 border-amber-500/40 bg-amber-500/10',
  approved:         'text-emerald-200 border-emerald-500/40 bg-emerald-500/10',
  rejected:         'text-rose-200 border-rose-500/40 bg-rose-500/10',
  applied:          'text-security-200 border-security-500/40 bg-security-500/10',
};

export function RemediationPlansView() {
  const { activeTenantId } = useTenant();
  const [plans, setPlans] = useState<RemediationPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenantId) { setPlans([]); return; }
    setError(null);
    listRemediationPlans(activeTenantId)
      .then(setPlans)
      .catch((err: Error) => setError(err.message));
  }, [activeTenantId]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex items-center gap-3">
        <div className="border border-titanium-800 bg-obsidian-950 p-2">
          <Wrench className="h-5 w-5 text-security-400" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-titanium-50">
            Remediation
          </h1>
          <p className="text-sm text-titanium-400">
            Fix vorbereiten · Review erforderlich · keine automatische Anwendung
          </p>
        </div>
      </header>

      <div className="mb-6">
        <RemediationReviewBanner />
      </div>

      {!activeTenantId ? (
        <p className="text-sm text-titanium-400">Tenant fehlt.</p>
      ) : error ? (
        <div className="flex items-start gap-2 border border-rose-500/40 bg-rose-500/5 px-4 py-3 text-sm text-rose-200">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      ) : plans === null ? (
        <p className="text-sm text-titanium-400">Lade Pläne …</p>
      ) : plans.length === 0 ? (
        <div className="border border-titanium-800 bg-obsidian-950 px-6 py-12 text-center">
          <p className="text-sm text-titanium-300">
            Noch keine Remediation-Pläne. Plans entstehen automatisch,
            wenn der Agent ein Finding empfängt (drift.detected,
            consent.violation, policy.violation …) und einen
            Vorschlag erzeugt.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-titanium-900 border border-titanium-800 bg-obsidian-950">
          {plans.map((plan) => (
            <li key={plan.id}>
              <Link
                to={`/governance/remediation/${plan.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-titanium-900/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-titanium-50">
                    {plan.summary || '(ohne Zusammenfassung)'}
                  </p>
                  <p className="mt-1 truncate text-xs text-titanium-400">
                    <span className="uppercase tracking-wider">{plan.affected_system}</span>
                    <span className="mx-1.5 text-titanium-700">·</span>
                    <span>{plan.technology}</span>
                    <span className="mx-1.5 text-titanium-700">·</span>
                    <span>{new Date(plan.created_at).toLocaleString('de-DE')}</span>
                    <span className="mx-1.5 text-titanium-700">·</span>
                    <span>{Math.round((plan.confidence ?? 0) * 100)}% Confidence</span>
                  </p>
                </div>
                <span className={`shrink-0 border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ${STATUS_TONE[plan.status]}`}>
                  {STATUS_LABEL[plan.status]}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-titanium-500" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
