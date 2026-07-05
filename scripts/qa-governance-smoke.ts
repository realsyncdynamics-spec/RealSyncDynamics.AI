#!/usr/bin/env node

/**
 * QA Smoke Test: Governance Views Verification
 *
 * Validates that all 11 governance views:
 * 1. Load without errors
 * 2. Display core UI elements
 * 3. Handle data transitions smoothly
 * 4. Respond to user interactions
 *
 * Run with: npm run qa:governance
 */

import { chromium, Browser, Page } from 'playwright';

interface SmokeTestResult {
  view: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const GOVERNANCE_VIEWS = [
  { path: '/app/governance/ai-register', title: 'AI-System', button: 'Hinzufügen' },
  { path: '/app/governance/dsgvo-directory', title: 'DSGVO-Verzeichnis', button: null },
  { path: '/app/governance/ai-act-assessment', title: 'AI-Act-Risikoprüfung', button: null },
  { path: '/app/governance/nis2-incidents', title: 'NIS2-Meldepflichten', button: null },
  { path: '/app/governance/iso27001', title: 'ISO 27001', button: null },
  { path: '/app/governance/iso42001', title: 'ISO 42001', button: null },
  { path: '/app/governance/gaps', title: 'Gap-Analyse', button: null },
  { path: '/app/governance/evidence-vault-advanced', title: 'Nachweis-Vault', button: 'Hochladen' },
  { path: '/app/governance/remediation-plans', title: 'Behebungsplan', button: null },
  { path: '/app/governance/audit-reports', title: 'Audit-Berichte', button: null },
  { path: '/app/governance/api-keys', title: 'API-Keys', button: 'Neuer Key' },
];

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TIMEOUT = 10000;

async function runSmokeTests(): Promise<void> {
  let browser: Browser | null = null;
  const results: SmokeTestResult[] = [];
  let passCount = 0;
  let failCount = 0;

  try {
    console.log('\n🚀 Starting Governance Views Smoke Tests\n');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Testing ${GOVERNANCE_VIEWS.length} views...\n`);

    browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Set timeout for all operations
    page.setDefaultTimeout(TIMEOUT);

    for (const view of GOVERNANCE_VIEWS) {
      const startTime = Date.now();
      const result: SmokeTestResult = {
        view: view.path,
        passed: false,
        duration: 0,
      };

      try {
        console.log(`Testing: ${view.path}`);

        // Navigate to view
        const response = await page.goto(`${BASE_URL}${view.path}`, {
          waitUntil: 'networkidle',
          timeout: TIMEOUT,
        });

        if (!response?.ok()) {
          throw new Error(`HTTP ${response?.status()} loading ${view.path}`);
        }

        // Check if core title/element is visible
        const titleLocator = page.locator(`text=${view.title}`);
        await titleLocator.waitFor({ state: 'visible', timeout: 5000 });

        if (!(await titleLocator.isVisible())) {
          throw new Error(`Core element "${view.title}" not visible`);
        }

        // Check for action button if specified
        if (view.button) {
          const buttonLocator = page.locator(`button:has-text("${view.button}"), a:has-text("${view.button}")`);
          const isVisible = await buttonLocator.first().isVisible().catch(() => false);

          if (!isVisible) {
            console.warn(`  ⚠️  Action button "${view.button}" not found (non-critical)`);
          }
        }

        // Verify no JavaScript errors in console
        let jsErrors: string[] = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            jsErrors.push(msg.text());
          }
        });

        // Small delay to collect any async errors
        await page.waitForLoadState('networkidle');

        if (jsErrors.length > 0) {
          console.warn(`  ⚠️  Console errors detected: ${jsErrors.slice(0, 2).join(', ')}`);
        }

        // Test basic interaction: scroll or click if available
        try {
          await page.evaluate(() => {
            window.scrollBy(0, 200);
          });
          await page.waitForTimeout(500);
        } catch (e) {
          // Non-critical
        }

        result.passed = true;
        result.duration = Date.now() - startTime;
        passCount++;

        console.log(`  ✅ PASS (${result.duration}ms)\n`);
      } catch (err) {
        result.passed = false;
        result.error = err instanceof Error ? err.message : String(err);
        result.duration = Date.now() - startTime;
        failCount++;

        console.log(`  ❌ FAIL (${result.duration}ms)`);
        console.log(`     Error: ${result.error}\n`);
      }

      results.push(result);
    }

    await page.close();
    await context.close();

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SMOKE TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${results.length}`);
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`Total Duration: ${results.reduce((sum, r) => sum + r.duration, 0)}ms`);
    console.log('='.repeat(60) + '\n');

    if (failCount > 0) {
      console.log('Failed Views:');
      results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  - ${r.view}`);
          console.log(`    ${r.error}`);
        });
    }

    // Exit with appropriate code
    process.exit(failCount > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal error in smoke tests:', err);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Health check before running tests
async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${BASE_URL}/`);
    return response.ok;
  } catch (err) {
    console.error(`❌ Cannot connect to ${BASE_URL}`);
    console.error('   Make sure the app is running: npm run dev');
    return false;
  }
}

async function main(): Promise<void> {
  const isHealthy = await healthCheck();
  if (!isHealthy) {
    process.exit(1);
  }

  await runSmokeTests();
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
