/**
 * „Ihre Pflichten heute": regelbasierte Ableitung aus der Selbstauskunft
 * des Mandanten (`organization.aiSetup`, WP3).
 *
 * Warum es das gibt: Ein frischer Mandant sieht im Command Center sonst nur
 * leere Zähler. Diese Liste zeigt ihm in der ersten Minute, welche
 * Pflichten sich aus seinen eigenen Angaben ergeben, und wo im Produkt er
 * sie erledigt.
 *
 * Regeln, die hier gelten:
 *   - Jede Pflicht nennt ihren Auslöser (`because`), also welche Angabe sie
 *     ausgelöst hat. Ohne Angabe gibt es auch keine Pflicht.
 *   - Es gibt keinen Score und keine Risikobewertung. `kind` trennt nur
 *     „gilt bei dieser Angabe" (`duty`) von „im Einzelfall prüfen" (`check`).
 *   - Keine Rechtsberatung: Die Liste ist ein Startpunkt und steht so im UI.
 *   - Reine Funktion ohne I/O, damit jede Regel testbar bleibt.
 */

import {
  AI_SYSTEM_OPTIONS,
  BOT_AGENT_OPTIONS,
  DATA_CLASS_OPTIONS,
  NONE_OPTION_ID,
  type AiSetup,
} from '../../activation/aiSetupCatalog';

export type ObligationKind = 'duty' | 'check';

export interface Obligation {
  id: string;
  kind: ObligationKind;
  title: string;
  /** Rechtsgrundlage, kurz. */
  basis: string;
  /** Welche Angaben des Mandanten die Pflicht ausgelöst haben. */
  because: string;
  /** Optionaler Geltungshinweis, z. B. „seit 02.02.2025". */
  since?: string;
  /** Wo im Produkt die Pflicht bearbeitet wird. Navigiert nur. */
  to: string;
  cta: string;
}

/** Nur die Felder, die für die Ableitung zählen. */
export type ObligationInput = Pick<AiSetup, 'aiSystems' | 'botsAgents' | 'dataClasses'> & {
  approvals?: Pick<AiSetup['approvals'], 'autoCommunicate' | 'triggerTransactions'>;
};

/** Externe Cloud-Anbieter: Daten verlassen das eigene Haus. */
export const EXTERNAL_AI_IDS = [
  'openai', 'anthropic', 'google', 'microsoft_copilot', 'xai', 'automation_make_zapier_n8n',
] as const;

/** Bots, mit denen Menschen direkt sprechen oder schreiben. */
const PEOPLE_FACING_BOT_IDS = [
  'website_chat', 'voice', 'whatsapp', 'support_agent', 'sales_agent',
] as const;

/** Datenklassen mit Personenbezug. */
const PERSONAL_DATA_IDS = [
  'customer', 'employee', 'health', 'payment', 'web_tracking', 'crm', 'email',
] as const;

const LABELS: Record<string, string> = Object.fromEntries(
  [...AI_SYSTEM_OPTIONS, ...BOT_AGENT_OPTIONS, ...DATA_CLASS_OPTIONS].map((o) => [o.id, o.label]),
);

function real(list: readonly string[]): string[] {
  return list.filter((x) => x !== NONE_OPTION_ID);
}

function pick(list: readonly string[], allowed: readonly string[]): string[] {
  return list.filter((x) => allowed.includes(x));
}

/** „A, B und C" aus Katalog-IDs. Kürzt Klammerzusätze für den Fließtext. */
export function joinLabels(ids: readonly string[]): string {
  const names = ids.map((id) => (LABELS[id] ?? id).replace(/\s*\(.*\)\s*$/, ''));
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
}

/** Hat der Mandant irgendeine KI oder einen Bot angegeben? */
export function usesAnyAi(input: ObligationInput): boolean {
  return real(input.aiSystems).length > 0 || real(input.botsAgents).length > 0;
}

/**
 * Leitet die Pflichtenliste ab. Reihenfolge: zuerst die Pflichten, die
 * jeden KI-Einsatz betreffen, dann die datengetriebenen, dann Prüfpunkte.
 */
