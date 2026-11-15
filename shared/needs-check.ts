/**
 * Bedarfs-Check — drei Fragen, eine Empfehlung.
 *
 * Reine Funktionen ohne Seiteneffekte. Hier stehen weder Preise (nur
 * `./pricing.ts`) noch Statusangaben (nur `src/product/implementation-status.ts`).
 *
 * Wichtig für jede Oberfläche, die das Ergebnis zeigt: Es beruht
 * ausschließlich auf den Angaben des Nutzers (`basis: 'self_report'`).
 * Es wird keine Website abgerufen und nichts technisch geprüft. Die einzige
 * technische Prüfung ist der bestehende Website-Check unter `/audit`; der
 * Bedarfs-Check verweist nur darauf.
 *
 * Gespeichert werden nur die Antworten. Das Ergebnis wird daraus jedes Mal
 * neu abgeleitet — so kann kein gespeichertes Ergebnis von der Auswertung
 * abweichen. Die erlaubten Werte spiegelt die Datenbank in
 * `public.needs_check_answers_valid` (Migration 20261115203000).
 */

export const NEEDS_CHECK_VERSION = 1;

export const NEEDS_GOALS = ['more_inquiries', 'answer_customers', 'new_website', 'ai_rules'] as const;
export const NEEDS_AREAS = ['trade', 'practice', 'office', 'retail', 'agency', 'other'] as const;
export const NEEDS_WEBSITE = ['yes', 'no'] as const;

export type NeedsGoal = (typeof NEEDS_GOALS)[number];
export type NeedsArea = (typeof NEEDS_AREAS)[number];
export type NeedsWebsite = (typeof NEEDS_WEBSITE)[number];

export interface NeedsAnswers {
  goal: NeedsGoal;
  area: NeedsArea;
  website: NeedsWebsite;
}

export type NeedsQuestionId = keyof NeedsAnswers;

export interface NeedsQuestion {
  id: NeedsQuestionId;
  title: string;
  hint: string;
  options: ReadonlyArray<{ id: string; label: string }>;
}

export const NEEDS_GOAL_LABEL: Record<NeedsGoal, string> = {
  more_inquiries: 'Mehr Anfragen über die Website erhalten',
  answer_customers: 'Kundenfragen schneller beantworten',
  new_website: 'Eine neue Website oder Landingpage aufbauen',
  ai_rules: 'KI-Einsatz mit Regeln und Nachweisen absichern',
};

export const NEEDS_AREA_LABEL: Record<NeedsArea, string> = {
  trade: 'Handwerk',
  practice: 'Praxis oder Gesundheitsberuf',
  office: 'Kanzlei, Büro oder Dienstleistung',
  retail: 'Handel oder Gastronomie',
  agency: 'Agentur (für Kundinnen und Kunden)',
  other: 'Anderer Bereich',
};

export const NEEDS_WEBSITE_LABEL: Record<NeedsWebsite, string> = {
  yes: 'Ja, es gibt bereits eine Website',
  no: 'Nein, noch keine Website',
};

export const NEEDS_QUESTIONS: readonly NeedsQuestion[] = [
  {
    id: 'goal',
    title: 'Was möchten Sie zuerst erreichen?',
    hint: 'Wählen Sie das Ziel, das Ihnen im Moment am wichtigsten ist.',
    options: NEEDS_GOALS.map((id) => ({ id, label: NEEDS_GOAL_LABEL[id] })),
  },
  {
    id: 'area',
    title: 'In welchem Bereich arbeiten Sie?',
    hint: 'Der Bereich erscheint nur in der Begründung der Empfehlung.',
    options: NEEDS_AREAS.map((id) => ({ id, label: NEEDS_AREA_LABEL[id] })),
  },
  {
    id: 'website',
    title: 'Gibt es bereits eine Website?',
    hint: 'Die Adresse wird hier nicht abgefragt und nicht abgerufen.',
    options: NEEDS_WEBSITE.map((id) => ({ id, label: NEEDS_WEBSITE_LABEL[id] })),
  },
];

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value);
}

/**
 * Prüft fremde Eingaben (Browser-Speicher, Datenbankzeile) streng: genau die
 * drei bekannten Schlüssel mit erlaubten Werten, sonst `null`.
 */
export function parseNeedsAnswers(value: unknown): NeedsAnswers | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== 3) return null;
  const { goal, area, website } = record;
  if (!isOneOf(NEEDS_GOALS, goal) || !isOneOf(NEEDS_AREAS, area) || !isOneOf(NEEDS_WEBSITE, website)) {
    return null;
  }
  return { goal, area, website };
}

export type NeedsPillar = 'build' | 'automate' | 'govern';

