import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Pflicht-Zähler dürfen RLS-/Netzfehler nicht als 0 schlucken', () => {
  it.each([
    'src/features/governance/incidentsApi.ts',
    'src/features/governance/dpiasApi.ts',
    'src/features/governance/approvalsApi.ts',
    'src/features/governance/vendorsApi.ts',
  ])('%s wirft bei error statt 0 zurückzugeben', (file) => {
    const source = readFileSync(file, 'utf8');
    expect(source).toMatch(/if \(error\) throw new Error\(error\.message\)/);
    expect(source).not.toMatch(/if \(error\) return 0/);
  });

  it('countOpenDsrs wirft bei total- und overdue-Fehler', () => {
    const source = readFileSync('src/features/governance/dsrApi.ts', 'utf8');
    expect(source).toContain('if (totalError) throw new Error(totalError.message)');
    expect(source).toContain('if (overdueError) throw new Error(overdueError.message)');
    expect(source).not.toMatch(/if \(error\) return 0/);
  });

  it('cockpitData treats rejected counts as unreliable for the score', () => {
    const source = readFileSync('src/features/governance/cockpit/cockpitData.ts', 'utf8');
    expect(source).toContain('computeGovernanceScoreIfReliable');
    expect(source).toContain('countsReliable');
  });

  it('caller dashboards do not let a badge-count throw blank the page', () => {
    const home = readFileSync('src/features/workspace/WorkspaceHome.tsx', 'utf8');
    const dash = readFileSync('src/features/governance/GovernanceDashboardView.tsx', 'utf8');
    const entry = readFileSync('src/features/governance/GovernanceHomeView.tsx', 'utf8');
    expect(home).toContain('Promise.allSettled');
    expect(dash).toContain('Promise.allSettled');
    expect(entry).toContain('Promise.allSettled');
    expect(entry).toContain('r.status === \'fulfilled\' ? r.value : []');
  });
});
