// AI-OS-Berichtslogik und GitHub-Client (Budget, Wiederholungen) — ohne Netz.
import { describe, expect, it, vi } from 'vitest';
import {
  checkKnowledgeNotes,
  collectGithubStatus,
  collectSecurityInfra,
  createGithubClient,
  findClaimGaps,
  GithubBudgetExceeded,
  latestPerWorkflow,
  parseFrontmatter,
  renderMarkdown,
  summarizeChecks,
  weeklyStats,
  type GhPull,
  type GhWorkflowRun,
  type GithubClient,
} from '../../packages/ai-os-core/src/index';

const NOW = new Date('2026-10-15T12:00:00Z');

const run = (over: Partial<GhWorkflowRun>): GhWorkflowRun => ({
  id: 1, name: 'CI', path: '.github/workflows/ci.yml', head_branch: 'main', event: 'push',
  status: 'completed', conclusion: 'success', created_at: '2026-10-15T10:00:00Z', html_url: 'https://x/1', ...over,
});
const pull = (over: Partial<GhPull>): GhPull => ({
  number: 1, title: 'feat: x', draft: false, html_url: 'https://x/pr/1',
  created_at: '2026-10-10T00:00:00Z', updated_at: '2026-10-14T00:00:00Z', head: { sha: 'abc', ref: 'b' }, ...over,
});

describe('summarizeChecks', () => {
  it('trennt grün, rot und laufend', () => {
    const s = summarizeChecks([
      { name: 'lint', status: 'completed', conclusion: 'success' },
      { name: 'unit', status: 'completed', conclusion: 'failure' },
      { name: 'e2e', status: 'in_progress', conclusion: null },
      { name: 'skip', status: 'completed', conclusion: 'skipped' },
    ]);
    expect(s).toEqual({ total: 4, passed: 2, failed: ['unit'], pending: 1, health: 'fail' });
  });

  it('ohne Checks ist der Zustand unbekannt, nicht grün', () => {
    expect(summarizeChecks([]).health).toBe('unknown');
  });
});

describe('latestPerWorkflow', () => {
  it('nimmt je Workflow den neuesten Lauf', () => {
    const rows = latestPerWorkflow([
      run({ id: 1, conclusion: 'failure', created_at: '2026-10-15T08:00:00Z' }),
      run({ id: 2, conclusion: 'success', created_at: '2026-10-15T09:00:00Z' }),
      run({ id: 3, name: 'E2E', path: '.github/workflows/e2e.yml', conclusion: 'failure' }),
    ]);
    expect(rows.map((r) => [r.workflow, r.health])).toEqual([['CI', 'ok'], ['E2E', 'fail']]);
  });
});

describe('weeklyStats', () => {
  it('liefert keine erfundene Quote ohne Läufe', () => {
    expect(weeklyStats([], [], [], new Date('2026-10-08T12:00:00Z')).mainSuccessRate).toBeNull();
  });

  it('zählt nur den Zeitraum', () => {
    const since = new Date('2026-10-08T12:00:00Z');
    const s = weeklyStats(
      [pull({ merged_at: '2026-10-10T00:00:00Z' }), pull({ number: 2, merged_at: '2026-10-01T00:00:00Z' }), pull({ number: 3, merged_at: null })],
      [pull({ created_at: '2026-10-09T00:00:00Z' }), pull({ number: 4, created_at: '2026-09-01T00:00:00Z' })],
      [run({ conclusion: 'success' }), run({ id: 2, conclusion: 'failure' }), run({ id: 3, status: 'in_progress', conclusion: null })],
      since,
    );
    expect(s).toEqual({ merged: 1, opened: 1, mainRuns: 2, mainRunsSucceeded: 1, mainSuccessRate: 50 });
  });
});

describe('findClaimGaps', () => {
  it('prüft nur live-Einträge und ignoriert Anker und PR-Verweise', () => {
    const gaps = findClaimGaps(
      [
        { id: 'a', name: 'A', status: 'live', evidence: ['src/a.ts#anker', 'PR #12'] },
        { id: 'b', name: 'B', status: 'live', evidence: ['src/fehlt.ts'] },
        { id: 'c', name: 'C', status: 'live', evidence: ['PR #3'] },
        { id: 'd', name: 'D', status: 'preview', evidence: ['src/fehlt.ts'] },
      ],
      (p) => p === 'src/a.ts',
    );
    expect(gaps).toEqual([
      { id: 'b', name: 'B', missing: ['src/fehlt.ts'] },
      { id: 'c', name: 'C', missing: ['(kein Dateibeleg)'] },
    ]);
  });
});

