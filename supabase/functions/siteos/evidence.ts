// SiteOS — Einträge in die Evidence-Kette des Mandanten (`governance_evidence`).
//
// Dieselbe Konvention wie `tenant-audit` (pipeline.ts, Schritt 4): Der Inhalt
// steht in `metadata.snapshot`, `content_hash` ist SHA-256 über dessen
// kanonisches JSON (RFC 8785, `_shared/evidence-hash.ts`), `previous_hash`
// ist der Kettenkopf zum Zeitpunkt des Schreibens und Teil des Snapshots.
// Angehängt wird ausschließlich über `append_governance_evidence`
// (Advisory-Lock je Mandant, Vergleich des Kettenkopfs) — bewegt sich der
// Kopf, wird neu gelesen, neu gehasht und erneut versucht. Die Kette
// verzweigt nie.
//
// Fail-closed: Gelingt das Anhängen nicht, meldet die Funktion einen Fehler,
// und der Aufrufer bricht ab. Eine Analyse ohne Nachweis findet nicht statt.

import { EVIDENCE_HASH_METHOD, evidenceContentHash } from '../_shared/evidence-hash.ts';

// deno-lint-ignore no-explicit-any
type AdminClient = any;

const ATTEMPTS = 3;

export type EvidenceAppend = { id: string; contentHash: string } | { status: number; code: string; error: string };

export interface EvidenceEntry {
  title: string;
  /** Quelle in `metadata.source`, z. B. `siteos.rebuild`. */
  source: string;
  /** Inhalt des Nachweises — landet im gehashten Snapshot. */
  body: Record<string, unknown>;
  /** Zusätzliche, ungehashte Felder in `metadata` (Suche, Zuordnung). */
  metadata?: Record<string, unknown>;
}

export async function appendSiteosEvidence(admin: AdminClient, tenantId: string, entry: EvidenceEntry): Promise<EvidenceAppend> {
  // Eine Kennung über alle Versuche: Sie steht im Snapshot und damit im Hash.
  const id = crypto.randomUUID();
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
    if (headError) {
      console.error(JSON.stringify({ level: 'error', scope: 'siteos_evidence_head_failed', source: entry.source, error: headError.message }));
      return { status: 500, code: 'EVIDENCE_INSERT', error: 'Die Evidence-Kette ist nicht lesbar.' };
    }

    const previousHash: string | null = head?.[0]?.content_hash ?? null;
    // Mandant und Kennung stehen im gehashten Inhalt — wie bei tenant-audit.
    const snapshot = { ...entry.body, tenant_id: tenantId, evidence_id: id, previous_hash: previousHash };
    const contentHash = await evidenceContentHash(snapshot);

    const { data, error } = await admin.rpc('append_governance_evidence', {
      p_row: {
        id,
        tenant_id: tenantId,
        event_id: null,
        asset_id: null,
        evidence_type: 'json',
        title: entry.title.slice(0, 500),
        storage_path: null,
        content_hash: contentHash,
        previous_hash: previousHash,
        metadata: { ...(entry.metadata ?? {}), source: entry.source, hash_method: EVIDENCE_HASH_METHOD, snapshot },
      },
      p_expected_previous_hash: previousHash,
    });
    if (error) {
      console.error(JSON.stringify({ level: 'error', scope: 'siteos_evidence_append_failed', source: entry.source, error: error.message }));
      return { status: 500, code: 'EVIDENCE_INSERT', error: 'Der Nachweis konnte nicht geschrieben werden.' };
    }
    // `null` heißt: Der Kopf hat sich bewegt — neu lesen, neu hashen.
    if (data) return { id: String(data), contentHash };
  }
  return { status: 503, code: 'EVIDENCE_CHAIN_CONFLICT', error: 'Die Evidence-Kette wurde gleichzeitig fortgeschrieben. Bitte erneut versuchen.' };
}
