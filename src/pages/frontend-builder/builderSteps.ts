/**
 * Frontend-Builder — Schritt-Definitionen und reine Navigationslogik.
 * Bewusst ohne React, damit Vitest die Regeln ohne DOM prüfen kann.
 */

export type BuilderStepId =
  | 'projektart'
  | 'ausgangslage'
  | 'tech'
  | 'ziel'
  | 'umfang'
  | 'timing'
  | 'kontakt'
  | 'zusammenfassung';

export interface BuilderOption {
  readonly id: string;
  readonly label: string;
}

export interface ChoiceStep {
  readonly id: Exclude<BuilderStepId, 'kontakt' | 'zusammenfassung'>;
  readonly kind: 'choice';
  readonly title: string;
  readonly hint: string;
  readonly options: readonly BuilderOption[];
}

export interface KontaktStep {
  readonly id: 'kontakt';
  readonly kind: 'kontakt';
  readonly title: string;
  readonly hint: string;
}

export interface SummaryStep {
  readonly id: 'zusammenfassung';
  readonly kind: 'summary';
  readonly title: string;
  readonly hint: string;
}

export type BuilderStep = ChoiceStep | KontaktStep | SummaryStep;

export const BUILDER_STEPS: readonly BuilderStep[] = [
  {
    id: 'projektart',
    kind: 'choice',
    title: 'Welche Projektart planen Sie?',
    hint: 'Eine Auswahl — wir passen Scope und Angebot danach aus.',
    options: [
      { id: 'landingpage', label: 'Landingpage' },
      { id: 'marketing_website', label: 'Marketing-Website' },
      { id: 'saas_dashboard', label: 'SaaS-Dashboard' },
      { id: 'relaunch', label: 'Relaunch' },
      { id: 'conversion_funnel', label: 'Conversion-Funnel' },
      { id: 'sonstiges', label: 'Sonstiges' },
    ],
  },
  {
    id: 'ausgangslage',
    kind: 'choice',
    title: 'Was liegt bereits vor?',
    hint: 'Je klarer die Ausgangslage, desto schneller die Qualifizierung.',
    options: [
      { id: 'design', label: 'Design vorhanden' },
      { id: 'wireframes', label: 'Wireframes' },
      { id: 'bestehende_website', label: 'Bestehende Website' },
      { id: 'nur_content', label: 'Nur Content/Text' },
      { id: 'nur_idee', label: 'Nur Idee' },
    ],
  },
  {
    id: 'tech',
    kind: 'choice',
    title: 'Welcher Tech-Stack?',
    hint: 'Falls noch offen: wir empfehlen nach Scope und Team.',
    options: [
      { id: 'webflow', label: 'Webflow' },
      { id: 'framer', label: 'Framer' },
      { id: 'nextjs', label: 'Next.js' },
      { id: 'wordpress', label: 'WordPress' },
      { id: 'shopify', label: 'Shopify' },
      { id: 'individuell', label: 'Individuell' },
      { id: 'noch_offen', label: 'Noch offen' },
    ],
  },
  {
    id: 'ziel',
    kind: 'choice',
    title: 'Was ist das Hauptziel?',
    hint: 'Ein Fokus — wir priorisieren Conversion und Scope danach.',
    options: [
      { id: 'mehr_leads', label: 'Mehr Leads' },
      { id: 'mehr_demos', label: 'Mehr Demo-Buchungen' },
      { id: 'besseres_branding', label: 'Besseres Branding' },
      { id: 'schnellere_seite', label: 'Schnellere Seite' },
      { id: 'redesign', label: 'Redesign' },
      { id: 'mvp', label: 'MVP online bringen' },
    ],
  },
  {
    id: 'umfang',
    kind: 'choice',
    title: 'Welcher Umfang?',
    hint: 'Seitenanzahl oder laufende Unterstützung — grob reicht.',
    options: [
      { id: '1_seite', label: '1 Seite' },
      { id: '3_5_seiten', label: '3–5 Seiten' },
      { id: '5_15_seiten', label: '5–15 Seiten' },
      { id: 'komplettes_frontend', label: 'Komplettes Frontend' },
      { id: 'laufend', label: 'Laufende Unterstützung' },
    ],
  },
  {
    id: 'timing',
    kind: 'choice',
    title: 'Wann soll es starten?',
    hint: 'Wir planen Kapazität und Festangebot danach.',
    options: [
      { id: 'sofort', label: 'Sofort' },
      { id: 'in_2_wochen', label: 'In 2 Wochen' },
      { id: 'diesen_monat', label: 'Diesen Monat' },
      { id: 'naechstes_quartal', label: 'Nächstes Quartal' },
    ],
  },
  {
    id: 'kontakt',
    kind: 'kontakt',
    title: 'Wie erreichen wir Sie?',
    hint: 'Nur für die Qualifizierung — kein Newsletter.',
  },
  {
    id: 'zusammenfassung',
    kind: 'summary',
    title: 'Zusammenfassung',
    hint: 'Prüfen Sie Ihre Angaben und senden Sie die Anfrage ab.',
  },
] as const;

