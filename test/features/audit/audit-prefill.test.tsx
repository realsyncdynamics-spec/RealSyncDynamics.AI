/**
 * Suche oben → /audit: Die Eingabe muss im Domain-Feld des Steppers ankommen.
 *
 * Regression 2026-09-25: `GovernanceAddressBar` und „Scannen" im
 * eingebetteten Browser navigierten mit `?target=`, `/audit` las nur
 * `?domain=` — die Eingabe ging verloren.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import {
  AUDIT_PREFILL_MAX,
  auditPathFor,
  readAuditPrefill,
} from '@/src/features/audit/auditPrefill';
import { GovernanceAddressBar } from '@/src/components/governance-os/GovernanceAddressBar';

describe('readAuditPrefill', () => {
  it('liest ?domain= (kanonisch)', () => {
    expect(readAuditPrefill('?domain=example.com')).toBe('example.com');
  });

  it('nimmt Altlast-Parameter target, url und q weiter an', () => {
    expect(readAuditPrefill('?target=shop.example.de')).toBe('shop.example.de');
    expect(readAuditPrefill('?url=https%3A%2F%2Fexample.org')).toBe('https://example.org');
    expect(readAuditPrefill('?q=example.net')).toBe('example.net');
  });

  it('domain gewinnt vor den Altlast-Parametern', () => {
    expect(readAuditPrefill('?target=alt.de&domain=neu.de')).toBe('neu.de');
  });

  it('trimmt, kappt auf die Feldlänge und liefert sonst leer', () => {
    expect(readAuditPrefill('?domain=%20%20example.com%20')).toBe('example.com');
    expect(readAuditPrefill(`?domain=${'a'.repeat(400)}`)).toHaveLength(AUDIT_PREFILL_MAX);
    expect(readAuditPrefill('')).toBe('');
    expect(readAuditPrefill('?domain=%20&source=x')).toBe('');
  });
});

describe('auditPathFor', () => {
  it('baut ?domain= statt ?target=', () => {
    const path = auditPathFor('example.com', 'app-search');
    expect(path).toBe('/audit?domain=example.com&source=app-search');
    expect(path).not.toContain('target=');
  });

  it('Rundreise: was der Sender schreibt, liest der Empfänger', () => {
    for (const input of ['example.com', 'https://www.example.de/pfad?x=1', 'Müller & Söhne GmbH']) {
      const path = auditPathFor(input);
      expect(readAuditPrefill(path.slice(path.indexOf('?')))).toBe(input);
    }
  });

  it('leere Eingabe → nacktes /audit', () => {
    expect(auditPathFor('   ')).toBe('/audit');
  });
});

function AuditProbe() {
  const { search } = useLocation();
  return <output data-testid="audit-prefill">{readAuditPrefill(search)}</output>;
}

describe('GovernanceAddressBar → /audit', () => {
  it('Enter mit Domain startet den Audit (nicht die Vorschau)', () => {
    const onLoadUrl = vi.fn();
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <Routes>
          <Route path="/app/dashboard" element={<GovernanceAddressBar onLoadUrl={onLoadUrl} />} />
          <Route path="/audit" element={<AuditProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    const input = screen.getByRole('textbox', { name: 'Domain prüfen (startet Audit)' });
    expect(input).toHaveAttribute('placeholder', 'Domain prüfen (startet Audit)');
    fireEvent.change(input, { target: { value: 'example.com' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('audit-prefill')).toHaveTextContent('example.com');
    expect(onLoadUrl).not.toHaveBeenCalled();
  });

  it('Vorschau bleibt als eigener Knopf erreichbar', () => {
    const onLoadUrl = vi.fn();
    render(
      <MemoryRouter>
        <GovernanceAddressBar onLoadUrl={onLoadUrl} />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }));
    expect(onLoadUrl).toHaveBeenCalledWith('https://example.com/');
  });

  it('übergibt die Suche so, dass /audit sie vorbelegt', () => {
    render(
      <MemoryRouter initialEntries={['/app/dashboard']}>
        <Routes>
          <Route path="/app/dashboard" element={<GovernanceAddressBar />} />
          <Route path="/audit" element={<AuditProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'KI-Chatbot Kundenservice' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByTestId('audit-prefill')).toHaveTextContent('KI-Chatbot Kundenservice');
  });

  it('kein Sender baut mehr ?target= für /audit', () => {
    for (const file of [
      'src/components/governance-os/GovernanceAddressBar.tsx',
      'src/components/governance-os/GovernanceBrowserShell.tsx',
    ]) {
      expect(readFileSync(file, 'utf8'), file).not.toContain('/audit?target=');
    }
  });
});
