// SiteOS — Einträge in die Evidence-Kette des Mandanten (`governance_evidence`).
//
// Dieselbe Konvention wie `tenant-audit`: Der Inhalt steht in
// `metadata.snapshot`, `content_hash` ist SHA-256 über dessen kanonisches
// JSON (RFC 8785, `_shared/evidence-hash.ts`), `previous_hash` ist der
// Kettenkopf zum Zeitpunkt des Schreibens. Angehängt wird ausschließlich über
// `append_governance_evidence` (Advisory-Lock je Mandant, Vergleich des
// Kettenkopfs) — bewegt sich der Kopf, wird neu gelesen, neu gehasht und
// erneut versucht.
//
// Fail-closed: Gelingt das Anhängen nicht, meldet die Funktion einen Fehler,
// und der Aufrufer bricht ab. Eine Analyse, ein Verzicht oder ein GO ohne
// Nachweis findet nicht statt.

import { EVIDENCE_HASH_METHOD, evidenceContentHash } from '../_shared/evidence-hash.ts';

// deno-lint-ignore no-explicit-any
type AdminClient = any;

const ATTEMPTS = 3;

export type EvidenceAppend = { id: string; contentHash: string } | { status: number; code: string; error: string };

export async function appendSiteosEvidence(
  admin: AdminClient,
  tenantId: string,
  args: { title: string; source: string; body: Record<string, unknown>; metadata?: Record<string, unknown> },
): Promise<EvidenceAppend> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const { data: head, error: headError } = await admin
      .from('governance_evidence')
      .select('content_hash')
      .eq('tenant_id', tenantId)
      .not('content_hash', 'is', null)
      // Dieselbe Reihenfolge wie append_governance_evidence — beide sehen denselben Kopf.
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1);
    if (headError) return { status: 500, code: 'EVIDENCE_INSERT', error: 'Evidence-Kette nicht lesbar.' };

    const previousHash: string | null = head?.[0]?.content_hash ?? null;
    const snapshot = { ...args.body, previous_hash: previousHash };
    const contentHash = await evidenceContentHash(snapshot);
    const id = crypto.randomUUID();

    const { data, error } = await admin.rpc('append_governance_evidence', {
      p_row: {
        id,
        tenant_id: tenantId,
        event_id: null,
        asset_id: null,
        evidence_type: 'json',
        title: args.title.slice(0, 500),
        storage_path: null,
        content_hash: contentHash,
        previous_hash: previousHash,
        metadata: { source: args.source, hash_method: EVIDENCE_HASH_METHOD, ...(args.metadata ?? {}), snapshot },
      },
      p_expected_previous_hash: previousHash,
    });
    if (error) {
      console.error(JSON.stringify({ level: 'error', scope: 'siteos_evidence_append_failed', source: args.source, error: error.message }));
      return { status: 500, code: 'EVIDENCE_INSERT', error: 'Nachweis konnte nicht geschrieben werden.' };
    }
    if (data) return { id: data as string, contentHash };
  }
  return { status: 503, code: 'EVIDENCE_CHAIN_CONFLICT', error: 'Die Evidence-Kette wurde gleichzeitig fortgeschrieben — bitte erneut versuchen.' };
}
