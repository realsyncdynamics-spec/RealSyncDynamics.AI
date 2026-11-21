import assert from 'node:assert/strict';
import test from 'node:test';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';

const { handleMessage } = await import('../src/mcp/protocol.js');
const { MCP_TOOLS, bindTenantTools, invokeTool } = await import('../src/mcp/tools.js');
const evidence = await import('../src/tools/evidence.js');

type Row = {
  id: string;
  tenant_id: string;
  subject_ref: string;
  label: string | null;
  version: number;
  content_sha256: string;
  prev_hash: string | null;
  event_hash: string;
  signature: string | null;
  retention_class: string;
  retained_until: string | null;
  created_by: string | null;
  created_at: string;
  event_timestamp: string | null;
};

type Filter = {
  eq(column: string, value: unknown): Filter;
  order(column: string, options: { ascending: boolean }): Filter;
  limit(n: number): Filter;
  ilike(column: string, pattern: string): Filter;
  single(): Promise<{ data: Row | null; error: { message: string; code?: string } | null }>;
  then<T>(
    onfulfilled?: ((value: { data: Row[] | null; error: null }) => T | PromiseLike<T>) | null,
  ): Promise<T>;
};

/**
 * Wendet genau die Filter an, die der Produktionscode setzt.
 * Fehlt `tenant_id`, liegen Zeilen beider Tenants im Ergebnis.
 */
function fakeDb(rows: Row[]) {
  function builder(
    filters: Array<(row: Row) => boolean>,
    order?: { column: string; ascending: boolean },
    limit?: number,
  ): Filter {
    const run = () => {
      let out = rows.filter((row) => filters.every((filter) => filter(row)));
      if (order) {
        out = [...out].sort((a, b) => {
          const av = String(a[order.column as keyof Row] ?? '');
          const bv = String(b[order.column as keyof Row] ?? '');
          return order.ascending ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      if (limit !== undefined) out = out.slice(0, limit);
      return out;
    };
    return {
      eq(column, value) {
        return builder([...filters, (row) => row[column as keyof Row] === value], order, limit);
      },
      ilike(column, pattern) {
        const expression = new RegExp(
          `^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`,
          'i',
        );
        return builder(
          [...filters, (row) => expression.test(String(row[column as keyof Row] ?? ''))],
          order,
          limit,
        );
      },
      order(column, options) {
        return builder(filters, { column, ascending: options.ascending }, limit);
      },
      limit(n) {
        return builder(filters, order, n);
      },
      single() {
        const out = run();
        if (out.length !== 1) {
          return Promise.resolve({ data: null, error: { code: 'PGRST116', message: 'row count' } });
        }
        return Promise.resolve({ data: out[0], error: null });
      },
      then(onfulfilled) {
        return Promise.resolve({ data: run(), error: null }).then(onfulfilled);
      },
    };
  }

  return {
    from(table: string) {
      if (table !== 'evidence_snapshots') throw new Error(`unerwartete Tabelle ${table}`);
      return { select: () => builder([]) };
    },
  };
}

function snap(id: string, tenantId: string, version = 1): Row {
  return {
    id,
    tenant_id: tenantId,
    subject_ref: 'iso42001/A.5',
    label: tenantId === 'tenant-a' ? 'NUR-TENANT-A' : 'NUR-TENANT-B',
    version,
    content_sha256: 'a'.repeat(64),
    prev_hash: null,
    event_hash: 'b'.repeat(64),
    signature: null,
    retention_class: '7y',
    retained_until: null,
    created_by: null,
    created_at: `2026-01-0${version}T00:00:00.000Z`,
    event_timestamp: null,
  };
}

const rows = [snap('a1', 'tenant-a', 1), snap('b1', 'tenant-b', 1), snap('b2', 'tenant-b', 2)];

function textOf(result: { content: Array<{ text: string }> }): string {
  return result.content.map((part) => part.text).join('\n');
}

test('evidence_list liefert nur Zeilen des gebundenen Tenants', async () => {
  const db = fakeDb(rows);
  const result = await invokeTool(
    'tenant-a',
    'evidence_list',
    { tenant_id: 'tenant-b', subject_ref: 'iso42001/A.5' },
    db,
  );
  const text = textOf(result);
  assert.match(text, /NUR-TENANT-A/);
  assert.doesNotMatch(text, /NUR-TENANT-B/);
  assert.doesNotMatch(text, /"id": "b1"/);
});

test('evidence_get mit der ID eines anderen Tenants findet nichts', async () => {
  const db = fakeDb(rows);
  const result = await invokeTool('tenant-a', 'evidence_get', { id: 'b1', tenant_id: 'tenant-b' }, db);
  assert.equal(result.isError, true);
  assert.match(textOf(result), /diesem Tenant/);
  assert.doesNotMatch(textOf(result), /NUR-TENANT-B/);
});

test('evidence_search_by_control mischt keine fremden Subjects ein', async () => {
  const db = fakeDb(rows);
  const result = await invokeTool(
    'tenant-a',
    'evidence_search_by_control',
    { control_id: 'A.5', tenant_id: 'tenant-b' },
    db,
  );
  const text = textOf(result);
  assert.match(text, /NUR-TENANT-A/);
  assert.doesNotMatch(text, /NUR-TENANT-B/);
});

test('die Kettenprüfung lädt nicht die Kette des anderen Tenants', async () => {
  const db = fakeDb(rows);
  const result = await invokeTool('tenant-a', 'evidence_verify_chain', { id: 'a1' }, db);
  const parsed = JSON.parse(textOf(result)) as { chainLength: number };
  // tenant-b hat zwei Snapshots desselben Subjects. Ohne Tenant-Filter wäre die Kette länger.
  assert.equal(parsed.chainLength, 1);
  assert.doesNotMatch(textOf(result), /NUR-TENANT-B/);
});

test('der MCP-Handler ruft das Werkzeug mit dem Tenant des Keys auf', async () => {
  const db = fakeDb(rows);
  const response = await handleMessage(
    {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'evidence_list',
        arguments: { tenant_id: 'tenant-b' },
      },
    },
    {
      tools: MCP_TOOLS,
      scopes: ['evidence.read'],
      serverName: 'realsync-mcp-governance',
      serverVersion: '0.1.0',
      invoke: bindTenantTools('tenant-a', db),
    },
  );
  const text = (response?.result as { content: Array<{ text: string }> }).content[0].text;
  assert.match(text, /NUR-TENANT-A/);
  assert.doesNotMatch(text, /NUR-TENANT-B/);
});

test('ohne Tenant-Kontext wird nichts gelesen', async () => {
  const db = fakeDb(rows);
  let queried = false;
  const guarded = {
    from(table: string) {
      queried = true;
      return db.from(table);
    },
  };
  const result = await invokeTool('  ', 'evidence_list', {}, guarded);
  assert.equal(result.isError, true);
  assert.equal(queried, false);
  await assert.rejects(() => evidence.listEvidence('', undefined, 10, db), /Tenant-Kontext fehlt/);
});
