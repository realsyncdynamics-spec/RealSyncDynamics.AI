/**
 * Governed Browser Runtime — verständliche Texte für Server-Codes.
 * Technische Details bleiben im Function-Log; hier nur, was Nutzer brauchen.
 */
import { BrowserExecutorError, type BrowserExecutorAction, type ExecutorStatus, type SessionStatus } from './browserExecutorClient';
import { consumedApprovalMessage } from './consumedApproval';

export const CAPABILITY_REASON_TEXT: Record<string, string> = {
  TENANT_NOT_VERIFIED: 'Mandant nicht über eine Mitgliedschaft bestätigt',
  ROLE_NOT_PERMITTED: 'Ihre Rolle erlaubt das nicht',
  ENTITLEMENT_REQUIRED: 'Nicht im Tarif enthalten (ab Starter)',
  ENTITLEMENT_UNAVAILABLE: 'Tarif derzeit nicht prüfbar',
  KILL_SWITCH_ENGAGED: 'Notabschaltung aktiv',
  EXECUTOR_OFFLINE: 'Executor offline',
  EXECUTOR_DEGRADED: 'Executor eingeschränkt',
  EXECUTOR_BUSY: 'Executor ausgelastet',
  POLICY_ENGINE_INACTIVE: 'Mandanten-Policies nicht ladbar',
  EVIDENCE_STORE_UNAVAILABLE: 'Evidence-Speicher nicht erreichbar',
  APPROVAL_POLICY_MISSING: 'Keine Autonomie-Freigabe-Policy definiert',
  SESSION_VISUALIZATION_UNAVAILABLE: 'Keine Session-Visualisierung',
  EXECUTION_LIMITS_MISSING: 'Keine Ausführungsgrenzen',
  KILL_SWITCH_MISSING: 'Keine Notabschaltung',
  ACTION_NOT_SUPPORTED_BY_EXECUTOR: 'Vom Executor nicht unterstützt',
  FILE_SOURCE_NOT_CONFIGURED: 'Keine mandantengebundene Dateiquelle eingerichtet',
};

export const EXECUTOR_REASON_TEXT: Record<string, string> = {
  EXECUTOR_NOT_CONFIGURED: 'Für diese Umgebung ist kein Executor eingerichtet.',
  EXECUTOR_UNREACHABLE: 'Der Executor antwortet nicht.',
  EXECUTOR_AUTH_FAILED: 'Der Executor lehnt die Zugangsdaten ab.',
  EXECUTOR_BROWSER_DISCONNECTED: 'Der Executor läuft, Chromium ist aber nicht verbunden.',
  EXECUTOR_LEGACY_NO_SESSIONS: 'Die Executor-Version unterstützt noch keine Sessions.',
  EXECUTOR_AT_CAPACITY: 'Alle Executor-Sessions sind belegt.',
  EXECUTOR_STARTING: 'Der Executor startet.',
};

export const EXECUTOR_STATUS_LABEL: Record<ExecutorStatus, string> = {
  offline: 'offline',
  connecting: 'verbindet',
  ready: 'bereit',
  busy: 'ausgelastet',
  degraded: 'eingeschränkt',
  error: 'Fehler',
};

export const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  creating: 'wird angelegt',
  ready: 'bereit',
  executing: 'führt aus',
  awaiting_approval: 'wartet auf Freigabe',
  paused: 'pausiert',
  failed: 'fehlgeschlagen',
  closed: 'geschlossen',
};

