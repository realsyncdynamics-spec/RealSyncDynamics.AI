import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E for the Landing (HeroOnly-Pivot + Long-Form-Sections).
 *
 * Aligned with HeroOnly.tsx (post-#104 pivot):
 * - H1: "Ihre Website & KI-Prozesse DSGVO-sicher"
 * - Primary-CTA "Jetzt kostenlosen Compliance-Check starten" → /audit
 * - Trust-Leiste: EU-Datenresidenz · AVV · Audit-Log · Made in Germany
 * - "Beispiel-Report ansehen" button opens modal with "GA4 ohne Consent geladen"
 * - Sections: Zielgruppen, So funktioniert, Leistungen, Gründe, Preise (PricingTeaserSection), FAQ
 *
 * fix(e2e): align landing.spec.ts with HeroOnly-Pivot (post-#104)
 */
test('Landing renders HeroOnly Hero + long-form sections + example-report modal', async ({ page }) => {
    await page.goto('/');

       // H1
       await expect(
             page.getByRole('heading', { name: /Ihre Website & KI-Prozesse DSGVO-sicher/i }),
           ).toBeVisible();

       // Primary CTA → /audit
       const primary = page.getByRole('link', { name: /Jetzt kostenlosen Compliance-Check starten/i }).first();
    await expect(primary).toBeVisible();
    await expect(primary).toHaveAttribute('href', /\/audit/);

       // Trust-Leiste (post-#135 Messaging-Shift: Vollständiges Audit-Log -> Continuous Monitoring)
       await expect(
             page.getByText(/EU-Datenresidenz · AVV inklusive · Continuous Monitoring · Made in Germany/i),
           ).toBeVisible();

       // Sektion „Zielgruppen"
       await expect(
             page.getByRole('heading', { name: /Ideal für Unternehmen mit eigener Website und KI-Einsatz/i }),
           ).toBeVisible();
    await expect(page.getByRole('heading', { name: /Online-Unternehmen & SaaS/i })).toBeVisible();

       // Sektion „So funktioniert"
       await expect(
             page.getByRole('heading', { name: /In drei Schritten zu einem klaren Compliance-Bild/i }),
           ).toBeVisible();

       // Sektion „Leistungen"
       await expect(page.getByRole('heading', { name: /^Mehr als ein Cookie-Scanner$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^KI-Workflow-Check$/i })).toBeVisible();

       // Sektion „Gründe"
       await expect(
             page.getByRole('heading', { name: /Typische Gründe, warum Firmen RealSyncDynamics.AI einsetzen/i }),
           ).toBeVisible();

       // Sektion „Preise" (PricingTeaserSection: Free Audit · Starter · Growth · Enterprise)
       await expect(
             page.getByRole('heading', { name: /Free Audit · Starter · Growth · Enterprise/i }),
           ).toBeVisible();
    await expect(page.getByText(/49 €/).first()).toBeVisible();

       // Sektion „FAQ"
       await expect(page.getByRole('heading', { name: /^Häufige Fragen$/i })).toBeVisible();
    await expect(page.getByText(/Müssen wir dafür unsere ganze IT umbauen/i)).toBeVisible();

       // Beispiel-Report-Modal: Button öffnet Modal mit "GA4 ohne Consent geladen"
       await page.getByRole('button', { name: /Beispiel-Report ansehen/i }).click();
    await expect(
          page.getByRole('heading', { name: /GA4 ohne Consent geladen/i }),
        ).toBeVisible();
});
