/**
 * Body-Attribut, das ein seitenweiter Dialog setzt, solange er offen ist
 * (z. B. der Produkt-Dialog auf /unternehmen). Schwebende Elemente wie der
 * Assistent-Chip blenden sich dann aus, damit sie den Dialog nicht überlagern
 * und nicht aus der Fokusfalle heraus erreichbar sind.
 */
export const PAGE_DIALOG_ATTR = 'data-page-dialog-open';

export function isPageDialogOpen(): boolean {
  return typeof document !== 'undefined' && !!document.body?.hasAttribute(PAGE_DIALOG_ATTR);
}
