import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const view = readFileSync('src/features/governance/risks/RiskCenterView.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');

describe('RiskCenterView — keine Demo-Daten im Live-Pfad', () => {
  it('seeden nicht mit atelier-nord', () => {
    expect(view).not.toMatch(/atelier-nord/i);
  });

  it('startet leer und ersetzt nie durch Mock bei leerer Incident-Liste', () => {
    expect(view).toContain('useState<Risk[]>([])');
    expect(view).toContain('incidents.map(incidentToRisk)');
    expect(view).not.toContain('if (incidents.length > 0)');
    expect(view).not.toContain('keep mock');
    expect(view).not.toContain('useState<Risk[]>(RISKS)');
    expect(view).toContain('Noch keine Vorfälle');
  });

  it('verwechselt einen Ladefehler nicht mit einem leeren Mandanten', () => {
    expect(view).toContain('risk-center-unavailable');
    expect(view).toContain('Risiken nicht verfügbar');
    expect(view).not.toMatch(/catch\s*\([^)]*\)\s*=>\s*\{[^}]*setActiveRisks\(\[\]\)/s);
  });

  it('leitet Kategorie-Zähler aus den geladenen Risiken ab', () => {
    expect(view).toContain('countByCategory');
    expect(view).not.toContain('CATEGORY_COUNTS');
  });
});

describe('/app/risks ist auth-gegatet', () => {
  it('hängt hinter AppGate, analog zum Evidence Vault', () => {
    const route = app.match(/<Route\s+path="\/app\/risks"(?!-)[\s\S]*?\/>/);
    expect(route, 'Route /app/risks nicht gefunden').toBeTruthy();
    expect(route?.[0]).toContain('<AppGate>');
    expect(route?.[0]).toContain('RiskCenterView');
  });
});
