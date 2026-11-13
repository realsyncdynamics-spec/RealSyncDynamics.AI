/**
 * Landing v8 — zwei öffentliche Schalter, eine Stelle.
 *
 * APP_ORIGIN (`VITE_APP_ORIGIN`)
 *   Registrierung läuft auf der App, nicht auf dieser Vorschau.
 *   Gesetzter Wert, ohne abschließenden Schrägstrich, plus `/welcome`.
 *   Nach dem Cutover: `https://app.realsyncdynamicsai.de`.
 *   Leer oder nicht gesetzt: aktueller Origin, damit `/welcome` in der
 *   Preview auf demselben Host bleibt.
 *
 * GROK_NOTICE (`VITE_V8_GROK_NOTICE`)
 *   `1` zeigt den Platzhaltertext. Jeder andere Wert, auch leer: aus.
 *   Einschalten erst, nachdem die Datenschutzerklärung xAI/Grok nennt.
 *   Solange aus, wird der Text nicht gerendert.
 */

export const V8_WELCOME_PATH = '/welcome';
export const V8_PRODUCTS_PATH = '/v8/produkte';

/** Platzhalter. Im Default nicht sichtbar. */
export const GROK_NOTICE_PLACEHOLDER =
  'Platzhalter, nicht freigegeben: Die Live-Stimme kann ein Sprachmodell von xAI (Grok) nutzen. Diesen Hinweis erst zeigen, wenn die Datenschutzerklärung das so ausweist.';

function trimOrigin(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

export function appOrigin(envOrigin?: string, currentOrigin?: string): string {
  const configured = trimOrigin(envOrigin);
  if (configured) return configured;
  return trimOrigin(currentOrigin);
}

/** `APP_ORIGIN` + `/welcome`. Ohne gesetzte Origin der aktuelle Host. */
export function registrationHref(envOrigin?: string, currentOrigin?: string): string {
  const origin = appOrigin(
    envOrigin ?? (import.meta.env.VITE_APP_ORIGIN as string | undefined),
    currentOrigin ?? (typeof window !== 'undefined' ? window.location.origin : ''),
  );
  return `${origin}${V8_WELCOME_PATH}`;
}

/** Nur das Zeichen `1` schaltet den Hinweis ein. */
export function grokNoticeEnabled(envValue?: string): boolean {
  const raw = envValue ?? (import.meta.env.VITE_V8_GROK_NOTICE as string | undefined) ?? '';
  return String(raw).trim() === '1';
}

export function grokNoticeText(envValue?: string): string | null {
  return grokNoticeEnabled(envValue) ? GROK_NOTICE_PLACEHOLDER : null;
}
