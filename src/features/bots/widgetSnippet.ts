/**
 * Einbettungsschnipsel für den Website-Chat.
 *
 * Everlast gewinnt, weil nach der Anlage ein Stück HTML auf die Seite kommt.
 * Der Schnipsel trägt den Transparenzhinweis **statisch** mit — ein Scan
 * ohne ausgeführtes JavaScript muss Art. 50 trotzdem sehen. `data-rsd-bot`
 * ist das Erkennungssignal für den öffentlichen Scan.
 */

export interface BotWidgetEmbedInput {
  tenantId: string;
  botId: string;
  endpointBase: string;
  widgetSrc: string;
  greeting?: string | null;
}

export function botWidgetEmbedHtml(input: BotWidgetEmbedInput): string {
  const endpoint = `${input.endpointBase.replace(/\/$/, '')}/bot-chat`;
  const greeting = (input.greeting ?? '').trim();

  return [
    `<div data-rsd-bot data-ai-disclosure`,
    `     data-tenant="${attr(input.tenantId)}"`,
    `     data-bot="${attr(input.botId)}"`,
    `     data-endpoint="${attr(endpoint)}"`,
    greeting ? `     data-greeting="${attr(greeting)}"` : '',
    `     class="rsd-bot-host">`,
    `  <p>Dieser Chat wird von einem KI-System beantwortet.</p>`,
    `</div>`,
    `<script src="${attr(input.widgetSrc)}" defer></script>`,
  ].filter((line) => line !== '').join('\n');
}

/** Werte landen in Attributen — Anführungszeichen und Tags dürfen nicht ausbrechen. */
function attr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function botWidgetSrc(origin: string): string {
  return `${origin.replace(/\/$/, '')}/bot-widget.js`;
}
