// Finance / Audit Support Skill — pure Helper. KEIN Audit-Opinion-Output.

export type DeficiencyClass = 'control_deficiency' | 'significant_deficiency' | 'material_weakness';
export type ControlFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface DeficiencyInput {
  likelihood: RiskLevel;
  magnitude: RiskLevel;
}

export function classifyDeficiency(input: DeficiencyInput): {
  classification: DeficiencyClass;
  rationale: string;
  reviewRequired: true;
} {
  if (!input || typeof input !== 'object') throw new Error('input required');
  const { likelihood, magnitude } = input;
  if (!isRisk(likelihood) || !isRisk(magnitude)) throw new Error('likelihood/magnitude must be low|medium|high');

  let classification: DeficiencyClass = 'control_deficiency';
  if (magnitude === 'high' && likelihood !== 'low') classification = 'material_weakness';
  else if (magnitude === 'high' || (magnitude === 'medium' && likelihood === 'high')) {
    classification = 'significant_deficiency';
  } else if (magnitude === 'medium' || likelihood === 'high') {
    classification = 'significant_deficiency';
  }

  return {
    classification,
    rationale: `likelihood=${likelihood}, magnitude=${magnitude} → ${classification}`,
    reviewRequired: true,
  };
}

function isRisk(v: unknown): v is RiskLevel {
  return v === 'low' || v === 'medium' || v === 'high';
}

// AICPA-aehnliche Faustwerte, KEINE Pruefungsempfehlung.
const SAMPLE_MATRIX: Record<ControlFrequency, Record<RiskLevel, number>> = {
  daily:     { low: 25, medium: 40, high: 60 },
  weekly:    { low: 15, medium: 25, high: 40 },
  monthly:   { low: 5,  medium: 10, high: 15 },
  quarterly: { low: 2,  medium: 4,  high: 8  },
  annual:    { low: 1,  medium: 1,  high: 2  },
};

export function recommendSampleSize(
  controlFrequency: ControlFrequency,
  riskLevel: RiskLevel,
): { size: number; method: string; caveat: string } {
  if (!(controlFrequency in SAMPLE_MATRIX)) throw new Error('unknown control frequency');
  if (!isRisk(riskLevel)) throw new Error('riskLevel must be low|medium|high');
  return {
    size: SAMPLE_MATRIX[controlFrequency][riskLevel],
    method: 'random sampling, stratified per control objective',
    caveat:
      'Faustwert. Vor Anwendung mit Pruefungsleiter/Fachpruefer abstimmen und ' +
      'an Wesentlichkeit + Kontrolltyp anpassen. Keine Audit-Opinion.',
  };
}