const ERROR_TEXT: Record<string, string> = {
  AUTH_REQUIRED: 'Bitte erneut anmelden.',
  TENANT_REQUIRED: 'Kein Mandant ausgewählt.',
  FORBIDDEN: 'Keine Berechtigung für diese Aktion.',
  ENTITLEMENT_REQUIRED: 'Die Browser-Runtime ist in Ihrem Tarif nicht enthalten (ab Starter).',
  EXECUTOR_OFFLINE: 'Executor offline — Browser-Aktionen sind vorübergehend nicht verfügbar.',
  SESSION_NOT_FOUND: 'Die Browser-Session existiert nicht mehr. Bitte neu öffnen.',
  SESSION_EXPIRED: 'Die Browser-Session ist abgelaufen. Bitte neu öffnen.',
  SESSION_BUSY: 'In dieser Session läuft gerade etwas anderes.',
  SESSION_LIMIT_REACHED: 'Zu viele offene Browser-Sessions. Bitte eine schließen.',
  POLICY_DENIED: 'Von der Policy abgelehnt.',
  POLICY_UNAVAILABLE: 'Policies konnten nicht geprüft werden — aus Sicherheitsgründen nicht ausgeführt.',
  APPROVAL_REQUIRED: 'Diese Aktion braucht eine menschliche Freigabe. Sie wurde nicht ausgeführt.',
  APPROVAL_PENDING: 'Die Freigabe steht noch aus.',
  APPROVAL_DENIED: 'Die Freigabe wurde abgelehnt oder zurückgezogen.',
  APPROVAL_EXPIRED: 'Die Freigabe ist abgelaufen.',
  APPROVAL_ALREADY_USED: 'Diese Freigabe wurde bereits verwendet.',
  APPROVAL_MISMATCH: 'Die Freigabe passt nicht zu dieser Aktion oder Seite.',
  APPROVAL_NOT_FOUND: 'Freigabe nicht gefunden.',
  PAGE_CHANGED: 'Die Seite hat sich seit der Freigabe geändert — nichts ausgeführt. Bitte für die aktuelle Seite neu anfordern.',
  RESERVATION_UNAVAILABLE: 'Die Freigabe konnte gerade nicht eingelöst werden — nichts ausgeführt, Freigabe nicht verbraucht. Bitte erneut versuchen.',
  ACTION_NOT_SUPPORTED: 'Diese Aktion wird nicht unterstützt.',
  VALIDATION_FAILED: 'Die Eingaben sind ungültig.',
  URL_BLOCKED: 'Ziel blockiert: private Netze, lokale Adressen, Metadaten-Endpunkte und Nicht-HTTP-Schemata sind gesperrt.',
  KILL_SWITCH_ENGAGED: 'Die Browser-Runtime ist per Notabschaltung gestoppt.',
  RATE_LIMITED: 'Zu viele Anfragen. Bitte kurz warten.',
  EXECUTION_FAILED: 'Die Aktion ist im Browser fehlgeschlagen.',
  SCAN_FAILED: 'Der Scan ist fehlgeschlagen.',
  EVIDENCE_WRITE_FAILED: 'Der Nachweis konnte nicht gespeichert werden — die Aktion wurde nicht ausgeführt.',
  PLAN_INVALID: 'Der Planer hat keinen gültigen Plan geliefert. Bitte die Aufgabe konkreter formulieren.',
  QUOTA_EXCEEDED: 'Das KI-Kontingent dieses Monats ist aufgebraucht.',
  NETWORK: 'Keine Verbindung zum Server.',
  INTERNAL_ERROR: 'Interner Fehler. Bitte später erneut versuchen.',
};

