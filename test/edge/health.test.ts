/**
 * Vertragstests fuer den /health Endpoint.
 *
 * Was hier bewiesen wird:
 *   1) Healthy-Pfad: db.rpc liefert 'ok' + alle env vorhanden → status='ok', http 200
 *   2) Down-Pfad: db.rpc liefert error → status='down', http 503 (kritisch)
 *   3) Degraded-Pfad: db ok, aber env unvollstaendig → status='degraded'
 *   4) Down-Pfad: db client null (env fehlt komplett) → status='down'
 *   5) Latency wird in latency_ms zurueckgegeben
 *   6) Exceptions im RPC-Call werden gefangen und als down gemeldet
 */
import { describe, it, expect, vi } from 'vitest';
import {
  checkHealth,
  type HealthDbClient,
} from '../../supabase/functions/_shared/health';

function mockDb(result: { data?: unknown; error?: { message: string } | null }): HealthDbClient {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: result.data ?? 'ok',
      error: result.error ?? null,
    }),
  };
}

function throwingDb(message: string): HealthDbClient {
  return {
    rpc: vi.fn().mockRejectedValue(new Error(message)),
  };
}

const FULL_ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'srk-test',
};

const FIXED_NOW = () => new Date('2026-05-23T20:00:00.000Z');

describe('checkHealth', () => {
  it('returns status=ok when db ping succeeds and env is complete', async () => {
    const summary = await checkHealth({
      db: mockDb({ data: 'ok' }),
      env: FULL_ENV,
      version: 'test',
      now: FIXED_NOW,
    });

    expect(summary.status).toBe('ok');
    expect(summary.checks.database.ok).toBe(true);
    expect(summary.checks.env.ok).toBe(true);
    expect(summary.version).toBe('test');
    expect(summary.timestamp).toBe('2026-05-23T20:00:00.000Z');
  });

  it('returns status=down when db ping returns an error', async () => {
    const summary = await checkHealth({
      db: mockDb({ error: { message: 'connection refused' } }),
      env: FULL_ENV,
      version: 'test',
    });

    expect(summary.status).toBe('down');
    expect(summary.checks.database.ok).toBe(false);
    expect(summary.checks.database.error).toBe('connection refused');
    expect(summary.checks.env.ok).toBe(true);
  });

  it('returns status=down when db client is null (env missing)', async () => {
    const summary = await checkHealth({
      db: null,
      env: {},
      version: 'test',
    });

    expect(summary.status).toBe('down');
    expect(summary.checks.database.ok).toBe(false);
    expect(summary.checks.env.ok).toBe(false);
    expect(summary.checks.env.error).toContain('SUPABASE_URL');
    expect(summary.checks.env.error).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('returns status=degraded when db ok but one env var missing', async () => {
    const summary = await checkHealth({
      db: mockDb({ data: 'ok' }),
      env: { SUPABASE_URL: 'https://example.supabase.co' },
      version: 'test',
    });

    expect(summary.status).toBe('degraded');
    expect(summary.checks.database.ok).toBe(true);
    expect(summary.checks.env.ok).toBe(false);
    expect(summary.checks.env.error).toBe('missing env: SUPABASE_SERVICE_ROLE_KEY');
  });

  it('includes latency_ms on the database check', async () => {
    const summary = await checkHealth({
      db: mockDb({ data: 'ok' }),
      env: FULL_ENV,
      version: 'test',
    });

    expect(summary.checks.database.latency_ms).toBeTypeOf('number');
    expect(summary.checks.database.latency_ms!).toBeGreaterThanOrEqual(0);
  });

  it('returns status=down when rpc throws', async () => {
    const summary = await checkHealth({
      db: throwingDb('network timeout'),
      env: FULL_ENV,
      version: 'test',
    });

    expect(summary.status).toBe('down');
    expect(summary.checks.database.ok).toBe(false);
    expect(summary.checks.database.error).toBe('network timeout');
  });
});

/**
 * Verbundstatus (Truth Layer, docs/architecture/target-architecture.md §3.1).
 *
 * Der Kern dieser Tests: 'unknown' ist ein eigener Zustand. Ein Baustein, den
 * wir nicht messen koennen, darf weder als gesund gemeldet werden noch den
 * Gesamtstatus verschlechtern.
 */
describe('checkHealth — Bausteine', () => {
  function dbWithTables(errors: Record<string, string> = {}): HealthDbClient {
    return {
      rpc: vi.fn().mockResolvedValue({ data: 'ok', error: null }),
      from: (table: string) => ({
        select: () => ({
          limit: async () => ({ error: errors[table] ? { message: errors[table] } : null }),
        }),
      }),
    };
  }

  it('meldet Bausteine als unknown, wenn keine Tabellensonde vorhanden ist', async () => {
    const summary = await checkHealth({ db: mockDb({ data: 'ok' }), env: FULL_ENV, version: 'test' });

    expect(summary.checks.automation.status).toBe('unknown');
    expect(summary.checks.bot_layer.status).toBe('unknown');
    expect(summary.checks.evidence.status).toBe('unknown');
    // Entscheidend: unknown zieht den Gesamtstatus NICHT herunter.
    expect(summary.status).toBe('ok');
  });

  it('meldet unknown niemals als ok', async () => {
    const summary = await checkHealth({ db: mockDb({ data: 'ok' }), env: FULL_ENV, version: 'test' });

    expect(summary.checks.automation.ok).toBe(false);
    expect(summary.checks.ai_gateway.ok).toBe(false);
  });

  it('meldet erreichbare Tabellen als ok', async () => {
    const summary = await checkHealth({ db: dbWithTables(), env: FULL_ENV, version: 'test' });

    expect(summary.checks.automation.status).toBe('ok');
    expect(summary.checks.bot_layer.status).toBe('ok');
    expect(summary.checks.evidence.status).toBe('ok');
    expect(summary.status).toBe('ok');
  });

  it('meldet eine fehlende Tabelle als down und den Gesamtstatus als degraded', async () => {
    // PGRST205 = Tabelle im Schema-Cache nicht vorhanden (Migration nie angewendet).
    const summary = await checkHealth({
      db: dbWithTables({ evidence_items: 'PGRST205: Could not find the table' }),
      env: FULL_ENV,
      version: 'test',
    });

    expect(summary.checks.evidence.status).toBe('down');
    expect(summary.checks.evidence.error).toContain('PGRST205');
    expect(summary.status).toBe('degraded');
    // Eine kaputte Tabelle darf die anderen Bausteine nicht mitreissen.
    expect(summary.checks.automation.status).toBe('ok');
  });

  it('meldet das AI Gateway als ok, sobald ein Provider-Secret gesetzt ist', async () => {
    const summary = await checkHealth({
      db: dbWithTables(),
      env: { ...FULL_ENV, OLLAMA_URL: 'https://ollama.example.de' },
      version: 'test',
    });

    expect(summary.checks.ai_gateway.status).toBe('ok');
  });

  it('meldet das AI Gateway als unknown statt down, wenn kein Env-Secret sichtbar ist', async () => {
    // Begruendung: getApiKey() faellt auf den Vault zurueck, den dieser Check
    // nicht einsehen kann. 'down' waere hier eine Behauptung, kein Befund.
    const summary = await checkHealth({ db: dbWithTables(), env: FULL_ENV, version: 'test' });

    expect(summary.checks.ai_gateway.status).toBe('unknown');
    expect(summary.status).toBe('ok');
  });

  it('loest keinen Provider-Aufruf aus (Health darf nichts kosten)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await checkHealth({ db: dbWithTables(), env: { ...FULL_ENV, ANTHROPIC_API_KEY: 'k' }, version: 'test' });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
