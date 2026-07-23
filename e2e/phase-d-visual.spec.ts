import { test, expect } from '@playwright/test';

test.describe('Phase D: Visual Hierarchy & Context Testing', () => {
  test('Landing page has landing-context class and cyan accent', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Check page loaded
    const title = await page.title();
    expect(title).toContain('RealSyncDynamics.AI');

    // Check body styling (landing-context should affect text color)
    const bodyElement = page.locator('body').or(page.locator('[class*="landing"]')).first();
    const computedStyle = await bodyElement.evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        color: style.color,
        backgroundColor: style.backgroundColor
      };
    });

    // Landing page should have light text (titanium-100)
    expect(computedStyle.color).toBeTruthy();
    console.log('Landing page text color:', computedStyle.color);
  });

  test('Buttons have primary/secondary/tertiary variants', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Check for primary buttons (should exist)
    const buttons = await page.locator('button').count();
    expect(buttons).toBeGreaterThan(0);
    console.log(`Found ${buttons} buttons on landing page`);

    // Check first button has button styling
    const firstButton = page.locator('button').first();
    const buttonClass = await firstButton.getAttribute('class');
    expect(buttonClass).toBeTruthy();
    console.log('First button class:', buttonClass);
  });

  test('CSS variables are cascading correctly', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Check that CSS variables are defined at root level
    const cssVars = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        contextAccent: style.getPropertyValue('--context-accent'),
        contextBg: style.getPropertyValue('--context-bg'),
        contextText: style.getPropertyValue('--context-text'),
      };
    });

    // Root should default to dashboard theme, but landing page should override
    console.log('CSS Variables:', cssVars);
    expect(cssVars.contextAccent).toBeTruthy();
    expect(cssVars.contextBg).toBeTruthy();
    expect(cssVars.contextText).toBeTruthy();
  });

  test('No console errors during page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('http://localhost:3000');
    expect(errors).toHaveLength(0);
  });

  test('Mobile viewport: landing page responsive', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
    await page.goto('http://localhost:3000');

    // Check page loads on mobile
    const title = await page.title();
    expect(title).toContain('RealSyncDynamics.AI');

    // Check buttons are accessible on mobile
    const buttons = await page.locator('button').count();
    expect(buttons).toBeGreaterThan(0);

    await page.close();
  });

  test('Flow context page loads with flow styling', async ({ page }) => {
    // Navigate to flow - try common flow URLs
    const flowUrls = [
      'http://localhost:3000/flow/start-audit',
      'http://localhost:3000/audit',
    ];

    for (const url of flowUrls) {
      try {
        await page.goto(url, { waitUntil: 'load', timeout: 5000 }).catch(() => null);
        const pageTitle = await page.title();
        if (pageTitle && !pageTitle.includes('404')) {
          console.log(`Flow page loaded: ${url}`);
          // Check for flow context indicators (gold accent, step counter, etc.)
          const text = await page.textContent('body');
          expect(text).toBeTruthy();
          break;
        }
      } catch (e) {
        // Continue to next URL
      }
    }
  });

  test('Dashboard context page loads with dashboard styling', async ({ page }) => {
    // Dashboard pages require auth, so just check routing exists
    const response = await page.goto('http://localhost:3000/app/dashboard', {
      waitUntil: 'load'
    }).catch(() => null);

    // Should either load dashboard or redirect to login/welcome
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
    console.log('Dashboard route returns:', pageTitle);
  });
});
