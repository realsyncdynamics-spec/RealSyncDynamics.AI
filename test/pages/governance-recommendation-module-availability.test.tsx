/**
 * „Was ist inbegriffen“: Preview-/Roadmap-Module dürfen kein grünes
 * „Im Produkt“-Häkchen tragen — analog TISAX/DORA, gesteuert über
 * `module.availability` in shared/pricing.ts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { GovernanceRecommendation } from '../../src/pages/GovernanceRecommendation';
import type { GovernanceProfile, Recommendation } from '../../src/core/onboarding/types';
import { ALL_MODULES, moduleAvailabilityLabel } from '../../shared/pricing';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const profile: GovernanceProfile = {
  scanId: 'audit-agency',
  domain: 'beispiel.de',
  sector: 'generic',
  riskLevel: 'medium',
  findings: [],
  answers: [],
  dimensions: [],
};

const recommendation: Recommendation = {
  recommendedPlan: 'agency',
  reasoning: 'Testempfehlung Agency — volle Modulbreite für Availability-Checks.',
  urgencyLevel: 'medium',
  nextSteps: [],
  sector: 'generic',
};

function mount() {
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/recommendation/audit-agency',
          state: { profile, recommendation },
        },
      ]}
    >
      <Routes>
        <Route path="/recommendation/:scanId" element={<GovernanceRecommendation />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('GovernanceRecommendation — Modul-Availability', () => {
  it('zeigt Preview- und Roadmap-Module mit grauem Häkchen und Suffix', () => {
    mount();
    expect(screen.getByText('Was ist inbegriffen')).toBeInTheDocument();

    const previewIds = ALL_MODULES.filter((m) => m.availability === 'preview').map((m) => m.id);
    const roadmapIds = ALL_MODULES.filter((m) => m.availability === 'coming-soon').map((m) => m.id);

    // Agency enthält n8n, Kodee, Kanäle, Human Handoff, TISAX — aber nicht DORA.
    const expectedOnAgency = new Set([
      'n8n',
      'kodee',
      'ai_bots',
      'voice',
      'whatsapp',
      'telegram',
      'website_chat',
      'multi_channel_messaging',
      'human_handoff',
      'tisax',
    ]);

    for (const id of previewIds) {
      if (!expectedOnAgency.has(id)) continue;
      const row = screen.getByTestId(`module-check-nonlive-${id}`).closest('[data-module-id]') as HTMLElement;
      expect(row).toHaveAttribute('data-module-availability', 'preview');
      expect(within(row).getByText('(Preview)')).toBeInTheDocument();
      expect(moduleAvailabilityLabel('preview')).toBe('(Preview)');
      expect(row.textContent).not.toMatch(/Im Produkt:/);
    }

    for (const id of roadmapIds) {
      if (!expectedOnAgency.has(id)) continue;
      const row = screen.getByTestId(`module-check-nonlive-${id}`).closest('[data-module-id]') as HTMLElement;
      expect(row).toHaveAttribute('data-module-availability', 'coming-soon');
      expect(within(row).getByText('(Roadmap)')).toBeInTheDocument();
      expect(moduleAvailabilityLabel('coming-soon')).toBe('(Roadmap)');
      expect(row.textContent).not.toMatch(/Im Produkt:/);
    }

    // Live-Kontrollprobe: DSGVO bleibt grün und ohne Status-Suffix.
    const live = screen.getByTestId('module-check-live-dsgvo').closest('[data-module-id]') as HTMLElement;
    expect(live).toHaveAttribute('data-module-availability', 'live');
    expect(within(live).queryByText('(Preview)')).toBeNull();
    expect(within(live).queryByText('(Roadmap)')).toBeNull();
    expect(live.textContent).toMatch(/Im Produkt:/);
  });
});
