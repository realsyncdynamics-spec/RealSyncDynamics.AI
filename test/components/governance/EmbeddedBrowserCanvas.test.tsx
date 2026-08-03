/**
 * Regressionstest für das sandbox-Attribut des Governance-Browsers.
 *
 * Hintergrund (COMPLIANCE_AUDIT_2026-07.md, „Governance-Browser vs. frame-src"):
 * `allow-scripts` + `allow-same-origin` zusammen heben die Sandbox auf, sobald
 * der eingebettete Inhalt gleichorigin ist — das Dokument kann dann das
 * sandbox-Attribut im Elterndokument entfernen. Die CSP lässt mit
 * `default-src 'self'` genau diesen Fall zu; fremde Hosts werden blockiert.
 *
 * Der Test hält fest, dass `allow-same-origin` nicht zurückkommt.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../../src/lib/supabase', () => ({
  getSupabase: () => ({
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
  }),
}));
vi.mock('../../../src/lib/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));
vi.mock('../../../src/lib/useCurrentTenant', () => ({
  useCurrentTenant: () => ({ id: 'tenant-1' }),
}));
vi.mock('../../../src/lib/useBrowserSession', () => ({
  useBrowserSession: () => 'session-1',
}));

import { EmbeddedBrowserCanvas } from '../../../src/components/governance-os/EmbeddedBrowserCanvas';

function renderCanvas(url = 'https://example.org/impressum') {
  render(
    <EmbeddedBrowserCanvas url={url} onClose={() => {}} onScan={() => {}} />,
  );
  return screen.getByTitle(`Governance Preview: ${new URL(url).hostname}`);
}

describe('EmbeddedBrowserCanvas — sandbox', () => {
  it('setzt KEIN allow-same-origin (sonst ist die Sandbox aufhebbar)', () => {
    const iframe = renderCanvas();
    const sandbox = iframe.getAttribute('sandbox') ?? '';
    expect(sandbox).not.toContain('allow-same-origin');
  });

  it('behält die Flags, die die Vorschau tatsächlich braucht', () => {
    const iframe = renderCanvas();
    const sandbox = iframe.getAttribute('sandbox') ?? '';
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).toContain('allow-popups');
    expect(sandbox).toContain('allow-forms');
  });

  it('das sandbox-Attribut ist überhaupt gesetzt', () => {
    // Ein fehlendes Attribut waere die restriktivste Variante — aber auch ein
    // Hinweis darauf, dass jemand es versehentlich entfernt hat.
    const iframe = renderCanvas();
    expect(iframe.hasAttribute('sandbox')).toBe(true);
  });

  it('lädt die uebergebene URL', () => {
    const iframe = renderCanvas('https://example.com/datenschutz');
    expect(iframe.getAttribute('src')).toBe('https://example.com/datenschutz');
  });
});
