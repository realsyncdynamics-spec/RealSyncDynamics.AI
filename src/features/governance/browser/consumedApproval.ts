import type { BrowserExecutorError } from './browserExecutorClient';

function detail(error: BrowserExecutorError, key: string): unknown {
  if (!error.details || typeof error.details !== 'object') return undefined;
  return (error.details as Record<string, unknown>)[key];
}

/**
 * Fehler, nach denen die Freigabe verbraucht ist (browser-execute reserviert
 * sie vor dem Executor, siehe reserve_browser_execution). Ein neuer Versuch
 * braucht eine neue Freigabe — die alte darf in der Oberfläche nicht als
 * „ausstehend" stehen bleiben.
 *
 * `null` heisst: kein solcher Fall, die allgemeine Fehlermeldung gilt.
 */
export function consumedApprovalMessage(error: BrowserExecutorError): string | null {
  if (error.code === 'EVIDENCE_WRITE_FAILED' && detail(error, 'action_executed') === true) {
    return 'Die Aktion wurde möglicherweise ausgeführt, aber der Prüfpfad konnte nicht vollständig '
      + 'geschrieben werden. Bitte manuell prüfen. Die Freigabe ist verbraucht und wird nicht wiederholt.';
  }
  if (error.code === 'APPROVAL_ALREADY_USED') {
    return 'Diese Freigabe wurde bereits verwendet. Für eine erneute Ausführung ist eine neue Freigabe nötig.';
  }
  if (error.code === 'APPROVAL_EXPIRED') {
    return 'Diese Freigabe ist abgelaufen. Für die Ausführung ist eine neue Freigabe nötig.';
  }
  if (detail(error, 'approval_consumed') === true) {
    return 'Der Browser-Executor hat nicht erfolgreich geantwortet. Ob die Aktion teilweise ausgeführt wurde, '
      + 'ist nicht feststellbar. Die Freigabe ist verbraucht; für einen neuen Versuch ist eine neue Freigabe nötig.';
  }
  return null;
}
