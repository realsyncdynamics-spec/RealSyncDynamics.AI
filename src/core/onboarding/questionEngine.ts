import type { GovernanceQuestion, GovernanceDimension, ClassifiedFinding } from './types';

/**
 * Question library: organized by dimension and severity
 * These are template questions that can be shown based on context
 */
const QUESTION_LIBRARY: Record<GovernanceDimension, GovernanceQuestion[]> = {
  website_compliance: [
    {
      id: 'wc_current_audit',
      dimension: 'website_compliance',
      question: 'Hast Du bereits externe Audits oder DSGVO-Prüfungen durchgeführt?',
      answerType: 'yes_no',
      triggeredByFindings: [],
    },
    {
      id: 'wc_tracker_knowledge',
      dimension: 'website_compliance',
      question: 'Kennst Du alle Third-Party-Tracker und Dienste auf Deiner Website?',
      answerType: 'yes_no',
      triggeredByFindings: ['third party scripts', 'tracking'],
    },
    {
      id: 'wc_consent_status',
      dimension: 'website_compliance',
      question: 'Wird Consent vor Tracking aktiv eingeholt?',
      answerType: 'yes_no',
      triggeredByFindings: ['tracking without consent', 'cookie'],
    },
    {
      id: 'wc_privacy_doc',
      dimension: 'website_compliance',
      question: 'Ist Deine Datenschutzerklärung aktuell (alle Tracker, Zwecke, Speicherdauer dokumentiert)?',
      answerType: 'yes_no',
      triggeredByFindings: ['privacy policy'],
    },
  ],
  monitoring: [
    {
      id: 'mon_current_practice',
      dimension: 'monitoring',
      question: 'Wie prüfst Du derzeit, ob Deine Website-Compliance sich ändert?',
      answerType: 'multiple_choice',
      options: ['Gar nicht', 'Manuell, gelegentlich', 'Manuell, regelmäßig', 'Automatisiert'],
      triggeredByFindings: [],
    },
    {
      id: 'mon_frequency',
      dimension: 'monitoring',
      question: 'Wie oft solltest Du Compliance-Änderungen erkennen?',
      answerType: 'multiple_choice',
      options: ['Täglich', 'Wöchentlich', 'Monatlich', 'Nie nötig — wir ändern nix'],
      triggeredByFindings: [],
    },
    {
      id: 'mon_alert_needed',
      dimension: 'monitoring',
      question: 'Brauchst Du automatische Alerts wenn Compliance-Probleme auftauchen?',
      answerType: 'yes_no',
      triggeredByFindings: [],
    },
  ],
  aiact_governance: [
    {
      id: 'ai_using_ai',
      dimension: 'aiact_governance',
      question: 'Nutzt Du AI-Modelle (ChatGPT, Claude, Google Gemini, etc.) in Deinem Produkt oder auf Deiner Website?',
      answerType: 'yes_no',
      triggeredByFindings: [],
    },
    {
      id: 'ai_classification',
      dimension: 'aiact_governance',
      question: 'Hast Du Deine AI-Systeme nach EU-AI-Act klassifiziert (High-Risk, Limited-Risk, Prohibited)?',
      answerType: 'yes_no',
      triggeredByFindings: ['ai act', 'high risk ai'],
    },
    {
      id: 'ai_risk_level',
      dimension: 'aiact_governance',
      question: 'Wie würdest Du das Risiko Deiner AI-Nutzung einschätzen?',
      answerType: 'multiple_choice',
      options: ['Prohibiert (nicht erlaubt)', 'Hochrisiko (Biometrie, Kreditwürdigkeit, etc.)', 'Begrenzt (z.B. Chatbot)', 'Minimal'],
      triggeredByFindings: [],
    },
    {
      id: 'ai_transparency',
      dimension: 'aiact_governance',
      question: 'Informierst Du Nutzer, wenn AI deren Daten verarbeitet oder Entscheidungen trifft?',
      answerType: 'yes_no',
      triggeredByFindings: ['ai act'],
    },
  ],
  evidence: [
    {
      id: 'ev_documentation',
      dimension: 'evidence',
      question: 'Dokumentierst Du Compliance-Maßnahmen (z.B. wer hat was wann gefixt)?',
      answerType: 'yes_no',
      triggeredByFindings: [],
    },
    {
      id: 'ev_audit_readiness',
      dimension: 'evidence',
      question: 'Könntest Du einem Auditor sofort alle Compliance-Nachweise vorlegen?',
      answerType: 'yes_no',
      triggeredByFindings: ['evidence', 'audit trail'],
    },
    {
      id: 'ev_retention',
      dimension: 'evidence',
      question: 'Wie lange speicherst Du Compliance-Nachweise?',
      answerType: 'multiple_choice',
      options: ['Gar nicht', 'Ad-hoc (Emails, PDFs)', '1 Jahr', '3+ Jahre'],
      triggeredByFindings: [],
    },
  ],
  policy_automation: [
    {
      id: 'pa_policies_exist',
      dimension: 'policy_automation',
      question: 'Hast Du formale Compliance-Policies definiert?',
      answerType: 'yes_no',
      triggeredByFindings: ['policy'],
    },
    {
      id: 'pa_manual_effort',
      dimension: 'policy_automation',
      question: 'Wieviel Zeit verbringst Du monatlich auf Compliance-Manual-Work?',
      answerType: 'multiple_choice',
      options: ['< 2h', '2–5h', '5–20h', '20+ Stunden'],
      triggeredByFindings: ['automation', 'policy'],
    },
    {
      id: 'pa_enforcement',
      dimension: 'policy_automation',
      question: 'Wie enforced Du Deine Policies (z.B. nur bestimmte Services erlaubt)?',
      answerType: 'multiple_choice',
      options: ['Nicht enforced', 'Manuell geprägt', 'Teils automatisiert', 'Vollständig automatisiert'],
      triggeredByFindings: [],
    },
  ],
  team_collaboration: [
    {
      id: 'tc_team_size',
      dimension: 'team_collaboration',
      question: 'Wie viele Personen sind in Compliance-Themen involviert?',
      answerType: 'multiple_choice',
      options: ['1 (ich allein)', '2–3', '4–10', '10+ Personen'],
      triggeredByFindings: [],
    },
    {
      id: 'tc_dpo',
      dimension: 'team_collaboration',
      question: 'Hast Du einen Datenschutzbeauftragten (DSB/DPO) benannt?',
      answerType: 'yes_no',
      triggeredByFindings: [],
    },
    {
      id: 'tc_roles',
      dimension: 'team_collaboration',
      question: 'Sind Compliance-Rollen und Verantwortlichkeiten klar definiert?',
      answerType: 'yes_no',
      triggeredByFindings: [],
    },
  ],
  api_integration: [
    {
      id: 'api_systems',
      dimension: 'api_integration',
      question: 'Wie viele separate Tools/Systeme nutzt Du für Compliance?',
      answerType: 'multiple_choice',
      options: ['1–2 (stark integriert)', '3–5', '5–10', '10+ (stark fragmentiert)'],
      triggeredByFindings: [],
    },
    {
      id: 'api_workflow',
      dimension: 'api_integration',
      question: 'Brauchst Du API/Webhook-Integration mit anderen Tools?',
      answerType: 'yes_no',
      triggeredByFindings: ['api', 'integration'],
    },
  ],
  industry_specifics: [
    {
      id: 'ind_industry',
      dimension: 'industry_specifics',
      question: 'In welcher Branche tätig?',
      answerType: 'multiple_choice',
      options: ['SaaS / Tech', 'Agency / Consulting', 'Healthcare / Medical', 'Finance / Banking', 'Public Sector', 'Other'],
      triggeredByFindings: [],
    },
    {
      id: 'ind_regulations',
      dimension: 'industry_specifics',
      question: 'Welche speziellen Regulierungen musst Du erfüllen?',
      answerType: 'text',
      hint: 'z.B. HIPAA (Healthcare), PSD2 (Finance), LVGL (Dänemark), etc.',
      triggeredByFindings: ['healthcare', 'banking', 'public sector'],
    },
  ],
};

