// Übergabe an Menschen für Bot-Konversationen (AI Receptionist, K4 PR C).
//
// Zwei Auslöser, beide serverseitig:
//   1. customer_request    — der Kunde verlangt ausdrücklich einen Menschen
//                            oder Rückruf (deterministische Mustererkennung).
//   2. assistant_uncertain — das Modell setzt den Marker HANDOFF_MARKER ans
//                            Ende seiner Antwort; der Marker wird vor dem
//                            Speichern und Versenden entfernt.
//
// Die Datenbank-Spalten kommen aus 20261104120000_bot_conversation_handoff.sql.
// Mitarbeitende übernehmen/schließen über die RPC bot_conversation_handoff.
//
// Reine Funktionen + minimaler struktureller Client-Typ, damit das Modul in
// Vitest importierbar bleibt (gleiche Technik wie _shared/bots.ts).

export type HandoffReason = 'customer_request' | 'assistant_uncertain';

export const HANDOFF_MARKER = '[[UEBERGABE]]';

// Ausdrückliche Bitten um einen Menschen oder Rückruf. Bewusst eng gefasst:
// „Wie viele Mitarbeiter habt ihr?“ soll keine Übergabe auslösen.
const HANDOFF_PATTERNS: RegExp[] = [
  /\bmit\s+(?:einem|einer|ihrem|ihrer|dem|der|jemandem|jemand)?\s*(?:echten\s+)?(?:menschen?|mitarbeiter(?:in|innen)?|person|chef(?:in)?|inhaber(?:in)?|meister(?:in)?|jemandem)\s+(?:sprechen|reden|telefonieren|verbinden|verbunden)/i,
  /\b(?:echte[nmr]?|richtige[nmr]?)\s+(?:menschen?|person|mitarbeiter(?:in)?)\b/i,
  /\br(?:ü|ue)ckruf\b/i,
  /\bzur(?:ü|ue)ckrufen\b/i,
  /\b(?:ruf|rufen\s+sie|ruft)\s+mich\s+(?:bitte\s+)?(?:zur(?:ü|ue)ck|an)\b/i,
  /\bkein(?:en)?\s+(?:bot|roboter|chatbot|ki|maschine)\b/i,
  /\b(?:speak|talk|chat)\s+(?:to|with)\s+(?:a\s+)?(?:real\s+)?(?:human|person|someone|agent|staff)\b/i,
  /\bcall\s+me\s+back\b/i,
  /\breal\s+(?:human|person)\b/i,
];

/** true, wenn die Kundennachricht ausdrücklich einen Menschen/Rückruf verlangt. */
export function detectHandoffRequest(message: string): boolean {
  const text = (message ?? '').slice(0, 4000);
  if (!text.trim()) return false;
  return HANDOFF_PATTERNS.some((re) => re.test(text));
}

/**
 * Entfernt den Übergabe-Marker aus einer Modellantwort.
 * `flagged` ist true, wenn der Marker mindestens einmal vorkam.
 */
export function extractHandoffMarker(reply: string): { reply: string; flagged: boolean } {
  const raw = reply ?? '';
  if (!raw.includes(HANDOFF_MARKER)) return { reply: raw, flagged: false };
  const cleaned = raw.split(HANDOFF_MARKER).join('').replace(/[ \t]+\n/g, '\n').trim();
  return { reply: cleaned, flagged: true };
}

/** Prompt-Abschnitt für bot_reply; nur Kanäle, die den Marker entfernen. */
export function buildHandoffPromptSection(alreadyRequested: boolean): string {
  const lines = [
    'Wenn du eine Frage nicht sicher beantworten kannst, ein Termin verbindlich bestätigt werden müsste '
      + 'oder der Kunde einen Menschen wünscht: Sage, dass sich ein Mitarbeiter meldet, frage nach Name '
      + 'und Rückrufnummer oder E-Mail, falls noch nicht bekannt, und setze ans Ende deiner Antwort genau '
      + `den Marker ${HANDOFF_MARKER}.`,
    'Nenne keine Uhrzeit oder Frist für den Rückruf und bestätige keinen Termin als gebucht.',
  ];
  if (alreadyRequested) {
    lines.unshift('Die Übergabe an einen Mitarbeiter ist für dieses Gespräch bereits eingetragen.');
  }
  return lines.join('\n');
}

// ── Persistenz ──────────────────────────────────────────────────────────────

interface HandoffUpdateChain extends PromiseLike<{ error?: unknown }> {
  eq(col: string, val: unknown): HandoffUpdateChain;
  in(col: string, vals: unknown[]): HandoffUpdateChain;
}

export interface HandoffAdmin {
  from(table: string): {
    update(obj: Record<string, unknown>): HandoffUpdateChain;
  };
}

/**
 * Markiert eine Konversation als „Übergabe angefordert“. Wirkt nur, wenn
 * keine offene Übergabe läuft (none/resolved) — eine bereits angenommene
 * Übergabe wird nicht zurückgesetzt. Scope immer über tenant_id + bot_id.
 *
 * Wirft nicht: Ein Fehler hier darf die bereits erzeugte Antwort an den
 * Kunden nicht verhindern. Rückgabe true = Übergabe ist vermerkt (neu oder
 * bereits offen), false = Schreibfehler (geloggt).
 */
export async function markHandoffRequested(
  admin: HandoffAdmin,
  scope: { tenantId: string; botId: string; conversationId: string },
  reason: HandoffReason,
): Promise<boolean> {
  try {
    const { error } = await admin.from('bot_conversations')
      .update({
        handoff_status: 'requested',
        handoff_reason: reason,
        handoff_requested_at: new Date().toISOString(),
        handoff_accepted_at: null,
        handoff_accepted_by: null,
        handoff_resolved_at: null,
        handoff_resolved_by: null,
      })
      .eq('id', scope.conversationId)
      .eq('tenant_id', scope.tenantId)
      .eq('bot_id', scope.botId)
      .in('handoff_status', ['none', 'resolved']);
    if (error) {
      console.error('[bot-handoff] mark failed', (error as { message?: string }).message ?? error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[bot-handoff] mark failed', (e as Error).message);
    return false;
  }
}
