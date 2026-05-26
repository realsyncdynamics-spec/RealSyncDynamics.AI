/**
 * Evidence reference protocol — typed wrapper around findings.evidence_ref.
 *
 * findings.evidence_ref is a TEXT column by design: typeless at the DB
 * level so the producing detector decides what kind of pointer fits.
 * This file gives the TS / consumer side a structured way to build,
 * parse, and validate that pointer without changing the DB shape.
 *
 * Wire format (the string stored in findings.evidence_ref):
 *
 *   url:<http_or_https_url>            — externally-accessible URL
 *   sha256:<64-hex>                    — content-addressed blob hash
 *   storage://<bucket>/<path>          — Supabase Storage reference
 *   runtime-event:<uuid>               — points to a runtime_events row
 *   inline:                            — payload lives in findings.raw_payload
 *
 * Producers use `formatEvidenceRef`; consumers (UI, report builder,
 * PDF exporter) use `parseEvidenceRef` to render the right viewer.
 */

export type EvidenceRef =
  | { kind: 'url';            url: string }
  | { kind: 'sha256';         hash: string }
  | { kind: 'storage';        bucket: string; path: string }
  | { kind: 'runtime-event';  eventId: string }
  | { kind: 'inline' }   // payload is in findings.raw_payload — no further ref
  | { kind: 'opaque';         raw: string };  // unrecognized — preserve

/** Build the wire-format string for storage in findings.evidence_ref. */
export function formatEvidenceRef(ref: EvidenceRef): string {
  switch (ref.kind) {
    case 'url':           return `url:${ref.url}`;
    case 'sha256':        return `sha256:${ref.hash.toLowerCase()}`;
    case 'storage':       return `storage://${ref.bucket}/${ref.path.replace(/^\//, '')}`;
    case 'runtime-event': return `runtime-event:${ref.eventId}`;
    case 'inline':        return 'inline:';
    case 'opaque':        return ref.raw;
  }
}

/**
 * Parse a wire-format string back into a tagged union. Returns the
 * `opaque` variant for unrecognized prefixes — never throws. Callers
 * can branch on `.kind` to render the right thing; an unrecognized
 * ref doesn't break the UI, it just lacks a typed viewer.
 */
export function parseEvidenceRef(raw: string | null | undefined): EvidenceRef | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const trimmed = raw.trim();

  if (trimmed.startsWith('url:')) {
    const url = trimmed.slice(4);
    if (/^https?:\/\//i.test(url)) return { kind: 'url', url };
    return { kind: 'opaque', raw: trimmed };
  }

  if (trimmed.startsWith('sha256:')) {
    const hash = trimmed.slice(7).toLowerCase();
    if (/^[0-9a-f]{64}$/.test(hash)) return { kind: 'sha256', hash };
    return { kind: 'opaque', raw: trimmed };
  }

  if (trimmed.startsWith('storage://')) {
    const rest  = trimmed.slice(10);
    const slash = rest.indexOf('/');
    if (slash > 0 && slash < rest.length - 1) {
      return { kind: 'storage', bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
    }
    return { kind: 'opaque', raw: trimmed };
  }

  if (trimmed.startsWith('runtime-event:')) {
    const eventId = trimmed.slice(14);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
      return { kind: 'runtime-event', eventId };
    }
    return { kind: 'opaque', raw: trimmed };
  }

  if (trimmed === 'inline:') return { kind: 'inline' };

  return { kind: 'opaque', raw: trimmed };
}

/**
 * Render an EvidenceRef into a one-line label for list views. Keeps
 * URLs short (host only), hashes truncated, storage paths shortened.
 * The PDF exporter / UI uses this for the "Evidence:" row of a finding.
 */
export function evidenceRefLabel(ref: EvidenceRef): string {
  switch (ref.kind) {
    case 'url': {
      try { return `URL · ${new URL(ref.url).host}`; }
      catch { return `URL · ${ref.url.slice(0, 60)}`; }
    }
    case 'sha256':
      return `Hash · ${ref.hash.slice(0, 12)}…`;
    case 'storage':
      return `Storage · ${ref.bucket}/${ref.path.length > 30 ? `${ref.path.slice(0, 27)}…` : ref.path}`;
    case 'runtime-event':
      return `Event · ${ref.eventId.slice(0, 8)}…`;
    case 'inline':
      return 'Inline (siehe Payload)';
    case 'opaque':
      return ref.raw.length > 60 ? `${ref.raw.slice(0, 57)}…` : ref.raw;
  }
}
