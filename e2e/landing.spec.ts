import { test, expect } from '@playwright/test';

/**
 * Smoke-E2E für die statische Self-Service-Landing (Governance OS).
 *
 * Aligned mit `src/pages/Landing.tsx`: Hero (Mission, 4-Verb-Botschaft),
 * Problem, Detect→Monitor→Document→Prove, DSGVO-/AI-Act-Automation,
 * Security & EU-Hosting, Für wen?, Preise-Teaser, Final CTA, Footer.
 * Vollständig statisch — keine Auto-Scroll-Sektionen.
 *
 * CTA-Disziplin: ausschließlich Self-Service-Strings; keine Beratungs-/
 * Pilot-/Demo-/Call-/Sales-Sprache.
 */
test('Landing renders the self-service governance-OS narrative + CTAs', async ({ page }) => {
  await page.goto('/');

  // Hero — Governance-OS-Headline
  await expect(
    page.getByRole('heading', {
      name: /Governance Operating System für DSGVO, AI Act und Continuous Compliance\./i,
    }),
  ).toBeVisible();

  // Primary CTA „Kostenlos starten" → /audit
  const primary = page.getByRole('link', { name: /^Kostenlos starten$/i }).first();
  await expect(primary).toBeVisible();
  await expect(primary).toHaveAttribute('href', /\/audit/);

  // Secondary CTA „Dashboard öffnen" → /welcome
  const secondary = page.getByRole('link', { name: /^Dashboard öffnen$/i }).first();
  await expect(secondary).toBeVisible();
  await expect(secondary).toHaveAttribute('href', /\/welcome/);

  // Automation-Flow — Detect · Monitor · Document · Prove
  await expect(
    page.getByRole('heading', { name: /Detect · Monitor · Document · Prove/i }),
  ).toBeVisible();

  // Problem-Sektion
  await expect(
    page.getByRole('heading', { name: /Compliance ist manuell, teuer und riskant/i }),
  ).toBeVisible();

  // Automations-Sektionen
  await expect(page.getByRole('heading', { name: /^DSGVO-Automation$/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^AI-Act-Automation$/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Für wen\?$/i })).toBeVisible();

  // Keine alten Vertriebs-/Pilot-CTAs auf der Startseite. Bewusst präzise
  // (Mehrwort-CTA-Phrasen), damit legitime globale Komponenten-Texte — etwa
  // der Assistent-Disclaimer „Für tiefere Beratung …" oder „ersetzt keine
  // Rechtsberatung" — NICHT fälschlich als Treffer zählen. Spiegelt die
  // CI-Gate-Logik aus .github/workflows/cta-enforcement.yml.
  for (const forbidden of [
    /Agency Pilot anfragen/i, /Pilot anfragen/i, /Pilot starten/i,
    /Demo anfragen/i, /Beratung anfragen/i, /Gespräch buchen/i,
    /Call buchen/i, /Runtime ansehen/i,
  ]) {
    await expect(page.getByRole('link', { name: forbidden })).toHaveCount(0);
  }

  // Footer-Legal-Links
  await expect(page.getByRole('link', { name: /^Impressum$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Datenschutz$/i })).toBeVisible();
});
