// Gemeinsame Helfer für die Bot-Edge-Functions (bot-chat, appointment-book,
// order-intake, bot-voice-webhook).
//
// Diese Functions sind öffentlich (verify_jwt = false): das Web-Widget bzw.
// der Telefonie-Provider rufen sie ohne Supabase-JWT auf. Die Zugriffs-
// kontrolle läuft daher über das Paar (tenant_id, bot_id): der Bot muss zum
// Tenant gehören UND `enabled` sein. Die bot_id ist eine nicht erratbare UUID
// und wirkt als Capability-Token (gleiches Modell wie browser-action-log /
// ai-gateway).

// Statt des Deno-only jsr-Imports von SupabaseClient nutzen wir einen
// minimalen strukturellen Client-Typ. So bleibt die reine buildBotPrompt-
// Funktion in Vitest importierbar, ohne den jsr-Specifier auflösen zu müssen
// (gleiche Technik wie _shared/findings.ts: AdminLike). Der echte
// service-role-Client der Edge Functions ist strukturell kompatibel.

interface QueryBuilder extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(col: string, val: unknown): QueryBuilder;
  order(col: string, opts?: Record<string, unknown>): QueryBuilder;
  limit(n: number): QueryBuilder;
  maybeSingle(): Promise<{ data: unknown; error: unknown }>;
  single(): Promise<{ data: unknown; error: unknown }>;
  select(cols?: string): QueryBuilder;
}

interface InsertChain extends PromiseLike<{ data?: unknown; error?: unknown }> {
  select(cols?: string): InsertChain;
  single(): Promise<{ data: unknown; error: unknown }>;
}

interface UpdateChain extends PromiseLike<{ error?: unknown }> {
  eq(col: string, val: unknown): UpdateChain;
}

interface TableBuilder {
  select(cols: string): QueryBuilder;
  insert(obj: Record<string, unknown>): InsertChain;
  update(obj: Record<string, unknown>): UpdateChain;
}

interface RpcResponse {
  data: unknown;
  error: unknown;
}

export interface SupabaseAdmin {
  from(table: string): TableBuilder;
  rpc(fn: string, args: Record<string, unknown>): Promise<RpcResponse>;
}

export type BotChannel = 'chat' | 'voice' | 'telegram' | 'whatsapp';

export interface BotRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  channel: BotChannel;
  persona: string | null;
  greeting: string | null;
  capabilities: Record<string, unknown>;
  config: Record<string, unknown>;
  enabled: boolean;
}

export class BotError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = 'BAD_REQUEST', status = 400) {
    super(message); this.code = code; this.status = status;
  }
}

/** Lädt einen Bot und prüft Tenant-Zugehörigkeit + enabled. */
export async function resolveBot(
  admin: SupabaseAdmin,
  tenantId: string,
  botId: string,
): Promise<BotRow> {
  if (!tenantId) throw new BotError('tenant_id required', 'BAD_REQUEST', 400);
  if (!botId)    throw new BotError('bot_id required', 'BAD_REQUEST', 400);

  const { data, error } = await admin
    .from('bots').select('*')
    .eq('id', botId).eq('tenant_id', tenantId).maybeSingle();
  if (error) throw new BotError((error as { message: string }).message, 'INTERNAL', 500);
  const row = data as BotRow | null;
  if (!row) throw new BotError('bot not found', 'NOT_FOUND', 404);
  if (!row.enabled) throw new BotError('bot is disabled', 'FORBIDDEN', 403);
  return row;
}

/**
 * Holt eine bestehende Konversation per (bot_id, external_ref) oder legt sie
 * an. external_ref ist die Session-/Anruf-/Chat-Referenz des Kanals.
 */
export async function upsertConversation(
  admin: SupabaseAdmin,
  bot: BotRow,
  opts: { channel?: BotChannel; externalRef?: string | null; contactLabel?: string | null } = {},
): Promise<string> {
  const channel = opts.channel ?? bot.channel;
  const externalRef = opts.externalRef ?? null;

  if (externalRef) {
    const { data: existing, error: selErr } = await admin
      .from('bot_conversations').select('id')
      .eq('bot_id', bot.id).eq('external_ref', externalRef).maybeSingle();
    if (selErr) throw new BotError((selErr as { message: string }).message, 'INTERNAL', 500);
    if (existing) return (existing as { id: string }).id;
  }

  const { data, error } = await admin.from('bot_conversations').insert({
    tenant_id: bot.tenant_id,
    bot_id: bot.id,
    channel,
    external_ref: externalRef,
    contact_label: opts.contactLabel ?? null,
    last_message_at: new Date().toISOString(),
  }).select('id').single();
  if (error) throw new BotError((error as { message: string }).message, 'INTERNAL', 500);
  return (data as { id: string }).id;
}

