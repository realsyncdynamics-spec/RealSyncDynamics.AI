import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const workspace = readFileSync(resolve(root, 'src/features/workspace/GovernanceWorkspace.tsx'), 'utf8');
const launcher = readFileSync(resolve(root, 'src/features/workspace/WorkspaceToolGrid.tsx'), 'utf8');

describe('Workspace-Launcher als additive REA-Integration', () => {
  it('verwendet genau den bestehenden Composer – oben beim Start, unten im Chat', () => {
    expect(workspace.match(/id="workspace-input"/g)).toHaveLength(1);
    expect(workspace).toContain('const composer = (');
    expect(workspace).toContain('{composer}');
    expect(workspace).toContain('{turns.length > 0 && composer}');
    expect(workspace).toContain('<WorkspaceToolGrid');
  });

  it('verändert keine Gateway-/REA-Verträge und erstellt kein Ersatzbackend', () => {
    expect(workspace).toContain("edgeFunctionUrl('ai-gateway')");
    expect(workspace).toContain('tenant_id: activeTenantId');
    expect(workspace).toContain('trace_id: traceId');
    expect(workspace).toContain('attestCall(');
    expect(workspace).toContain('codeEntryState(prompt)');
    for (const forbidden of ['fetch(', 'createClient', 'service_role', 'SUPABASE_SERVICE_ROLE']) {
      expect(launcher).not.toContain(forbidden);
    }
  });

  it('deaktiviert fehlende Werkzeuge und öffnet vorhandene Ziele nur über Links', () => {
    expect(launcher).toContain('isWorkspaceToolRunnable(tool)');
    expect(launcher).toContain('aria-disabled="true"');
    expect(launcher).toContain('to={tool.href}');
    for (const forbidden of ['window.location', 'window.open']) {
      expect(launcher).not.toContain(forbidden);
    }
  });
});