/** Server-Fehler → verständliche Meldung (ohne technische Rohdetails). */
export function runtimeErrorText(error: unknown): string {
  if (!(error instanceof BrowserExecutorError)) return ERROR_TEXT.INTERNAL_ERROR;
  const details = (error.details ?? {}) as Record<string, unknown>;
  if (error.code === 'EXECUTOR_OFFLINE' && typeof details.reason === 'string' && EXECUTOR_REASON_TEXT[details.reason]) {
    return `${ERROR_TEXT.EXECUTOR_OFFLINE} ${EXECUTOR_REASON_TEXT[details.reason]}`;
  }
  if (error.code === 'ACTION_NOT_SUPPORTED' && details.reason === 'FILE_SOURCE_NOT_CONFIGURED') {
    return 'Upload braucht eine mandantengebundene Dateiquelle — noch nicht eingerichtet.';
  }
  if (error.code === 'PAGE_CHANGED') {
    return details.approval_consumed === true
      ? `${ERROR_TEXT.PAGE_CHANGED} Die alte Freigabe ist verbraucht.`
      : ERROR_TEXT.PAGE_CHANGED;
  }
  if (error.code === 'URL_BLOCKED' && details.reason === 'LANDED_ON_NON_PUBLIC_URL') {
    return details.action_executed === true
      ? 'Die Aktion lief, danach landete die Seite auf einer gesperrten Adresse (z. B. internes Netz). Sie wurde zurückgesetzt, die Session aus Sicherheitsgründen geschlossen.'
      : 'Die Seite stand auf einer gesperrten Adresse (z. B. internes Netz) und wurde zurückgesetzt — nichts ausgeführt, die Session ist aus Sicherheitsgründen geschlossen.';
  }
  if (error.code === 'EVIDENCE_WRITE_FAILED' && details.action_executed === true && details.approval_consumed !== true) {
    return 'Die Aktion lief, ihr Nachweis fehlt — die Session ist pausiert und muss geprüft werden.';
  }
  // Freigabe verbraucht (Reservierung vor dem Executor, #1728): eigener Hinweis.
  const consumed = consumedApprovalMessage(error);
  if (consumed) return consumed;
  if (error.code === 'POLICY_DENIED' && error.message && !/^[A-Z_]+$/.test(error.message)) {
    return `Von der Policy abgelehnt: ${error.message}`;
  }
  if (error.code === 'FORBIDDEN' && Array.isArray(details.reasons) && details.reasons.length > 0) {
    return `Nicht verfügbar: ${(details.reasons as string[]).map((r) => CAPABILITY_REASON_TEXT[r] ?? r).join(', ')}.`;
  }
  return ERROR_TEXT[error.code] ?? ERROR_TEXT.INTERNAL_ERROR;
}

export function reasonText(code: string | null | undefined): string {
  if (!code) return '';
  return CAPABILITY_REASON_TEXT[code] ?? code;
}

/** Kurzbeschreibung eines (Plan-)Schritts für Listen. */
export function describeAction(action: BrowserExecutorAction): string {
  switch (action.type) {
    case 'navigate': return `Öffnen: ${action.url}`;
    case 'scroll': return `Scrollen ${action.direction === 'up' ? 'nach oben' : 'nach unten'}${action.amount ? ` (${action.amount}px)` : ''}`;
    case 'click': return `Klicken: ${action.selector}`;
    case 'type': return `Eingeben in ${action.selector}: „${action.text}“`;
    case 'select': return `Auswählen in ${action.selector}: ${action.value}`;
    case 'submit': return `Formular absenden: ${action.selector}`;
    case 'extract':
    case 'read_text': return action.selector ? `Text lesen: ${action.selector}` : 'Seitentext lesen';
    case 'read_dom': return action.selector ? `Struktur lesen: ${action.selector}` : 'Seitenstruktur lesen';
    case 'wait': return `Warten ${action.milliseconds} ms`;
    case 'screenshot': return 'Screenshot';
    case 'back': return 'Zurück';
    case 'forward': return 'Vorwärts';
    case 'reload': return 'Neu laden';
    case 'download': return `Download: ${action.selector}`;
    case 'upload': return `Upload in ${action.selector}`;
  }
}

/** Wie describeAction, aber ohne eingegebenen Text (für redigierte Anzeigen). */
export function describeRedacted(action: Record<string, unknown>): string {
  const type = String(action.type ?? '');
  const selector = typeof action.selector === 'string' ? action.selector : '';
  if (type === 'type') return `Eingeben in ${selector}: ${String(action.text ?? '[redigiert]')}`;
  if (type === 'navigate') return `Öffnen: ${String(action.url ?? '')}`;
  if (type === 'select') return `Auswählen in ${selector}: ${String(action.value ?? '')}`;
  if (selector) return `${type}: ${selector}`;
  return type;
}
