import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ListChecks, AlertTriangle, MessageSquare, GitPullRequest } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import {
  getRemediationPlan,
  prepareGithubIssue,
  preparePrComment,
} from './api';
import type { RemediationPlan } from './types';
import { RemediationReviewBanner } from './RemediationReviewBanner';
import { RemediationSnippetCard } from './RemediationSnippetCard';

export function RemediationPlanDetailView() {
  const { planId } = useParams<{ planId: string }>();
  const { activeTenantId } = useTenant();
  const [plan, setPlan]   = useState<RemediationPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issueDraft, setIssueDraft] = useState<{ title: string; body: string; labels: string[] } | null>(null);
  const [commentDraft, setCommentDraft] = useState<{ body: string } | null>(null);
  const [busy, setBusy] = useState<null | 'issue' | 'comment'>(null);

  useEffect(() => {
    if (!activeTenantId || !planId) return;
    setError(null);
    getRemediationPlan(activeTenantId, planId)
      .then(setPlan)
      .catch((err: Error) => setError(err.message));
  }, [activeTenantId, planId]);

  const onPrepareIssue = async () => {
    if (!activeTenantId || !planId) return;
    setBusy('issue'); setError(null);
    try {
      const issue = await prepareGithubIssue(activeTenantId, planId);
      setIssueDraft(issue);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onPrepareComment = async () => {
    if (!activeTenantId || !planId) return;
    setBusy('comment'); setError(null);
    try {
      const comment = await preparePrComment(activeTenantId, planId);
      setCommentDraft(comment);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!activeTenantId) return <p className="px-4 py-8 text-sm text-titanium-400">Tenant fehlt.</p>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        to="/governance/remediation"
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-titanium-400 hover:text-titanium-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Zurück zur Übersicht
      </Link>

      <div className="mb-6">
        <RemediationReviewBanner />
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-2 border border-rose-500/40 bg-rose-500/5 px-4 py-3 text-sm text-rose-200">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      ) : null}

      {!plan ? (
        <p className="text-sm text-titanium-400">Lade Plan …</p>
      ) : (
        <>
          <section className="mb-6 border border-titanium-800 bg-obsidian-950 p-4">
            <h2 className="font-display text-lg font-semibold text-titanium-50">
              {plan.summary || '(ohne Zusammenfassung)'}
            </h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-titanium-300 sm:grid-cols-4">
              <div>
                <dt className="text-titanium-500 uppercase tracking-wider">System</dt>
                <dd className="font-medium text-titanium-100">{plan.affected_system}</dd>
              </div>
              <div>
                <dt className="text-titanium-500 uppercase tracking-wider">Technologie</dt>
                <dd className="font-medium text-titanium-100">{plan.technology}</dd>
              </div>
              <div>
                <dt className="text-titanium-500 uppercase tracking-wider">Confidence</dt>
                <dd className="font-medium text-titanium-100">{Math.round((plan.confidence ?? 0) * 100)} %</dd>
              </div>
              <div>
                <dt className="text-titanium-500 uppercase tracking-wider">Status</dt>
                <dd className="font-medium text-titanium-100">{plan.status}</dd>
              </div>
            </dl>
          </section>

          {plan.steps.length > 0 ? (
            <section className="mb-6">
              <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-wider text-titanium-300">
                <ListChecks className="h-4 w-4 text-security-400" /> Schritte
              </h3>
              <ol className="space-y-2 border border-titanium-800 bg-obsidian-950 px-4 py-3">
                {plan.steps.map((step, i) => (
                  <li key={i} className="text-sm text-titanium-100">
                    <span className="mr-2 font-mono text-titanium-500">{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-medium">{step.title}</span>
                    {step.detail ? <p className="mt-1 ml-7 text-xs text-titanium-400">{step.detail}</p> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {plan.snippets.length > 0 ? (
            <section className="mb-6">
              <h3 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-titanium-300">
                Snippets
              </h3>
              <div className="space-y-3">
                {plan.snippets.map((s, i) => (
                  <RemediationSnippetCard key={i} snippet={s} index={i} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="mb-6 border border-titanium-800 bg-obsidian-950 p-4">
            <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-titanium-300">
              Artefakte vorbereiten
            </h3>
            <p className="mb-3 text-xs text-titanium-400">
              Diese Aktionen erzeugen <strong>Entwürfe</strong>. Der Agent
              ruft GitHub <strong>nicht</strong> selbst auf — du kopierst die
              Inhalte und legst sie manuell an.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onPrepareIssue}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 border border-titanium-800 bg-obsidian-900 px-3 py-1.5 text-xs text-titanium-100 hover:bg-titanium-900 disabled:opacity-50"
              >
                <GitPullRequest className="h-3.5 w-3.5 text-security-400" />
                GitHub-Issue vorbereiten
              </button>
              <button
                type="button"
                onClick={onPrepareComment}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 border border-titanium-800 bg-obsidian-900 px-3 py-1.5 text-xs text-titanium-100 hover:bg-titanium-900 disabled:opacity-50"
              >
                <MessageSquare className="h-3.5 w-3.5 text-security-400" />
                PR-Kommentar vorbereiten
              </button>
            </div>

            {issueDraft ? (
              <div className="mt-4 border border-titanium-800 bg-obsidian-900 p-3">
                <p className="text-xs uppercase tracking-wider text-titanium-500">Issue-Entwurf</p>
                <p className="mt-1 text-sm font-semibold text-titanium-50">{issueDraft.title}</p>
                {issueDraft.labels.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {issueDraft.labels.map((l) => (
                      <span key={l} className="border border-titanium-800 bg-obsidian-950 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-titanium-300">{l}</span>
                    ))}
                  </div>
                ) : null}
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-titanium-200">{issueDraft.body}</pre>
              </div>
            ) : null}

            {commentDraft ? (
              <div className="mt-4 border border-titanium-800 bg-obsidian-900 p-3">
                <p className="text-xs uppercase tracking-wider text-titanium-500">PR-Kommentar-Entwurf</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-titanium-200">{commentDraft.body}</pre>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
