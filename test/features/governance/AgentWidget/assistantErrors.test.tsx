/**
 * Assistent: Server-/Netzwerkfehler werden ehrlich gemeldet (mit „Erneut
 * versuchen"), nicht verschluckt; keine Beispiel-Konversationen, kein
 * „EU-lokal"-Badge (der Tenant-Chat routet über Anthropic/USA, 412 bis
 * bestätigt — siehe supabase/functions/governance-agent).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

interface InvokeCall { fn: string; body: Record<string, unknown> }
const calls: InvokeCall[] = [];
let responses: Array<{ data: unknown; error: unknown } | Error> = [];

vi.mock('@/src/lib/supabase', () => ({
  getSupabase: () => ({
    functions: {
      invoke: (fn: string, opts: { body: Record<string, unknown> }) => {
        calls.push({ fn, body: opts.body });
        const next = responses.shift() ?? { data: null, error: { message: 'boom', context: { status: 500 } } };
        return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
      },
    },
  }),
}));

vi.mock('@/src/core/access/TenantProvider', () => ({
  useTenant: () => ({ activeTenantId: 'tenant-1', tenants: [], loading: false, entitlements: null, hasFeature: () => false }),
}));

import {
  ASSISTANT_UNAVAILABLE,
  useAgentChat,
  useAnonChat,
} from '@/src/features/governance/AgentWidget/useAgentChat';
import { GovernanceChatSidebar } from '@/src/components/governance-os/GovernanceChatSidebar';
import { AgentWidget } from '@/src/features/governance/AgentWidget/AgentWidget';

const OK = (response: string) => ({
  data: { ok: true, session_id: 's1', response, tool_calls: 0, actions_taken: [], outcome: 'success' },
  error: null,
});
const HTTP = (status: number) => ({ data: null, error: { message: `Edge Function returned ${status}`, context: { status } } });

// jsdom kennt scrollIntoView nicht (useAgentChat scrollt nach Antworten).
Element.prototype.scrollIntoView = vi.fn();

beforeEach(() => {
  calls.length = 0;
  responses = [];
  sessionStorage.clear();
  localStorage.clear();
});

describe('useAgentChat (tenant)', () => {
  it('Serverfehler → ehrliche Meldung ohne Rohtext, retry sendet erneut', async () => {
    responses = [HTTP(500), OK('Antwort vom Server')];
    const { result } = renderHook(() => useAgentChat('tenant-1'));
    await act(async () => { await result.current.send('Frage'); });

    const last = result.current.messages.at(-1)!;
    expect(last.content).toBe(ASSISTANT_UNAVAILABLE);
    expect(last.isError).toBe(true);
    expect(last.content).not.toMatch(/Edge Function|Verbindungsfehler/);
    expect(result.current.canRetry).toBe(true);
    expect(result.current.isLoading).toBe(false);

    await act(async () => { await result.current.retry(); });
    expect(calls).toHaveLength(2);
    expect(calls[1].body.message).toBe('Frage');
    const contents = result.current.messages.map((m) => m.content);
    expect(contents).not.toContain(ASSISTANT_UNAVAILABLE);
    expect(contents.filter((c) => c === 'Frage')).toHaveLength(1);
    expect(contents.at(-1)).toBe('Antwort vom Server');
    expect(result.current.canRetry).toBe(false);
  });

  it('geworfener Fehler (Netzwerk) hängt nicht im Ladezustand', async () => {
    responses = [new Error('Failed to fetch')];
    const { result } = renderHook(() => useAgentChat('tenant-1'));
    await act(async () => { await result.current.send('Frage'); });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages.some((m) => m.isLoading)).toBe(false);
    expect(result.current.messages.at(-1)!.content).toBe(ASSISTANT_UNAVAILABLE);
  });

  it('LLM nicht konfiguriert (503) → gleiche ehrliche Meldung, kein Vault-Interna', async () => {
    responses = [HTTP(503)];
    const { result } = renderHook(() => useAgentChat('tenant-1'));
    await act(async () => { await result.current.send('Frage'); });
    const last = result.current.messages.at(-1)!;
    expect(last.content).toBe(ASSISTANT_UNAVAILABLE);
    expect(last.content).not.toMatch(/Vault|anthropic_api_key/);
  });

  it('412 US-Routing: Nachricht wird nach Bestätigung gesendet statt verworfen', async () => {
    responses = [HTTP(412), OK('ok')];
    const { result } = renderHook(() => useAgentChat('tenant-1'));
    await act(async () => { await result.current.send('Frage'); });
    expect(result.current.usRoutingRequired).toBe(true);
    await act(async () => { await result.current.acknowledgeUsRouting(); });
    expect(calls).toHaveLength(2);
    expect(calls[1].body.acknowledge_us_routing).toBe(true);
    expect(calls[1].body.message).toBe('Frage');
    expect(result.current.messages.at(-1)!.content).toBe('ok');
  });
});

describe('useAnonChat (public)', () => {
  it('Serverfehler → ehrliche Meldung + retry', async () => {
    responses = [HTTP(500), { data: { ok: true, session_id: 'x', response: 'Hallo', history: [] }, error: null }];
    const { result } = renderHook(() => useAnonChat());
    await act(async () => { await result.current.send('Frage'); });
    expect(result.current.messages.at(-1)!.content).toBe(ASSISTANT_UNAVAILABLE);
    expect(result.current.canRetry).toBe(true);
    await act(async () => { await result.current.retry(); });
    expect(result.current.messages.at(-1)!.content).toBe('Hallo');
  });
});

describe('GovernanceChatSidebar (App-Shell-Assistent)', () => {
  function renderSidebar() {
    return render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <GovernanceChatSidebar open onClose={() => {}} />
      </MemoryRouter>,
    );
  }

  it('zeigt keine Beispiel-Konversationen und kein EU-lokal-Badge', () => {
    renderSidebar();
    expect(document.body.textContent).not.toMatch(/EU-lokal|EU-local/i);
    for (const fake of ['Meta Pixel Analyse', 'Cookie-Banner TDDDG §25', 'DSFA Empfehlungsalgorithmus', 'VVT Aktualisierung Q2', 'EU AI Act CV-Screening']) {
      expect(screen.queryByText(fake)).not.toBeInTheDocument();
    }
    expect(screen.queryByText('Verlauf')).not.toBeInTheDocument();
  });

  it('Serverfehler: ehrliche Meldung mit „Erneut versuchen"', async () => {
    responses = [HTTP(500), OK('Antwort')];
    renderSidebar();
    const box = screen.getByPlaceholderText(/Was möchtest du/);
    fireEvent.change(box, { target: { value: 'Frage' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText(ASSISTANT_UNAVAILABLE)).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('assistant-retry'));
    await waitFor(() => expect(screen.getByText('Antwort')).toBeInTheDocument());
    expect(screen.queryByText(ASSISTANT_UNAVAILABLE)).not.toBeInTheDocument();
  });

  it('412: US-Routing-Hinweis erscheint, statt die Nachricht still zu verwerfen', async () => {
    responses = [HTTP(412)];
    renderSidebar();
    const box = screen.getByPlaceholderText(/Was möchtest du/);
    fireEvent.change(box, { target: { value: 'Frage' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(screen.getByTestId('us-routing-banner')).toBeInTheDocument());
  });
});

describe('AgentWidget (öffentlich)', () => {
  it('behauptet keine EU-Datenhaltung', () => {
    render(<AgentWidget mode="anon" open onClose={() => {}} />);
    expect(document.body.textContent).not.toMatch(/EU-lokal|EU-local|EU-Daten|Öffentlich · EU/);
  });
});
