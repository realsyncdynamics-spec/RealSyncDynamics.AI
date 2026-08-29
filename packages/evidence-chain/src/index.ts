/**
 * Evidence Vault — unabhängige Hash-Chain-Verifizierung.
 *
 * Pure, deterministisch. Prüft die Snapshot-Kette eines Subjects nach:
 *   1. Struktur    — lückenlose Versionsfolge ab 1, keine Duplikate.
 *   2. Verkettung  — prev_hash[n] == event_hash[n-1], Genesis hat prev_hash=null.
 *   3. Kryptografie — event_hash neu berechnet und mit dem gespeicherten Wert
 *                     verglichen (erkennt nachträgliche Manipulation).
 *
 * Die Kanonisierung ist IDENTISCH zur Erzeugung in
 * supabase/functions/evidence-vault (snapshotHash). Die Hash-Funktion wird
 * injiziert (Browser-WebCrypto bzw. Node-WebCrypto im Test), damit dieses Modul
 * frei von Krypto-Abhängigkeiten und voll testbar bleibt.
 *
 * Voraussetzung für die kryptografische Prüfung ist der exakt gehashte
 * Zeitstempel (event_timestamp). Snapshots ohne diesen Wert (vor Einführung der
 * Spalte erzeugt) werden strukturell geprüft und als „legacy" markiert — nicht
 * als Manipulation.
 */

export type ChainIssueKind =
  | 'hash_mismatch'
  | 'broken_link'
  | 'version_gap'
  | 'duplicate_version'
  | 'missing_genesis'
  | 'bad_content_digest';

export interface SnapshotRecord {
  subject_ref: string;
  version: number;
  content_sha256: string;
  retention_class: string;
  prev_hash: string | null;
  event_hash: string;
  /** Exakt in den Hash eingegangener Zeitstempel; null bei Legacy-Snapshots. */
  event_timestamp: string | null;
}

export interface ChainIssue {
  subject_ref: string;
  version: number;
  kind: ChainIssueKind;
  detail: string;
}

export interface ChainReport {
  subjectRef: string;
  count: number;
  ok: boolean;
  cryptoVerified: number;
  legacy: number;
  issues: ChainIssue[];
}

export type HashHex = (input: string) => Promise<string>;

export function normalizeHex(h: string): string {
  return h.trim().toLowerCase().replace(/^0x/, '');
}

/**
 * Kanonische Serialisierung eines Snapshots für den Hash — muss zeichengenau
 * mit der Edge-Function übereinstimmen.
 */
export function serializeSnapshotForHash(s: SnapshotRecord): string {
  const ordered = {
    subjectRef: s.subject_ref,
    version: s.version,
    contentSha256: normalizeHex(s.content_sha256),
    retentionClass: s.retention_class,
    timestamp: s.event_timestamp,
    prevHash: s.prev_hash === null ? null : normalizeHex(s.prev_hash),
  };
  return JSON.stringify(ordered);
}

const HEX64 = /^[0-9a-f]{64}$/;

/** Verifiziert die Kette EINES Subjects. Snapshots dürfen unsortiert sein. */
export async function verifyChain(snapshots: SnapshotRecord[], hashHex: HashHex): Promise<ChainReport> {
  const subjectRef = snapshots[0]?.subject_ref ?? '';
  const sorted = [...snapshots].sort((a, b) => a.version - b.version);
  const issues: ChainIssue[] = [];
  let cryptoVerified = 0;
  let legacy = 0;

  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];

    // Struktur: Versionsfolge.
    const expectedVersion = i + 1;
    if (s.version === sorted[i - 1]?.version) {
      issues.push({ subject_ref: subjectRef, version: s.version, kind: 'duplicate_version', detail: `Version ${s.version} kommt mehrfach vor.` });
    } else if (i === 0 && s.version !== 1) {
      issues.push({ subject_ref: subjectRef, version: s.version, kind: 'missing_genesis', detail: `Kette beginnt bei Version ${s.version} statt 1.` });
    } else if (s.version !== expectedVersion) {
      issues.push({ subject_ref: subjectRef, version: s.version, kind: 'version_gap', detail: `Erwartete Version ${expectedVersion}, gefunden ${s.version}.` });
    }

    // Verkettung.
    if (i === 0) {
      if (s.prev_hash !== null) {
        issues.push({ subject_ref: subjectRef, version: s.version, kind: 'broken_link', detail: 'Genesis-Snapshot hat einen prev_hash (erwartet: keiner).' });
      }
    } else {
      const prev = sorted[i - 1];
      if (normalizeHex(s.prev_hash ?? '') !== normalizeHex(prev.event_hash)) {
        issues.push({ subject_ref: subjectRef, version: s.version, kind: 'broken_link', detail: `prev_hash verweist nicht auf Version ${prev.version}.` });
      }
    }

    // Content-Digest-Format.
    if (!HEX64.test(normalizeHex(s.content_sha256))) {
      issues.push({ subject_ref: subjectRef, version: s.version, kind: 'bad_content_digest', detail: 'content_sha256 ist kein gültiger 64-stelliger Hex-Digest.' });
    }

    // Kryptografie: nur mit gespeichertem gehashtem Zeitstempel möglich.
    if (s.event_timestamp === null) {
      legacy++;
    } else {
      const recomputed = normalizeHex(await hashHex(serializeSnapshotForHash(s)));
      if (recomputed !== normalizeHex(s.event_hash)) {
        issues.push({ subject_ref: subjectRef, version: s.version, kind: 'hash_mismatch', detail: 'Neu berechneter event_hash weicht ab — Snapshot wurde verändert.' });
      } else {
        cryptoVerified++;
      }
    }
  }

  return { subjectRef, count: sorted.length, ok: issues.length === 0, cryptoVerified, legacy, issues };
}

/** Gruppiert Snapshots nach subject_ref und verifiziert jede Kette einzeln. */
export async function verifyAllChains(snapshots: SnapshotRecord[], hashHex: HashHex): Promise<ChainReport[]> {
  const bySubject = new Map<string, SnapshotRecord[]>();
  for (const s of snapshots) {
    const arr = bySubject.get(s.subject_ref) ?? [];
    arr.push(s);
    bySubject.set(s.subject_ref, arr);
  }
  const reports: ChainReport[] = [];
  for (const [, arr] of bySubject) reports.push(await verifyChain(arr, hashHex));
  reports.sort((a, b) => a.subjectRef.localeCompare(b.subjectRef));
  return reports;
}
