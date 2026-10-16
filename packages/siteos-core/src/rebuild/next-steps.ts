// AUTOMATE / GOVERN — was nach der Veröffentlichung sinnvoll ist.
//
// Die neue Website ist der Einstieg in die übrige Plattform: Anfragen
// weiterleiten, Termine annehmen, einen Chatbot mit Kennzeichnung betreiben,
// die Site laufend gegen DSGVO und EU AI Act prüfen.
//
// ## Zwei Regeln, die diese Datei trägt
//
// 1. **Keine behauptete Verbindung.** Ob ein CRM, ein Postfach oder Stripe
//    angebunden ist, steht in der Connector-Registratur des Mandanten
//    (`connector_registry`) — und nur dort. Fehlt der Eintrag, heißt der
//    Schritt „nicht verbunden", auch wenn die Plattform die Anbindung
//    grundsätzlich kann. Die Registratur liest der Server; der Aufrufer kann
//    sie nicht behaupten.
// 2. **Nichts läuft von selbst.** Ein Schritt ist eine Empfehlung mit
//    Begründung und Einstieg. Eingerichtet und aktiviert wird im jeweiligen
//    Modul, durch eine Person — `requiresApproval` ist deshalb immer `true`.
//
// Die Begründung zitiert, was die Ausgangsseite und der Neubau belegen
// (Formular, Chat-Widget, Buchungslink) — keine Empfehlung „auf Verdacht".

import type { SiteBlueprint } from '../types.ts';
import { hostMatches } from './hosts.ts';
import type { SourceSnapshot } from './types.ts';

export type NextStepKey =
  | 'dsgvo-ai-act-check'
  | 'ki-governance-scan'
  | 'lead-automation'
  | 'form-to-workflow'
  | 'chatbot'
  | 'booking'
  | 'crm'
  | 'email'
  | 'stripe'
  | 'local-ai';

/** Eintrag der Connector-Registratur, wie ihn der Server liest. */
export interface ConnectorState {
  systemType: string;
  status: 'connected' | 'pending' | 'error' | 'disabled';
  displayName: string;
}

export type ConnectionState = 'connected' | 'pending' | 'error' | 'not-connected' | 'included';

export interface NextStep {
  key: NextStepKey;
  title: string;
  /** Warum gerade für diese Website — mit Bezug auf Belege. */
  reason: string;
  evidence: string[];
  relevance: 'high' | 'medium' | 'low';
  /** `included`: Teil der Plattform, keine Fremdverbindung nötig. */
  connection: ConnectionState;
  /** Name des tatsächlich verbundenen Systems, sonst `null`. */
  connectedSystem: string | null;
  /** Welche Verbindung fehlt — in Worten, für die Oberfläche. */
  needs: string | null;
  /** Immer `true`: Einrichtung und Aktivierung nur durch eine Person. */
  requiresApproval: true;
  /** Einstieg in der App. */
  route: string;
}

interface CatalogEntry {
  key: NextStepKey;
  title: string;
  route: string;
  /** Registratur-Typen, die den Schritt erfüllen; leer = Plattform-Modul. */
  systemTypes: string[];
  /** Engere Zuordnung über den Anzeigenamen (z. B. Stripe unter `custom_api`). */
  nameHint?: RegExp;
  needs: string | null;
}

/**
 * Anzeigename eines lokal betriebenen Modells. Ganze Wörter, keine bloße
 * Silbe: „eu" allein träfe „OpenAI (neu)" oder „Deutsch" — und die Karte
 * behauptete eine lokale KI, die es nicht gibt.
 */
const LOCAL_AI_NAME = /(^|[^a-zäöüß])(lokal\w*|local|ollama|on-?prem\w*|self-?hosted|selbst gehostet|eu[_-]local|eigener server)($|[^a-zäöüß])/i;

