import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const view = readFileSync('src/features/governance/risks/RiskCenterView.tsx', 'utf8');

describe('RiskCenterView — keine Demo-Daten im Live-Pfad', () => {
  it('seeden nicht mit atelier-nord', () => {
    expect(view).not.toMatch(/atelier-nord/i);
  });

  it('startet leer und ersetzt nie durch Mock bei leerer Incident-Liste', () => {
    expect(view).toContain('useState<Risk[]>([])');
    expect(view).toContain('incidents.map(mapIncidentToRisk)');
    expect(view).not.toContain('if (incidents.length > 0)');
    expect(view).not.toContain('keep mock');
    expect(view).not.toContain('useState<Risk[]>(RISKS)');
  });

  it('leitet Kategorie-Zähler aus den geladenen Risiken ab', () => {
    expect(view).toContain('countRisksByCategory');
    expect(view).not.toContain('CATEGORY_COUNTS');
  });
});
