// Reine Logik des Posteingangs (PR C, Schritt 4) — ohne Supabase-Import,
// damit test/bots/inbox.test.ts sie direkt prüfen kann.
//
// Die Statusmaschine liegt in Postgres (inbox_take_over / inbox_resolve mit
// Compare-and-Set). Diese Datei entscheidet nur, was die Oberfläche anbietet
// und wie sie Antworten des Servers in Worte fasst. Sie erlaubt nichts, was
// der Server nicht ohnehin prüft.

import type {
  BotConversation,
  ConversationChannel,
  ConversationStatus,
  InboxRpcResult,
  SiteInboxBinding,
  WebsiteProjectSummary,
  Bot,
} from './types';

/** Filter der Konversationsliste. `aktiv` = Neu + In Bearbeitung. */
export type InboxFilter = 'aktiv' | 'open' | 'in_bearbeitung' | 'erledigt' | 'alle';

export const INBOX_FILTERS: readonly { id: InboxFilter; label: string }[] = [
  { id: 'aktiv', label: 'Offen' },
  { id: 'open', label: 'Neu' },
  { id: 'in_bearbeitung', label: 'In Bearbeitung' },
  { id: 'erledigt', label: 'Erledigt' },
  { id: 'alle', label: 'Alle' },
];

/** Statuswerte, die ein Filter abfragt; `null` = keine Einschränkung. */
export function statusesForFilter(filter: InboxFilter): ConversationStatus[] | null {
  switch (filter) {
    case 'aktiv': return ['open', 'in_bearbeitung'];
    case 'open': return ['open'];
    case 'in_bearbeitung': return ['in_bearbeitung'];
    case 'erledigt': return ['erledigt'];
    case 'alle': return null;
  }
}

const STATUS_LABEL: Record<ConversationStatus, string> = {
  open: 'Neu',
  in_bearbeitung: 'In Bearbeitung',
  erledigt: 'Erledigt',
  closed: 'Geschlossen',
};

/** Anzeigename eines Status. „Neu“ ist der Bestandswert `open` (E10). */
export function statusLabel(status: string): string {
  return (STATUS_LABEL as Record<string, string>)[status] ?? status;
}

/** Semantische Statusfarbe (getrennt von Brand-Akzenten). */
export type StatusTone = 'attention' | 'progress' | 'done' | 'muted';

export function statusTone(status: string): StatusTone {
  switch (status) {
    case 'open': return 'attention';
    case 'in_bearbeitung': return 'progress';
    case 'erledigt': return 'done';
    default: return 'muted';
  }
}

const CHANNEL_LABEL: Record<ConversationChannel, string> = {
  chat: 'Chat',
  voice: 'Telefon',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  form: 'Formular',
};

export function channelLabel(channel: string): string {
  return (CHANNEL_LABEL as Record<string, string>)[channel] ?? channel;
}

/** Welche Übergabe-Aktion die Oberfläche für einen Status anbietet. */
export type InboxAction = 'take_over' | 'resolve' | null;

export function availableAction(status: string): InboxAction {
  if (status === 'open') return 'take_over';
  if (status === 'in_bearbeitung') return 'resolve';
  return null;
}

export const ACTION_LABEL: Record<Exclude<InboxAction, null>, string> = {
  take_over: 'Übernehmen',
  resolve: 'Als erledigt markieren',
};

/**
 * Antwort eines RPC als Rückmeldung. `conflict` heißt: Der Status hat sich
 * inzwischen geändert (z. B. hat jemand anderes übernommen). `not_found`
 * unterscheidet bewusst nicht zwischen „gibt es nicht“ und „kein Zugriff“.
 */
export function rpcFeedback(
  action: Exclude<InboxAction, null>,
  result: InboxRpcResult | string,
): { tone: 'ok' | 'warn' | 'error'; text: string } {
  if (result === 'ok') {
    return action === 'take_over'
      ? { tone: 'ok', text: 'Anfrage übernommen. Du bist jetzt zuständig.' }
      : { tone: 'ok', text: 'Anfrage als erledigt markiert.' };
  }
  if (result === 'conflict') {
    return action === 'take_over'
      ? { tone: 'warn', text: 'Diese Anfrage wurde inzwischen schon übernommen. Die Liste ist aktualisiert.' }
      : { tone: 'warn', text: 'Der Status dieser Anfrage hat sich inzwischen geändert. Die Liste ist aktualisiert.' };
  }
  if (result === 'not_found') {
    return { tone: 'error', text: 'Anfrage nicht gefunden oder kein Zugriff.' };
  }
  return { tone: 'error', text: 'Unerwartete Antwort des Servers. Bitte Seite neu laden.' };
}

/** Kurzbezeichnung einer Konversation in der Liste. */
export function conversationTitle(c: Pick<BotConversation, 'contact_label' | 'external_ref' | 'channel'>, intakeName?: string | null): string {
  if (intakeName && intakeName.trim()) return intakeName.trim();
  if (c.contact_label && c.contact_label.trim()) return c.contact_label.trim();
  // Formular-Nonces (`form:<nonce>`) sind technische Schlüssel, kein Name.
  if (c.channel === 'form') return 'Formular-Anfrage';
  return c.external_ref || 'Anonym';
}

/**
 * Fehler, die nur bedeuten „Migration aus PR C noch nicht angewendet“
 * (Tabelle/Funktion fehlt). Die Oberfläche zeigt dann einen ruhigen Hinweis
 * statt einer roten Fehlermeldung.
 */
export function isMissingSchemaError(message: string): boolean {
  return /PGRST20[25]|42P01|42883|does not exist|Could not find the (table|function)|schema cache/i.test(message);
}

// ── Binding-Panel ──────────────────────────────────────────────────────────

/** Rollen, die Bindings anlegen und ändern dürfen (= RLS-Policy). */
export function canManageBindings(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Warum ein Formular (noch) keine Anfragen annimmt. Spiegelt die
 * fail-closed-Bedingungen von `resolve_site_inbox`: Binding aktiv, Seite
 * `live`, Bot aktiv. Leere Liste = alle drei Bedingungen erfüllt.
 */
export function bindingBlockers(
  binding: Pick<SiteInboxBinding, 'enabled'>,
  project: Pick<WebsiteProjectSummary, 'status'> | undefined,
  bot: Pick<Bot, 'enabled'> | undefined,
): string[] {
  const out: string[] = [];
  if (!binding.enabled) out.push('Annahme ist ausgeschaltet.');
  if (!project) out.push('Seite nicht gefunden.');
  else if (project.status !== 'live') out.push('Seite ist nicht veröffentlicht (Status muss „live“ sein).');
  if (!bot) out.push('Assistent nicht gefunden.');
  else if (!bot.enabled) out.push('Assistent ist deaktiviert.');
  return out;
}