const CATALOG: readonly CatalogEntry[] = [
  { key: 'dsgvo-ai-act-check', title: 'DSGVO- und EU-AI-Act-Prüfung der neuen Site', route: '/app/siteos', systemTypes: [], needs: null },
  { key: 'ki-governance-scan', title: 'KI-Governance-Scan: eingesetzte KI erfassen und kennzeichnen', route: '/app/governance/ai-register', systemTypes: [], needs: null },
  { key: 'lead-automation', title: 'Anfragen automatisch zustellen und nachfassen', route: '/app/automations', systemTypes: ['crm', 'messaging', 'microsoft365'], needs: 'CRM oder Postfach' },
  { key: 'form-to-workflow', title: 'Formular → Workflow mit Zuständigkeit und Frist', route: '/app/workflows', systemTypes: ['custom_api', 'ticketing', 'crm'], needs: 'Webhook, Ticketsystem oder CRM' },
  { key: 'chatbot', title: 'Website-Chatbot mit KI-Kennzeichnung und Freigaben', route: '/app/bots', systemTypes: ['chatbot'], needs: 'Chatbot-Anbindung' },
  { key: 'booking', title: 'Online-Terminbuchung', route: '/app/connectors', systemTypes: ['custom_api', 'crm', 'microsoft365'], nameHint: /(termin|booking|calendly|cal\.com|doctolib|etermin|shore|outlook|kalender|calendar)/i, needs: 'Buchungs- oder Kalendersystem' },
  { key: 'crm', title: 'Anfragen im CRM', route: '/app/connectors', systemTypes: ['crm'], needs: 'CRM' },
  { key: 'email', title: 'Benachrichtigung per E-Mail', route: '/app/connectors', systemTypes: ['messaging', 'microsoft365'], needs: 'Postfach (z. B. Microsoft 365)' },
  { key: 'stripe', title: 'Zahlungen mit Stripe', route: '/app/connectors', systemTypes: ['custom_api', 'erp'], nameHint: /stripe/i, needs: 'Stripe-Konto' },
  { key: 'local-ai', title: 'Lokale KI für sensible Anfragen (EU/eigener Server)', route: '/app/local-ai', systemTypes: ['ai_gateway'], nameHint: LOCAL_AI_NAME, needs: 'Lokales Modell über das AI Gateway' },
];

/** KI-Chat-Anbieter: ein Einsatz von KI im Kundenkontakt (Art. 50 EU AI Act). */
const AI_CHAT_HOSTS = ['chatbase.co', 'voiceflow.com', 'moin.ai', 'botpress.cloud', 'landbot.io', 'drift.com', 'intercom.io', 'tidio.co'];

export interface NextStepInput {
  blueprint: SiteBlueprint;
  snapshot: SourceSnapshot | null;
  connectors: ConnectorState[];
}

