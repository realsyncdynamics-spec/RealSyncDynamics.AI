import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendQuickChat, __resetQuickChatStateForTests } from '../../../src/features/assistant/assistantQuickChatApi';

// Vertrag #1591: Der öffentliche Chip ist ausdrücklich anonym — Legacy-
// Anon-Key (JWT) als Bearer, keine Nutzer-Sitzung, kein tenant_id.
const LEGACY_ANON_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJl';
const OK = { ok: true, provider: 'lm_studio', model: 'm', profile: 'fast-local', output: 'Hallo.', trace_id: 't', latency_ms: 1 };

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  __resetQuickChatStateForTests();
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(OK), { status: 200 }));
});
afterEach(() => fetchSpy.mockRestore());

describe('assistantQuickChatApi — ausdrücklich anonym', () => {
  it('sendet den Legacy-Anon-Key als apikey und Bearer, ohne tenant_id', async () => {
    const res = await sendQuickChat({ message: 'Was ist der AI Act?', history: [] }, { supabaseUrl: 'https://t.supabase.co', supabaseAnonKey: LEGACY_ANON_JWT });
    expect(res.kind).toBe('ok');
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(init.headers).toMatchObject({ authorization: `Bearer ${LEGACY_ANON_JWT}`, apikey: LEGACY_ANON_JWT });
    expect(JSON.parse(String(init.body))).not.toHaveProperty('tenant_id');
  });

  it('mit sb_publishable_-Key: strukturierter Konfigurationsfehler, nichts gesendet', async () => {
    const res = await sendQuickChat({ message: 'Hallo', history: [] }, { supabaseUrl: 'https://t.supabase.co', supabaseAnonKey: 'sb_publishable_x' });
    expect(res).toMatchObject({ kind: 'error', code: 'AI_GATEWAY_NOT_CONFIGURED' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
