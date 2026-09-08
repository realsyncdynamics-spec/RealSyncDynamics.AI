// Ziel-Vorlagen für den Bot-Builder.
//
// Everlast, Voiceflow und Retell gewinnen nicht durch mehr Felder, sondern
// dadurch, dass die Anlage drei Fragen stellt: Was soll der Bot tun? Für wen?
// Wohin eskaliert er? Der Rest ist Ableitung.
//
// Diese Datei ist die Ableitung. Der Mandant wählt ein Ziel, nicht einen
// Kanal-Dropdown. Kanal, Persona, Begrüßung und Fähigkeiten entstehen daraus
// — überschreibbar, aber nicht der Einstieg.

import type { BotCapabilities, BotChannel, BotKnowledge, CreateBotArgs } from './types';

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Liest `bots.config.knowledge`. Dieselbe Form wie `_shared/bots.ts`. */
export function knowledgeFromBotConfig(config: Record<string, unknown> | null | undefined): BotKnowledge {
  const raw = config && typeof config === 'object' ? config.knowledge : undefined;
  if (!raw || typeof raw !== 'object') return {};
  const k = raw as Record<string, unknown>;
  return {
    goal: readString(k.goal),
    hours: readString(k.hours),
    services: readString(k.services),
    handoffPhone: readString(k.handoffPhone),
    notes: readString(k.notes),
  };
}

export type BotGoalId =
  | 'phone_reception'
  | 'web_chat'
  | 'appointments'
  | 'orders'
  | 'whatsapp_desk';

export interface BotGoalTemplate {
  id: BotGoalId;
  /** Kurzname auf der Kachel. */
  name: string;
  /** Ein Satz, was der Bot nach der Anlage tut. */
  promise: string;
  channel: BotChannel;
  capabilities: BotCapabilities;
  greeting: string;
  /** Persona-Gerüst. `{name}` wird durch den Anzeigenamen ersetzt. */
  persona: string;
  knowledge: Pick<BotKnowledge, 'goal'>;
  /** Telefon ist das Leitprodukt — die Kachel steht zuerst und größer. */
  featured?: boolean;
}

export const BOT_GOAL_TEMPLATES: readonly BotGoalTemplate[] = [
  {
    id: 'phone_reception',
    name: 'Telefon-Empfang',
    promise: 'Nimmt Anrufe an, beantwortet häufige Fragen und legt Termine an.',
    channel: 'voice',
    capabilities: { appointments: true, orders: false },
    greeting: 'Guten Tag, Sie sprechen mit dem Empfang. Wie kann ich Ihnen helfen?',
    persona:
      'Du bist der telefonische Empfang von {name}. Du siezt, sprichst kurze Sätze und unterbrichst dich, wenn der Anrufer spricht. Du buchst Termine, nennst Öffnungszeiten und leitest bei Unsicherheit an einen Menschen weiter. Kein Verkaufsdruck.',
    knowledge: { goal: 'phone_reception' },
    featured: true,
  },
  {
    id: 'web_chat',
    name: 'Website-Chat',
    promise: 'Beantwortet Besucherfragen auf der Website, rund um die Uhr.',
    channel: 'chat',
    capabilities: { appointments: false, orders: false },
    greeting: 'Hallo! Wobei kann ich Ihnen helfen?',
    persona:
      'Du bist der Chat-Assistent von {name}. Du antwortest knapp, sachlich und auf Deutsch. Du erfindest keine Fakten und verweist bei Unsicherheit auf den Kontaktweg.',
    knowledge: { goal: 'web_chat' },
  },
  {
    id: 'appointments',
    name: 'Termin-Assistent',
    promise: 'Nimmt Terminanfragen entgegen und bestätigt den Wunschtermin.',
    channel: 'chat',
    capabilities: { appointments: true, orders: false },
    greeting: 'Hallo, ich nehme Termine entgegen. Wann passt es Ihnen?',
    persona:
      'Du bist der Termin-Assistent von {name}. Deine einzige Aufgabe ist, einen passenden Termin aufzunehmen: Name, Kontakt, Wunschzeit, Anliegen. Keine medizinische oder rechtliche Beratung.',
    knowledge: { goal: 'appointments' },
  },
  {
    id: 'orders',
    name: 'Bestellannahme',
    promise: 'Nimmt Bestellungen auf und wiederholt die Positionen zur Bestätigung.',
    channel: 'chat',
    capabilities: { appointments: false, orders: true },
    greeting: 'Guten Tag, ich nehme Ihre Bestellung auf. Was darf es sein?',
    persona:
      'Du bist die Bestellannahme von {name}. Du nimmst Positionen, Mengen und den Kontakt auf, wiederholst die Bestellung und bestätigst erst danach. Keine Preise erfinden.',
    knowledge: { goal: 'orders' },
  },
  {
    id: 'whatsapp_desk',
    name: 'WhatsApp-Empfang',
    promise: 'Beantwortet Nachrichten auf der Geschäftsnummer und nimmt Anliegen auf.',
    channel: 'whatsapp',
    capabilities: { appointments: true, orders: false },
    greeting: 'Willkommen bei uns auf WhatsApp. Wie kann ich helfen?',
    persona:
      'Du bist der WhatsApp-Empfang von {name}. Kurze Nachrichten, kein Fließtext, eine Frage nach der anderen. Termine nimmst du auf, Rechts- oder Gesundheitsrat gibst du nicht.',
    knowledge: { goal: 'whatsapp_desk' },
  },
] as const;

export function botGoalById(id: BotGoalId): BotGoalTemplate {
  return BOT_GOAL_TEMPLATES.find((t) => t.id === id) ?? BOT_GOAL_TEMPLATES[0];
}

export interface ApplyBotGoalInput {
  tenant_id: string;
  displayName: string;
  hours?: string;
  services?: string;
  handoffPhone?: string;
}

/** Baut die Create-Args für einen Ziel-Bot. Keine Netzarbeit. */
export function applyBotGoal(goal: BotGoalId, input: ApplyBotGoalInput): CreateBotArgs {
  const template = botGoalById(goal);
  const name = input.displayName.trim() || template.name;
  const persona = template.persona.replaceAll('{name}', name);

  return {
    tenant_id: input.tenant_id,
    name,
    description: template.promise,
    channel: template.channel,
    persona,
    greeting: template.greeting,
    capabilities: { ...template.capabilities },
    enabled: true,
    config: {
      knowledge: {
        goal: template.knowledge.goal,
        hours: input.hours?.trim() || undefined,
        services: input.services?.trim() || undefined,
        handoffPhone: input.handoffPhone?.trim() || undefined,
      },
    },
  };
}
