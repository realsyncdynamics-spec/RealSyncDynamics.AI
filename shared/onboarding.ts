/**
 * Q&A-Einstieg → Plan- und Modul-Empfehlung.
 * Keine Preise hier. Preise nur aus `./pricing.ts`.
 */

import {
  BOOKABLE_MODULES,
  type BookableModuleId,
  type PlanId,
  recommendPlan,
} from './pricing';

export type OnboardingChoiceId =
  | 'keep_frontend'
  | 'modernize_frontend'
  | 'decide_later'
  | 'channel_web'
  | 'channel_whatsapp'
  | 'channel_voice'
  | 'channel_none'
  | 'domains_1'
  | 'domains_3'
  | 'domains_10'
  | 'domains_multi'
  | 'fw_dsgvo'
  | 'fw_ai_act'
  | 'fw_iso'
  | 'fw_regulated'
  | 'role_solo'
  | 'role_team'
  | 'role_agency'
  | 'role_enterprise'
  | 'bill_usage'
  | 'bill_flat'
  | 'bill_contract';

export interface OnboardingQuestion {
  id: string;
  title: string;
  hint: string;
  multi: boolean;
  options: Array<{ id: OnboardingChoiceId; label: string }>;
}

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'frontend',
    title: 'Was betreibst du heute?',
    hint: 'Governance läuft auch auf der bestehenden Website.',
    multi: false,
    options: [
      { id: 'keep_frontend', label: 'Bestehende Website behalten' },
      { id: 'modernize_frontend', label: 'Neue Landingpage / SiteOS' },
      { id: 'decide_later', label: 'Später entscheiden' },
    ],
  },
  {
    id: 'channels',
    title: 'Welche Kanäle sollen antworten?',
    hint: 'Live erst nach Art.-50-Hinweis und Vault-Secret.',
    multi: true,
    options: [
      { id: 'channel_web', label: 'Website-Chat' },
      { id: 'channel_whatsapp', label: 'WhatsApp (zzgl. Meta-Gebühren)' },
      { id: 'channel_voice', label: 'Telefon (zzgl. Minuten)' },
      { id: 'channel_none', label: 'Nur Governance, keine Bots' },
    ],
  },
  {
    id: 'scale',
    title: 'Wie viele Domains oder Marken?',
    hint: '1 = Starter möglich · 2–3 = Growth · mehr = Agency.',
    multi: false,
    options: [
      { id: 'domains_1', label: 'Eine Domain' },
      { id: 'domains_3', label: 'Zwei bis drei' },
      { id: 'domains_10', label: 'Vier bis zehn' },
      { id: 'domains_multi', label: 'Mehrere Firmen / Mandanten' },
    ],
  },
  {
    id: 'frameworks',
    title: 'Was muss nachweisbar sein?',
    hint: 'DSGVO und AI Act sitzen im Fundament.',
    multi: true,
    options: [
      { id: 'fw_dsgvo', label: 'DSGVO' },
      { id: 'fw_ai_act', label: 'EU AI Act (Art. 50 bei Chat/Voice)' },
      { id: 'fw_iso', label: 'ISO 27001 / Drift' },
      { id: 'fw_regulated', label: 'NIS2 / TISAX / DORA' },
    ],
  },
  {
    id: 'role',
    title: 'Wer nutzt das Produkt?',
    hint: 'Die Rolle bestimmt den Plan stärker als der Score.',
    multi: false,
    options: [
      { id: 'role_solo', label: 'Ich selbst' },
      { id: 'role_team', label: 'Team bis fünf Personen' },
      { id: 'role_agency', label: 'Agentur für Kunden' },
      { id: 'role_enterprise', label: 'Konzern / SSO' },
    ],
  },
  {
    id: 'billing',
    title: 'Wie soll abgerechnet werden?',
    hint: 'Verbrauch (WhatsApp, Voice, Bilder) bleibt sichtbar.',
    multi: false,
    options: [
      { id: 'bill_usage', label: 'Fix plus Verbrauch' },
      { id: 'bill_flat', label: 'Nur Fix, enge Limits' },
      { id: 'bill_contract', label: 'Angebot / Vertrag' },
    ],
  },
];

export interface OnboardingRecommendation {
  planId: PlanId;
  reason: string;
  modules: BookableModuleId[];
  track: 'keep_frontend' | 'modernize_frontend';
}

export function recommendFromAnswers(selected: readonly OnboardingChoiceId[]): OnboardingRecommendation {
  const has = (id: OnboardingChoiceId) => selected.includes(id);

  const tenants = has('domains_multi') || has('role_enterprise') ? 3 : 1;
  const domains = has('domains_10') ? 8 : has('domains_3') ? 3 : 1;
  const needsWhiteLabel = has('role_agency');
  const needsApi = has('fw_iso') || has('fw_regulated');

  let base = recommendPlan({
    score: has('fw_regulated') ? 30 : has('fw_iso') ? 50 : 80,
    domains,
    tenants,
    needsApi,
    needsWhiteLabel,
  });

  if (has('role_agency') && base.planId !== 'partner') {
    base = { planId: 'agency', reason: 'Agentur-Betrieb mit Kunden-Dashboards liegt auf Agency.' };
  }
  if (has('role_enterprise')) {
    base = { planId: 'enterprise', reason: 'SSO und mehrere Organisationen liegen auf Enterprise.' };
  }
  if (has('bill_contract') && base.planId !== 'partner') {
    base = { planId: 'enterprise', reason: 'Vertragsabrechnung startet über Enterprise.' };
  }

  const modules: BookableModuleId[] = ['governance_core'];
  if (has('modernize_frontend')) modules.push('ai_frontend');
  if (has('channel_web')) modules.push('website_chat');
  if (has('channel_whatsapp')) modules.push('whatsapp_bot');
  if (has('channel_voice')) modules.push('voice_bot');
  if (has('fw_iso') || has('fw_regulated')) modules.push('advanced_ai_governance');

  const known = new Set(BOOKABLE_MODULES.map((m) => m.id));
  return {
    planId: base.planId,
    reason: base.reason,
    modules: modules.filter((id) => known.has(id)),
    track: has('modernize_frontend') ? 'modernize_frontend' : 'keep_frontend',
  };
}
