import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrialCountdownBanner } from '../src/features/billing/TrialCountdownBanner';
import { BrowserRouter } from 'react-router-dom';

// Helper to render with Router
function renderWithRouter(component: React.ReactElement) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe('TrialCountdownBanner', () => {
  describe('rendering and visibility', () => {
    it('hides when no trial end date provided', () => {
      const { container } = renderWithRouter(
        <TrialCountdownBanner trialEndDate={null} planName="Starter" />
      );
      expect(container.innerHTML).not.toContain('Testphase');
    });

    it('displays when trial is active and future', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      renderWithRouter(
        <TrialCountdownBanner trialEndDate={futureDate.toISOString()} planName="Starter" />
      );
      expect(screen.getByText(/Testphase/i)).toBeInTheDocument();
    });

    it('shows plan name in the message', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      renderWithRouter(
        <TrialCountdownBanner trialEndDate={futureDate.toISOString()} planName="Growth" />
      );
      expect(screen.getByText(/Growth/)).toBeInTheDocument();
    });
  });

  describe('urgency levels', () => {
    it('shows critical state when 3 days or less remain', () => {
      const soonDate = new Date();
      soonDate.setDate(soonDate.getDate() + 2);
      const { container } = renderWithRouter(
        <TrialCountdownBanner trialEndDate={soonDate.toISOString()} planName="Growth" />
      );
      expect(container.innerHTML).toContain('bg-red-950');
    });

    it('shows warning state when 4-7 days remain', () => {
      const midDate = new Date();
      midDate.setDate(midDate.getDate() + 5);
      const { container } = renderWithRouter(
        <TrialCountdownBanner trialEndDate={midDate.toISOString()} planName="Growth" />
      );
      expect(container.innerHTML).toContain('bg-amber-950');
    });

    it('shows info state when 8+ days remain', () => {
      const longDate = new Date();
      longDate.setDate(longDate.getDate() + 14);
      const { container } = renderWithRouter(
        <TrialCountdownBanner trialEndDate={longDate.toISOString()} planName="Growth" />
      );
      expect(container.innerHTML).toContain('bg-blue-950');
    });
  });

  describe('day counting', () => {
    it('displays countdown message for active trial', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      renderWithRouter(
        <TrialCountdownBanner trialEndDate={futureDate.toISOString()} planName="Starter" />
      );
      // Verify countdown message is displayed
      expect(screen.getByText(/Testphase endet/i)).toBeInTheDocument();
    });

    it('displays message with time remaining for 5-day trial', () => {
      const fiveDaysLater = new Date();
      fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);
      renderWithRouter(
        <TrialCountdownBanner trialEndDate={fiveDaysLater.toISOString()} planName="Starter" />
      );
      // Should show days remaining message
      expect(screen.getByText(/Testphase endet/i)).toBeInTheDocument();
    });

    it('displays critical message for 2-day trial', () => {
      const twoDaysLater = new Date();
      twoDaysLater.setDate(twoDaysLater.getDate() + 2);
      const { container } = renderWithRouter(
        <TrialCountdownBanner trialEndDate={twoDaysLater.toISOString()} planName="Starter" />
      );
      // Should have critical styling
      expect(container.innerHTML).toContain('bg-red-950');
    });
  });

  describe('plan name display', () => {
    it('includes the plan name in message', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      renderWithRouter(
        <TrialCountdownBanner trialEndDate={futureDate.toISOString()} planName="Enterprise" />
      );
      expect(screen.getByText(/Enterprise/)).toBeInTheDocument();
    });
  });

  describe('upgrade link', () => {
    it('provides link to billing page', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      renderWithRouter(
        <TrialCountdownBanner trialEndDate={futureDate.toISOString()} planName="Starter" />
      );
      const link = screen.getByRole('link', { name: /upgrade/i });
      expect(link).toHaveAttribute('href', '/app/billing');
    });
  });

  describe('dismiss callback', () => {
    it('renders dismiss button when onDismiss provided', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const mockDismiss = () => {};
      renderWithRouter(
        <TrialCountdownBanner
          trialEndDate={futureDate.toISOString()}
          planName="Starter"
          onDismiss={mockDismiss}
        />
      );
      expect(screen.getByRole('button', { name: '✕' })).toBeInTheDocument();
    });

    it('omits dismiss button when onDismiss not provided', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      renderWithRouter(
        <TrialCountdownBanner trialEndDate={futureDate.toISOString()} planName="Starter" />
      );
      expect(screen.queryByRole('button', { name: '✕' })).not.toBeInTheDocument();
    });
  });
});
