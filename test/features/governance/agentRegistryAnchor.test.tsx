/**
 * Register-Anker aus der Seitenleiste: Ein erneuter Klick auf denselben
 * Eintrag setzt den Filter zurück, auch wenn der Anker gleich bleibt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import { AGENT_CATALOG, agentAnchor } from '../../../src/features/governance/agents/agentCatalog';
import { STATUS_LABEL, type ImplementationStatus } from '../../../src/product/implementation-status';

vi.mock('../../../src/features/kodee/connections/AuthGate', () => ({
  AuthGate: ({ children }: { children: () => unknown }) => children(),
}));

import { AgentRegistryInner } from '../../../src/features/governance/agents/AgentRegistryView';

const target = AGENT_CATALOG.find((a) => a.maturity !== 'live') ?? AGENT_CATALOG[0];
const otherStatus: ImplementationStatus = target.maturity === 'live' ? 'preview' : 'live';
const href = `/app/ai-systems/agents#${agentAnchor(target.id)}`;

describe('AgentRegistryInner — Sprung per Anker', () => {
  const scrollIntoView = vi.fn();
  // Frames sammeln und erst nach dem Re-Render ausführen — wie im Browser.
  let frames: FrameRequestCallback[] = [];
  const flushFrames = () =>
    act(() => {
      const pending = frames;
      frames = [];
      pending.forEach((cb) => cb(0));
    });

  beforeEach(() => {
    scrollIntoView.mockClear();
    frames = [];
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('zeigt die Karte wieder, wenn derselbe Eintrag erneut angeklickt wird', () => {
    render(
      <MemoryRouter initialEntries={[href]}>
        <Link to={href} data-testid="sidebar-entry">{target.name}</Link>
        <AgentRegistryInner />
      </MemoryRouter>,
    );

    const card = () => document.getElementById(agentAnchor(target.id));
    expect(card()).not.toBeNull();
    expect(card()).toHaveAttribute('data-highlighted', 'true');
    flushFrames();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: STATUS_LABEL[otherStatus] }));
    expect(card()).toBeNull();

    fireEvent.click(screen.getByTestId('sidebar-entry'));
    expect(card()).not.toBeNull();
    flushFrames();
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });
});
