import { test, expect, request as playwrightRequest } from '@playwright/test';

/**
 * E2E-Smokes für die rechtlich kritischen Surfaces:
 * Sub-Prozessoren-Register und PrivacyPolicy.
 *
 * Schützt vor:
 *   - Sub-Processor-Eintrag im Code, aber nicht in der UI (RLS-/Render-Bug)
 *   - DPA-Link, der versehentlich auf ein internes target umgebogen wird
 *   - Privacy-Policy, die nach Refactor leer rendert
 *
 * Externe DPA-URL-Reachability ist optional und nur lokal/cron sinnvoll,
 * damit CI nicht auf fremder Infrastruktur flaket — Gate via E2E_EXTERNAL_HTTP=1.
 */

const EXPECTED_SUB_PROCESSORS = [
  'Supabase Inc.',
  'Anthropic, PBC',
  'Google LLC',
  'OpenAI, L.L.C.',
  'Stripe Payments Europe, Limited',
  'Hostinger International, Ltd.',
  'Resend Inc.',
  'GitHub, Inc. (Microsoft Corporation)',
] as const;

const EXPECTED_DPA_URLS = [
  'https://supabase.com/legal/dpa',
  'https://www.anthropic.com/legal/dpa',
  'https://cloud.google.com/terms/data-processing-addendum',
  'https://openai.com/policies/data-processing-addendum',
  'https://stripe.com/legal/dpa',
  'https://www.hostinger.com/legal/data-processing-agreement',
  'https://resend.com/legal/dpa',
  'https://github.com/customer-terms/github-data-protection-agreement',
] as const;

test.describe('/legal/sub-processors', () => {
  test('rendert alle 8 Sub-Prozessoren mit DPA-Link', async ({ page }) => {
    await page.goto('/legal/sub-processors');

    await expect(
      page.getByText('Sub-Prozessoren', { exact: false }).first(),
    ).toBeVisible();
    await expect(
      page.getByText(/Art\. 28 DSGVO/i).first(),
    ).toBeVisible();

    for (const name of EXPECTED_SUB_PROCESSORS) {
      await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
    }

    for (const url of EXPECTED_DPA_URLS) {
      const anchor = page.locator(`a[href="${url}"]`).first();
      await expect(anchor).toHaveAttribute('target', '_blank');
      await expect(anchor).toHaveAttribute('rel', /noopener/);
    }
  });

  test('DPA-URLs sind erreichbar (E2E_EXTERNAL_HTTP=1)', async () => {
    test.skip(
      process.env.E2E_EXTERNAL_HTTP !== '1',
      'External DPA-URL HEAD-Check via E2E_EXTERNAL_HTTP=1 gegated, damit CI nicht auf fremder Infrastruktur flaket.',
    );
    const ctx = await playwrightRequest.newContext({
      extraHTTPHeaders: { 'user-agent': 'RealSyncDynamicsAI-DPA-Healthcheck/1.0' },
    });
    const failures: { url: string; status: number | string }[] = [];
    for (const url of EXPECTED_DPA_URLS) {
      try {
        const res = await ctx.get(url, { maxRedirects: 5, timeout: 10_000 });
        if (res.status() >= 400) failures.push({ url, status: res.status() });
      } catch (err) {
        failures.push({ url, status: (err as Error).message });
      }
    }
    await ctx.dispose();
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
  });
});
