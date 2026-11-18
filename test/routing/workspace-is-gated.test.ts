// /app/workspace (Governance Workspace mit REA-Prüfpfad) hängt am selben
// Schalter wie /app/assistant und lädt den Workspace nur über die Route.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const app = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf-8');
const route = readFileSync(resolve(ROOT, 'src/features/workspace/GovernanceWorkspaceRoute.tsx'), 'utf-8');
const workspace = readFileSync(resolve(ROOT, 'src/features/workspace/GovernanceWorkspace.tsx'), 'utf-8');

describe('/app/workspace', () => {
  it('liegt hinter AppGate und lädt nur die Route-Hülle', () => {
    const line = app.split('\n').find((l) => l.includes('path="/app/workspace"')) ?? '';
    expect(line).toContain('<AppGate>');
    expect(line).toContain('GovernanceWorkspaceRoute');
    expect(app).not.toMatch(/import\(['"][^'"]*workspace\/GovernanceWorkspace['"]\)/);
  });

  it('prüft den Governance-AI-Schalter vor dem Laden', () => {
    expect(route).toContain('isGovernanceAiEnabled()');
    expect(route).toContain('GovernanceAiUnavailable');
  });

  it('nutzt nur Nutzer-Session und keinen Service-Role-Pfad', () => {
    expect(workspace).not.toMatch(/service_role|SERVICE_ROLE|x-internal-key/);
    expect(workspace).toContain('tenant_id: activeTenantId');
    expect(workspace).toContain('attestCall(');
  });

  it('sendet das Nutzer-JWT an den Gateway, nicht den Anon-Key als Bearer', () => {
    expect(workspace).toContain('authToken: currentAccessToken');
    expect(workspace).toContain('const client = userGatewayClient();');
  });

  it('nur die aktuelle Anfrage setzt den Ladezustand zurück', () => {
    expect(workspace).toMatch(/finally \{\n\s+if \(isCurrent\(\)\) \{/);
  });
});