export const NEEDS_PILLAR_LABEL: Record<NeedsPillar, string> = {
  build: 'Build',
  automate: 'Automate',
  govern: 'Govern',
};

export interface NeedsRecommendation {
  id: 'website_builder' | 'chat_assistant' | 'rules_evidence' | 'website_check';
  pillar: NeedsPillar;
  title: string;
  /** Begründung, abgeleitet aus den Angaben. */
  reason: string;
  /** Vorhandene Route der Plattform. */
  to: string;
  linkLabel: string;
  /**
   * `true` nur beim Verweis auf den Website-Check: Dort findet eine
   * technische Prüfung statt — aber erst, wenn der Nutzer sie startet.
   */
  startsTechnicalCheck: boolean;
}

export interface NeedsResult {
  version: number;
  /** Das Ergebnis beruht auf Selbstauskunft, nicht auf einer Messung. */
  basis: 'self_report';
  primary: NeedsPillar;
  recommendations: NeedsRecommendation[];
}

function websiteBuilder(a: NeedsAnswers): NeedsRecommendation {
  return {
    id: 'website_builder',
    pillar: 'build',
    title: 'Website-Entwurf aus einer Beschreibung',
    reason:
      a.website === 'no'
        ? `Sie haben angegeben, dass es noch keine Website gibt (${NEEDS_AREA_LABEL[a.area]}). Ein Entwurf ist der erste Schritt.`
        : `Sie haben als Ziel „${NEEDS_GOAL_LABEL[a.goal]}“ gewählt. Der Builder plant daraus Seiten und Abschnitte.`,
    to: '/build',
    linkLabel: 'Entwurf erstellen',
    startsTechnicalCheck: false,
  };
}

function chatAssistant(a: NeedsAnswers): NeedsRecommendation {
  return {
    id: 'chat_assistant',
    pillar: 'automate',
    title: 'Chat-Assistent für wiederkehrende Fragen',
    reason: `Sie haben als Ziel „${NEEDS_GOAL_LABEL[a.goal]}“ gewählt (${NEEDS_AREA_LABEL[a.area]}). Ein Chat-Assistent nimmt Fragen auf der Website entgegen.`,
    to: '/chatbot/start',
    linkLabel: 'Chat-Assistent ansehen',
    startsTechnicalCheck: false,
  };
}

function rulesEvidence(a: NeedsAnswers): NeedsRecommendation {
  return {
    id: 'rules_evidence',
    pillar: 'govern',
    title: 'Regeln, Freigaben und Nachweise',
    reason:
      a.goal === 'ai_rules'
        ? 'Sie möchten den KI-Einsatz absichern. Die Übersicht zeigt, wie Regeln geprüft und Entscheidungen dokumentiert werden.'
        : 'Sie betreuen als Agentur mehrere Auftraggeber. Regeln und Nachweise je Auftraggeber gehören dazu.',
    to: '/governance-runtime',
    linkLabel: 'Regeln und Nachweise ansehen',
    startsTechnicalCheck: false,
  };
}

function websiteCheck(): NeedsRecommendation {
  return {
    id: 'website_check',
    pillar: 'govern',
    title: 'Bestehende Website technisch prüfen',
    reason:
      'Sie haben angegeben, dass es bereits eine Website gibt. Der Website-Check ruft sie ab und prüft sie – erst, wenn Sie ihn dort starten.',
    to: '/audit',
    linkLabel: 'Zum Website-Check',
    startsTechnicalCheck: true,
  };
}

/** Leitet die Empfehlung deterministisch aus den drei Antworten ab. */
export function deriveNeedsResult(answers: NeedsAnswers): NeedsResult {
  const recommendations: NeedsRecommendation[] = [];

  switch (answers.goal) {
    case 'new_website':
      recommendations.push(websiteBuilder(answers));
      break;
    case 'more_inquiries':
      if (answers.website === 'no') recommendations.push(websiteBuilder(answers));
      recommendations.push(chatAssistant(answers));
      break;
    case 'answer_customers':
      recommendations.push(chatAssistant(answers));
      if (answers.website === 'no') recommendations.push(websiteBuilder(answers));
      break;
    case 'ai_rules':
      recommendations.push(rulesEvidence(answers));
      break;
  }

  if (answers.area === 'agency' && answers.goal !== 'ai_rules') {
    recommendations.push(rulesEvidence(answers));
  }
  if (answers.website === 'yes') {
    recommendations.push(websiteCheck());
  }

  const first = recommendations[0];
  return {
    version: NEEDS_CHECK_VERSION,
    basis: 'self_report',
    primary: first ? first.pillar : 'build',
    recommendations,
  };
}
