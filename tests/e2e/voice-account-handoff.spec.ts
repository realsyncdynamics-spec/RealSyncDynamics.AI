import { expect, test } from '@playwright/test';

test.describe('Voice-Agent – gemeinsamer Produktpfad und sicherer Account-Handoff', () => {
  test('Zentraler Produktpfad zeigt Account-Einstieg und nur feste externe Vorschau-URL', async ({ page }) => {
    await page.goto('/voice-agent');

    await expect(page.getByRole('heading', { name: /Ihr KI-Empfang für Kundenanfragen und Telefonie/i })).toBeVisible();

    const account = page.getByTestId('voice-account-setup-cta');
    await expect(account).toHaveAttribute('href', '/app/voice/setup');

    const preview = page.getByTestId('voice-external-preview-cta');
    await expect(preview).toHaveAttribute('href', 'https://voice.realsyncdynamicsai.de/onboarding.html');
    await expect(preview).toHaveAttribute('target', '_blank');
    await expect(preview).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('Alter Voice-Einstieg leitet zur kanonischen Route weiter und erhält Website-Parameter', async ({ page }) => {
    await page.goto('/phonebot/start?source=website_transformation&audit_id=voice-audit-1&domain=example.de');
    await expect(page).toHaveURL(/\/voice-agent\?/);

    const url = new URL(page.url());
    expect(url.pathname).toBe('/voice-agent');
    expect(url.searchParams.get('source')).toBe('website_transformation');
    expect(url.searchParams.get('audit_id')).toBe('voice-audit-1');
    expect(url.searchParams.get('domain')).toBe('example.de');

    await expect(page.getByRole('link', { name: /Weiter zur Governance-Aktivierung/ })).toBeVisible();
  });

  test('Voice-Setup verlangt RealSync-Login und bewahrt das Rücksprungziel', async ({ page }) => {
    // Fresh Playwright context with no prior RealSync session. No external
    // voice-preview navigation or account provisioning is performed.
    await page.goto('/app/voice/setup');

    await expect(page).toHaveURL(/\/welcome\?next=/);
    const url = new URL(page.url());
    expect(url.pathname).toBe('/welcome');
    expect(url.searchParams.get('next')).toBe('/app/voice/setup');

    // The setup view is not exposed to unauthenticated visitors.
    await expect(page.getByTestId('voice-setup-open-preview')).toHaveCount(0);
  });
});
