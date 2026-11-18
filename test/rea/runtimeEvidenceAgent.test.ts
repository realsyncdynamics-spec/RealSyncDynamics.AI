import { describe, expect, it } from 'vitest';
import {
  attestAgentRun,
  attestCall,
  byteaToHex,
  sha256HexOf,
  type ReaChainRow,
  type ReaDataSource,
  type ReaEvidenceRow,
} from '../../src/features/rea/runtimeEvidenceAgent';

const TENANT = '11111111-1111-1111-1111-111111111111';
const TRACE = 'trace-abc';
const INPUT = 'Nutzer: Welche AI-Act-Pflichten gelten?';
const fast = { sleep: async () => {}, attempts: 3, delayMs: 0, now: () => new Date('2026-11-18T08:00:00Z') };

async function row(overrides: Partial<ReaEvidenceRow> = {}, evidence: Record<string, unknown> = {}): Promise<ReaEvidenceRow> {
  return {
    id: 'ev-1',
    event_type: 'ai:call',
    created_at: '2026-11-18T07:59:59Z',
    chain_index: 42,
    event_hash: '\\xdeadbeef',
    evidence: {
      request_id: TRACE,
      input_sha256: await sha256HexOf(INPUT),
      verdict: 'allow',
      residency: 'eu_local',
      provider_region: 'EU',
      tokens: { input: 10, output: 20, total: 30 },
      ...evidence,
    },
    ...overrides,
  };
}

function source(rows: ReaEvidenceRow[][], chain: ReaChainRow[] | Error = []): ReaDataSource & { calls: number } {
  const s = {
    calls: 0,
    async findEvidenceByTrace(tenantId: string, traceId: string) {
      expect(tenantId).toBe(TENANT);
      expect(traceId).toBe(TRACE);
      const data = rows[Math.min(s.calls, rows.length - 1)];
      s.calls++;
      return { data, error: null };
    },
    async verifyChain() {
      if (chain instanceof Error) return { data: null, error: { message: chain.message } };
      return { data: chain, error: null };
    },
  };
  return s;
}

const okChain: ReaChainRow[] = [
  { chain_index: 41, event_id: 'ev-0', hash_ok: true, link_ok: null },
  { chain_index: 42, event_id: 'ev-1', hash_ok: true, link_ok: true },
];

describe('REA attestCall', () => {
  it('belegt nur bei Eintrag, gleicher Prüfsumme und intakter Kette', async () => {
    const r = await attestCall(source([[await row()]], okChain), { tenantId: TENANT, traceId: TRACE, input: INPUT }, fast);
    expect(r.status).toBe('belegt');
    expect(r.inputHashMatches).toBe(true);
    expect(r.chain).toEqual({ hashOk: true, linkOk: true });
    expect(r.eventHashHex).toBe('deadbeef');
    expect(r.totalTokens).toBe(30);
  });

  it('ohne Mandant oder Trace: nicht_verfuegbar, keine Abfrage', async () => {
    const s = source([[]]);
    expect((await attestCall(s, { tenantId: null, traceId: TRACE, input: INPUT }, fast)).status).toBe('nicht_verfuegbar');
    expect((await attestCall(s, { tenantId: TENANT, traceId: null, input: INPUT }, fast)).status).toBe('nicht_verfuegbar');
    expect(s.calls).toBe(0);
  });

  it('wartet auf den nachgelagert geschriebenen Eintrag und meldet sonst ausstehend', async () => {
    const late = source([[], [], [await row()]], okChain);
    expect((await attestCall(late, { tenantId: TENANT, traceId: TRACE, input: INPUT }, fast)).status).toBe('belegt');
    expect(late.calls).toBe(3);

    const never = source([[]]);
    const r = await attestCall(never, { tenantId: TENANT, traceId: TRACE, input: INPUT }, fast);
    expect(r.status).toBe('ausstehend');
    expect(never.calls).toBe(3);
  });

  it('Prüfsummen-Abweichung ist abweichung, nie belegt', async () => {
    const r = await attestCall(source([[await row({}, { input_sha256: 'ff' })]], okChain), { tenantId: TENANT, traceId: TRACE, input: INPUT }, fast);
    expect(r.status).toBe('abweichung');
    expect(r.inputHashMatches).toBe(false);
  });

  it('fehlende Server-Prüfsumme ist abweichung', async () => {
    const r = await attestCall(source([[await row({}, { input_sha256: null })]], okChain), { tenantId: TENANT, traceId: TRACE, input: INPUT }, fast);
    expect(r.status).toBe('abweichung');
  });

  it('Kettenfehler am Eintrag ist abweichung', async () => {
    const broken: ReaChainRow[] = [okChain[0], { ...okChain[1], link_ok: false }];
    const r = await attestCall(source([[await row()]], broken), { tenantId: TENANT, traceId: TRACE, input: INPUT }, fast);
    expect(r.status).toBe('abweichung');
  });

  it('ungeprüfte Verknüpfung (link_ok null) außerhalb des Kettenanfangs ist nie belegt', async () => {
    const r = await attestCall(
      source([[await row()]], [{ chain_index: 42, event_id: 'ev-1', hash_ok: true, link_ok: null }]),
      { tenantId: TENANT, traceId: TRACE, input: INPUT },
      fast,
    );
    expect(r.status).toBe('nicht_verfuegbar');
  });

  it('nicht verankerter Eintrag bleibt ausstehend', async () => {
    const r = await attestCall(source([[await row({ chain_index: null, event_hash: null })]], okChain), { tenantId: TENANT, traceId: TRACE, input: INPUT }, fast);
    expect(r.status).toBe('ausstehend');
  });

  it('nicht erreichbare Kettenprüfung ist nicht_verfuegbar', async () => {
    const r = await attestCall(source([[await row()]], new Error('rpc')), { tenantId: TENANT, traceId: TRACE, input: INPUT }, fast);
    expect(r.status).toBe('nicht_verfuegbar');
  });

  it('doppelte Trace-ID ist abweichung', async () => {
    const r = await attestCall(source([[await row(), await row({ id: 'ev-2' })]], okChain), { tenantId: TENANT, traceId: TRACE, input: INPUT }, fast);
    expect(r.status).toBe('abweichung');
  });

  it('erster Eintrag der Kette: link n/a, trotzdem belegt', async () => {
    const r = await attestCall(
      source([[await row({ chain_index: 1 })]], [{ chain_index: 1, event_id: 'ev-1', hash_ok: true, link_ok: null }]),
      { tenantId: TENANT, traceId: TRACE, input: INPUT },
      fast,
    );
    expect(r.status).toBe('belegt');
    expect(r.chain?.linkOk).toBeNull();
  });

  it('Datenbankfehler wirft nicht', async () => {
    const s: ReaDataSource = {
      findEvidenceByTrace: async () => { throw new Error('netz'); },
      verifyChain: async () => ({ data: [], error: null }),
    };
    expect((await attestCall(s, { tenantId: TENANT, traceId: TRACE, input: INPUT }, fast)).status).toBe('nicht_verfuegbar');
  });
});

