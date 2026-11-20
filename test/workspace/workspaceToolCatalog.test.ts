import { describe, expect, it } from 'vitest';
import {
  WORKSPACE_TOOLS, isWorkspaceToolRunnable, workspaceToolsFor,
} from '../../src/features/workspace/workspaceToolCatalog';

describe('Governance Workspace — Werkzeugkatalog (additiv)', () => {
  it('führt acht KI-Werkzeuge und vorhandene RealSync-Module getrennt', () => {
    expect(workspaceToolsFor('ki-werkzeuge')).toHaveLength(8);
    expect(workspaceToolsFor('realsync-module').length).toBeGreaterThanOrEqual(4);
    expect(new Set(WORKSPACE_TOOLS.map((tool) => tool.id)).size).toBe(WORKSPACE_TOOLS.length);
  });

  it('zeigt fehlende Generatoren ohne ausführbare Aktion', () => {
    for (const id of ['slides', 'tables', 'image', 'video', 'translation']) {
      const tool = WORKSPACE_TOOLS.find((entry) => entry.id === id);
      expect(tool).toBeDefined();
      expect(tool?.state).toBe('geplant');
      expect(tool?.action).toBe('none');
      expect(isWorkspaceToolRunnable(tool!)).toBe(false);
    }
  });

  it('verwendet vorhandene Governance- und Agenten-Routen', () => {
    expect(WORKSPACE_TOOLS.find((t) => t.id === 'documents')?.href).toBe('/app/documents');
    expect(WORKSPACE_TOOLS.find((t) => t.id === 'agents')?.href).toBe('/app/agents');
    expect(WORKSPACE_TOOLS.find((t) => t.id === 'evidence')?.href).toBe('/app/evidence');
  });

  it('deklariert nur vorhandene Modi oder absolute interne Routen als ausführbar', () => {
    for (const tool of WORKSPACE_TOOLS) {
      if (tool.state === 'geplant') expect(isWorkspaceToolRunnable(tool)).toBe(false);
      if (tool.action === 'route' && isWorkspaceToolRunnable(tool)) {
        expect(tool.href?.startsWith('/app/')).toBe(true);
      }
    }
  });

  it('ignoriert eine ungesicherte externe Navigation', () => {
    expect(isWorkspaceToolRunnable({
      id: 'voice', label: 'Extern', description: '', group: 'realsync-module',
      state: 'zu_pruefen', action: 'route', href: 'https://example.com',
    })).toBe(false);
  });
});
