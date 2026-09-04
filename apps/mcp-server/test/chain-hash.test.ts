import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

process.env.SUPABASE_URL ??= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';

const { verifyChain, serializeSnapshotForHash } = await import(
  '../../../packages/evidence-chain/src/index.js'
);

/** Dieselbe Injektion, die tools/evidence.ts an verifyChain übergibt. */
const sha256Hex = async (input: string): Promise<string> =>
  createHash('sha256').update(input, 'utf8').digest('hex');

type Rec = Parameters<typeof serializeSnapshotForHash>[0];

/** Baut eine gültige, korrekt verkettete Kette der Länge n. */
async function buildChain(n: number, subjectRef = 'iso42001/A.5'): Promise<Rec[]> {
  const chain: Rec[] = [];
  let prev: string | null = null;
  for (let v = 1; v <= n; v++) {
    const rec: Rec = {
      subject_ref: subjectRef,
      version: v,
      content_sha256: createHash('sha256').update(`inhalt-${v}`).digest('hex'),
      retention_class: '7y',
      prev_hash: prev,
      event_hash: '',
      event_timestamp: `2026-08-0${v}T10:00:00.000Z`,
    };
    rec.event_hash = await sha256Hex(serializeSnapshotForHash(rec));
    prev = rec.event_hash;
    chain.push(rec);
  }
  return chain;
}

test('Die Node-Hash-Injektion rechnet die Kanonisierung korrekt nach', async () => {
  // Sichert die Schnittstelle zwischen MCP Server und dem geteilten Kern:
  // Weicht die injizierte Hash-Funktion ab, meldet die Verifizierung
  // unversehrte Ketten als manipuliert.
  const chain = await buildChain(3);
  const report = await verifyChain(chain, sha256Hex);

  assert.equal(report.ok, true, JSON.stringify(report.issues));
  assert.equal(report.cryptoVerified, 3);
  assert.equal(report.legacy, 0);
});

test('Ein nachträglich veränderter Inhalt fällt auf', async () => {
  const chain = await buildChain(3);
  chain[1].content_sha256 = createHash('sha256').update('gefaelscht').digest('hex');

  const report = await verifyChain(chain, sha256Hex);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i) => i.kind === 'hash_mismatch'));
});

test('Legacy-Snapshots gelten nicht als Manipulation', async () => {
  // Snapshots von vor Einführung von event_timestamp lassen sich nicht
  // nachrechnen. Sie als manipuliert zu melden wäre ein Fehlalarm über
  // Bestandsdaten — genau das darf ein Compliance-Werkzeug nicht tun.
  const chain = await buildChain(2);
  chain[0].event_timestamp = null;

  const report = await verifyChain(chain, sha256Hex);
  assert.equal(report.ok, true, JSON.stringify(report.issues));
  assert.equal(report.legacy, 1);
  assert.equal(report.cryptoVerified, 1);
});

test('Eine unterbrochene Verkettung fällt auf', async () => {
  const chain = await buildChain(3);
  chain[2].prev_hash = 'a'.repeat(64);

  const report = await verifyChain(chain, sha256Hex);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((i) => i.kind === 'broken_link'));
});
