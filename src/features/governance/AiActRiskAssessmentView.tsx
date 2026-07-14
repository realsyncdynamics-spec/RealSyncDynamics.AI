import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, AlertTriangle, CheckCircle2, AlertCircle, Loader2,
  ChevronRight, Lock, Users, Brain, FileText,
} from 'lucide-react';
import { useTenant } from '../../core/access/TenantProvider';
import { AuthGate } from '../kodee/connections/AuthGate';

interface Assessment {
  id: string;
  ai_system_id: string;
  ai_system_name: string;
  classification: 'minimal_risk' | 'limited_risk' | 'high_risk' | 'prohibited' | 'unknown';
  overall_risk_score: number;
  approval_status: 'pending' | 'approved' | 'rejected' | 'conditional';
  indicators: Record<string, boolean>;
  created_at: string;
}

export function AiActRiskAssessmentView() {
  return <AuthGate>{() => <Inner />}</AuthGate>;
}

function Inner() {
  const { tenants, activeTenantId, setActiveTenant } = useTenant();
  const [assessments, setAssessments] = useState<Assessment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startingFlow, setStartingFlow] = useState(false);

  const reload = async () => {
    if (!activeTenantId) return;
    setError(null);
    setAssessments(null);

    try {
      const response = await fetch(
        `/functions/v1/governance-resources?tenant_id=${activeTenantId}&resource_type=ai_act_assessment`,
        { headers: { Authorization: `Bearer ${(await import('../../lib/auth')).getAuthToken()}` } }
      );
      if (!response.ok) throw new Error('Failed to load');
      const data = await response.json();
      setAssessments(data.assessments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler');
    }
  };

  const handleStartAssessment = async () => {
    if (!activeTenantId) return;
    setStartingFlow(true);

    try {
      // Redirect to workflow with AI Act focus
      window.location.href = `/app/governance/onboarding?focus=ai_act&tenant_id=${activeTenantId}`;
    } catch (err) {
      alert('Fehler beim Starten');
      setStartingFlow(false);
    }
  };

  useEffect(() => { void reload(); }, [activeTenantId]);

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100">
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link to="/app/governance" className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-sm">
              <AlertTriangle className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold text-sm tracking-tight text-titanium-50">AI-Act-Risikoprüfung</div>
              <div className="text-[11px] text-titanium-400 font-medium">VO (EU) 2024/1689 · Hochrisiko-Klassifizierung</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tenants.length > 1 && (
            <select
              value={activeTenantId ?? ''}
              onChange={(e) => setActiveTenant(e.target.value)}
              className="bg-obsidian-950 border border-titanium-900 text-titanium-200 text-xs rounded-none px-2 py-1.5 outline-none cursor-pointer font-medium hover:bg-obsidian-800 max-w-[200px]"
            >
              {tenants.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 text-sm text-red-300 bg-red-950/50 border border-red-900 rounded-none p-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!activeTenantId ? (
          <div className="text-titanium-500 text-sm">Tenant wählen.</div>
        ) : assessments === null ? (
          <div className="flex items-center gap-2 text-titanium-500 text-sm py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : (
          <div className="space-y-8">
            {/* Explanation Section */}
            <div className="bg-obsidian-900 border border-orange-900/30 rounded-none p-6">
              <h2 className="font-semibold text-titanium-50 mb-2">Was ist die AI-Act-Risikoprüfung?</h2>
              <p className="text-[13px] text-titanium-300 leading-relaxed mb-4">
                Die EU AI Act klassifiziert KI-Systeme in Risikokategorien:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12px]">
                <div className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-green-300">Minimal Risk</div>
                    <div className="text-titanium-400">Allgemeine KI-Nutzung ohne Hochrisiko-Merkmale</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-yellow-300">Limited Risk</div>
                    <div className="text-titanium-400">Transparenzanforderungen, z.B. Chatbots</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-orange-300">High Risk</div>
                    <div className="text-titanium-400">Strenge Anforderungen (Annex III): Biometrie, Krediterstellung, etc.</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-red-300">Prohibited</div>
                    <div className="text-titanium-400">Verbotene Anwendungen: Massenüberwachung, Social Scoring</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Start Assessment CTA */}
            <button
              onClick={handleStartAssessment}
              disabled={startingFlow}
              className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 disabled:opacity-50 text-white text-sm font-semibold px-6 py-4 rounded-none flex items-center justify-between transition-colors"
            >
              <span className="flex items-center gap-3">
                <Brain className="h-5 w-5" />
                Neue AI-Act-Bewertung starten
              </span>
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Existing Assessments */}
            {assessments.length > 0 && (
              <div>
                <h3 className="font-semibold text-titanium-50 mb-4">Bestehende Bewertungen</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {assessments.map((assessment) => (
                    <AssessmentCard key={assessment.id} assessment={assessment} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function AssessmentCard({ assessment }: { assessment: Assessment }) {
  const classificationColor = {
    minimal_risk: 'from-green-600 to-emerald-600',
    limited_risk: 'from-yellow-600 to-amber-600',
    high_risk: 'from-orange-600 to-red-600',
    prohibited: 'from-red-700 to-red-800',
    unknown: 'from-titanium-700 to-titanium-800',
  }[assessment.classification];

  const classificationLabel = {
    minimal_risk: '✓ Minimal Risk',
    limited_risk: '⚠ Limited Risk',
    high_risk: '⚠ High Risk',
    prohibited: '✗ Prohibited',
    unknown: '? Unknown',
  }[assessment.classification];

  const approvalBadge = {
    approved: { bg: 'bg-green-950', text: 'text-green-300', label: '✓ Genehmigt' },
    pending: { bg: 'bg-amber-950', text: 'text-amber-300', label: '⏳ Ausstehend' },
    rejected: { bg: 'bg-red-950', text: 'text-red-300', label: '✗ Abgelehnt' },
    conditional: { bg: 'bg-blue-950', text: 'text-blue-300', label: '→ Bedingt' },
  }[assessment.approval_status];

  const highRiskIndicators = Object.entries(assessment.indicators)
    .filter(([_, value]) => value === true)
    .map(([key]) => key);

  return (
    <div className={`bg-gradient-to-br ${classificationColor} rounded-none p-4 border border-white/10`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-white mb-1">{assessment.ai_system_name}</h4>
          <p className="text-[12px] text-white/70">{classificationLabel}</p>
        </div>
        <div className={`${approvalBadge.bg} ${approvalBadge.text} text-[11px] font-semibold px-2 py-1 rounded-none`}>
          {approvalBadge.label}
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-white/70">Risk Score</span>
          <span className="text-[12px] font-mono font-bold text-white">{assessment.overall_risk_score}/100</span>
        </div>
        <div className="bg-white/20 h-2 rounded-none overflow-hidden">
          <div
            className="h-full bg-white/80"
            style={{ width: `${assessment.overall_risk_score}%` }}
          />
        </div>
      </div>

      {highRiskIndicators.length > 0 && (
        <div className="text-[11px] text-white/80 mb-3">
          <div className="font-semibold mb-1">Hochrisiko-Indikatoren:</div>
          <div className="flex flex-wrap gap-1">
            {highRiskIndicators.map((ind) => (
              <span key={ind} className="bg-white/20 px-2 py-0.5 rounded-none text-[10px]">
                {ind.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      <Link
        to={`/app/ai-act-assessment/${assessment.id}`}
        className="inline-flex items-center gap-1.5 text-white text-[12px] font-semibold hover:underline mt-3"
      >
        Details ansehen <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
