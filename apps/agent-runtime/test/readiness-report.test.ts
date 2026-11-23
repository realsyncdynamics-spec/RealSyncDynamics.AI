import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { VOICE_TOOL_BACKEND, VOICE_TOOL_EXECUTORS } from '../src/voice/tool-executors.js';
import { VOICE_WRITE_TOOLS } from '../src/voice/tool-gateway.js';
import { VOICE_TOOLS } from '../src/voice-tools.js';
import type { VoiceToolName } from '../src/voice-types.js';
import { createMemoryVoiceStore } from '../src/voice/voice-store.js';
import {
  VOICE_STORE_ENV_NAMES,
  assessVoiceToolReadiness,
  buildVoiceReadinessReport,
  createVoiceReadinessReport,
  listVoiceToolReadinessFacts,
  renderVoiceReadinessJson,
  renderVoiceReadinessMarkdown,
  runVoiceReadinessCli,
  type VoiceToolReadinessFact,
} from '../src/voice/readiness-report.js';

const SENTINEL_URL = 'https://sentinel.invalid/readiness-secret-url';
const SENTINEL_KEY = 'sentinel-service-role-value-9f3a';
const UNRELATED = 'unrelated-secret-value-should-not-leak';

const STORE_ENV = {
  SUPABASE_URL: SENTINEL_URL,
  SUPABASE_SERVICE_ROLE_KEY: SENTINEL_KEY,
  UNRELATED_SECRET: UNRELATED,
};

function fact(partial: Partial<VoiceToolReadinessFact> & Pick<VoiceToolReadinessFact, 'name'>): VoiceToolReadinessFact {
  return {
    writes: false,
    writeLocked: false,
    hasBackend: true,
    requiredEnv: VOICE_STORE_ENV_NAMES,
    steps: [],
    ...partial,
  };
}

function assertNoSecrets(text: string): void {
  assert.equal(text.includes(SENTINEL_URL), false);
  assert.equal(text.includes(SENTINEL_KEY), false);
  assert.equal(text.includes(UNRELATED), false);
  assert.equal(text.includes('sentinel'), false);
}

