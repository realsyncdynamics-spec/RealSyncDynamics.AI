import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RealSyncLogo, RealSyncMark } from '../../src/components/branding';

describe('RealSyncLogo', () => {
  it('rendert Wortmarke „RealSync Dynamics AI" und Tagline in der full-Variante', () => {
    render(<RealSyncLogo variant="full" />);
    expect(screen.getByText('RealSync')).toBeInTheDocument();
    expect(screen.getByText(/Dynamics AI/)).toBeInTheDocument();
    expect(
      screen.getByText(/Governance-Runtime fuer KI, Datenschutz und Nachweise/i),
    ).toBeInTheDocument();
  });

  it('zeigt keine Tagline in der compact-Variante', () => {
    render(<RealSyncLogo variant="compact" />);
    expect(screen.getByText('RealSync')).toBeInTheDocument();
    expect(
      screen.queryByText(/Governance-Runtime fuer KI, Datenschutz und Nachweise/i),
    ).toBeNull();
  });

  it('zeigt keine Wortmarke in der icon-Variante', () => {
    render(<RealSyncLogo variant="icon" />);
    expect(screen.queryByText('RealSync')).toBeNull();
    expect(screen.getByRole('img', { name: /RealSync Dynamics AI/i })).toBeInTheDocument();
  });

  it('RealSyncMark traegt das aria-label und ist standalone nutzbar', () => {
    render(<RealSyncMark ariaLabel="Brand Mark" />);
    expect(screen.getByRole('img', { name: 'Brand Mark' })).toBeInTheDocument();
  });

  it('akzeptiert brandName-Override fuer Marketing-Kontexte', () => {
    render(<RealSyncLogo variant="compact" brandName="Acme Sync OS" />);
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText(/Sync OS/)).toBeInTheDocument();
  });
});
