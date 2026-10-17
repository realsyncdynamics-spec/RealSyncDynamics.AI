/**
 * /roadmap: Beta-Fahrplan kommt aus src/config/beta.ts (WP-7) — keine
 * erfundenen Termine für Feedback-Runden.
 */
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Roadmap } from '../../src/pages/Roadmap';
import { BETA, BETA_MILESTONES } from '../../src/config/beta';

afterEach(cleanup);

it('renders every beta milestone from the config and marks the current one', () => {
  render(
    <MemoryRouter initialEntries={['/roadmap']}>
      <Roadmap />
    </MemoryRouter>,
  );
  expect(BETA.active).toBe(true);
  const section = screen.getByTestId('roadmap-beta');
  for (const m of BETA_MILESTONES) {
    expect(section).toHaveTextContent(m.title);
  }
  expect(screen.getByTestId('roadmap-beta-end')).toHaveTextContent(BETA.endsLabel.toUpperCase());
  expect(screen.getByTestId('roadmap-beta-feedback')).toHaveAttribute('aria-current', 'step');
  expect(screen.getByTestId('roadmap-beta-prices')).not.toHaveAttribute('aria-current');
  expect(screen.getByRole('link', { name: 'Kostenlos testen' }).getAttribute('href')).toMatch(
    /^\/welcome\?beta=1&plan=growth&source=roadmap/,
  );
});
