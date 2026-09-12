/**
 * Regression: auth resume path must honor ?next= on existing sessions and
 * must not steal checkout returns into SetupAssistant without resume.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { safeInternalPath } from '../../src/lib/safeInternalPath';

const WELCOME = readFileSync(resolve('src/pages/Welcome.tsx'), 'utf8');
const SETUP = readFileSync(resolve('src/features/onboarding/SetupAssistant.tsx'), 'utf8');
const CHECKOUT = readFileSync(resolve('src/features/billing/CheckoutPage.tsx'), 'utf8');
const PROTECTED = readFileSync(resolve('src/features/demo/ProtectedRoute.tsx'), 'utf8');
const APP = readFileSync(resolve('src/App.tsx'), 'utf8');
const REDIRECTS = readFileSync(resolve('public/_redirects'), 'utf8');

describe('safeInternalPath', () => {
  it('accepts relative app paths', () => {
    expect(safeInternalPath('/checkout/starter')).toBe('/checkout/starter');
    expect(safeInternalPath('/app/dashboard?plan=starter')).toBe('/app/dashboard?plan=starter');
  });

  it('rejects open redirects', () => {
    expect(safeInternalPath('//evil.example')).toBeNull();
    expect(safeInternalPath('https://evil.example')).toBeNull();
    expect(safeInternalPath(null)).toBeNull();
    expect(safeInternalPath('')).toBeNull();
  });
});

describe('Welcome — ?next= resume', () => {
  it('honors next on getSession mount, not only SIGNED_IN', () => {
    expect(WELCOME).toContain('getSession()');
    expect(WELCOME).toContain('resumeAfterAuth');
    // Both auth entry points share the same resume helper.
    expect(WELCOME).toMatch(/getSession[\s\S]*resumeAfterAuth/);
    expect(WELCOME).toMatch(/SIGNED_IN[\s\S]*resumeAfterAuth/);
  });

  it('never forces setup-assistant when next is present', () => {
    expect(WELCOME).toContain("navigate('/setup-assistant'");
    // setup-assistant navigation must be gated after nextParam early-return
    const setupIdx = WELCOME.indexOf("navigate('/setup-assistant'");
    const nextGuardIdx = WELCOME.lastIndexOf('if (nextParam)', setupIdx);
    expect(nextGuardIdx).toBeGreaterThan(-1);
    expect(nextGuardIdx).toBeLessThan(setupIdx);
  });

  it('keeps post-checkout wizard only when session= is set', () => {
    expect(WELCOME).toContain('isPostCheckoutWizard');
    expect(WELCOME).toContain('Boolean(sessionId)');
  });
});

describe('SetupAssistant — resume next', () => {
  it('reads ?next= and navigates there after finish/skip', () => {
    expect(SETUP).toContain('safeInternalPath');
    expect(SETUP).toContain('finishTarget');
    expect(SETUP).toContain('navigate(finishTarget');
    expect(SETUP).not.toMatch(/navigate\('\/app\/dashboard',\s*\{\s*replace:\s*true\s*\}\)/);
  });
});

describe('Checkout login copy', () => {
  it('does not claim automatic checkout start after login', () => {
    expect(CHECKOUT).not.toMatch(/Checkout startet automatisch/i);
    expect(CHECKOUT).toMatch(/Zustimmung und Bestätigen/i);
  });
});

describe('ProtectedRoute → canonical welcome', () => {
  it('redirects unauthenticated users to /welcome with next, not /demo-login', () => {
    expect(PROTECTED).toContain('/welcome?next=');
    expect(PROTECTED).not.toMatch(/Navigate to=\{?["'`]\/demo-login/);
  });
});

describe('Prototype auth leaks closed', () => {
  it('routes /os/login and /os/signup to /welcome', () => {
    expect(APP).toMatch(/path="\/os\/login"[^>]*Navigate to="\/welcome/);
    expect(APP).toMatch(/path="\/os\/signup"[^>]*Navigate to="\/welcome/);
  });

  it('edge-redirects /os/login and /os/signup for full page loads', () => {
    expect(REDIRECTS).toMatch(/\/os\/login\s+\/welcome\s+301/);
    expect(REDIRECTS).toMatch(/\/os\/signup\s+\/welcome\s+301/);
  });

  it('routes /demo-login to /welcome (no parallel password login)', () => {
    expect(APP).toMatch(/path="\/demo-login"[^>]*Navigate to="\/welcome/);
    expect(REDIRECTS).toMatch(/\/demo-login\s+\/welcome\s+301/);
  });
});

describe('Canonical dashboard only', () => {
  it('aliases /app/overview and duplicate /app/home to /app/dashboard', () => {
    expect(APP).toMatch(/path="\/app\/overview"[^>]*Navigate to="\/app\/dashboard"/);
    // First /app/home registration must be a Navigate (not a second shell).
    const homeLine = APP.split('\n').find((l) => l.includes('path="/app/home"')) ?? '';
    expect(homeLine).toContain('Navigate to="/app/dashboard"');
  });
});

describe('Checkout invalid-plan copy is monthly-only', () => {
  it('does not advertise yearly or scale as available checkout plans', () => {
    expect(CHECKOUT).toContain('starter (79');
    expect(CHECKOUT).toContain('growth (249');
    expect(CHECKOUT).toContain('agency (699');
    expect(CHECKOUT).not.toMatch(/monatlich oder jährlich/);
    expect(CHECKOUT).not.toMatch(/agency \/ scale/);
  });
});
