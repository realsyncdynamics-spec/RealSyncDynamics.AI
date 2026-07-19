import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ListChecks, AlertTriangle, MessageSquare, GitPullRequest } from 'lucide-react';
import { useTenant } from '../../../core/access/TenantProvider';
import { AuthGate } from '../../kodee/connections/AuthGate';
import { withPerformanceMonitoring } from '../../../lib/hoc';
import {
  getRemediationPlan,
  prepareGithubIssue,
  preparePrComment,
} from './api';
import type { RemediationPlan } from './types';
import { RemediationReviewBanner } from './RemediationReviewBanner';
import { RemediationSnippetCard } from './RemediationSnippetCard';

function _RemediationPlanDetailView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

export const RemediationPlanDetailView = withPerformanceMonitoring(
  _RemediationPlanDetailView,
  'RemediationPlanDetailView',
  { threshold: 500, maxRenders: 10 }
);

function Inner() {
  const { planId } = useParams<{ planId: string }>();
  const { activeTenantId } = useTenant();
  const [plan, setPlan] = useState<RemediationPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'ok' | 'error' } | null>(null);

  useEffect(() => {
    void loadPlan();
  }, [planId, activeTenantId]);

  const loadPlan = async () => {
    if (!planId || !activeTenantId) return;
    try {
      setLoading(true);
      const data = await getRemediationPlan(planId, activeTenantId);
      setPlan(data || null);
    } catch (err) {
      console.error('Failed to load remediation plan:', err);
      setToast({ message: 'Failed to load remediation plan', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIssue = async () => {
    if (!plan || !activeTenantId) return;
    try {
      const issueData = await prepareGithubIssue(plan.id, activeTenantId);
      if (issueData) {
        setToast({ message: 'GitHub-Issue-Daten vorbereitet', type: 'ok' });
      }
    } catch (err) {
      console.error('Failed to create issue:', err);
      setToast({ message: 'Fehler beim Erstellen des Issues', type: 'error' });
    }
  };

  const handleCreatePrComment = async () => {
    if (!plan || !activeTenantId) return;
    try {
      const prData = await preparePrComment(plan.id, activeTenantId);
      if (prData) {
        setToast({ message: 'PR-Kommentar-Daten vorbereitet', type: 'ok' });
      }
    } catch (err) {
      console.error('Failed to prepare PR comment:', err);
      setToast({ message: 'Fehler beim Vorbereiten des PR-Kommentars', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-obsidian-950">
        <div className="text-center">
          <div className="text-[12px] text-titanium-400">Plan wird geladen...</div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex flex-col h-screen bg-obsidian-950 text-titanium-100">
        <div className="px-6 py-4 border-b border-titanium-900 flex items-center gap-3">
          <Link to="/governance/remediation" className="text-teal-400 hover:text-teal-300">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-semibold">Remediation Plan nicht gefunden</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-3" />
            <div className="text-[12px] text-titanium-400">
              Der angeforderte Remediation Plan existiert nicht
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-obsidian-950 text-titanium-100">
      {/* Header */}
      <div className="px-6 py-4 border-b border-titanium-900">
        <Link to="/governance/remediation" className="flex items-center gap-2 text-teal-400 hover:text-teal-300 mb-3 text-[12px] font-mono uppercase tracking-wider">
          <ArrowLeft className="h-3.5 w-3.5" />
          Zurück
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">{plan.affected_system} — {plan.technology}</h1>
            <p className="text-[12px] text-titanium-400 mt-1">{plan.summary}</p>
          </div>
          <span className={`font-mono text-[10px] px-2 py-1 border shrink-0 ${
            plan.status === 'approved' ? 'bg-teal-600/20 border-teal-600/40 text-teal-400' :
            plan.status === 'review_required' ? 'bg-amber-600/20 border-amber-600/40 text-amber-400' :
            'bg-obsidian-800 border-titanium-800 text-titanium-500'
          }`}>
            {plan.status}
          </span>
        </div>
      </div>

      {/* Remediation Review Banner */}
      {plan.review_required && <RemediationReviewBanner />}

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4 space-y-6">
        {/* Summary Section */}
        <div className="bg-obsidian-900 border border-titanium-900 p-4">
          <div className="flex items-start gap-3 mb-4">
            <ListChecks className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-titanium-100">Zusammenfassung</h2>
              <p className="text-[12px] text-titanium-300 mt-2 leading-relaxed">{plan.summary}</p>
            </div>
          </div>

          {/* Status & Metadata */}
          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-titanium-800">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Status</span>
              <p className="font-mono text-[11px] text-titanium-300 mt-1">{plan.status}</p>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Vertrauen</span>
              <p className={`font-mono text-[11px] mt-1 ${
                plan.confidence >= 80 ? 'text-teal-400' :
                plan.confidence >= 60 ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {Math.round(plan.confidence * 100)}%
              </p>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Erstellt von</span>
              <p className="font-mono text-[11px] text-titanium-300 mt-1">{plan.created_by || 'Agent'}</p>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-titanium-500">Erstellt am</span>
              <p className="font-mono text-[11px] text-titanium-300 mt-1">{new Date(plan.created_at).toLocaleDateString('de-DE')}</p>
            </div>
          </div>
        </div>

        {/* Remediation Steps */}
        <div className="bg-obsidian-900 border border-titanium-900 p-4">
          <h2 className="text-sm font-semibold text-titanium-100 mb-4">Remediationsschritte</h2>
          <div className="space-y-3">
            {plan.steps.map((step, idx) => (
              <div key={idx} className="p-3 bg-obsidian-800 border border-titanium-800">
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center h-6 w-6 rounded-full bg-teal-600/20 text-teal-400 font-mono text-[10px] shrink-0">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-titanium-100">{step.title}</p>
                    <p className="text-[11px] text-titanium-400 mt-1">{step.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Code Snippets */}
        {plan.snippets && plan.snippets.length > 0 && (
          <div className="bg-obsidian-900 border border-titanium-900 p-4">
            <h2 className="text-sm font-semibold text-titanium-100 mb-4">Code-Änderungen</h2>
            <div className="space-y-4">
              {plan.snippets.map((snippet, idx) => (
                <RemediationSnippetCard key={idx} index={idx} snippet={snippet} />
              ))}
            </div>
          </div>
        )}

        {/* GitHub Integration */}
        <div className="bg-obsidian-900 border border-titanium-900 p-4">
          <h2 className="text-sm font-semibold text-titanium-100 mb-4">GitHub Integration</h2>
          <div className="flex gap-3">
            <button
              onClick={() => void handleCreateIssue()}
              className="flex items-center gap-2 px-4 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-300 text-[11px] font-mono uppercase tracking-wider hover:border-titanium-700 transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Issue erstellen
            </button>
            <button
              onClick={() => void handleCreatePrComment()}
              className="flex items-center gap-2 px-4 py-2 bg-obsidian-800 border border-titanium-800 text-titanium-300 text-[11px] font-mono uppercase tracking-wider hover:border-titanium-700 transition-colors"
            >
              <GitPullRequest className="h-3.5 w-3.5" />
              PR-Kommentar
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 border font-mono text-xs shadow-lg ${
            toast.type === 'error'
              ? 'bg-red-950 border-red-800 text-red-200'
              : 'bg-obsidian-800 border-teal-700 text-teal-300'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertTriangle className="h-3.5 w-3.5" />
          ) : (
            <MessageSquare className="h-3.5 w-3.5" />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}