describe('Wissensnotizen', () => {
  it('liest Frontmatter', () => {
    const { meta, body } = parseFrontmatter('---\ntitle: X\nowner: "Betrieb"\nreviewed: 2026-10-01\n---\n# X\n');
    expect(meta).toEqual({ title: 'X', owner: 'Betrieb', reviewed: '2026-10-01' });
    expect(body).toBe('# X\n');
  });

  it('liest CRLF-Notizen, ignoriert ungültige Schlüssel und Zeilen ohne Doppelpunkt', () => {
    const { meta, body } = parseFrontmatter("---\r\ntitle: 'Y'\r\nowner-x: no\r\nnur text\r\nreviewed: 2026-10-02\r\n---\r\nRest");
    expect(meta).toEqual({ title: 'Y', reviewed: '2026-10-02' });
    expect(body).toBe('Rest');
  });

  it('läuft auch bei präparierten Zeilen linear (CodeQL js/polynomial-redos)', () => {
    const evil = `---\nA:${'\t'.repeat(50_000)}x\n${'B:'.repeat(20_000)}\n---\n`;
    const start = Date.now();
    parseFrontmatter(evil);
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('erkennt Begrenzer mit mehrfachem \\r und Leerzeichen am Zeilenende', () => {
    const { meta, body } = parseFrontmatter('---\r\r\ntitle: Z\n--- \r\nRest');
    expect(meta).toEqual({ title: 'Z' });
    expect(body).toBe('Rest');
  });

  it('ohne schließendes --- gilt der Text als Rumpf', () => {
    expect(parseFrontmatter('---\ntitle: X\n')).toEqual({ meta: {}, body: '---\ntitle: X\n' });
  });

  it('meldet fehlende Felder und veraltete Prüfdaten', () => {
    const issues = checkKnowledgeNotes(
      [
        { path: 'a.md', content: '---\ntitle: A\nowner: B\nreviewed: 2026-10-01\n---\n' },
        { path: 'b.md', content: '---\ntitle: B\nowner: B\nreviewed: 2026-01-01\n---\n' },
        { path: 'c.md', content: '# ohne Frontmatter' },
      ],
      NOW,
    );
    expect(issues.filter((i) => i.path === 'a.md')).toEqual([]);
    expect(issues.find((i) => i.path === 'b.md')?.problem).toMatch(/90 Tagen/);
    expect(issues.filter((i) => i.path === 'c.md')).toHaveLength(3);
  });

  it('die echten Notizen unter docs/ai-os sind vollständig', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const root = join(__dirname, '..', '..');
    const walk = (dir: string): string[] => readdirSync(join(root, dir)).flatMap((n) => {
      const p = `${dir}/${n}`;
      return statSync(join(root, p)).isDirectory() ? walk(p) : p.endsWith('.md') ? [p] : [];
    });
    const notes = walk('docs/ai-os').map((p) => ({ path: p, content: readFileSync(join(root, p), 'utf8') }));
    expect(notes.length).toBeGreaterThanOrEqual(5);
    expect(checkKnowledgeNotes(notes, NOW)).toEqual([]);
  });
});

describe('renderMarkdown', () => {
  it('maskiert Tabellenzeichen und zeigt Leerzustände', () => {
    const md = renderMarkdown({
      routine: 'x', title: 'T', generatedAt: 'now', health: 'warn', apiCalls: 2, data: {},
      sections: [
        { heading: 'Tabelle', table: { head: ['A'], rows: [['a|b']] } },
        { heading: 'Leer', lines: [], empty: 'Nichts.' },
      ],
    });
    expect(md).toContain('| a\\|b |');
    const escaped = renderMarkdown({
      routine: 'x', title: 'T', generatedAt: 'now', health: 'ok', apiCalls: 0, data: {},
      sections: [{ heading: 'Backslash', table: { head: ['A'], rows: [['a\\|b']] } }],
    });
    // Ein Backslash vor der Pipe darf das Maskieren nicht aufheben (CodeQL js/incomplete-sanitization).
    expect(escaped).toContain('| a\\\\\\|b |');
    expect(md).toContain('Nichts.');
    expect(md).toContain('GitHub-API-Aufrufe: 2');
  });
});

describe('createGithubClient', () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it('wiederholt 5xx begrenzt und hält das Budget ein', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(ok({ a: 1 }));
    const gh = createGithubClient({ token: 't', repo: 'o/r', maxCalls: 5, maxAttempts: 3, fetchImpl, sleep: async () => {} });
    await expect(gh.get('/pulls')).resolves.toEqual({ a: 1 });
    expect(gh.calls()).toBe(2);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.github.com/repos/o/r/pulls');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer t');
  });

  it('wiederholt 4xx nicht', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    const gh = createGithubClient({ token: 't', repo: 'o/r', maxCalls: 5, maxAttempts: 3, fetchImpl, sleep: async () => {} });
    await expect(gh.get('/contents/x')).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('bricht bei erschöpftem Budget ab', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => ok([]));
    const gh = createGithubClient({ token: 't', repo: 'o/r', maxCalls: 2, maxAttempts: 1, fetchImpl, sleep: async () => {} });
    await gh.get('/a');
    await gh.get('/b');
    await expect(gh.get('/c')).rejects.toBeInstanceOf(GithubBudgetExceeded);
  });

  it('lehnt ungültige Repository-Namen ab', () => {
    expect(() => createGithubClient({ token: 't', repo: 'x', maxCalls: 1, maxAttempts: 1 })).toThrow();
  });
});

