import { Link } from 'react-router-dom';
import { planGrants } from '@/shared/pricing';

/**
 * Workstore-Stub. Install bleibt disabled ohne Entitlement.
 * Kein zweiter Orchestrator, kein Parallel-Vault.
 */
export function WorkstoreListingCard({
  planKey = 'starter',
}: {
  planKey?: string;
}) {
  const allowed =
    planGrants(planKey, 'bots.chat') &&
    planGrants(planKey, 'bots.enabled') &&
    planGrants(planKey, 'bots.human_handoff');

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6" data-testid="workstore-support-agent">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">WORKSTORE</p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">AI Customer Support Agent</h2>
      <p className="mt-2 text-sm text-slate-600">
        Agent, Wissen, Website-Chat, Handoff, Art. 50 und Evidence als ein Pack — kein ZIP-Template.
      </p>
      <button
        type="button"
        disabled={!allowed}
        className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {allowed ? 'Installieren' : 'Install gesperrt — Entitlement fehlt'}
      </button>
      {!allowed && (
        <p className="mt-2 text-xs text-slate-500">
          Human-Handoff liegt nicht auf jedem Plan. Details unter{' '}
          <Link to="/pricing" className="underline">
            /pricing
          </Link>
          .
        </p>
      )}
    </article>
  );
}