/**
 * Generate contextual questions based on classified findings
 * - If dimension has critical findings, show all questions for that dimension
 * - If dimension has findings, show triggered questions
 * - If dimension has no findings but is related to company type, suggest it
 */
export function generateContextualQuestions(
  findings: ClassifiedFinding[],
  dimensions: GovernanceDimension[]
): GovernanceQuestion[] {
  const questions: GovernanceQuestion[] = [];
  const usedIds = new Set<string>();

  // First pass: add all questions for dimensions with critical/high findings
  for (const dimension of dimensions) {
    const dimensionFindings = findings.filter((f) => f.dimension === dimension);
    const hasCritical = dimensionFindings.some((f) => f.original.severity === 'critical' || f.original.severity === 'high');

    if (hasCritical && QUESTION_LIBRARY[dimension]) {
      for (const q of QUESTION_LIBRARY[dimension]) {
        if (!usedIds.has(q.id)) {
          questions.push(q);
          usedIds.add(q.id);
        }
      }
    }
  }

  // Second pass: add triggered questions for findings
  for (const finding of findings) {
    const library = QUESTION_LIBRARY[finding.dimension] || [];
    for (const q of library) {
      if (usedIds.has(q.id)) continue;
      if (!q.triggeredByFindings || q.triggeredByFindings.length === 0) continue;

      // Check if any trigger matches
      const title = finding.original.title.toLowerCase();
      const detail = finding.original.detail.toLowerCase();
      const matches = q.triggeredByFindings.some((trigger) => title.includes(trigger) || detail.includes(trigger));

      if (matches) {
        questions.push(q);
        usedIds.add(q.id);
      }
    }
  }

  // Third pass: add foundational questions not yet added
  const foundational = [
    'ind_industry',
    'wc_tracker_knowledge',
    'mon_current_practice',
    'ai_using_ai',
    'tc_team_size',
  ];
  for (const qId of foundational) {
    if (usedIds.has(qId)) continue;
    for (const dimension of Object.values(QUESTION_LIBRARY)) {
      const q = dimension.find((qu) => qu.id === qId);
      if (q) {
        questions.push(q);
        usedIds.add(qId);
        break;
      }
    }
  }

  return questions.slice(0, 10); // Cap at 10 questions to keep flow brief
}

/**
 * Get a single question by ID
 */
export function getQuestion(questionId: string): GovernanceQuestion | undefined {
  for (const dimension of Object.values(QUESTION_LIBRARY)) {
    const q = dimension.find((qu) => qu.id === questionId);
    if (q) return q;
  }
  return undefined;
}
