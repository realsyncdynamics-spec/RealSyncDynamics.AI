import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { VoiceAgentStudioPage } from '../../src/pages/voice-agents/VoiceAgentStudioPage';
import { VOICE_INDUSTRIES } from '../../src/pages/voice-agents/catalog';

function visit(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/voice-agents/*" element={<VoiceAgentStudioPage />} /></Routes></MemoryRouter>);
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Voice Studio: public journey without a false activation promise', () => {
  it('takes the visitor from the landing page to Handwerk and an honest setup entry', () => {
    visit('/voice-agents');
    expect(screen.getByText('STUDIO IN ENTWICKLUNG')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Branche auswählen' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Für deinen Arbeitsalltag gedacht.' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /Handwerk.*Anfragen strukturieren/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Auf der Baustelle. Für Kunden erreichbar.' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Einrichtung kennenlernen' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Dein Voice Agent für Handwerk.' })).toBeInTheDocument();
    expect(screen.getByText(/Es wird noch keine Konfiguration gespeichert/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Bestehenden Bot-Builder öffnen' })).toHaveAttribute('href', '/app/bots');
    expect(document.activeElement).toBe(screen.getByRole('main'));
  });

  it.each(VOICE_INDUSTRIES)('supports a direct link to $name with its scope and limits', (industry) => {
    visit(`/voice-agents/branchen/${industry.slug}`);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(industry.headline);
    expect(screen.getByText(industry.boundary)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Einrichtung kennenlernen' })).toHaveAttribute('href', `/voice-agents/start?branche=${industry.slug}`);
    const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content');
    expect(robots?.split(',').map((directive) => directive.trim())).toEqual(['noindex', 'nofollow']);
  });

  it('changes examples and resets the scenario when changing industry, without calling a provider', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    visit('/voice-agents/demo?branche=handwerk');
    fireEvent.click(screen.getByRole('button', { name: 'Wissenslücke' }));
    expect(screen.getByText(/Ich kann Ihnen keinen Preis zusagen/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Übergabe' }));
    expect(screen.getByText(/Dieses Beispiel führt keine Weiterleitung aus/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Branche' }), { target: { value: 'kanzleien' } });
    expect(screen.getByRole('button', { name: 'Anfrage' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Ich gebe keine Rechtsberatung/)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['/voice-agents/branchen/unbekannt', '/voice-agents/unbekannt'])('handles unknown routes: %s', (path) => {
    visit(path);
    expect(screen.getByRole('heading', { name: 'Hier gibt es noch keinen Eintrag.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Zur Branchenübersicht' })).toHaveAttribute('href', '/voice-agents/branchen');
  });

  it('explains an unknown demo selection instead of accepting arbitrary input as a template', () => {
    visit('/voice-agents/demo?branche=unbekannt');
    expect(screen.getByRole('status')).toHaveTextContent('Die angefragte Branche ist unbekannt. Gezeigt wird Handwerk.');
    expect(screen.getByRole('combobox')).toHaveValue('handwerk');
  });

  it('keeps all product concepts unpriced and unpurchasable', () => {
    visit('/voice-agents/preise');
    const main = within(screen.getByRole('main'));
    expect(main.getAllByText('Tarif in Vorbereitung')).toHaveLength(5);
    expect(main.queryByRole('link', { name: /kaufen|bezahlen|aktivieren/i })).not.toBeInTheDocument();
    expect(main.getByRole('link', { name: 'Plattformtarife ansehen' })).toHaveAttribute('href', '/pricing');
    expect(screen.getByRole('main').textContent).not.toMatch(/\d\s*€/);
  });

  it('shows a generic, non-persisting setup entry without a valid industry', () => {
    visit('/voice-agents/start?branche=unbekannt');
    expect(screen.getByRole('heading', { level: 1, name: 'Von deinem Betrieb zum Telefonassistenten.' })).toBeInTheDocument();
    expect(screen.getAllByText('GEPLANT')).toHaveLength(10);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /aktivieren/i })).not.toBeInTheDocument();
  });
});
