import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductTiles } from '../../src/components/landing/company/ProductTiles';
import { COMPANY_PRODUCTS } from '../../src/components/landing/company/companyProducts';
import { validateCompanyContact } from '../../src/components/landing/company/CompanyContactForm';
import { getImplementation, STATUS_LABEL } from '../../src/product/implementation-status';

function renderTiles() {
  return render(
    <MemoryRouter>
      <ProductTiles />
    </MemoryRouter>,
  );
}

describe('Unternehmens-Landing – Produkt-Tafeln', () => {
  it('Status kommt aus der SSoT (implementation-status.ts)', () => {
    for (const p of COMPANY_PRODUCTS) {
      const item = getImplementation(p.id);
      expect(item).toBeDefined();
      expect(p.statusLabel).toBe(STATUS_LABEL[item!.status]);
      // Nur live-Einträge bekommen einen Einstieg.
      if (item!.status !== 'live') expect(p.route).toBeUndefined();
    }
  });

  it('Voice/Telefonie wird nicht als live dargestellt', () => {
    const voice = COMPANY_PRODUCTS.find((p) => p.id === 'voice-telephony');
    expect(voice?.status).not.toBe('live');
  });

  it('Modal öffnet per Klick, Pfeiltasten blättern/wechseln, Esc schließt, Fokus kehrt zurück', async () => {
    renderTiles();
    const tile = screen.getByTestId('product-tile-free-audit');
    tile.focus();
    fireEvent.click(tile);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(document.activeElement).toBe(tabs[0]);

    // Pfeil in der Tab-Leiste → nächster Tab
    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(screen.getAllByRole('tab')[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getAllByRole('tab')[1], { key: 'ArrowLeft' });
    expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true');

    // Pfeil im Panel → nächste Seite
    const panel = screen.getByRole('tabpanel');
    expect(screen.getByText('Seite 1 / 2')).toBeInTheDocument();
    fireEvent.keyDown(panel, { key: 'ArrowRight' });
    expect(screen.getByText('Seite 2 / 2')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(tile));
  });
});

describe('Unternehmens-Landing – Kontaktformular-Validierung', () => {
  it('verlangt gültige E-Mail und Nachricht', () => {
    const errors = validateCompanyContact({ name: '', email: 'x', company: '', message: 'kurz' });
    expect(errors.email).toBeDefined();
    expect(errors.message).toBeDefined();
  });

  it('akzeptiert gültige Eingaben', () => {
    const errors = validateCompanyContact({
      name: 'A',
      email: 'kontakt@beispiel.de',
      company: '',
      message: 'Bitte um Rückmeldung zum Produkt.',
    });
    expect(errors).toEqual({});
  });
});
