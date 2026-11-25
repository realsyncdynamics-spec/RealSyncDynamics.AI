// Bereinigt den vom Browser mitgeschickten Verlauf des öffentlichen
// Assistenten (governance-agent, op 'chat_anon').
//
// Der Verlauf kommt aus localStorage und ist damit vollständig vom Besucher
// kontrollierbar. Ohne Prüfung könnten beliebige Rollen, Nicht-Strings oder
// sehr lange Einträge an das Modell gehen. Hier gilt: nur 'user'/'assistant',
// nur nicht-leere Strings, jeder Eintrag gekürzt, höchstens `maxItems` aus
// dem Ende. Reine Funktion ohne Deno-APIs, damit Vitest sie direkt testet.

export type AnonHistoryMsg = { role: 'user' | 'assistant'; content: string };

export const ANON_HISTORY_MAX_CHARS = 4000;

export function sanitizeAnonHistory(raw: unknown, maxItems: number): AnonHistoryMsg[] {
  if (!Array.isArray(raw) || maxItems <= 0) return [];
  const out: AnonHistoryMsg[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string') continue;
    const text = content.trim();
    if (!text) continue;
    out.push({ role, content: text.slice(0, ANON_HISTORY_MAX_CHARS) });
  }
  return out.slice(-maxItems);
}
