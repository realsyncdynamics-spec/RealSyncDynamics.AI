/**
 * Unterkategorien der Seitenleiste: Kein Hauptbereich und kein Modul darf
 * beim Gruppieren verloren gehen.
 */
import { describe, expect, it } from 'vitest';
import { SHELL_NAV, SHELL_NAV_ROUTES } from '../../../src/components/governance-os/shellNav';
import { TAB_MODULES } from '../../../src/components/governance-os/governanceModules';
import { groupShellNav, SHELL_NAV_GROUPS } from '../../../src/components/governance-os/shellNavGroups';
import { matchAgents, mentionQuery } from '../../../src/features/governance/dashboard/AgentComposer';

describe('groupShellNav', () => {
  const more = TAB_MODULES.filter((m) => !SHELL_NAV_ROUTES.has(m.route));
  const groups = groupShellNav(SHELL_NAV, more);

  it('enthält jeden Hauptbereich genau einmal', () => {
    const ids = groups.flatMap((g) => g.shell.map((s) => s.id));
    expect(ids.sort()).toEqual(SHELL_NAV.map((s) => s.id).sort());
  });

  it('enthält jedes weitere Modul genau einmal', () => {
    const ids = groups.flatMap((g) => g.modules.map((m) => m.id));
    expect(ids.sort()).toEqual(more.map((m) => m.id).sort());
  });

  it('beginnt mit „Start" und der Übersicht', () => {
    expect(groups[0].group.id).toBe('start');
    expect(groups[0].shell[0].id).toBe('overview');
  });

  it('ordnet jede Modul-ID höchstens einer Gruppe zu', () => {
    const all = SHELL_NAV_GROUPS.flatMap((g) => g.modules);
    expect(new Set(all).size).toBe(all.length);
  });

  it('sammelt unbekannte Module unter „Weitere"', () => {
    const extra = groupShellNav(SHELL_NAV, [{ id: 'neu' }]);
    expect(extra.at(-1)?.group.id).toBe('other');
    expect(extra.at(-1)?.modules.map((m) => m.id)).toEqual(['neu']);
  });
});

describe('AgentComposer — @-Auswahl', () => {
  it('erkennt eine offene @-Abfrage nur am Textende', () => {
    expect(mentionQuery('Bitte prüfen @dsg')).toBe('dsg');
    expect(mentionQuery('@')).toBe('');
    expect(mentionQuery('mail@firma.de prüfen')).toBeNull();
    expect(mentionQuery('@DSGVO fertig ')).toBeNull();
  });

  it('findet Agenten über Name oder ID', () => {
    expect(matchAgents('dsgvo')[0].id).toBe('dsgvo');
    expect(matchAgents('aiact').map((a) => a.id)).toContain('ai-act');
    expect(matchAgents('').length).toBeLessThanOrEqual(6);
  });
});
