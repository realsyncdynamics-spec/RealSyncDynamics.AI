import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { runAiTool } from './ai.ts';
import { gateFeature, EntitlementError } from './entitlements.ts';
import {
  buildBotPrompt,
  type BotRow,
} from './bots.ts';
import {
  RestaurantOrderError,
  type RestaurantOrderResolution,
} from './restaurant.ts';
import {
  buildRestaurantQuotePayload,
  buildRestaurantTurnProtocol,
  canQuoteRestaurantDraft,
  formatRestaurantQuote,
  isExplicitRestaurantOrderConfirmation,
  isExplicitRestaurantOrderRejection,
  normalizeRestaurantOrderDraft,
  parseRestaurantTurnProposal,
  resolveRestaurantDraftQuote,
  type RestaurantOrderDraft,
} from './restaurant-turn.ts';

type SupabaseAdmin = SupabaseClient;

interface RestaurantConversationState {
  version: 1;
  revision: number;
  draft: RestaurantOrderDraft | null;
  quote_hash: string | null;
  awaiting_confirmation: boolean;
  last_order_id?: string | null;
}

export interface RestaurantConversationTurnResult {
  reply: string;
  runId: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  orderId?: string | null;
  metadata: Record<string, unknown>;
}

export interface RestaurantConversationTurnInput {
  channel: 'chat' | 'voice' | 'whatsapp';
  contact?: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function emptyState(): RestaurantConversationState {
  return {
    version: 1,
    revision: 0,
    draft: null,
    quote_hash: null,
    awaiting_confirmation: false,
    last_order_id: null,
  };
}

function canonicalDraft(draft: RestaurantOrderDraft | null): string {
  if (!draft) return 'null';
  const items = [...draft.items].sort((a, b) => a.item_id.localeCompare(b.item_id));
  return JSON.stringify({
    items,
    fulfillment: draft.fulfillment ?? null,
    delivery_address: draft.delivery_address ?? null,
    customer_name: draft.customer_name ?? null,
    notes: draft.notes ?? null,
  });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function uuidFromHash(hash: string): string {
  const bytes = hash.slice(0, 32).split('').reduce<string[]>((acc, ch, index) => {
    if (index % 2 === 0) acc.push(hash.slice(index, index + 2));
    return acc;
  }, []).map((x) => parseInt(x, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function quoteHash(
  resolution: RestaurantOrderResolution,
  draft: RestaurantOrderDraft,
): Promise<string> {
  const payload = buildRestaurantQuotePayload(resolution, draft);
  const row = asRecord(payload) ?? {};
  const items = Array.isArray(row.items)
    ? [...row.items].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    : [];
  return sha256Hex(JSON.stringify({ ...row, items }));
}

async function loadConversationState(
  admin: SupabaseAdmin,
  bot: BotRow,
  conversationId: string,
): Promise<{ metadata: Record<string, unknown>; state: RestaurantConversationState }> {
  const { data, error } = await admin
    .from('bot_conversations')
    .select('metadata')
    .eq('id', conversationId)
    .eq('tenant_id', bot.tenant_id)
    .eq('bot_id', bot.id)
    .single();
  if (error) throw new Error(`conversation metadata lookup failed: ${error.message}`);

  const metadata = asRecord((data as { metadata?: unknown } | null)?.metadata) ?? {};
  const raw = asRecord(metadata.restaurant_order_state);
  if (!raw) return { metadata, state: emptyState() };

  const draft = normalizeRestaurantOrderDraft(bot.config, raw.draft);
  const revision = typeof raw.revision === 'number' && Number.isInteger(raw.revision) && raw.revision >= 0
    ? raw.revision
    : 0;

  return {
    metadata,
    state: {
      version: 1,
      revision,
      draft,
      quote_hash: typeof raw.quote_hash === 'string' ? raw.quote_hash : null,
      awaiting_confirmation: raw.awaiting_confirmation === true,
      last_order_id: typeof raw.last_order_id === 'string' ? raw.last_order_id : null,
    },
  };
}

async function saveConversationState(
  admin: SupabaseAdmin,
  bot: BotRow,
  conversationId: string,
  metadata: Record<string, unknown>,
  state: RestaurantConversationState,
): Promise<void> {
  const { error } = await admin
    .from('bot_conversations')
    .update({
      metadata: { ...metadata, restaurant_order_state: state },
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('tenant_id', bot.tenant_id)
    .eq('bot_id', bot.id);
  if (error) throw new Error(`conversation metadata update failed: ${error.message}`);
}

async function orderAccessMessage(admin: SupabaseAdmin, bot: BotRow): Promise<string | null> {
  if (bot.capabilities?.orders !== true) {
    return 'Die Bestellannahme ist für diesen Assistenten derzeit nicht aktiviert.';
  }
  try {
    await gateFeature(admin, bot.tenant_id, 'bots.orders');
    return null;
  } catch (error) {
    if (error instanceof EntitlementError) {
      return 'Die Bestellannahme ist für diesen Arbeitsbereich derzeit nicht verfügbar.';
    }
    throw error;
  }
}

async function persistConfirmedOrder(
  admin: SupabaseAdmin,
  bot: BotRow,
  conversationId: string,
  draft: RestaurantOrderDraft,
  resolution: RestaurantOrderResolution,
  revision: number,
  hash: string,
  contact: string | null,
): Promise<{ id: string; status: string }> {
  const deterministicHash = await sha256Hex(
    `${bot.tenant_id}:${bot.id}:${conversationId}:${revision}:${hash}`,
  );
  const id = uuidFromHash(deterministicHash);

  const metadata = {
    source: 'bot-conversation',
    vertical: 'restaurant',
    pricing_authority: 'bots.config.restaurant.menu',
    customer_confirmed: true,
    confirmation_mode: 'explicit_text',
    quote_hash: hash,
    draft_revision: revision,
    fulfillment: resolution.fulfillment,
    subtotal: resolution.subtotal,
    delivery_fee: resolution.delivery_fee,
    delivery_address: resolution.fulfillment === 'delivery' ? draft.delivery_address ?? null : null,
    estimated_delivery_minutes: resolution.estimated_delivery_minutes,
  };

  const { data, error } = await admin.from('bot_orders').insert({
    id,
    tenant_id: bot.tenant_id,
    bot_id: bot.id,
    conversation_id: conversationId,
    customer_name: draft.customer_name!,
    contact,
    items: resolution.items,
    total_amount: resolution.total_amount,
    currency: resolution.currency,
    notes: draft.notes ?? null,
    metadata,
  }).select('id, status').single();

  if (!error && data) return data as { id: string; status: string };

  const code = (error as { code?: string } | null)?.code;
  if (code === '23505') {
    const { data: existing, error: existingError } = await admin
      .from('bot_orders')
      .select('id, status')
      .eq('id', id)
      .eq('tenant_id', bot.tenant_id)
      .eq('bot_id', bot.id)
      .maybeSingle();
    if (!existingError && existing) return existing as { id: string; status: string };
  }

  throw new Error(`restaurant order insert failed: ${error?.message ?? 'unknown error'}`);
}

function safeRestaurantError(error: unknown): string {
  if (error instanceof RestaurantOrderError) {
    if (error.code === 'ITEM_UNAVAILABLE') return 'Ein ausgewählter Artikel ist derzeit nicht verfügbar. Bitte ändern Sie die Bestellung.';
    if (error.code === 'ITEM_NOT_FOUND') return 'Ein ausgewählter Artikel ist nicht mehr im aktuellen Menü. Bitte ändern Sie die Bestellung.';
    if (error.code === 'MINIMUM_ORDER_NOT_MET') return 'Der Mindestbestellwert ist noch nicht erreicht.';
    if (error.code === 'FULFILLMENT_NOT_ALLOWED') return 'Die gewünschte Liefer- oder Abholart ist derzeit nicht verfügbar.';
  }
  return 'Die Bestellung kann in dieser Form noch nicht bestätigt werden. Bitte prüfen Sie die Angaben.';
}

export async function runRestaurantConversationTurn(
  admin: SupabaseAdmin,
  bot: BotRow,
  conversationId: string,
  userText: string,
  priorHistory: Array<{ role: string; content: string }>,
  input: RestaurantConversationTurnInput,
): Promise<RestaurantConversationTurnResult | null> {
  if (bot.config?.vertical !== 'restaurant') return null;

  const loaded = await loadConversationState(admin, bot, conversationId);
  let { state } = loaded;

  if (
    state.awaiting_confirmation &&
    state.draft &&
    isExplicitRestaurantOrderConfirmation(userText)
  ) {
    const accessMessage = await orderAccessMessage(admin, bot);
    if (accessMessage) {
      return {
        reply: accessMessage,
        runId: null,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        durationMs: 0,
        metadata: { channel: input.channel, restaurant_order_blocked: true },
      };
    }

    try {
      const resolution = resolveRestaurantDraftQuote(bot.config, state.draft);
      const currentHash = await quoteHash(resolution, state.draft);

      if (!state.quote_hash || currentHash !== state.quote_hash) {
        state = { ...state, quote_hash: currentHash, awaiting_confirmation: true };
        await saveConversationState(admin, bot, conversationId, loaded.metadata, state);
        return {
          reply: `Preis oder Verfügbarkeit haben sich seit der letzten Zusammenfassung geändert. ${formatRestaurantQuote(resolution, state.draft)}`,
          runId: null,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          durationMs: 0,
          metadata: { channel: input.channel, restaurant_requote_required: true, quote_hash: currentHash },
        };
      }

      const order = await persistConfirmedOrder(
        admin,
        bot,
        conversationId,
        state.draft,
        resolution,
        state.revision,
        currentHash,
        input.contact ?? null,
      );

      const finalState: RestaurantConversationState = {
        version: 1,
        revision: state.revision,
        draft: null,
        quote_hash: null,
        awaiting_confirmation: false,
        last_order_id: order.id,
      };
      await saveConversationState(admin, bot, conversationId, loaded.metadata, finalState);

      return {
        reply: `Danke. Ihre Bestellung wurde angenommen. Gesamtbetrag: ${new Intl.NumberFormat('de-DE', {
          style: 'currency',
          currency: resolution.currency,
        }).format(resolution.total_amount)}.`,
        runId: null,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        durationMs: 0,
        orderId: order.id,
        metadata: {
          channel: input.channel,
          restaurant_order_created: true,
          order_id: order.id,
          quote_hash: currentHash,
          draft_revision: state.revision,
        },
      };
    } catch (error) {
      state = { ...state, awaiting_confirmation: false, quote_hash: null };
      await saveConversationState(admin, bot, conversationId, loaded.metadata, state);
      return {
        reply: safeRestaurantError(error),
        runId: null,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        durationMs: 0,
        metadata: { channel: input.channel, restaurant_order_validation_failed: true },
      };
    }
  }

  if (state.awaiting_confirmation && isExplicitRestaurantOrderRejection(userText)) {
    state = { ...state, awaiting_confirmation: false, quote_hash: null };
    await saveConversationState(admin, bot, conversationId, loaded.metadata, state);
    return {
      reply: 'Alles klar. Was möchten Sie an der Bestellung ändern?',
      runId: null,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      durationMs: 0,
      metadata: { channel: input.channel, restaurant_confirmation_rejected: true },
    };
  }

  const prompt = [
    buildBotPrompt({
      persona: bot.persona,
      config: bot.config,
      history: priorHistory,
      userMessage: userText,
    }),
    buildRestaurantTurnProtocol(state.draft),
  ].join('\n\n');

  const ai = await runAiTool(admin, bot.tenant_id, null, 'bot_reply', prompt, {
    metadata: {
      bot_id: bot.id,
      conversation_id: conversationId,
      channel: input.channel,
      restaurant_structured_turn: true,
    },
  });

  const proposal = parseRestaurantTurnProposal(bot.config, ai.output);
  if (!proposal) {
    return {
      reply: ai.output,
      runId: ai.runId,
      inputTokens: ai.inputTokens,
      outputTokens: ai.outputTokens,
      costUsd: ai.costUsd,
      durationMs: ai.durationMs,
      metadata: {
        channel: input.channel,
        duration_ms: ai.durationMs,
        restaurant_proposal_parsed: false,
      },
    };
  }

  const nextDraft = proposal.order_draft ?? state.draft;
  if (!nextDraft) {
    return {
      reply: proposal.reply,
      runId: ai.runId,
      inputTokens: ai.inputTokens,
      outputTokens: ai.outputTokens,
      costUsd: ai.costUsd,
      durationMs: ai.durationMs,
      metadata: {
        channel: input.channel,
        duration_ms: ai.durationMs,
        restaurant_proposal_parsed: true,
      },
    };
  }

  const changed = canonicalDraft(nextDraft) !== canonicalDraft(state.draft);
  const revision = changed ? state.revision + 1 : Math.max(1, state.revision);
  const preservePendingConfirmation = !changed && state.awaiting_confirmation;
  state = {
    version: 1,
    revision,
    draft: nextDraft,
    quote_hash: changed ? null : state.quote_hash,
    awaiting_confirmation: preservePendingConfirmation,
    last_order_id: state.last_order_id ?? null,
  };

  if (proposal.ready_for_confirmation && canQuoteRestaurantDraft(nextDraft)) {
    const accessMessage = await orderAccessMessage(admin, bot);
    if (accessMessage) {
      await saveConversationState(admin, bot, conversationId, loaded.metadata, state);
      return {
        reply: accessMessage,
        runId: ai.runId,
        inputTokens: ai.inputTokens,
        outputTokens: ai.outputTokens,
        costUsd: ai.costUsd,
        durationMs: ai.durationMs,
        metadata: { channel: input.channel, restaurant_order_blocked: true },
      };
    }

    try {
      const resolution = resolveRestaurantDraftQuote(bot.config, nextDraft);
      const hash = await quoteHash(resolution, nextDraft);
      state = { ...state, quote_hash: hash, awaiting_confirmation: true };
      await saveConversationState(admin, bot, conversationId, loaded.metadata, state);

      return {
        reply: formatRestaurantQuote(resolution, nextDraft),
        runId: ai.runId,
        inputTokens: ai.inputTokens,
        outputTokens: ai.outputTokens,
        costUsd: ai.costUsd,
        durationMs: ai.durationMs,
        metadata: {
          channel: input.channel,
          duration_ms: ai.durationMs,
          restaurant_proposal_parsed: true,
          restaurant_awaiting_confirmation: true,
          quote_hash: hash,
          draft_revision: revision,
        },
      };
    } catch (error) {
      await saveConversationState(admin, bot, conversationId, loaded.metadata, state);
      return {
        reply: safeRestaurantError(error),
        runId: ai.runId,
        inputTokens: ai.inputTokens,
        outputTokens: ai.outputTokens,
        costUsd: ai.costUsd,
        durationMs: ai.durationMs,
        metadata: {
          channel: input.channel,
          restaurant_order_validation_failed: true,
          draft_revision: revision,
        },
      };
    }
  }

  await saveConversationState(admin, bot, conversationId, loaded.metadata, state);
  return {
    reply: preservePendingConfirmation
      ? `${proposal.reply} Wenn Sie die bereits zusammengefasste Bestellung verbindlich abschicken möchten, antworten Sie bitte mit „Ja“.`
      : proposal.reply,
    runId: ai.runId,
    inputTokens: ai.inputTokens,
    outputTokens: ai.outputTokens,
    costUsd: ai.costUsd,
    durationMs: ai.durationMs,
    metadata: {
      channel: input.channel,
      duration_ms: ai.durationMs,
      restaurant_proposal_parsed: true,
      draft_revision: revision,
    },
  };
}
