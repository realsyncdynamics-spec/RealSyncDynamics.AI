import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { OAuthProviderButtons } from '../../../src/features/auth/OAuthProviderButtons';

// Hardening for the production OAuth bug: when Supabase returns
// `validation_failed` ("provider is not enabled"), the affected button must
// (a) stay disabled, (b) be tagged with data-oauth-error so future
// transcripts can pinpoint the provider, (c) surface a user-friendly hint
// instead of the raw Supabase string.

const signInWithOAuth = vi.fn();

vi.mock('../../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({ auth: { signInWithOAuth } }),
}));

beforeEach(() => {
  signInWithOAuth.mockReset();
  cleanup();
});

describe('OAuthProviderButtons — validation_failed handling', () => {
  it('disables the clicked provider and tags it after "provider is not enabled"', async () => {
    signInWithOAuth.mockResolvedValueOnce({
      error: { code: 'validation_failed', message: 'Unsupported provider: provider is not enabled' },
    });

    render(<OAuthProviderButtons />);

    const googleBtn = screen.getByRole('button', { name: /Google/i });
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(googleBtn).toBeDisabled();
    });
    expect(googleBtn).toHaveAttribute('data-oauth-error', 'validation_failed');

    // Other providers must remain clickable.
    const githubBtn = screen.getByRole('button', { name: /GitHub/i });
    expect(githubBtn).not.toBeDisabled();
    expect(githubBtn).not.toHaveAttribute('data-oauth-error');

    // User-friendly message, not the raw Supabase string.
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toMatch(/Unsupported provider/i);
    expect(alert.textContent).toMatch(/anderen Anbieter/i);
  });

  it('shows the raw message for unrelated errors and keeps the button enabled', async () => {
    signInWithOAuth.mockResolvedValueOnce({
      error: { message: 'Network request failed' },
    });

    render(<OAuthProviderButtons />);

    const githubBtn = screen.getByRole('button', { name: /GitHub/i });
    fireEvent.click(githubBtn);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/Network request failed/);
    // Non-provider errors are recoverable — button stays enabled for retry.
    await waitFor(() => {
      expect(githubBtn).not.toBeDisabled();
    });
  });
});