export function planNextSteps(input: NextStepInput): NextStep[] {
  const { blueprint, snapshot, connectors } = input;
  const pages = snapshot?.pages ?? [];
  const blocks = blueprint.pages.flatMap((p) => p.blocks).filter((b) => b.content.hidden !== true);
  const leadForms = pages.flatMap((p) => p.forms).filter((f) => f.purpose === 'contact' || f.purpose === 'booking');
  const newForm = blocks.find((b) => b.kind === 'contact-form' || b.kind === 'booking');
  const chats = pages.flatMap((p) => p.thirdParty).filter((t) => t.category === 'chat');
  const aiChats = chats.filter((t) => AI_CHAT_HOSTS.some((d) => hostMatches(t.host, d)));
  const bookingSignals = [
    ...pages.flatMap((p) => p.backendLinks).filter((l) => l.kind === 'booking').map((l) => l.ev),
    ...pages.flatMap((p) => p.forms).filter((f) => f.purpose === 'booking').map((f) => f.ev),
    ...pages.flatMap((p) => p.thirdParty).filter((t) => t.category === 'booking').map((t) => t.ev),
  ];
  const paymentSignals = [
    ...pages.flatMap((p) => p.backendLinks).filter((l) => l.kind === 'payment' || l.kind === 'shop').map((l) => l.ev),
    ...pages.flatMap((p) => p.thirdParty).filter((t) => t.category === 'payment').map((t) => t.ev),
  ];
  const faqCount = blocks.filter((b) => b.kind === 'faq').reduce((n, b) => n + (Array.isArray(b.content.items) ? b.content.items.length : 0), 0);
  const generated = blocks.some((b) => b.aiGenerated);
  const sensitive = blueprint.compliance.specialCategories || ['rechtsanwalt', 'steuerberatung', 'arztpraxis', 'zahnarzt'].includes(blueprint.industry);

  const steps: NextStep[] = [];
  for (const entry of CATALOG) {
    const connection = resolveConnection(entry, connectors);
    const base = { key: entry.key, title: entry.title, route: entry.route, requiresApproval: true as const, ...connection, needs: connection.connection === 'connected' || connection.connection === 'included' ? null : entry.needs };
    switch (entry.key) {
      case 'dsgvo-ai-act-check':
        steps.push({ ...base, relevance: 'high', evidence: [], reason: `Vor und nach der Veröffentlichung: Impressum, Datenschutz, Formular-Rechtsgrundlagen (${blueprint.compliance.legalBases.join(', ') || '—'}), Einwilligungskategorien (${blueprint.compliance.consentCategories.join(', ')}) und KI-Kennzeichnung laufend prüfen.` });
        break;
      case 'ki-governance-scan':
        steps.push({
          ...base,
          relevance: aiChats.length > 0 || generated ? 'high' : 'medium',
          evidence: aiChats.map((c) => c.ev),
          reason: aiChats.length > 0
            ? `Die bisherige Website bindet einen KI-Chat ein (${[...new Set(aiChats.map((c) => c.host))].join(', ')}). KI im Kundenkontakt ist kennzeichnungspflichtig (Art. 50 EU AI Act) und gehört ins KI-Register.`
            : 'Eingesetzte KI-Systeme (Chat, Texte, Auswertung) im KI-Register erfassen — Grundlage für Kennzeichnung und Risikoeinstufung nach EU AI Act.',
        });
        break;
      case 'lead-automation':
        steps.push({
          ...base,
          relevance: leadForms.length > 0 || newForm ? 'high' : 'low',
          evidence: leadForms.map((f) => f.ev),
          reason: leadForms.length > 0
            ? `Die bisherige Website nimmt Anfragen über ${leadForms.length === 1 ? 'ein Formular' : `${leadForms.length} Formulare`} an. Zustellung, Eingangsbestätigung und Nachfassen lassen sich automatisieren — jede Automation erst nach Freigabe.`
            : 'Anfragen aus dem neuen Formular zustellen, bestätigen und nachfassen — jede Automation erst nach Freigabe.',
        });
        break;
      case 'form-to-workflow':
        steps.push({
          ...base,
          relevance: newForm ? 'medium' : 'low',
          evidence: [],
          reason: 'Jede Anfrage als Vorgang mit Zuständigkeit und Frist statt als lose E-Mail — mit Prüfpfad, wer was wann bearbeitet hat.',
        });
        break;
      case 'chatbot':
        steps.push({
          ...base,
          relevance: chats.length > 0 ? 'high' : faqCount >= 3 ? 'medium' : 'low',
          evidence: chats.map((c) => c.ev),
          reason: chats.length > 0
            ? `Das Chat-Widget der bisherigen Website (${[...new Set(chats.map((c) => c.host))].join(', ')}) wird nicht übernommen. Ein Chatbot mit KI-Kennzeichnung, Freigaben und Prüfpfad kann ihn ersetzen.`
            : faqCount >= 3
              ? `Die Site beantwortet ${faqCount} häufige Fragen — eine belegte Wissensbasis für einen gekennzeichneten Chatbot.`
              : 'Ein Chatbot lohnt sich erst mit belegten Antworten (FAQ, Leistungen) — sonst erfindet er sie.',
        });
        break;
      case 'booking':
        steps.push({
          ...base,
          relevance: bookingSignals.length > 0 ? 'high' : blueprint.industry === 'zahnarzt' || blueprint.industry === 'arztpraxis' ? 'medium' : 'low',
          evidence: bookingSignals,
          reason: bookingSignals.length > 0
            ? 'Die bisherige Website führt zu einer Terminbuchung. Anbinden statt nur verlinken, damit Termine im eigenen Kalender landen.'
            : 'Termine online annehmen statt per Telefon abstimmen.',
        });
        break;
      case 'crm':
        steps.push({ ...base, relevance: leadForms.length > 0 ? 'medium' : 'low', evidence: leadForms.map((f) => f.ev), reason: 'Anfragen mit Herkunft (Seite, Formular) im CRM statt im Postfach.' });
        break;
      case 'email':
        steps.push({ ...base, relevance: newForm ? 'medium' : 'low', evidence: [], reason: 'Benachrichtigung und Eingangsbestätigung aus dem eigenen Postfach.' });
        break;
      case 'stripe':
        steps.push({
          ...base,
          relevance: paymentSignals.length > 0 ? 'high' : 'low',
          evidence: paymentSignals,
          reason: paymentSignals.length > 0
            ? 'Die bisherige Website hat eine Zahlungs- oder Shop-Strecke. Mit Stripe lässt sie sich unabhängig vom alten System weiterführen.'
            : 'Nur relevant, wenn online bezahlt werden soll.',
        });
        break;
      case 'local-ai':
        steps.push({
          ...base,
          relevance: sensitive ? 'medium' : 'low',
          evidence: [],
          reason: sensitive
            ? 'Anfragen dieser Branche enthalten oft vertrauliche Angaben. Eine lokale KI verarbeitet sie ohne Übermittlung an Cloud-Anbieter.'
            : 'Für vertrauliche Inhalte: KI auf eigener oder EU-Infrastruktur statt bei einem Cloud-Anbieter.',
        });
        break;
    }
  }

  const rank = { high: 0, medium: 1, low: 2 } as const;
  return steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => rank[a.step.relevance] - rank[b.step.relevance] || a.index - b.index)
    .map(({ step }) => step);
}

function resolveConnection(entry: CatalogEntry, connectors: ConnectorState[]): { connection: ConnectionState; connectedSystem: string | null } {
  if (entry.systemTypes.length === 0) return { connection: 'included', connectedSystem: null };
  const candidates = connectors.filter((c) => entry.systemTypes.includes(c.systemType) && (!entry.nameHint || entry.nameHint.test(c.displayName)));
  const connected = candidates.find((c) => c.status === 'connected');
  if (connected) return { connection: 'connected', connectedSystem: connected.displayName };
  if (candidates.some((c) => c.status === 'pending')) return { connection: 'pending', connectedSystem: null };
  if (candidates.some((c) => c.status === 'error')) return { connection: 'error', connectedSystem: null };
  return { connection: 'not-connected', connectedSystem: null };
}
