import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AiStudioPlayground from '../../src/features/ai-studio/AiStudioPlayground';

const state = vi.hoisted(() => ({
  tenant: 'tenant-a' as string | null,
  session: { user: { id: 'user-a' }, access_token: 'test-access-token' } as { user: { id: string }; access_token: string } | null,
  invoke: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('../../src/features/supabase/SupabaseAuthContext', () => ({
  useSupabaseAuth: () => ({ session: state.session }),
}));
vi.mock('../../src/core/access/TenantProvider', () => ({
  useTenant: () => ({ activeTenantId: state.tenant, loading: false }),
}));
vi.mock('../../src/lib/supabase', () => ({
  getSupabase: () => ({
    functions: { invoke: state.invoke },
    auth: { getSession: state.getSession },
  }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => { resolve = finish; });
  return { promise, resolve };
}
function mount() {
  return render(<MemoryRouter><AiStudioPlayground /></MemoryRouter>);
}
function send(text = 'Hallo') {
  fireEvent.change(screen.getByLabelText('Nachricht'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
}

describe('AI Studio Playground / Gateway contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.tenant = 'tenant-a';
    state.session = { user: { id: 'user-a' }, access_token: 'test-access-token' };
    state.getSession.mockResolvedValue({ data: { session: state.session } });
  });

  it('sends the native generate operation with the current tenant and local profile', async () => {
    state.invoke.mockResolvedValue({ data: { ok: true, output: 'Echte Antwort', provider: 'lm_studio', model: 'local-model' }, error: null });
    mount();
    send('Welche Aufgabe?');
    await waitFor(() => expect(screen.getByText('Echte Antwort')).toBeInTheDocument());
    expect(state.invoke).toHaveBeenCalledWith('ai-gateway', expect.objectContaining({
      body: expect.objectContaining({
        op: 'generate', tenant_id: 'tenant-a', feature: 'ai_studio',
        model_profile: 'fast-local', input: 'Nutzer: Welche Aufgabe?',
      }),
    }));
  });

  it('refuses to invoke without a tenant', () => {
    state.tenant = null;
    mount();
    fireEvent.change(screen.getByLabelText('Nachricht'), { target: { value: 'Hallo' } });
    expect(screen.getByRole('button', { name: 'Senden' })).toBeDisabled();
    expect(state.invoke).not.toHaveBeenCalled();
  });

  it('shows gateway failures without inventing an assistant answer', async () => {
    state.invoke.mockResolvedValue({ data: null, error: new Error('Gateway nicht erreichbar') });
    mount();
    send();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Gateway nicht erreichbar'));
    expect(screen.queryByText('KI', { exact: true })).toBeNull();
  });

  it('shows server rejection (e.g. rate limit) instead of displaying success', async () => {
    state.invoke.mockResolvedValue({ data: { ok: false, error: { code: 'RATE_LIMITED', message: 'Limit erreicht' } }, error: null });
    mount();
    send();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Limit erreicht'));
  });

  it('reports a missing provider (503) without a fabricated reply', async () => {
    state.invoke.mockResolvedValue({ data: { ok: false, error: { code: 'NO_PROVIDER', message: 'Kein lokales Modell verfügbar' } }, error: null });
    mount();
    send();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Kein lokales Modell verfügbar'));
    expect(screen.queryByText('KI', { exact: true })).toBeNull();
  });

  it('fails closed on a malformed successful gateway envelope', async () => {
    state.invoke.mockResolvedValue({ data: { ok: true, output: { unexpected: true } }, error: null });
    mount();
    send();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('keine lesbare Textantwort'));
    expect(screen.queryByText('[object Object]')).toBeNull();
  });

  it('handles a rejected invocation without rendering an assistant reply', async () => {
    state.invoke.mockRejectedValue(new Error('Gateway timeout'));
    mount();
    send();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Gateway timeout'));
    expect(screen.queryByText('KI', { exact: true })).toBeNull();
  });

  it('discards responses when the active tenant changes during a request', async () => {
    const response = deferred<{ data: { ok: true; output: string }; error: null }>();
    state.invoke.mockReturnValue(response.promise);
    const view = mount();
    send('Anfrage A');
    expect(state.invoke).toHaveBeenCalledTimes(1);
    state.tenant = 'tenant-b';
    view.rerender(<MemoryRouter><AiStudioPlayground /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText('Anfrage A')).toBeNull());
    response.resolve({ data: { ok: true, output: 'Vertrauliche Antwort A' }, error: null });
    await waitFor(() => expect(screen.queryByText('Vertrauliche Antwort A')).toBeNull());
    expect(screen.getByText(/Schreibe eine Nachricht/)).toBeInTheDocument();
  });

  it('discards a delayed response when the signed-in account changes', async () => {
    const response = deferred<{ data: { ok: true; output: string }; error: null }>();
    state.invoke.mockReturnValue(response.promise);
    const view = mount();
    send('Private Anfrage');
    state.session = { user: { id: 'user-b' }, access_token: 'different-token' };
    state.getSession.mockResolvedValue({ data: { session: state.session } });
    view.rerender(<MemoryRouter><AiStudioPlayground /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText('Private Anfrage')).toBeNull());
    response.resolve({ data: { ok: true, output: 'Antwort von user-a' }, error: null });
    await waitFor(() => expect(screen.queryByText('Antwort von user-a')).toBeNull());
  });

  it('does not show a delayed gateway error after a tenant switch', async () => {
    const response = deferred<{ data: null; error: Error }>();
    state.invoke.mockReturnValue(response.promise);
    const view = mount();
    send('Vor Wechsel');
    state.tenant = 'tenant-b';
    view.rerender(<MemoryRouter><AiStudioPlayground /></MemoryRouter>);
    await waitFor(() => expect(screen.queryByText('Vor Wechsel')).toBeNull());
    response.resolve({ data: null, error: new Error('Alter Mandant: Fehler') });
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('does not send a request when the user is signed out', () => {
    state.session = null;
    mount();
    fireEvent.change(screen.getByLabelText('Nachricht'), { target: { value: 'Nicht senden' } });
    expect(screen.getByRole('button', { name: 'Senden' })).toBeDisabled();
    expect(state.invoke).not.toHaveBeenCalled();
  });
});
