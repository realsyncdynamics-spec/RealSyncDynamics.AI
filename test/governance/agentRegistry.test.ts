import { describe, expect, it } from 'vitest';
import {
  AGENT_CATALOG,
  HARD_FORBIDDEN_WEB_ACTIONS,
  countByMaturity,
} from '../../src/features/governance/agents/agentCatalog';
import { AGENT_MESH } from '../../src/core/realsync-os/agentMesh';
import { getImplementation } from '../../src/product/implementation-status';

const byId = (id: string) => {
  const entry = AGENT_CATALOG.find((a) => a.id === id);
  if (!entry) throw new Error(`Katalog-Eintrag ${id} fehlt`);
  return entry;
};

describe('Agent-/Bot-Katalog (WP5)', () => {
  it('enthält die zehn geforderten Agenten- und Bot-Typen', () => {
    expect(AGENT_CATALOG.map((a) => a.name)).toEqual([
      'Compliance Agent',
      'Evidence Agent',
      'Security Agent',
      'Onboarding Agent',
      'Website Chatbot',
      'Voice Bot',
      'WhatsApp Bot',
      'Browser Agent',
      'Builder Agent',
      'Workflow Agent',
    ]);
  });

  it('IDs sind eindeutig', () => {
    const ids = AGENT_CATALOG.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Browser- und Builder-Agent: harte Verbote und Freigabe immer', () => {
    for (const id of ['browser-agent', 'builder-agent']) {
      const agent = byId(id);
      for (const action of HARD_FORBIDDEN_WEB_ACTIONS) {
        expect(agent.forbiddenActions, `${id} ${action}`).toContain(action);
      }
      expect(agent.reviewMode).toBe('always');
      expect(agent.allowedActions.some((a) => (HARD_FORBIDDEN_WEB_ACTIONS as readonly string[]).includes(a))).toBe(false);
    }
  });

  it('Reifegrad und runnable der Mesh-Agenten entsprechen AGENT_MESH', () => {
    const meshEntries = AGENT_CATALOG.filter((a) => a.statusSource.startsWith('agentMesh:'));
    expect(meshEntries.length).toBeGreaterThanOrEqual(4);
    for (const entry of meshEntries) {
      const meshId = entry.statusSource.slice('agentMesh:'.length);
      const mesh = AGENT_MESH.find((m) => m.id === meshId);
      expect(mesh, `Mesh-Agent ${meshId}`).toBeDefined();
      expect(entry.maturity).toBe(mesh!.maturity);
      expect(entry.runnable).toBe(mesh!.runnable);
    }
  });

  it('Reifegrad der übrigen Einträge entspricht implementation-status.ts; dort nie ausführbar', () => {
    for (const entry of AGENT_CATALOG.filter((a) => a.statusSource.startsWith('implementation-status:'))) {
      const item = getImplementation(entry.statusSource.slice('implementation-status:'.length));
      expect(item, entry.id).toBeDefined();
      expect(entry.maturity).toBe(item!.status);
      expect(entry.runnable).toBe(false);
    }
  });

  it('ohne belegte Quelle: coming-soon und nicht ausführbar', () => {
    for (const entry of AGENT_CATALOG.filter((a) => a.statusSource === 'none')) {
      expect(entry.maturity).toBe('coming-soon');
      expect(entry.runnable).toBe(false);
    }
  });

  it('kein Eintrag ist live ohne Beleg; nur Compliance ist ausführbar', () => {
    for (const entry of AGENT_CATALOG.filter((a) => a.maturity === 'live')) {
      expect(entry.statusSource).not.toBe('none');
    }
    expect(AGENT_CATALOG.filter((a) => a.runnable).map((a) => a.id)).toEqual(['compliance-agent']);
    expect(byId('compliance-agent').maturity).toBe('preview');
  });

  it('jeder Eintrag hat Owner, Zweck, Datenzugriff, erlaubte und verbotene Aktionen', () => {
    for (const a of AGENT_CATALOG) {
      expect(a.owner, a.id).not.toBe('');
      expect(a.purpose, a.id).not.toBe('');
      expect(a.dataAccess.length, a.id).toBeGreaterThan(0);
      expect(a.allowedActions.length, a.id).toBeGreaterThan(0);
      expect(a.forbiddenActions.length, a.id).toBeGreaterThan(0);
    }
  });

  it('countByMaturity summiert auf die Katalog-Größe', () => {
    const c = countByMaturity(AGENT_CATALOG);
    expect(c.live + c.preview + c['coming-soon']).toBe(AGENT_CATALOG.length);
  });
});
