/**
 * Anon-Mode Vertragstest fuer den public AgentWidget-Flow.
 *
 * Geprueft werden Eigenschaften, die den Anon-Modus von Tenant-Mode
 * unterscheiden:
 *   - eigene Session-ID, persistiert in localStorage
 *   - ratelimit landet im UI-State, ohne den Hook zu zerschiessen
 *   - der API-Call enthaelt NIEMALS Tenant-Felder oder Tool-/Mutation-Operationen
 *   - sendChatAnon ruft genau die Edge-Function-Operation `chat_anon`
 *
 * Wir mocken `getSupabase` damit kein echter Netzwerk-Roundtrip noetig ist.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ─── Supabase Mock ─────────────────────────────────────────────────────────────

interface MockInvokeCall {
  fn: string;
  body: Record<string, unknown>;
}

const invokeCalls: MockInvokeCall[] = [];
let nextResponse: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock('../../../../src/lib/supabase', () => ({
  getSupabase: () => ({
    functions: {
      invoke: (fn: string, opts: { body: Record<string, unknown> }) => {
        invokeCalls.push({ fn, body: opts.body });
        return Promise.resolve(nextResponse);
      },
    },
  }),
}));

import { useAnonChat } from '../../../../src/features/governance/AgentWidget/useAgentChat';

const ANON_SESSION_KEY = 'rsd_anon_chat_session';
const ANON_HISTORY_KEY = 'rsd_anon_chat_history';

beforeEach(() => {
  invokeCalls.length = 0;
  nextResponse = { data: null, error: null };
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AgentWidget — anon mode', () => {
  it('initialisiert eine Session-ID und persistiert sie nach erstem ok-Response', async () => {
    nextResponse = {
      data: {
        ok: true,
        response: 'Hallo zurueck.',
        history: [{ role: 'user', content: 'Hallo' }, { role: 'assistant', content: 'Hallo zurueck.' }],
      },
      error: null,
    };

    const { result } = renderHook(() => useAnonChat());

    // Vor dem ersten Send ist noch nichts in localStorage (loadAnonSession
    // generiert eine UUID nur fuer das State, schreibt aber erst beim ersten
    // ok-Response in localStorage — so wird kein Bot-Traffic ohne Konversation
    // mit unnoetigen Sessions belegt).
    expect(localStorage.getItem(ANON_SESSION_KEY)).toBeNull();

    await act(async () => {
      await result.current.send('Hallo');
    });

    await waitFor(() => {
      expect(localStorage.getItem(ANON_SESSION_KEY)).toBeTruthy();
    });

    // Session-ID ist eine UUID (36 Zeichen mit Bindestrichen).
    const sid = localStorage.getItem(ANON_SESSION_KEY)!;
    expect(sid).toMatch(/^[0-9a-f-]{36}$/i);

    // History ist persistiert.
    const history = JSON.parse(localStorage.getItem(ANON_HISTORY_KEY) ?? '[]');
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe('user');
    expect(history[1].role).toBe('assistant');
  });

  it('setzt rateLimited=true bei 429 und rollt die User-Nachricht zurueck', async () => {
    nextResponse = {
      data: null,
      error: { message: 'rate limit', context: { status: 429 } },
    };

    const { result } = renderHook(() => useAnonChat());
    const beforeCount = result.current.messages.length;

    await act(async () => {
      await result.current.send('Zu viele Anfragen?');
    });

    await waitFor(() => {
      expect(result.current.rateLimited).toBe(true);
    });

    // Bei rate_limited werden user message + loading message zurueckgerollt
    expect(result.current.messages.length).toBe(beforeCount);
    expect(result.current.isLoading).toBe(false);
  });

  it('uebermittelt nur die anon-spezifischen Felder — kein tenant_id, keine tool-Spec', async () => {
    nextResponse = {
      data: { ok: true, response: '...', history: [] },
      error: null,
    };

    const { result } = renderHook(() => useAnonChat());
    await act(async () => {
      await result.current.send('Eine Frage');
    });

    expect(invokeCalls.length).toBe(1);
    const call = invokeCalls[0];

    // Die einzige aufgerufene Edge-Function-Operation ist chat_anon
    expect(call.fn).toBe('governance-agent');
    expect(call.body.op).toBe('chat_anon');

    // Anon-Body enthaelt nur die erlaubten Felder
    const allowedKeys = new Set([
      'op', 'session_id', 'message', 'history', 'acknowledge_us_routing',
    ]);
    for (const key of Object.keys(call.body)) {
      expect(allowedKeys.has(key), `unerlaubter Feld-Leak in anon-Body: "${key}"`).toBe(true);
    }

    // Ausdruecklich KEINE tenant- oder tool-bezogenen Felder
    expect(call.body).not.toHaveProperty('tenant_id');
    expect(call.body).not.toHaveProperty('tenantId');
    expect(call.body).not.toHaveProperty('tools');
    expect(call.body).not.toHaveProperty('tool_calls');
    expect(call.body).not.toHaveProperty('mutation');
  });

  it('verwendet eine bestehende Session-ID aus localStorage statt eine neue zu generieren', async () => {
    const existingSid = 'a1b2c3d4-e5f6-4789-abcd-ef1234567890';
    localStorage.setItem(ANON_SESSION_KEY, existingSid);
    localStorage.setItem(ANON_HISTORY_KEY, JSON.stringify([
      { role: 'user', content: 'Frueher gesagt' },
      { role: 'assistant', content: 'Frueher geantwortet' },
    ]));

    nextResponse = {
      data: { ok: true, response: 'ok', history: [
        { role: 'user', content: 'Frueher gesagt' },
        { role: 'assistant', content: 'Frueher geantwortet' },
        { role: 'user', content: 'Jetzt' },
        { role: 'assistant', content: 'ok' },
      ] },
      error: null,
    };

    const { result } = renderHook(() => useAnonChat());

    await act(async () => {
      await result.current.send('Jetzt');
    });

    expect(invokeCalls.length).toBe(1);
    expect(invokeCalls[0].body.session_id).toBe(existingSid);
    // History wurde mitgegeben
    expect(invokeCalls[0].body.history).toEqual([
      { role: 'user', content: 'Frueher gesagt' },
      { role: 'assistant', content: 'Frueher geantwortet' },
    ]);
  });

  it('reset() leert die Konversation auf den Anfangszustand', async () => {
    nextResponse = { data: { ok: true, response: 'ok', history: [] }, error: null };

    const { result } = renderHook(() => useAnonChat());

    await act(async () => {
      await result.current.send('Frage 1');
    });
    await waitFor(() => expect(result.current.messages.length).toBeGreaterThan(1));

    act(() => {
      result.current.reset();
    });

    // Nach reset bleibt nur die Welcome-Nachricht
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe('welcome');
    expect(result.current.messages[0].role).toBe('assistant');
  });
});
