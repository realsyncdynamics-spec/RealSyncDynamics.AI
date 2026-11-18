/**
 * RealOS-Einstieg (Owner-Freigabe 18.11.2026):
 * `/app` und der Login-Rücksprung wiederkehrender Nutzer führen auf
 * `/app/start`; das Dashboard bleibt unter `/app/dashboard` erreichbar.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APP = readFileSync(resolve('src/App.tsx'), 'utf8');
const WELCOME = readFileSync(resolve('src/pages/Welcome.tsx'), 'utf8');
const SIDEBAR = readFileSync(resolve('src/components/governance-os/GovernanceSidebar.tsx'), 'utf8');

const routeLine = (path: string) =>
  APP.split('\n').find((line) => line.includes(`path="${path}"`)) ?? '';

describe('RealOS-Einstieg', () => {
  it('/app leitet auf /app/start um', () => {
    expect(routeLine('/app')).toContain('<Navigate to="/app/start" replace />');
  });

  it('/app/start liegt hinter AppGate in der Shell', () => {
    const line = routeLine('/app/start');
    expect(line).toContain('<AppGate>');
    expect(line).toContain('<GovernanceBrowserShell>');
    expect(line).toContain('<RealOsStart />');
  });

  it('das Dashboard bleibt erreichbar', () => {
    expect(routeLine('/app/dashboard')).toContain('DashboardRouter');
  });

  it('wiederkehrende Nutzer landen nach dem Login auf /app/start', () => {
    expect(WELCOME).toContain("navigate('/app/start', { replace: true })");
    expect(WELCOME).not.toContain("navigate('/app/dashboard', { replace: true })");
  });

  it('die Seitenleiste trägt den Namen RealOS und führt zur Startfläche', () => {
    expect(SIDEBAR).toContain('<span className="rs-side__product">RealOS</span>');
    expect(SIDEBAR).toContain('<Link to="/app/start" className="rs-side__brand"');
  });
});
