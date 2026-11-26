import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

const discoverWebsite = vi.fn();
vi.mock('../../../src/features/siteos/siteOsApi', () => ({
  discoverWebsite: (...args: unknown[]) => discoverWebsite(...args),
  errorMessage: () => 'Fehler beim Website-Check',
}));

vi.mock('../../../src/components/landing/EdgeFunctionAvailabilityNotice', () => ({
  allEdgeFunctionsAvailable: () => true,
}));

const { ReceptionistDraftCard } = await import('../../../src/features/betrieb/ReceptionistDraftCard');

const discovery = {
  ok: true,
  source_url: 'https://elektro-mueller.de/',
  status: 200,
  content_type: 'text/html',
  title: 'Elektro Müller GmbH | Elektriker in Köln',
  description: 'Elektroinstallation in Köln',
  h1: null,
  headings: [],
  services: ['Elektroinstallation'],
  visible_text: 'Öffnungszeiten Mo–Fr 7–16 Uhr. Tel. 0221 123456',
  fetched_at: '2026-11-25T10:00:00Z',
};

beforeEach(() => {
  discoverWebsite.mockReset();
});

async function readWebsite() {
  discoverWebsite.mockResolvedValue({ kind: 'ok', data: discovery });
  render(<ReceptionistDraftCard tenantId="tenant-1" />);
  fireEvent.change(screen.getByLabelText('Website-Adresse'), { target: { value: 'elektro-mueller.de' } });
  fireEvent.click(screen.getByRole('button', { name: /Website auslesen/ }));
  await screen.findByText('Elektro Müller GmbH');
}

describe('ReceptionistDraftCard', () => {
  it('ruft den Website-Check mit dem Mandanten aus dem Kontext und normalisierter URL auf', async () => {
    await readWebsite();
    expect(discoverWebsite).toHaveBeenCalledWith({ tenant_id: 'tenant-1', url: 'https://elektro-mueller.de/' });
  });

  it('zeigt Entwurfsstatus, Herkunft und offene Pflichtpunkte; Freigabe gesperrt', async () => {
    await readWebsite();
    expect(screen.getByTestId('draft-status')).toHaveTextContent('Entwurf – Freigabe durch Inhaber erforderlich');
    expect(screen.getAllByText('Aus Website').length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('open-points')).getByText(/an wen der Assistent übergibt/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entwurf freigeben/ })).toBeDisabled();
  });

  it('lehnt lokale Adressen ab, ohne den Website-Check aufzurufen', () => {
    render(<ReceptionistDraftCard tenantId="tenant-1" />);
    fireEvent.change(screen.getByLabelText('Website-Adresse'), { target: { value: 'localhost' } });
    fireEvent.click(screen.getByRole('button', { name: /Website auslesen/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('öffentliche Website-Adresse');
    expect(discoverWebsite).not.toHaveBeenCalled();
  });

  it('Inhaber ergänzt das Übergabeziel, bestätigt die Prüfung und gibt frei', async () => {
    await readWebsite();
    const row = screen.getByText('Übergabe an Menschen – an wen').closest('div') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Bearbeiten' }));
    fireEvent.change(screen.getByLabelText('Übergabe an Menschen – an wen bearbeiten'), {
      target: { value: 'Herr Müller, 0171 1234567' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(screen.getByText('Vom Inhaber')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Entwurf freigeben/ }));
    await waitFor(() =>
      expect(screen.getByTestId('draft-status')).toHaveTextContent('Vom Inhaber freigegeben – noch nicht gespeichert'),
    );
  });
});
