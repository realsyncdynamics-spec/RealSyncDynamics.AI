import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { CommandCenter } from '../../../src/components/governance-os/CommandCenter';
import type { CommandDefinition } from '../../../src/components/governance-os/commandCenterCatalog';

const ITEMS: CommandDefinition[] = [
  {
    id: 'nav-evidence',
    label: 'Evidence',
    group: 'Navigation',
    keywords: ['evidence', 'nachweise'],
    state: 'ready',
    path: '/app/evidence',
    description: 'Hashes und Prüfpfade',
  },
  {
    id: 'nav-settings',
    label: 'Einstellungen',
    group: 'Navigation',
    keywords: ['settings'],
    state: 'ready',
    path: '/app/settings',
  },
  {
    id: 'mod-dpia',
    label: 'DSFA',
    group: 'Roadmap',
    keywords: ['dpia'],
    state: 'coming_soon',
    badge: 'Coming Soon',
    description: 'Noch nicht verfügbar',
  },
];

describe('CommandCenter', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rendert nichts wenn geschlossen', () => {
    const { container } = render(
      <CommandCenter open={false} onClose={() => {}} items={ITEMS} onRun={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('öffnet die Palette mit Suchfeld und Befehlen', () => {
    render(
      <CommandCenter open onClose={() => {}} items={ITEMS} onRun={() => {}} />,
    );
    expect(screen.getByRole('dialog', { name: 'Command Center' })).toBeInTheDocument();
    expect(screen.getByLabelText('Was möchtest du erledigen?')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Evidence/ })).toBeInTheDocument();
  });

  it('schließt bei Escape', () => {
    const onClose = vi.fn();
    render(
      <CommandCenter open onClose={onClose} items={ITEMS} onRun={() => {}} />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('filtert Befehle und führt Enter auf dem aktiven Eintrag aus', () => {
    const onRun = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandCenter open onClose={onClose} items={ITEMS} onRun={onRun} />,
    );

    fireEvent.change(screen.getByLabelText('Was möchtest du erledigen?'), {
      target: { value: 'Einstell' },
    });
    expect(screen.getByRole('option', { name: /Einstellungen/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Evidence/ })).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onRun).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'nav-settings', path: '/app/settings' }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('führt Coming-Soon-Befehle nicht aus', () => {
    const onRun = vi.fn();
    render(
      <CommandCenter open onClose={() => {}} items={ITEMS} onRun={onRun} />,
    );

    fireEvent.change(screen.getByLabelText('Was möchtest du erledigen?'), {
      target: { value: 'DSFA' },
    });
    const option = screen.getByRole('option', { name: /DSFA/ });
    expect(option).toBeDisabled();
    expect(within(option).getByText('Coming Soon')).toBeInTheDocument();

    fireEvent.click(option);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onRun).not.toHaveBeenCalled();
  });

  it('navigiert mit Pfeiltasten durch die Liste', () => {
    const onRun = vi.fn();
    render(
      <CommandCenter open onClose={() => {}} items={ITEMS} onRun={onRun} />,
    );

    fireEvent.keyDown(window, { key: 'ArrowDown' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onRun).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'nav-settings' }),
    );
  });

  it('öffnet einen unbekannten Freitext per Enter nur als Entwurf', () => {
    const onSubmitIntent = vi.fn();
    const onRun = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandCenter open onClose={onClose} items={ITEMS} onRun={onRun} onSubmitIntent={onSubmitIntent} />,
    );
    fireEvent.change(screen.getByLabelText('Was möchtest du erledigen?'), {
      target: { value: '  Prüfe meine Datenverarbeitung auf DSGVO-Lücken  ' },
    });
    expect(onSubmitIntent).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSubmitIntent).toHaveBeenCalledOnce();
    expect(onSubmitIntent).toHaveBeenCalledWith('Prüfe meine Datenverarbeitung auf DSGVO-Lücken');
    expect(onRun).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('zeigt bei Treffer eine separate Entwurf-Aktion statt ungewollter Navigation', () => {
    const onSubmitIntent = vi.fn();
    const onRun = vi.fn();
    render(
      <CommandCenter open onClose={() => {}} items={ITEMS} onRun={onRun} onSubmitIntent={onSubmitIntent} />,
    );
    fireEvent.change(screen.getByLabelText('Was möchtest du erledigen?'), {
      target: { value: 'Evidence' },
    });
    expect(screen.getByRole('option', { name: /Evidence/ })).toBeInTheDocument();
    expect(screen.getByText(/Kein automatischer Versand oder Agentenlauf/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Entwurf im Governance-Assistenten öffnen/ }));
    expect(onSubmitIntent).toHaveBeenCalledWith('Evidence');
    expect(onRun).not.toHaveBeenCalled();
  });

  it('Ctrl+Enter übergibt gezielt Freitext auch bei übereinstimmendem Befehl', () => {
    const onSubmitIntent = vi.fn();
    const onRun = vi.fn();
    render(
      <CommandCenter open onClose={() => {}} items={ITEMS} onRun={onRun} onSubmitIntent={onSubmitIntent} />,
    );
    fireEvent.change(screen.getByLabelText('Was möchtest du erledigen?'), {
      target: { value: 'Evidence' },
    });
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    expect(onSubmitIntent).toHaveBeenCalledWith('Evidence');
    expect(onRun).not.toHaveBeenCalled();
  });

  it('führt gesperrte Coming-Soon-Befehle auch mit Entwurf-Funktion nicht per Enter aus', () => {
    const onSubmitIntent = vi.fn();
    const onRun = vi.fn();
    render(
      <CommandCenter open onClose={() => {}} items={ITEMS} onRun={onRun} onSubmitIntent={onSubmitIntent} />,
    );
    fireEvent.change(screen.getByLabelText('Was möchtest du erledigen?'), {
      target: { value: 'DSFA' },
    });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSubmitIntent).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();
  });

  it('hat ohne Intent-Handler keinen Entwurf-Button', () => {
    render(
      <CommandCenter open onClose={() => {}} items={ITEMS} onRun={() => {}} />,
    );
    fireEvent.change(screen.getByLabelText('Was möchtest du erledigen?'), {
      target: { value: 'Unbekannte Aufgabe' },
    });
    expect(screen.queryByRole('button', { name: /Entwurf im Governance-Assistenten öffnen/ })).not.toBeInTheDocument();
  });

});
