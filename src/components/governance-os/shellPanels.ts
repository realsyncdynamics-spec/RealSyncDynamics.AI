/**
 * Ausklappbare Panels rechts in der App-Shell (Design System „RealSync
 * Dashboard“, SidePanel). Es ist immer höchstens eines offen.
 */
export type ShellPanelId = 'assistant' | 'browser';

/** Ein zweiter Klick auf denselben Schalter schließt das Panel. */
export function togglePanel(current: ShellPanelId | null, id: ShellPanelId): ShellPanelId | null {
  return current === id ? null : id;
}