describe('Voice Readiness Report', () => {
  it('sortiert Werkzeuge deterministisch und unabhängig von der Eingabereihenfolge', () => {
    const facts = [
      fact({ name: 'schedule_appointment', writes: true, writeLocked: true, steps: ['T7', 'T5'] }),
      fact({ name: 'lookup_kb', hasBackend: false }),
      fact({ name: 'handoff_human', steps: ['T7'] }),
    ];
    const reversed = [...facts].reverse();
    const env = {};
    const a = renderVoiceReadinessJson(buildVoiceReadinessReport(facts, env));
    const b = renderVoiceReadinessJson(buildVoiceReadinessReport(reversed, env));
    assert.equal(a, b);
    const names = buildVoiceReadinessReport(facts, env).tools.map((row) => row.name);
    assert.deepEqual(names, ['handoff_human', 'lookup_kb', 'schedule_appointment']);
    assert.deepEqual(buildVoiceReadinessReport(facts, env).tools[0]?.steps, ['T7']);
    assert.deepEqual(buildVoiceReadinessReport(facts, env).tools[2]?.steps, ['T5', 'T7']);
  });

  it('fehlende oder leere Env-Namen führen zu not_configured', () => {
    const writeTool = fact({
      name: 'schedule_appointment',
      writes: true,
      writeLocked: true,
      hasBackend: true,
    });
    const readTool = fact({ name: 'lookup_live', writes: false, hasBackend: true });
    for (const env of [
      {},
      { SUPABASE_URL: SENTINEL_URL },
      { SUPABASE_URL: '   ', SUPABASE_SERVICE_ROLE_KEY: '   ' },
      { SUPABASE_URL: SENTINEL_URL, SUPABASE_SERVICE_ROLE_KEY: '' },
    ]) {
      assert.equal(assessVoiceToolReadiness(writeTool, env).state, 'not_configured');
      assert.equal(assessVoiceToolReadiness(readTool, env).state, 'not_configured');
      assert.equal(assessVoiceToolReadiness(readTool, env).ready, false);
    }
  });

  it('meldet schreibende Tools nie als ready, solange die Schreibsperre gilt', () => {
    const locked = fact({
      name: 'schedule_appointment',
      writes: true,
      writeLocked: true,
      hasBackend: true,
      steps: ['T5', 'T7'],
    });
    const withStore = assessVoiceToolReadiness(locked, STORE_ENV);
    assert.equal(withStore.state, 'write_tool_disabled');
    assert.equal(withStore.ready, false);
    assert.equal(withStore.access, 'write');

    const withoutStore = assessVoiceToolReadiness(locked, {});
    assert.equal(withoutStore.state, 'not_configured');
    assert.equal(withoutStore.ready, false);

    const catalogWriteWithoutLock = fact({
      name: 'create_ticket',
      writes: true,
      writeLocked: false,
      hasBackend: false,
    });
    const ticket = assessVoiceToolReadiness(catalogWriteWithoutLock, STORE_ENV);
    assert.equal(ticket.state, 'not_configured');
    assert.equal(ticket.ready, false);
    assert.equal(ticket.access, 'write');
  });

  it('ein Lese-Werkzeug mit Backend und gesetzten Env-Namen ist configured und ready', () => {
    const row = assessVoiceToolReadiness(
      fact({ name: 'lookup_live', writes: false, writeLocked: false, hasBackend: true }),
      STORE_ENV,
    );
    assert.equal(row.state, 'configured');
    assert.equal(row.ready, true);
    assert.equal(row.access, 'read');
    assert.deepEqual(row.env, ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL']);
  });

  it('gibt keine Env-Werte aus und hängt nicht am konkreten Wert', () => {
    const reportA = createVoiceReadinessReport(STORE_ENV);
    const reportB = createVoiceReadinessReport({
      SUPABASE_URL: 'other-url-value',
      SUPABASE_SERVICE_ROLE_KEY: 'other-key-value',
      UNRELATED_SECRET: UNRELATED,
    });
    assert.deepEqual(reportA, reportB);
    const markdown = renderVoiceReadinessMarkdown(reportA);
    const json = renderVoiceReadinessJson(reportA);
    assertNoSecrets(markdown);
    assertNoSecrets(json);
    assert.equal(json.includes('other-url-value'), false);
    assert.equal(json.includes('other-key-value'), false);
    assert.equal(markdown.includes('value'), false);
  });

  it('die Registry bleibt sortiert, schreibende Nora-Tools sind nicht ready', () => {
    const empty = createVoiceReadinessReport({});
    const present = createVoiceReadinessReport(STORE_ENV);
    const names = present.tools.map((row) => row.name);
    assert.deepEqual(names, [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    assert.deepEqual(
      names,
      ['create_ticket', 'export_transcript', 'handoff_human', 'lookup_kb', 'schedule_appointment'],
    );
    for (const row of [...empty.tools, ...present.tools]) {
      const spec = VOICE_TOOLS[row.name as VoiceToolName];
      if (spec.writes || VOICE_WRITE_TOOLS.has(row.name as VoiceToolName)) {
        assert.equal(row.ready, false);
        assert.equal(row.access, 'write');
      }
      assert.deepEqual(row.env, ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL']);
    }
    const byName = Object.fromEntries(present.tools.map((row) => [row.name, row]));
    assert.equal(byName.schedule_appointment?.state, 'write_tool_disabled');
    assert.equal(byName.lookup_kb?.state, 'not_configured');
    assert.equal(byName.create_ticket?.state, 'not_configured');
    assert.equal(byName.handoff_human?.state, 'not_configured');
    assert.equal(byName.export_transcript?.state, 'not_configured');
    assert.deepEqual(byName.schedule_appointment?.steps, ['T5', 'T7']);
    assert.deepEqual(byName.handoff_human?.steps, ['T7']);
    assert.deepEqual(byName.lookup_kb?.steps, []);
    assert.deepEqual(byName.create_ticket?.steps, []);
    assert.deepEqual(byName.export_transcript?.steps, []);
    for (const row of present.tools) {
      for (const step of row.steps) assert.match(step, /^T[1-8]$/);
    }
    assert.equal(empty.tools.every((row) => row.state === 'not_configured' && row.ready === false), true);
  });

  it('Backend-Karte und Executoren bleiben deckungsgleich', async () => {
    const names = Object.keys(VOICE_TOOLS).sort();
    assert.deepEqual(Object.keys(VOICE_TOOL_BACKEND).sort(), names);
    assert.deepEqual(Object.keys(VOICE_TOOL_EXECUTORS).sort(), names);
    assert.deepEqual(
      listVoiceToolReadinessFacts().map((item) => item.name),
      names,
    );
    const store = createMemoryVoiceStore();
    for (const name of names) {
      const tool = name as VoiceToolName;
      if (VOICE_TOOL_BACKEND[tool] !== 'none') {
        assert.equal(tool, 'schedule_appointment');
        continue;
      }
      const result = await VOICE_TOOL_EXECUTORS[tool]({
        tenantId: 't',
        botId: 'b',
        sessionId: 's',
        toolRequestId: 'r',
        args: {},
        store,
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.errorCode, 'not_configured');
    }
  });

  it('CLI akzeptiert nur --json und wiederholt keine Argumente', () => {
    const chunks: string[] = [];
    const errors: string[] = [];
    const code = runVoiceReadinessCli({
      argv: ['--json', SENTINEL_KEY],
      env: STORE_ENV,
      stdout: (chunk) => chunks.push(chunk),
      stderr: (chunk) => errors.push(chunk),
    });
    assert.equal(code, 2);
    assert.equal(chunks.join(''), '');
    const errorText = errors.join('');
    assert.match(errorText, /--json/);
    assert.equal(errorText.includes(SENTINEL_KEY), false);

    const ok: string[] = [];
    const okCode = runVoiceReadinessCli({
      argv: ['--json'],
      env: {},
      stdout: (chunk) => ok.push(chunk),
      stderr: () => undefined,
    });
    assert.equal(okCode, 0);
    const parsed = JSON.parse(ok.join('')) as { tools: Array<{ name: string }> };
    assert.deepEqual(
      parsed.tools.map((row) => row.name),
      ['create_ticket', 'export_transcript', 'handoff_human', 'lookup_kb', 'schedule_appointment'],
    );
  });

  it('der Prozess-Einstieg schreibt Markdown ohne Env-Werte', () => {
    const cli = fileURLToPath(new URL('../src/voice/readiness-report-cli.ts', import.meta.url));
    const tsx = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [tsx, cli], {
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        SUPABASE_URL: SENTINEL_URL,
        SUPABASE_SERVICE_ROLE_KEY: SENTINEL_KEY,
        UNRELATED_SECRET: UNRELATED,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\| schedule_appointment \| write \| write_tool_disabled \| nein \|/);
    assertNoSecrets(result.stdout);
    assertNoSecrets(result.stderr);
  });
});
