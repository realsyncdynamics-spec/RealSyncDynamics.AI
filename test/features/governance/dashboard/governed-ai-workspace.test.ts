import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PANEL = readFileSync(
  'src/features/governance/dashboard/GovernedAiWorkspacePanel.tsx',
  'utf8',
);
const DASHBOARD = readFileSync(
  'src/features/governance/dashboard/ComplianceStatusDashboard.tsx',
  'utf8',
);

describe('Governed AI Workspace shell', () => {
  it('bleibt Teil des kanonischen Compliance-Dashboards statt ein zweites Dashboard zu bauen', () => {
    expect(DASHBOARD).toContain("import { GovernedAiWorkspacePanel }");
    expect(DASHBOARD).toContain('<GovernedAiWorkspacePanel />');
    expect(PANEL).toContain('to="/app/assistant"');
  });

  it('modelliert Capability-Modi statt acht parallele Chatfenster', () => {
    for (const label of ['Browse & Research', 'Code & Build', 'Agent Mesh', 'Govern & Prove']) {
      expect(PANEL).toContain(label);
    }
    expect(PANEL).toContain('Fähigkeiten werden geroutet, Provider bleiben austauschbar');
  });

  it('trennt lokale, EU-private und governed-cloud Ausführung', () => {
    expect(PANEL).toContain('Device / Local');
    expect(PANEL).toContain('EU Private');
    expect(PANEL).toContain('Governed Cloud');
    expect(PANEL).toContain('/settings/ai-residency');
  });

  it('führt die gewünschten Provider nur als Lanes/Zieladapter, nicht als Live-Behauptung', () => {
    for (const provider of [
      'Ollama',
      'Mistral',
      'Claude',
      'GPT',
      'Gemini',
      'xAI / Grok',
      'Perplexity',
    ]) {
      expect(PANEL).toContain(provider);
    }
    expect(PANEL).toContain('bestehend + Zieladapter');
    expect(PANEL).toContain('Ausbauziel');
  });

  it('hält die Autorisierung außerhalb des Modells', () => {
    expect(PANEL).toContain(
      'Request → Identity → Tenant → Data class → Capability → Policy → Risk → Approval →',
    );
    expect(PANEL).toContain('ein Modell darf seine eigene Freigabe nicht erzeugen');
  });

  it('spricht Provider nie direkt aus dem Browser an', () => {
    expect(PANEL).not.toContain('fetch(');
    expect(PANEL).not.toContain('api.openai.com');
    expect(PANEL).not.toContain('api.anthropic.com');
    expect(PANEL).not.toContain('generativelanguage.googleapis.com');
    expect(PANEL).not.toContain('api.x.ai');
    expect(PANEL).not.toContain('api.perplexity.ai');
  });
});
