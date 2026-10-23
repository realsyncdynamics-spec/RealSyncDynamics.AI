import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GovernanceSelfCheck } from '../../src/components/landing/GovernanceSelfCheck';
import { GOVERNANCE_CHECK_QUESTIONS } from '../../src/components/governance-frontend/hero-content';

afterEach(cleanup);

it('guides users through the existing eight questions without discarding answers', () => {
  render(<MemoryRouter><GovernanceSelfCheck /></MemoryRouter>);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','0');
  expect(screen.getByText(GOVERNANCE_CHECK_QUESTIONS[0].question)).toBeInTheDocument();
  expect(screen.queryByText(GOVERNANCE_CHECK_QUESTIONS[1].question)).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText('Ja'));
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow','1');
  fireEvent.click(screen.getByRole('button',{name:/Weiter/}));
  expect(screen.getByText(GOVERNANCE_CHECK_QUESTIONS[1].question)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Zurück'}));
  expect(screen.getByLabelText('Ja')).toBeChecked();
});
