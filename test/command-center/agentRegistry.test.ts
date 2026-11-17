import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTER, filterAgents, fromRow, GROK_SOLL_AGENTS, normalizeStatus, type AgentRegistryRow,
} from '../../src/features/command-center/agentRegistry';

const row = (p: Partial<AgentRegistryRow>): AgentRegistryRow => ({
  registry_id: 'autonomous:1', source: 'autonomous_agents', name: 'Drift', agent_type: 'monitoring',
  description: null, status: 'unknown', status_source: 'none', last_activity_at: null,
  current_run_id: null, current_run_status: null, last_error: null, ...p,
});

describe('normalizeStatus', () => {
  it('ohne belegte Quelle → unknown', () => {
    expect(normalizeStatus('working', 'none')).toBe('unknown');
    expect(normalizeStatus('active', null)).toBe('unknown');
  });
  it('offline (enabled=false) ist auch ohne Run belegt', () => {
    expect(normalizeStatus('offline', 'none')).toBe('offline');
  });
  it('belegter Status wird übernommen, Unbekanntes → unknown', () => {
    expect(normalizeStatus('error', 'autonomous_agent_runs')).toBe('error');
    expect(normalizeStatus('bogus', 'autonomous_agent_runs')).toBe('unknown');
  });
});

describe('fromRow', () => {
  it('mappt Run auf laufenden Auftrag', () => {
    const a = fromRow(row({ status: 'working', status_source: 'autonomous_agent_runs', current_run_id: 'abcdef1234', current_run_status: 'running' }));
    expect(a.status).toBe('working');
    expect(a.currentTask).toBe('Run abcdef12 (running)');
    expect(a.openDecisions).toBeNull();
  });
});

describe('Grok-Soll-Agenten', () => {
  it('haben nie einen Live-Status', () => {
    expect(GROK_SOLL_AGENTS.length).toBeGreaterThan(0);
    for (const a of GROK_SOLL_AGENTS) {
      expect(a.status).toBe('unknown');
      expect(a.statusSource).toBe('none');
      expect(a.lastActivityAt).toBeNull();
    }
  });
});

describe('filterAgents', () => {
  const agents = [...GROK_SOLL_AGENTS, fromRow(row({ name: 'Drift Agent', status: 'error', status_source: 'autonomous_agent_runs' }))];
  it('Suche nach Name/Beschreibung', () => {
    expect(filterAgents(agents, { ...EMPTY_FILTER, query: 'drift' }).map((a) => a.name)).toEqual(['Drift Agent']);
  });
  it('Statusfilter', () => {
    expect(filterAgents(agents, { ...EMPTY_FILTER, status: 'error' })).toHaveLength(1);
  });
  it('Typ- und Projektfilter', () => {
    expect(filterAgents(agents, { ...EMPTY_FILTER, type: 'grok-bot' })).toHaveLength(GROK_SOLL_AGENTS.length);
    expect(filterAgents(agents, { ...EMPTY_FILTER, project: 'RealSyncDynamics.AI' })).toHaveLength(GROK_SOLL_AGENTS.length);
  });
  it('unbekannte offene Entscheidungen zählen nicht als vorhanden', () => {
    expect(filterAgents(agents, { ...EMPTY_FILTER, onlyOpenDecisions: true })).toHaveLength(0);
  });
});

import { applySoll, runtimeStaticAgents, UNSET } from '../../src/features/command-center/agentRegistry';

describe('runtime_static (apps/agent-runtime)', () => {
  it('liefert alle Code-Agenten, Status immer unknown', () => {
    const r = runtimeStaticAgents();
    expect(r.length).toBeGreaterThan(0);
    for (const a of r) {
      expect(a.source).toBe('runtime_static');
      expect(a.status).toBe('unknown');
    }
  });
  it('applySoll setzt Projekt, aber keine erfundene Priorität', () => {
    const a = applySoll(runtimeStaticAgents()[0]!);
    expect(a.project).toBe('Governance Runtime');
    expect(a.priority).toBeNull();
    expect(a.status).toBe('unknown');
  });
  it('UNSET-Filter trifft Agenten ohne Projekt', () => {
    const dbAgent = fromRow(row({}));
    expect(filterAgents([dbAgent, applySoll(runtimeStaticAgents()[0]!)], { ...EMPTY_FILTER, project: UNSET })).toEqual([dbAgent]);
  });
});

import { sectionOf, SOLL_CONFIG } from '../../src/features/command-center/agentRegistry';

describe('Soll-Ist-Abgleich 30.10.2026', () => {
  const byId = (id: string) => GROK_SOLL_AGENTS.find((a) => a.registryId === `grok:${id}`);
  it('enthält die Paket-Karten mit echten Bot-IDs', () => {
    expect(byId('infra-manager')?.mappedBotIds).toEqual(['202942d8-e3b8-4c62-abba-6e3766514cbc']);
    expect(byId('monetization')?.mappedBotIds).toHaveLength(3);
    expect(byId('marketing-social')?.mappedBotIds?.length).toBeGreaterThanOrEqual(5);
    for (const id of ['grok-master', 'co-ceo-manager', 'hostinger-manager', 'dsgvo-check', 'vertical-voice', 'rsd-dashboard']) {
      expect(byId(id)).toBeTruthy();
    }
  });
  it('keine Gruppen und kein Dashboard-Duplikat als Karte', () => {
    const all = GROK_SOLL_AGENTS.flatMap((a) => a.mappedBotIds ?? []);
    for (const g of ['adb041be', '2e04fda9', '52d75e55', '273579fb']) {
      expect(all.some((id) => id.startsWith(g))).toBe(false);
    }
  });
  it('Prioritäten laut Paket', () => {
    expect(applySoll(byId('infra-manager')!).priority).toBe('P0');
    expect(applySoll(byId('monetization')!).priority).toBe('P1');
    expect(applySoll(byId('marketing-social')!).priority).toBe('P2');
    expect(Object.keys(SOLL_CONFIG).every((k) => GROK_SOLL_AGENTS.some((a) => a.registryId === k))).toBe(true);
  });
  it('Abschnitte: Grok-Bots vs. Produkt-Agenten', () => {
    expect(sectionOf(GROK_SOLL_AGENTS[0]!)).toBe('grok_bots');
    for (const a of runtimeStaticAgents()) expect(sectionOf(a)).toBe('product_agents');
    expect(sectionOf({ source: 'agent_profiles' })).toBe('product_agents');
  });
});