describe('Hilfsfunktionen', () => {
  it('sha256HexOf entspricht dem bekannten Testvektor', async () => {
    expect(await sha256HexOf('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('byteaToHex entfernt das PostgREST-Präfix', () => {
    expect(byteaToHex('\\xab')).toBe('ab');
    expect(byteaToHex(null)).toBeUndefined();
  });
});

describe('REA attestAgentRun (Assistent der Shell)', () => {
  const SESSION = 'sess-1';
  const sentAt = new Date('2026-11-18T08:00:00Z');
  const runRow = (user_message: string) => ({
    id: 'run-1',
    created_at: '2026-11-18T08:00:02Z',
    user_message,
    llm_provider: 'anthropic',
    llm_model: 'claude',
    input_tokens: 10,
    output_tokens: 5,
    outcome: 'success',
  });
  const src = (pages: ReturnType<typeof runRow>[][]) => {
    let calls = 0;
    return {
      get calls() { return calls; },
      async findAgentRuns(tenantId: string, sessionId: string, sinceIso: string) {
        expect(tenantId).toBe(TENANT);
        expect(sessionId).toBe(SESSION);
        expect(sinceIso).toBe('2026-11-18T07:58:00.000Z');
        const data = pages[Math.min(calls, pages.length - 1)];
        calls++;
        return { data, error: null };
      },
    };
  };

  it('höchstens protokolliert, nie belegt', async () => {
    const r = await attestAgentRun(src([[runRow(INPUT)]]), { tenantId: TENANT, sessionId: SESSION, message: INPUT, sentAt }, fast);
    expect(r.status).toBe('protokolliert');
    expect(r.inputHashMatches).toBe(true);
    expect(r.totalTokens).toBe(15);
  });

  it('vergleicht gegen die auf 4.000 Zeichen gekürzte Nachricht', async () => {
    const long = 'x'.repeat(5000);
    const r = await attestAgentRun(src([[runRow(long.slice(0, 4000))]]), { tenantId: TENANT, sessionId: SESSION, message: long, sentAt }, fast);
    expect(r.status).toBe('protokolliert');
  });

  it('fremde Nachricht in der Sitzung zählt nicht → ausstehend', async () => {
    const s = src([[runRow('andere Frage')]]);
    const r = await attestAgentRun(s, { tenantId: TENANT, sessionId: SESSION, message: INPUT, sentAt }, fast);
    expect(r.status).toBe('ausstehend');
    expect(s.calls).toBe(3);
  });

  it('ohne Sitzung oder bei Fehler: nicht_verfuegbar', async () => {
    expect((await attestAgentRun(src([[]]), { tenantId: TENANT, sessionId: null, message: INPUT, sentAt }, fast)).status).toBe('nicht_verfuegbar');
    const broken = { findAgentRuns: async () => ({ data: null, error: { message: 'rls' } }) };
    expect((await attestAgentRun(broken, { tenantId: TENANT, sessionId: SESSION, message: INPUT, sentAt }, fast)).status).toBe('nicht_verfuegbar');
  });
});