function fakeClient(routes: Record<string, unknown>): GithubClient {
  let calls = 0;
  return {
    repo: 'o/r',
    calls: () => calls,
    get: async <T,>(path: string) => {
      calls += 1;
      const key = Object.keys(routes).find((k) => path.startsWith(k));
      if (!key) throw Object.assign(new Error(`no route ${path}`), { name: 'GithubApiError', status: 404 });
      return routes[key] as T;
    },
    send: async () => null,
  };
}

describe('Sammler', () => {
  it('collectGithubStatus: rote Checks an nicht-Entwürfen → Hinweis; rot auf main → Handlungsbedarf', async () => {
    const client = fakeClient({
      '/pulls?state=open': [pull({ number: 7, head: { sha: 's7', ref: 'b' } }), pull({ number: 8, draft: true, head: { sha: 's8', ref: 'c' } })],
      '/commits/s7/check-runs': { check_runs: [{ name: 'unit', status: 'completed', conclusion: 'failure' }] },
      '/commits/s8/check-runs': { check_runs: [] },
      '/actions/runs?branch=main': { workflow_runs: [run({})] },
    });
    const r = await collectGithubStatus(client, NOW, { maxCheckLookups: 10 });
    expect(r.health).toBe('warn');
    expect(r.apiCalls).toBe(4);
    expect(renderMarkdown(r)).toContain('rot: unit');
  });

  it('collectGithubStatus: Budget für Check-Abfragen wird respektiert', async () => {
    const client = fakeClient({
      '/pulls?state=open': [pull({ number: 1 }), pull({ number: 2, head: { sha: 'x', ref: 'y' } })],
      '/commits/': { check_runs: [] },
      '/actions/runs': { workflow_runs: [] },
    });
    const r = await collectGithubStatus(client, NOW, { maxCheckLookups: 1 });
    expect((r.data as { uncheckedPulls: number }).uncheckedPulls).toBe(1);
  });

  it('collectSecurityInfra: fehlender Guard-Lauf ist „ohne Daten", nicht grün', async () => {
    const client = fakeClient({
      '/actions/workflows/codeql.yml/runs': { workflow_runs: [run({ name: 'CodeQL', path: 'codeql.yml', conclusion: 'failure' })] },
      '/actions/workflows/': { workflow_runs: [] },
      '/pulls?state=open': [pull({ title: 'fix(security): x' })],
    });
    const r = await collectSecurityInfra(client, NOW);
    expect(r.health).toBe('fail');
    const guards = (r.data as { guards: Array<{ label: string; health: string }> }).guards;
    expect(guards.find((g) => g.label === 'CodeQL')?.health).toBe('fail');
    expect(guards.find((g) => g.label === 'Cron-Health')?.health).toBe('unknown');
    expect((r.data as { securityPulls: unknown[] }).securityPulls).toHaveLength(1);
  });
});