/** Speichert eine Nachricht und schiebt last_message_at der Konversation nach. */
export async function insertMessage(
  admin: SupabaseAdmin,
  bot: BotRow,
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  extra: {
    runId?: string | null;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
    metadata?: Record<string, unknown>;
  } = {},
): Promise<void> {
  const { error } = await admin.from('bot_messages').insert({
    tenant_id: bot.tenant_id,
    conversation_id: conversationId,
    bot_id: bot.id,
    role,
    content,
    run_id: extra.runId ?? null,
    input_tokens: extra.inputTokens ?? 0,
    output_tokens: extra.outputTokens ?? 0,
    cost_usd: extra.costUsd ?? 0,
    metadata: extra.metadata ?? {},
  });
  if (error) throw new BotError((error as { message: string }).message, 'INTERNAL', 500);

  await admin.from('bot_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);
}

/** Lädt die letzten N Nachrichten einer Konversation in chronologischer Reihenfolge. */
export async function loadRecentHistory(
  admin: SupabaseAdmin,
  conversationId: string,
  limit = 12,
): Promise<Array<{ role: string; content: string }>> {
  const { data, error } = await admin
    .from('bot_messages').select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new BotError((error as { message: string }).message, 'INTERNAL', 500);
  return ((data as unknown as Array<{ role: string; content: string }> ?? [])).reverse();
}

export interface BotKnowledge {
  goal?: string;
  hours?: string;
  services?: string;
  handoffPhone?: string;
  notes?: string;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Liest `bots.config.knowledge`. Die Schlüssel stehen doppelt — hier und in
 * `src/features/bots/templates.ts`. Nie einseitig ändern; sonst kennt der
 * Builder Felder, die der Prompt verschluckt, oder umgekehrt.
 */
export function knowledgeFromConfig(config: Record<string, unknown> | null | undefined): BotKnowledge {
  const raw = config && typeof config === 'object' ? config.knowledge : undefined;
  if (!raw || typeof raw !== 'object') return {};
  const k = raw as Record<string, unknown>;
  return {
    goal: readString(k.goal),
    hours: readString(k.hours),
    services: readString(k.services),
    handoffPhone: readString(k.handoffPhone),
    notes: readString(k.notes),
  };
}

function formatKnowledge(knowledge: BotKnowledge): string | null {
  const lines: string[] = [];
  if (knowledge.hours) lines.push(`Öffnungszeiten: ${knowledge.hours}`);
  if (knowledge.services) lines.push(`Leistungen: ${knowledge.services}`);
  if (knowledge.handoffPhone) lines.push(`Weiterleitung an einen Menschen: ${knowledge.handoffPhone}`);
  if (knowledge.notes) lines.push(`Hinweise: ${knowledge.notes}`);
  if (knowledge.goal) lines.push(`Ziel des Bots: ${knowledge.goal}`);
  return lines.length > 0 ? lines.join('\n') : null;
}

export interface BuildBotPromptInput {
  persona?: string | null;
  knowledge?: BotKnowledge | null;
  /**
   * Telefon/Voice: kurze, sprechbare Sätze. Markdown am Telefon ist ein
   * Hörfehler, keine Formatierung — Everlast/Retell scheitern genau daran,
   * wenn der Prompt den Chat-Stil durchlässt.
   */
  spoken?: boolean;
  history?: Array<{ role: string; content: string }>;
  userMessage: string;
}

/**
 * Baut den Eingabe-Prompt für runAiTool('bot_reply'). Reine Funktion, damit
 * sie unit-testbar ist (siehe test/bots/buildBotPrompt.test.ts).
 *
 * Der tool-eigene Basis-System-Prompt (ai_tools.system_prompt) bleibt davon
 * unberührt — hier kommt nur Persona + Wissen + Verlauf + neue Nachricht hinein.
 */
export function buildBotPrompt(input: BuildBotPromptInput): string {
  const parts: string[] = [];

  const persona = (input.persona ?? '').trim();
  if (persona) {
    parts.push(`[Unternehmens-Kontext und Persona]\n${persona}`);
  }

  const knowledge = formatKnowledge(input.knowledge ?? {});
  if (knowledge) {
    parts.push(`[Wissensbasis — nur diese Fakten, nichts erfinden]\n${knowledge}`);
  }

  if (input.spoken) {
    parts.push(
      '[Sprechstil]\nDu sprichst am Telefon. Kurze Sätze. Kein Markdown, keine Listen, keine URLs vorlesen außer auf Nachfrage. Siezen. Nach einer Rückfrage innehalten.',
    );
  }

  const history = (input.history ?? []).filter((m) => m.role !== 'system' && m.content.trim());
  if (history.length > 0) {
    const lines = history.map((m) => {
      const who = m.role === 'assistant' ? 'Assistent' : 'Nutzer';
      return `${who}: ${m.content.trim()}`;
    });
    parts.push(`[Bisheriger Gesprächsverlauf]\n${lines.join('\n')}`);
  }

  parts.push(`[Neue Nachricht]\nNutzer: ${input.userMessage.trim()}`);
  parts.push('Antworte als Assistent auf die neue Nachricht.');

  return parts.join('\n\n');
}

/** Bequemer Einstieg: Persona, Wissen und Sprechstil aus der Bot-Zeile. */
export function buildBotPromptFromBot(
  bot: BotRow,
  input: { history?: Array<{ role: string; content: string }>; userMessage: string },
): string {
  return buildBotPrompt({
    persona: bot.persona,
    knowledge: knowledgeFromConfig(bot.config),
    spoken: bot.channel === 'voice',
    history: input.history,
    userMessage: input.userMessage,
  });
}
