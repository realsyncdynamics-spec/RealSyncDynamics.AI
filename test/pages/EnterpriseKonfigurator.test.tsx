/**
 * Verhaltens-Tests für den Enterprise-Konfigurator.
 *
 * Der Zweck der Seite ist ein Preis, den der Interessent ohne Rückfrage
 * bekommt. Deshalb wird hier nicht das Markup geprüft, sondern die Rechnung:
 * Grundpreis aus der SSoT, Bausteine aus `addonsFor('enterprise')`, Summe
 * live. Erfundene Beträge würden hier auffallen, weil jeder Erwartungswert
 * aus `shared/pricing.ts` stammt und nicht hart steht.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EnterpriseKonfigurator from '../../src/pages/EnterpriseKonfigurator';
import { planById, addonById, addonsFor } from '../../shared/pricing';

const BASE = planById('enterprise').price.monthlyEur;
const eur = (n: number) => `${n.toLocaleString('de-DE')} €`;

function renderPage() {
  return render(
    <MemoryRouter>
      <EnterpriseKonfigurator />
    </MemoryRouter>,
  );
}

describe('EnterpriseKonfigurator', () => {
  it('startet beim Enterprise-Grundpreis aus der SSoT', () => {
    renderPage();
    expect(screen.getByTestId('enterprise-total')).toHaveTextContent(eur(BASE));
  });

  it('addiert einen Ja/Nein-Baustein mit seinem SSoT-Preis', () => {
    renderPage();
    const voice = addonById('voice')!;
    const card = screen.getByText(/Sprachkanal über Telefonie/i).closest('div')!.parentElement!;
    fireEvent.click(within(card).getByRole('button', { name: 'Hinzufügen' }));
    expect(screen.getByTestId('enterprise-total')).toHaveTextContent(eur(BASE + voice.priceEur));
  });

  it('rechnet Mengen-Bausteine mal ihrer Anzahl', () => {
    renderPage();
    const pack = addonById('agency_bot_pack')!;
    const plus = screen.getByRole('button', { name: /Agency Bot Pack: Bausteine erhöhen/i });
    fireEvent.click(plus);
    fireEvent.click(plus);
    expect(screen.getByTestId('enterprise-total')).toHaveTextContent(eur(BASE + pack.priceEur * 2));
  });

  it('bietet nur Bausteine an, die die SSoT für Enterprise freigibt', () => {
    renderPage();
    const allowed = new Set(addonsFor('enterprise').map((a) => a.name));
    // Der Konfigurator darf keinen Baustein zeigen, den Enterprise nicht buchen kann.
    for (const name of ['WhatsApp']) {
      expect(allowed.has(name)).toBe(false);
      expect(screen.queryByText(new RegExp(name, 'i'))).toBeNull();
    }
  });

  it('weist Vertragspunkte ohne Betrag aus statt eine Zahl zu behaupten', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Mehr als 25 Domains/i }));
    expect(screen.getByText('nach Vertrag')).toBeInTheDocument();
    // Die Summe darf sich davon nicht bewegen.
    expect(screen.getByTestId('enterprise-total')).toHaveTextContent(eur(BASE));
  });
});