export const CHOICE_STEP_COUNT = BUILDER_STEPS.filter((s) => s.kind === 'choice').length;
export const TOTAL_STEP_COUNT = BUILDER_STEPS.length;

export type BuilderAnswers = Partial<Record<ChoiceStep['id'], string>>;

export interface KontaktForm {
  name: string;
  email: string;
  company: string;
  websiteUrl: string;
  message: string;
  privacyAccepted: boolean;
  /** Honeypot — must stay empty. */
  companyWebsite: string;
}

export function stepIndex(id: BuilderStepId): number {
  return BUILDER_STEPS.findIndex((s) => s.id === id);
}

export function progressPercent(index: number): number {
  if (TOTAL_STEP_COUNT <= 1) return 100;
  return Math.round(((index + 1) / TOTAL_STEP_COUNT) * 100);
}

export function canAdvanceChoice(step: ChoiceStep, answers: BuilderAnswers): boolean {
  const value = answers[step.id];
  return typeof value === 'string' && value.length > 0;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function canAdvanceKontakt(form: KontaktForm): boolean {
  if (form.companyWebsite.trim()) return false; // honeypot filled → treat as invalid for bots; UI still blocks
  if (!form.name.trim()) return false;
  if (!form.email.trim() || !EMAIL_RE.test(form.email.trim())) return false;
  if (!form.company.trim()) return false;
  if (!form.privacyAccepted) return false;
  return true;
}

export function canAdvance(step: BuilderStep, answers: BuilderAnswers, form: KontaktForm): boolean {
  if (step.kind === 'choice') return canAdvanceChoice(step, answers);
  if (step.kind === 'kontakt') return canAdvanceKontakt(form);
  return true; // summary — submit handled separately
}

export function labelForAnswer(stepId: ChoiceStep['id'], optionId: string | undefined): string {
  if (!optionId) return '—';
  const step = BUILDER_STEPS.find((s) => s.id === stepId);
  if (!step || step.kind !== 'choice') return optionId;
  return step.options.find((o) => o.id === optionId)?.label ?? optionId;
}

/** Structured payload for sales-lead `message` (no email echo to client). */
export function buildInquiryPayload(
  answers: BuilderAnswers,
  form: KontaktForm,
): {
  source: 'frontend_builder';
  use_case: 'frontend_builder';
  intent: 'frontend_builder';
  path: '/frontend-builder';
  name: string;
  email: string;
  company: string;
  company_domain?: string;
  message: string;
} {
  const answersLabeled = (BUILDER_STEPS.filter((s) => s.kind === 'choice') as ChoiceStep[]).map(
    (s) => ({
      step: s.id,
      label: s.title,
      value: answers[s.id] ?? null,
      value_label: labelForAnswer(s.id, answers[s.id]),
    }),
  );

  const domain = form.websiteUrl.trim()
    ? form.websiteUrl
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split(/[/?#]/)[0]
    : undefined;

  const lines = [
    'Frontend-Builder Anfrage',
    ...answersLabeled.map((a) => `${a.label}: ${a.value_label}`),
    form.message.trim() ? `Nachricht: ${form.message.trim().slice(0, 1500)}` : null,
    `Payload: ${JSON.stringify({ answers: answersLabeled, website: form.websiteUrl.trim() || null })}`,
  ].filter(Boolean) as string[];

  return {
    source: 'frontend_builder',
    use_case: 'frontend_builder',
    intent: 'frontend_builder',
    path: '/frontend-builder',
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    company: form.company.trim(),
    ...(domain ? { company_domain: domain.slice(0, 253) } : {}),
    message: lines.join('\n').slice(0, 4000),
  };
}

export function isHoneypotTripped(form: KontaktForm): boolean {
  return form.companyWebsite.trim().length > 0;
}