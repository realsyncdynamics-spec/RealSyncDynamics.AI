import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowRight, ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Building2, Zap,
  Globe, Briefcase, Heart, Shield, User,
} from 'lucide-react';
import { useGovernanceOnboarding } from '../hooks/useGovernanceOnboarding';
import type { ScanFinding, Sector } from '../core/onboarding/types';
import { getQuestion } from '../core/onboarding/questionEngine';

/**
 * GovernanceOnboarding — guided post-scan flow
 *
 * After completing a free website audit, users are guided through:
 * 1. Sector selection (SaaS, Agency, Healthcare, Public Sector, Generic)
 * 2. Context-specific questions based on findings
 * 3. Profile building
 * 4. Smart recommendation to the right plan
 *
 * The flow is conversational and brief (< 5 minutes)
 */

interface LocationState {
  findings?: ScanFinding[];
  domain?: string;
  score?: number;
  severity?: string;
  auditId?: string;
}

export function GovernanceOnboarding() {
  const { scanId = '' } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const { state } = useLocation();
  const locationState = (state ?? {}) as LocationState;

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'sector' | 'questions' | 'summary'>('sector');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  // Fallback to mock findings if not provided via state
  const findings = locationState.findings || [];
  const domain = locationState.domain || 'example.com';

  const onboarding = useGovernanceOnboarding(scanId, domain, findings);

  if (findings.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold text-titanium-50 mb-2">Keine Scan-Daten gefunden</h1>
          <p className="text-sm text-titanium-300 mb-6">
            Bitte vollziehe erst den kostenlosen Website-Audit durch, um die Onboarding-Flow zu starten.
          </p>
          <button
            onClick={() => navigate('/audit')}
            className="surface-mono inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-sm"
          >
            Zum Audit <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const handleSectorSelect = (sector: Sector) => {
    onboarding.updateSector(sector);
    setStep('questions');
  };

  const handleNextQuestion = (answer: boolean | number | string | string[]) => {
    const currentQuestion = onboarding.contextualQuestions[currentQuestionIndex];
    if (currentQuestion) {
      onboarding.addAnswer(currentQuestion.id, answer);
    }

    if (currentQuestionIndex < onboarding.contextualQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setStep('summary');
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else {
      setStep('sector');
    }
  };

  const handleProceedToRecommendation = async () => {
    setLoading(true);
    try {
      // In real app, save profile to backend
      await new Promise((r) => setTimeout(r, 500));
      navigate(`/recommendation/${scanId}`, {
        state: {
          profile: onboarding.profile,
          recommendation: onboarding.recommendation,
          findings: onboarding.classified,
        },
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian-950 text-titanium-100 flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-titanium-900 bg-obsidian-900 flex items-center px-4 sm:px-6">
        <button
          onClick={() => (step === 'sector' ? navigate('/audit') : handlePreviousQuestion())}
          className="p-1.5 rounded-none hover:bg-obsidian-800 text-titanium-400 hover:text-titanium-200 mr-3"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-8 h-8 rounded-none bg-obsidian-950 border border-titanium-700 flex items-center justify-center">
            <Zap className="h-4 w-4 text-titanium-100" />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-tight text-titanium-50">Governance Onboarding</div>
            <div className="text-[11px] text-titanium-400 font-medium">
              {step === 'sector' && 'Schritt 1: Branche'}
              {step === 'questions' && `Schritt 2: Fragen (${currentQuestionIndex + 1}/${onboarding.contextualQuestions.length})`}
              {step === 'summary' && 'Schritt 3: Übersicht'}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-2xl mx-auto">
          {step === 'sector' && <SectorSelectionStep onSelect={handleSectorSelect} />}

          {step === 'questions' && onboarding.contextualQuestions.length > 0 && (
            <QuestionStep
              question={onboarding.contextualQuestions[currentQuestionIndex]}
              currentIndex={currentQuestionIndex}
              totalCount={onboarding.contextualQuestions.length}
              answer={onboarding.getAnswerForQuestion(onboarding.contextualQuestions[currentQuestionIndex].id)}
              onAnswer={handleNextQuestion}
            />
          )}

          {step === 'summary' && (
            <SummaryStep
              onboarding={onboarding}
              onProceed={handleProceedToRecommendation}
              loading={loading}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// ─── Sector Selection ────────────────────────────────────────────────────

const SECTORS = [
  {
    value: 'saas' as const,
    label: 'SaaS / Tech',
    icon: Zap,
    description: 'Software-as-a-Service, Cloud-Plattformen, AI-Produkte',
  },
  {
    value: 'agency' as const,
    label: 'Agentur / White-Label',
    icon: Briefcase,
    description: 'Marketing-Agenturen, Web-Agenturen, Consultants',
  },
  {
    value: 'healthcare' as const,
    label: 'Healthcare / Medical',
    icon: Heart,
    description: 'Kliniken, Arztpraxen, Telehealth, Medical Devices',
  },
  {
    value: 'public_sector' as const,
    label: 'Public Sector',
    icon: Shield,
    description: 'Behörden, Gemeinden, öffentliche Einrichtungen',
  },
  {
    value: 'generic' as const,
    label: 'Sonstiges',
    icon: Globe,
    description: 'E-Commerce, Handel, Dienstleistungen, andere',
  },
];

function SectorSelectionStep({ onSelect }: { onSelect: (sector: Sector) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 mb-2">
          Deine Branche?
        </h1>
        <p className="text-sm text-titanium-300">
          Das hilft uns, dir spezifische Fragen und Empfehlungen zu geben.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {SECTORS.map((sector) => {
          const Icon = sector.icon;
          return (
            <button
              key={sector.value}
              onClick={() => onSelect(sector.value)}
              className="text-left p-4 border border-titanium-700 hover:border-titanium-400 bg-obsidian-900 hover:bg-obsidian-800 rounded-none transition-colors group"
            >
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 text-titanium-400 group-hover:text-titanium-200 shrink-0 mt-0.5 transition-colors" />
                <div className="flex-1 min-w-0">
                  <div className="font-display font-bold text-titanium-50 text-sm group-hover:text-titanium-200 transition-colors">
                    {sector.label}
                  </div>
                  <div className="text-xs text-titanium-400 mt-0.5">{sector.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-titanium-500 text-center mt-6">
        Deine Antwort wird später verwendet um dir einen personalisierte Empfehlungen und Dashboards zu bieten.
      </p>
    </div>
  );
}

// ─── Question Step ──────────────────────────────────────────────────────

function QuestionStep({
  question,
  currentIndex,
  totalCount,
  answer,
  onAnswer,
}: {
  question: any;
  currentIndex: number;
  totalCount: number;
  answer: any;
  onAnswer: (answer: any) => void;
}) {
  const [selectedAnswer, setSelectedAnswer] = React.useState<any>(answer);

  const handleSubmit = () => {
    if (selectedAnswer !== undefined && selectedAnswer !== null && selectedAnswer !== '') {
      onAnswer(selectedAnswer);
      setSelectedAnswer(undefined);
    }
  };

  const progress = ((currentIndex + 1) / totalCount) * 100;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-titanium-500">
            Frage {currentIndex + 1} von {totalCount}
          </span>
          <span className="text-[11px] font-mono uppercase tracking-wider text-titanium-500">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-1 bg-obsidian-900 border border-titanium-800 rounded-none overflow-hidden">
          <div className="h-full bg-cyan-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="space-y-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-titanium-50 mb-2">{question.question}</h2>
          {question.hint && <p className="text-sm text-titanium-400">{question.hint}</p>}
        </div>

        {/* Answer options */}
        <div className="space-y-2 mt-6">
          {question.answerType === 'yes_no' && (
            <>
              <button
                onClick={() => setSelectedAnswer(true)}
                className={`w-full text-left p-4 border rounded-none transition-colors ${
                  selectedAnswer === true
                    ? 'border-cyan-500 bg-cyan-950 text-cyan-200'
                    : 'border-titanium-700 bg-obsidian-900 text-titanium-300 hover:border-titanium-500'
                }`}
              >
                <div className="font-semibold">Ja</div>
              </button>
              <button
                onClick={() => setSelectedAnswer(false)}
                className={`w-full text-left p-4 border rounded-none transition-colors ${
                  selectedAnswer === false
                    ? 'border-cyan-500 bg-cyan-950 text-cyan-200'
                    : 'border-titanium-700 bg-obsidian-900 text-titanium-300 hover:border-titanium-500'
                }`}
              >
                <div className="font-semibold">Nein</div>
              </button>
            </>
          )}

          {question.answerType === 'multiple_choice' && question.options && (
            <>
              {question.options.map((option: string, i: number) => (
                <button
                  key={i}
                  onClick={() => setSelectedAnswer(option)}
                  className={`w-full text-left p-4 border rounded-none transition-colors ${
                    selectedAnswer === option
                      ? 'border-cyan-500 bg-cyan-950 text-cyan-200'
                      : 'border-titanium-700 bg-obsidian-900 text-titanium-300 hover:border-titanium-500'
                  }`}
                >
                  <div className="font-semibold text-sm">{option}</div>
                </button>
              ))}
            </>
          )}

          {question.answerType === 'text' && (
            <input
              type="text"
              value={selectedAnswer || ''}
              onChange={(e) => setSelectedAnswer(e.target.value)}
              placeholder="Deine Antwort eingeben..."
              className="w-full px-4 py-3 bg-obsidian-900 border border-titanium-700 text-titanium-50 placeholder-titanium-600 rounded-none focus:border-titanium-400 outline-none"
            />
          )}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={handleSubmit}
          disabled={selectedAnswer === undefined || selectedAnswer === null || selectedAnswer === ''}
          className="flex-1 bg-cyan-500 text-obsidian-950 px-6 py-3 font-bold text-sm rounded-none disabled:opacity-40 hover:bg-cyan-400 transition-colors"
        >
          Weiter <ArrowRight className="h-4 w-4 inline ml-1" />
        </button>
      </div>
    </div>
  );
}

// ─── Summary Step ───────────────────────────────────────────────────────

function SummaryStep({
  onboarding,
  onProceed,
  loading,
}: {
  onboarding: ReturnType<typeof useGovernanceOnboarding>;
  onProceed: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-4" />
        <h1 className="text-3xl sm:text-4xl font-display font-bold text-titanium-50 mb-2">
          Dein Governance-Profil ist fertig!
        </h1>
        <p className="text-sm text-titanium-300">
          Basierend auf deinem Audit und deinen Antworten zeigen wir dir jetzt deine personalisierte Empfehlung.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Scan-ID" value={onboarding.scanId.slice(0, 8)} />
        <StatBox label="Befunde" value={String(onboarding.findings.length)} />
        <StatBox label="Dimensionen" value={String(onboarding.dimensions.length)} />
        <StatBox label="Risiko-Level" value={onboarding.overallRiskLevel.toUpperCase()} />
      </div>

      {/* Answered questions summary */}
      <div className="border border-titanium-800 bg-obsidian-900 p-4 rounded-none">
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono text-[10px] uppercase tracking-wider text-titanium-600">
            Beantwortete Fragen
          </div>
          <div className="font-display font-bold text-sm text-titanium-50">
            {onboarding.answeredCount} von {onboarding.questionCount}
          </div>
        </div>
        <div className="h-2 bg-obsidian-950 border border-titanium-800 rounded-none overflow-hidden">
          <div
            className="h-full bg-cyan-500"
            style={{
              width: `${(onboarding.answeredCount / onboarding.questionCount) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Sector info */}
      <div className="border border-titanium-700 bg-obsidian-900 p-4 rounded-none">
        <div className="text-[10px] font-mono uppercase tracking-wider text-titanium-600 mb-1">
          Deine Branche
        </div>
        <div className="font-display font-bold text-titanium-50 capitalize">
          {onboarding.selectedSector === 'public_sector' ? 'Public Sector' : onboarding.selectedSector}
        </div>
      </div>

      {/* Main CTA */}
      <button
        onClick={onProceed}
        disabled={loading}
        className="w-full bg-cyan-500 text-obsidian-950 px-6 py-3 font-bold text-sm rounded-none disabled:opacity-40 hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Empfehlung wird erstellt ...
          </>
        ) : (
          <>
            Zur Empfehlung <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <p className="text-xs text-titanium-500 text-center">
        Nächster Schritt: Wir zeigen dir den perfekten Plan für deine Governance-Anforderungen.
      </p>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-titanium-800 bg-obsidian-900 p-3 rounded-none text-center">
      <div className="text-[9px] font-mono uppercase tracking-wider text-titanium-600 mb-1">{label}</div>
      <div className="font-display font-bold text-titanium-50 text-lg">{value}</div>
    </div>
  );
}
