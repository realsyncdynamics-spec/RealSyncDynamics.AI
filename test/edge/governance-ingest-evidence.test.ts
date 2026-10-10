/**
 * governance-ingest: Hashes eines API-Key-Halters gehören nicht in die
 * Evidence-Kette.
 *
 * Vorher landeten content_hash/previous_hash aus dem Request ungeprüft in
 * governance_evidence. Der Kettenkopf ist die jüngste Zeile mit content_hash
 * (append_governance_evidence) — ein externer Aufrufer konnte so den Kopf
 * setzen, an den tenant-audit/email-auth-rescan als Nächstes anhängen.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { callerEvidenceRow } from '../../supabase/functions/governance-ingest/evidence';

const ctx = { tenantId: 't-1', eventId: 'e-1', assetId: null };

describe('callerEvidenceRow', () => {
  it('schreibt keine Aufrufer-Hashes in die Kettenspalten', () => {
    const row = callerEvidenceRow(
      { evidence_type: 'log', title: 'x', content_hash: 'sha256:abc', previous_hash: 'forged' },
      ctx,
    );
    expect(row.content_hash).toBeNull();
    expect(row.previous_hash).toBeNull();
  });

  it('bewahrt die Aufrufer-Werte unter metadata.client_*', () => {
    const row = callerEvidenceRow(
      { evidence_type: 'log', title: 'x', content_hash: 'sha256:abc', previous_hash: 'p', metadata: { a: 1 } },
      ctx,
    );
    expect(row.metadata).toEqual({ a: 1, client_content_hash: 'sha256:abc', client_previous_hash: 'p' });
  });

  it('übernimmt keine client_*-Werte aus metadata, die nicht aus den Hash-Feldern stammen', () => {
    const row = callerEvidenceRow(
      { evidence_type: 'log', title: 'x', metadata: { client_content_hash: 'spoof', client_previous_hash: 'spoof' } },
      ctx,
    );
    expect(row.metadata).toEqual({});
  });

  it('ohne Hashes: Zeile wie bisher, Mandant/Event/Asset aus dem Kontext', () => {
    const row = callerEvidenceRow({ evidence_type: 'pdf', title: 'Bericht', storage_path: 'b/x.pdf' }, ctx);
    expect(row).toEqual({
      tenant_id: 't-1', event_id: 'e-1', asset_id: null, evidence_type: 'pdf', title: 'Bericht',
      storage_path: 'b/x.pdf', content_hash: null, previous_hash: null, metadata: {},
    });
  });
});

describe('governance-ingest: Verdrahtung', () => {
  const src = readFileSync('supabase/functions/governance-ingest/index.ts', 'utf8');

  it('nutzt callerEvidenceRow und reicht keine Aufrufer-Hashes direkt durch', () => {
    expect(src).toContain('callerEvidenceRow(e, {');
    expect(src).not.toMatch(/content_hash:\s*e\.content_hash/);
    expect(src).not.toMatch(/previous_hash:\s*e\.previous_hash/);
  });
});