export function deriveObligations(input: ObligationInput): Obligation[] {
  if (!usesAnyAi(input)) return [];

  const ai = real(input.aiSystems);
  const bots = real(input.botsAgents);
  const external = pick(ai, EXTERNAL_AI_IDS);
  const facing = pick(bots, PEOPLE_FACING_BOT_IDS);
  const personal = pick(input.dataClasses, PERSONAL_DATA_IDS);
  const anyAiLabel = joinLabels([...ai, ...bots].slice(0, 3));

  const out: Obligation[] = [];

  out.push({
    id: 'ai_literacy',
    kind: 'duty',
    title: 'KI-Kompetenz der Beschäftigten sicherstellen und dokumentieren',
    basis: 'Art. 4 KI-VO',
    since: 'seit 02.02.2025',
    because: `Sie setzen KI ein (${anyAiLabel}).`,
    to: '/app/policies/templates',
    cta: 'KI-Richtlinie anlegen',
  });

  out.push({
    id: 'ai_inventory',
    kind: 'duty',
    title: 'Eingesetzte KI-Systeme erfassen und einstufen',
    basis: 'Art. 6, 26, 50 KI-VO',
    because: 'Ohne Inventar lässt sich keine Risikoklasse und keine Pflicht nachweisen.',
    to: '/app/ai-systems',
    cta: 'Ins KI-Inventar übernehmen',
  });

  if (facing.length > 0) {
    out.push({
      id: 'ai_transparency',
      kind: 'duty',
      title: 'Kennzeichnen, dass Menschen mit einer KI sprechen',
      basis: 'Art. 50 Abs. 1 KI-VO',
      since: 'laut Verordnung ab 02.08.2026',
      because: `Sie nutzen oder planen: ${joinLabels(facing)}.`,
      to: '/app/ai-systems',
      cta: 'Hinweistext im Inventar festhalten',
    });
  }

  if (external.length > 0 && personal.length > 0) {
    out.push({
      id: 'processor_contract',
      kind: 'duty',
      title: 'Auftragsverarbeitung und Drittlandübermittlung mit KI-Anbietern absichern',
      basis: 'Art. 28, 44 ff. DSGVO',
      because: `${joinLabels(external)} verarbeiten bei Ihnen ${joinLabels(personal)}.`,
      to: '/app/vendors',
      cta: 'Anbieter erfassen',
    });
  }

  if (personal.length > 0) {
    out.push({
      id: 'records_of_processing',
      kind: 'duty',
      title: 'KI-Verarbeitungen ins Verarbeitungsverzeichnis aufnehmen',
      basis: 'Art. 30 DSGVO',
      because: `KI kommt mit ${joinLabels(personal)} in Berührung.`,
      to: '/app/vvt',
      cta: 'VVT öffnen',
    });
  }

  if (input.dataClasses.includes('health')) {
    out.push({
      id: 'dpia_health',
      kind: 'duty',
      title: 'Datenschutz-Folgenabschätzung durchführen',
      basis: 'Art. 9, 35 DSGVO',
      because: 'KI verarbeitet Gesundheitsdaten (besondere Kategorie).',
      to: '/app/dpia',
      cta: 'DSFA starten',
    });
  }

  if (input.dataClasses.includes('employee')) {
    out.push({
      id: 'hr_high_risk_check',
      kind: 'check',
      title: 'Prüfen, ob KI im Personalbereich als Hochrisiko gilt',
      basis: 'Anhang III Nr. 4 KI-VO · § 87 BetrVG',
      because: 'KI kommt mit Mitarbeiterdaten in Berührung.',
      to: '/app/risk-inventory',
      cta: 'Im Risiko-Inventar prüfen',
    });
  }

  const approvals = input.approvals;
  if (
    bots.length > 0
    && approvals
    && (approvals.autoCommunicate === 'yes' || approvals.triggerTransactions === 'yes')
  ) {
    out.push({
      id: 'human_oversight',
      kind: 'check',
      title: 'Menschliche Freigabe für Außenwirkung und Transaktionen festlegen',
      basis: 'Art. 22 DSGVO · Grundsatz menschlicher Aufsicht',
      because: 'Bots dürfen laut Ihrem Setup ohne Freigabe kommunizieren oder Transaktionen auslösen.',
      to: '/app/activation',
      cta: 'Freigaberegeln anpassen',
    });
  }

  return out;
}

/** Zählung für die Überschrift. Reine Zählung der abgeleiteten Einträge. */
export function countByKind(list: readonly Obligation[]): { duties: number; checks: number } {
  let duties = 0;
  let checks = 0;
  for (const o of list) {
    if (o.kind === 'duty') duties += 1;
    else checks += 1;
  }
  return { duties, checks };
}
