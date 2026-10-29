/**
 * Agenten-Register in der Seitenleistengruppe „Agenten" — Quelle AGENT_CATALOG, ehrlicher Reifegrad.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AGENT_CATALOG } from '../../../src/features/governance/agents/agentCatalog';
import { STATUS_LABEL } from '../../../src/product/implementation-status';
import {
  GovernanceAgentsNav,
  isAgentRegisterTarget,
} from '../../../src/components/governance-os/GovernanceAgentsNav';

function renderNav(entry = '/app/dashboard') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <GovernanceAgentsNav />
    </MemoryRouter>,
  );
}

describe('GovernanceAgentsNav', () => {
  it('listet jeden Katalog-Eintrag mit Anker ins Register', () => {
    renderNav();
    for (const agent of AGENT_CATALOG) {
      const link = screen.getByTestId(`side-agent-${agent.id}`);
      expect(link).toHaveAttribute('href', `/app/ai-systems/agents#agent-${agent.id}`);
      expect(link).toHaveTextContent(agent.name);
    }
  });

  it('Reifegrad stammt aus dem Katalog und ist für Screenreader lesbar', () => {
    renderNav();
    for (const agent of AGENT_CATALOG) {
      const link = screen.getByTestId(`side-agent-${agent.id}`);
      expect(link).toHaveAttribute('data-maturity', agent.maturity);
      expect(link).toHaveTextContent(STATUS_LABEL[agent.maturity]);
    }
  });

  it('Register-Karte zählt zur Gruppe „Agenten", das Register ohne Anker nicht', () => {
    expect(isAgentRegisterTarget('/app/ai-systems/agents', '#agent-browser-agent')).toBe(true);
    expect(isAgentRegisterTarget('/app/ai-systems/agents', '')).toBe(false);
    expect(isAgentRegisterTarget('/app/ai-systems', '#agent-browser-agent')).toBe(false);
  });

  it('markiert den angesprungenen Eintrag im Register', () => {
    const [first, second] = AGENT_CATALOG;
    renderNav(`/app/ai-systems/agents#agent-${first.id}`);
    expect(screen.getByTestId(`side-agent-${first.id}`)).toHaveAttribute('aria-current', 'location');
    expect(screen.getByTestId(`side-agent-${second.id}`)).not.toHaveAttribute('aria-current');
  });
});
