// WP-4: Feedback-Formular in der App statt Umweg über /kontakt.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const tenant = vi.hoisted(() => ({ activeTenantId: 'tenant-1' as string | null }));
const submit = vi.hoisted(() => vi.fn());

vi.mock('../../../src/core/access/TenantProvider', () => ({
  useOptionalTenant: () => ({ activeTenantId: tenant.activeTenantId }),
}));
vi.mock('../../../src/lib/supabase', () => ({ getSupabase: () => ({}) }));
vi.mock('../../../src/features/beta/betaFeedback', async (orig) => ({
  ...(await orig<typeof import('../../../src/features/beta/betaFeedback')>()),
  submitBetaFeedback: submit,
}));

import { BetaFeedback } from '../../../src/components/governance-os/BetaFeedback';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <BetaFeedback />
    </MemoryRouter>,
  );
}

describe('BetaFeedback', () => {
  beforeEach(() => {
    tenant.activeTenantId = 'tenant-1';
    submit.mockReset();
  });

  it('erscheint ohne aktiven Mandanten nicht', () => {
    tenant.activeTenantId = null;
    renderAt('/app/dashboard');
    expect(screen.queryByRole('button', { name: 'Feedback geben' })).toBeNull();
  });

  it('öffnet das Formular und fokussiert das Textfeld', () => {
    renderAt('/app/dashboard');
    const toggle = screen.getByRole('button', { name: 'Feedback geben' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Was ist Ihnen aufgefallen?'));
  });

  it('meldet leeren Text, ohne zu senden', () => {
    renderAt('/app/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Feedback geben' }));
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
    expect(screen.getByRole('alert').textContent).toMatch(/schreiben Sie kurz/);
    expect(submit).not.toHaveBeenCalled();
  });

  it('sendet Text, Mandant und Route ohne Query und bestätigt', async () => {
    submit.mockResolvedValue(undefined);
    renderAt('/app/scans?token=geheim');
    fireEvent.click(screen.getByRole('button', { name: 'Feedback geben' }));
    fireEvent.change(screen.getByLabelText('Was ist Ihnen aufgefallen?'), { target: { value: ' Scan dauert lange ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/beim Team angekommen/));
    expect(submit).toHaveBeenCalledWith({}, { tenantId: 'tenant-1', text: 'Scan dauert lange', route: '/app/scans' });
    expect(screen.queryByLabelText('Was ist Ihnen aufgefallen?')).toBeNull();
  });

  it('zeigt einen Fehler und behält den Text, wenn das Senden scheitert', async () => {
    submit.mockRejectedValue(new Error('RLS'));
    renderAt('/app/dashboard');
    fireEvent.click(screen.getByRole('button', { name: 'Feedback geben' }));
    const field = screen.getByLabelText('Was ist Ihnen aufgefallen?');
    fireEvent.change(field, { target: { value: 'Etwas' } });
    fireEvent.click(screen.getByRole('button', { name: 'Senden' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/nicht gesendet/));
    expect((field as HTMLTextAreaElement).value).toBe('Etwas');
  });

  it('schließt mit Escape und gibt den Fokus an den Knopf zurück', () => {
    renderAt('/app/dashboard');
    const toggle = screen.getByRole('button', { name: 'Feedback geben' });
    fireEvent.click(toggle);
    fireEvent.keyDown(screen.getByLabelText('Was ist Ihnen aufgefallen?'), { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });
});
