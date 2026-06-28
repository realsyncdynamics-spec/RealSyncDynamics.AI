import { useState, useCallback, useMemo } from 'react';
import type { ScanFinding, GovernanceProfile, GovernanceAnswer, Recommendation, Sector } from '../core/onboarding/types';
import { classifyAllFindings, groupFindingsByDimension, scoreDimensionCriticality } from '../core/onboarding/findingClassifier';
import { generateContextualQuestions } from '../core/onboarding/questionEngine';
import { generateRecommendation } from '../core/onboarding/recommendationEngine';

/**
 * Hook to manage the entire guided onboarding flow
 * Takes scan findings and returns tools to build profile, collect answers, and get recommendations
 */
export function useGovernanceOnboarding(
  scanId: string,
  domain: string,
  findings: ScanFinding[],
  initialSector?: Sector
) {
  // Classification state
  const classified = useMemo(() => classifyAllFindings(findings), [findings]);
  const grouped = useMemo(() => groupFindingsByDimension(classified), [classified]);
  const dimensions = useMemo(() => Array.from(grouped.keys()), [grouped]);

  // Determine overall risk level from findings
  const overallRiskLevel = useMemo(() => {
    if (classified.some((f) => f.original.severity === 'critical')) return 'critical';
    if (classified.some((f) => f.original.severity === 'high')) return 'high';
    if (classified.some((f) => f.original.severity === 'medium')) return 'medium';
    if (classified.some((f) => f.original.severity === 'low')) return 'low';
    return 'info';
  }, [classified]);

  // Generate contextual questions
  const contextualQuestions = useMemo(() => generateContextualQuestions(classified, dimensions), [classified, dimensions]);

  // User answers collection
  const [answers, setAnswers] = useState<GovernanceAnswer[]>([]);
  const [selectedSector, setSelectedSector] = useState<Sector>(initialSector || 'generic');

  // Build governance profile
  const profile = useMemo((): GovernanceProfile => {
    const dimensionScores = dimensions.map((dim) => {
      const score = scoreDimensionCriticality(classified, dim);
      const recommendedPlan: 'starter_governance' | 'professional_governance' | 'governance_os' =
        score >= 70 ? 'governance_os' : score >= 40 ? 'professional_governance' : 'starter_governance';
      return {
        dimension: dim,
        criticalityScore: score,
        needsAddressing: grouped.get(dim)!.some((f) => f.urgency !== 'eventual'),
        recommendedPlan,
      };
    });

    return {
      scanId,
      domain,
      sector: selectedSector,
      riskLevel: overallRiskLevel,
      findings: classified,
      answers,
      dimensions: dimensionScores,
    };
  }, [scanId, domain, selectedSector, overallRiskLevel, classified, answers, dimensions, grouped]);

  // Generate recommendation
  const recommendation = useMemo(() => generateRecommendation(profile), [profile]);

  // Callbacks
  const addAnswer = useCallback((questionId: string, answer: boolean | number | string | string[]) => {
    setAnswers((prev) => {
      const existing = prev.findIndex((a) => a.questionId === questionId);
      const newAnswer: GovernanceAnswer = {
        questionId,
        answer,
        timestamp: Date.now(),
      };
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newAnswer;
        return updated;
      }
      return [...prev, newAnswer];
    });
  }, []);

  const updateSector = useCallback((sector: Sector) => {
    setSelectedSector(sector);
  }, []);

  const getAnswerForQuestion = useCallback(
    (questionId: string) => {
      return answers.find((a) => a.questionId === questionId)?.answer;
    },
    [answers]
  );

  return {
    // Input state
    scanId,
    domain,
    findings,
    contextualQuestions,

    // Classification
    classified,
    dimensions,
    overallRiskLevel,
    grouped,

    // Profile building
    profile,
    recommendation,
    selectedSector,
    updateSector,

    // Answer management
    answers,
    addAnswer,
    getAnswerForQuestion,
    answeredCount: answers.length,
    questionCount: contextualQuestions.length,
  };
}
