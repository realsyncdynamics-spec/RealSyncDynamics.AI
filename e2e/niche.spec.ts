import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E for the three Niche-Landings (/fuer-saas, /fuer-agenturen,
 * /fuer-praxen). Asserts:
 *   - Niche-Eyebrow rendert
 *   - Headline-Stichwort ist sichtbar (validates segment-spezifische Copy)
 *   - Pain-Cards-Section H2 rendert
 *   - Audit-Inhalt-Section H2 rendert
 *   - FAQ-Section enthält erste segment-typische Frage
 *   - Primary-CTA verlinkt auf /audit?source=fuer-{niche}
 *   - Cross-Niche-Footer enthält Links auf die anderen beiden Niches
 *
 * Catches Regressionen wenn jemand die NicheConfig-Schnittstelle bricht
 * oder eine Wrapper-Page ohne Config-Eintrag committet.
 */

const NICHES = [
  {
    path: '/fuer-saas',
    eyebrow: 'Für SaaS-Plattformen',
    headlineFragment: 'DSGVO + EU AI Act für SaaS',
    firstFaq: 'Müssen wir den Audit auf unsere Produktiv-Plattform laufen lassen?',
    auditSourceParam: 'source=fuer-saas',
    crossLinkLabels: ['Agenturen', 'Praxen'],
  },
  {
    path: '/fuer-agenturen',
    eyebrow: 'Für Agenturen + Web-Studios',
    headlineFragment: 'DSGVO + AI-Act Compliance für 50 Kundenseiten',
    firstFaq: 'Können wir das Tool unter unserem Logo verkaufen?',
    auditSourceParam: 'source=fuer-agenturen',
    crossLinkLabels: ['SaaS', 'Praxen'],
  },
  {
    path: '/fuer-praxen',
    eyebrow: 'Für Arzt-, Zahnarzt-, Therapie-Praxen',
    headlineFragment: 'DSGVO + Patientendaten-Schutz',
    firstFaq: 'Müssen wir Doctolib jetzt abschalten?',
    auditSourceParam: 'source=fuer-praxen',
    crossLinkLabels: ['SaaS', 'Agenturen'],
  },
];

for (const n of NICHES) {
  test(`Niche-Landing ${n.path} renders Hero + Pain-Cards + Audit-Inhalt + FAQ + cross-links`, async ({ page }) => {
    await page.goto(n.path);

    // Eyebrow
    await expect(page.getByText(n.eyebrow, { exact: false }).first()).toBeVisible();

    // Headline (substring match per locator().hasText — vermeidet Regex-
    // Probleme bei `+`/`-` in den Fragments)
    await expect(
      page.locator('h1', { hasText: n.headlineFragment }),
    ).toBeVisible();

    // Pain-Cards-Section — segment-agnostischer Substring der H2
    await expect(
      page.getByRole('heading', { name: /unsichtbare Compliance-Lücken/i }),
    ).toBeVisible();

    // Audit-Inhalt-Section (numbered steps with Audit-Inhalt-Eyebrow)
    await expect(
      page.getByRole('heading', { name: /Was wir konkret/i }),
    ).toBeVisible();

    // FAQ-Section: erste segment-typische Frage muss sichtbar sein
    // (kann zugeklappt sein — getByText findet sie trotzdem im DOM)
    await expect(page.getByText(n.firstFaq, { exact: false })).toBeVisible();

    // Primary-CTA in Hero hat source-Parameter
    const heroCta = page.getByRole('link', { name: /Jetzt kostenlosen Compliance-Check starten/i }).first();
    await expect(heroCta).toBeVisible();
    await expect(heroCta).toHaveAttribute('href', new RegExp(n.auditSourceParam));

    // Cross-Niche-Footer enthält die anderen beiden Niches
    for (const otherNicheLabel of n.crossLinkLabels) {
      await expect(
        page.locator('footer').getByRole('link', { name: new RegExp(`^${otherNicheLabel}$`, 'i') }),
      ).toBeVisible();
    }

    // Pricing-Teaser-Section (geteilte Component aus #111-Refactor,
    // 5-Tier-Modell seit #145: Free Audit / Starter 79€ / Growth 249€ /
    // Agency 699€ / Enterprise)
    await expect(
      page.getByRole('heading', {
        name: /Free Audit · Starter · Growth · Agency · Enterprise/i,
      }),
    ).toBeVisible();
    await expect(page.getByText(/79 €/).first()).toBeVisible();
  });
}
