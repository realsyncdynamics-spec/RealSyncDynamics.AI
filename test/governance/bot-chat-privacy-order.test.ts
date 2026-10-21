import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const chat = readFileSync('supabase/functions/bot-chat/index.ts', 'utf8');
const helpers = readFileSync('supabase/functions/_shared/bots.ts', 'utf8');

describe('bot-chat – no persistence before policy approval', () => {
  it('runs the same Bot PEP before quota, conversation creation or message insert', () => {
    const pep = chat.indexOf('const verdict = await enforceBotMessage(');
    const quota = chat.indexOf('await consumeUsage(');
    const create = chat.indexOf('const conversationId = await upsertConversation(');
    const persist = chat.indexOf("await insertMessage(admin, bot, conversationId, 'user'");
    const inference = chat.indexOf('await runAiTool(');
    expect(pep).toBeGreaterThan(-1);
    for (const following of [quota, create, persist, inference]) {
      expect(following).toBeGreaterThan(pep);
    }
  });

  it('does not store rejected user text, a contact label or synthetic bot reply', () => {
    const denied = chat.slice(
      chat.indexOf('if (!verdict.allowed) {'),
      chat.indexOf('    // Billable quota and storage only after', chat.indexOf('if (!verdict.allowed) {')),
    );
    expect(denied).toContain('verdict.safe_reply');
    expect(denied).toContain('policy_blocked: true');
    expect(denied).not.toContain('insertMessage(');
    expect(denied).not.toContain('upsertConversation(');
    expect(denied).not.toContain('consumeUsage(');
    expect(denied).not.toContain('contactLabel');
  });

  it('reads the prior conversation without writing or leaking cross-tenant data', () => {
    const begin = helpers.indexOf('export async function findExistingConversationId(');
    const end = helpers.indexOf('export async function upsertConversation(', begin);
    const lookup = helpers.slice(begin, end);
    expect(lookup).toContain(".eq('tenant_id', bot.tenant_id)");
    expect(lookup).toContain(".eq('bot_id', bot.id)");
    expect(lookup).toContain(".eq('external_ref', externalRef)");
    expect(lookup).toContain('.maybeSingle()');
    expect(lookup).not.toContain('.insert(');
    expect(lookup).not.toContain('.update(');
  });

  it('checks conversation length and user message without persisting it first', () => {
    const lookup = chat.indexOf('await findExistingConversationId(');
    const history = chat.indexOf('await loadRecentHistory(');
    const pep = chat.indexOf('const verdict = await enforceBotMessage(');
    expect(lookup).toBeGreaterThan(-1);
    expect(history).toBeGreaterThan(lookup);
    expect(pep).toBeGreaterThan(history);
    expect(chat).toContain('history_length: priorHistory.length');
  });
});
