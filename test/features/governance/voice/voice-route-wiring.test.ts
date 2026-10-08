/**
 * /app/voice must stay behind AppGate + GovernanceBrowserShell + lazy VoiceRouter.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APP = readFileSync(resolve('src/App.tsx'), 'utf8');
const SHELL_NAV = readFileSync(resolve('src/components/governance-os/shellNav.ts'), 'utf8');

describe('Voice route wiring', () => {
  it('lazy-loadet VoiceRouter', () => {
    expect(APP).toMatch(
      /lazy\(\(\) => import\('\.\/features\/governance\/voice\/VoiceRouter'\)/,
    );
  });

  it('hält /app/voice hinter AppGate und GovernanceBrowserShell', () => {
    const line = APP.split('\n').find((l) => l.includes('path="/app/voice"')) ?? '';
    expect(line).toContain('<AppGate>');
    expect(line).toContain('<GovernanceBrowserShell>');
    expect(line).toContain('<VoiceRouter');
  });

  it('hält /app/voice/:sessionId hinter AppGate und GovernanceBrowserShell', () => {
    const line = APP.split('\n').find((l) => l.includes('path="/app/voice/:sessionId"')) ?? '';
    expect(line).toContain('<AppGate>');
    expect(line).toContain('<GovernanceBrowserShell>');
    expect(line).toContain('<VoiceRouter');
  });

  it('registriert Voice in SHELL_NAV', () => {
    expect(SHELL_NAV).toContain("id: 'voice'");
    expect(SHELL_NAV).toContain("route: '/app/voice'");
  });
});
