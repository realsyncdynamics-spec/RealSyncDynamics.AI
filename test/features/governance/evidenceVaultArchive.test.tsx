/**
 * Evidence-Vault-Archivierung — der Weg vom Archive-Knopf bis zum PATCH.
 *
 * Warum am Verhalten und nicht am Typ: Der Knopf war von Anfang an vorhanden und
 * typkorrekt verdrahtet, sein Handler enthielt aber nur ein `console.log` hinter
 * einem TODO. Weder `tsc` noch ein Render-Test haetten das gefunden — sichtbar
 * wird es erst daran, ob ueberhaupt eine Anfrage hinausgeht und wohin.
 *
 * Geprueft wird deshalb die Anfrage selbst: Methode, Ziel-Function, und dass
 * tenant_id und evidence_id mitgehen. Ohne den Tenant-Parameter antwortet die
 * Edge Function mit 400, ohne evidence_id ebenso.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { DetailPanel } from '@/src/features/governance/Iso42001EvidenceVaultView';

vi.mock('@/src/lib/auth', () => ({
  getAuthToken: vi.fn(async () => 'test-token'),
}));

const evidence = {
  id: 'ev-1',
  title: 'DPIA 2026',
  evidence_type: 'document' as const,
  framework_codes: ['iso42001'],
  control_ids: [],
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('Evidence Vault — Archivieren', () => {
  beforeEach(() => {
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const clickArchive = (fetchImpl: typeof fetch, onArchived = vi.fn(), onClose = vi.fn()) => {
    vi.stubGlobal('fetch', fetchImpl);
    const view = render(
      <DetailPanel evidence={evidence} tenantId="tenant-1" onArchived={onArchived} onClose={onClose} />
    );
    fireEvent.click(view.getByRole('button', { name: /archive/i }));
    return { onArchived, onClose };
  };

  it('schickt einen PATCH an die Evidence-Vault-Function mit Tenant und Evidence-ID', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    clickArchive(fetchMock as unknown as typeof fetch);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('PATCH');
    expect(url).toContain('/functions/v1/iso42001-evidence-vault');
    expect(url).toContain('tenant_id=tenant-1');
    expect(url).toContain('evidence_id=ev-1');
    expect(url).toContain('archived=true');
  });

  it('laedt die Liste neu und schliesst das Panel — in dieser Reihenfolge', async () => {
    const order: string[] = [];
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const { onArchived, onClose } = clickArchive(
      fetchMock as unknown as typeof fetch,
      vi.fn(() => { order.push('reload'); }),
      vi.fn(() => { order.push('close'); })
    );

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onArchived).toHaveBeenCalled();
    // Zuerst neu laden, dann schliessen — sonst steht der archivierte Eintrag
    // noch in der Liste, waehrend das Panel bereits zu ist.
    expect(order).toEqual(['reload', 'close']);
  });

  it('haelt das Panel offen und zeigt den Fehler, wenn der Server ablehnt', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 403 }));
    const onClose = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const view = render(
      <DetailPanel evidence={evidence} tenantId="tenant-1" onArchived={vi.fn()} onClose={onClose} />
    );
    fireEvent.click(view.getByRole('button', { name: /archive/i }));

    await waitFor(() => expect(view.getByText(/failed to archive/i)).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('fragt vor dem Archivieren nach und bricht bei Ablehnung ohne Anfrage ab', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    const fetchMock = vi.fn();
    clickArchive(fetchMock as unknown as typeof fetch);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
