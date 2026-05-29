"""
SPEC-001 — Canonical event-envelope bytes.

Python mirror of `src/lib/governance/runtime-math.ts::canonicalEventBytes`
in the production TypeScript codebase, which itself mirrors the SQL
function `public.runtime_events_canonical_bytes()`.

CONTRACT
========
Given an event envelope dict, this module returns the exact bytes that
would be hashed by the producing system. Determinism is the entire
point — byte-drift here breaks hash-chain verification and Ed25519
signature verification across implementations.

Three rules, each non-negotiable:

  1. JSON keys are sorted alphabetically at EVERY nesting level
     (Postgres jsonb_build_object → ::text sorts; we mirror that).
  2. Timestamps normalize to Postgres microsecond ISO:
     `YYYY-MM-DDTHH:MM:SS.mmm000Z` (trailing `000Z` brings the 3-digit
     millisecond rendering up to 6-digit microsecond width with no
     decimal change).
  3. `prev_hash` is rendered as a lowercase hex string when present and
     as JSON null otherwise (matches PG `encode(..., 'hex')`).

The fixture in `tests/test_canonical.py` was generated from the
TypeScript reference; if a change here breaks that test, the change is
wrong — not the fixture.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Mapping


# Envelope field order is documentary only; final ordering comes from the
# alphabetical sort below. Listed here so a reader sees what the schema is.
ENVELOPE_FIELDS = (
    "id",
    "tenant_id",
    "global_seq",
    "tenant_seq",
    "spec_version",
    "ts",
    "type",
    "severity",
    "source",
    "review_status",
    "subject_ref",
    "payload",
    "evidence_refs",
    "trace_id",
    "correlation_id",
    "causation_id",
    "prev_hash",
)


def canonical_event_bytes(event: Mapping[str, Any]) -> bytes:
    """Return the canonical UTF-8 bytes for a SPEC-001 event envelope.

    The input dict may contain additional fields; only the envelope
    fields listed in ENVELOPE_FIELDS contribute to the canonical output.
    Missing envelope fields raise KeyError — silent defaults would mask
    schema drift.

    `prev_hash` accepts None, bytes, or a hex string (which is parsed
    and re-rendered to enforce lowercase normalization).
    """
    canonical: dict[str, Any] = {
        "id":             _require(event, "id"),
        "tenant_id":      _require(event, "tenant_id"),
        "global_seq":     _require(event, "global_seq"),
        "tenant_seq":     _require(event, "tenant_seq"),
        "spec_version":   _require(event, "spec_version"),
        "ts":             _to_pg_micro_iso(_require(event, "ts")),
        "type":           _require(event, "type"),
        "severity":       _require(event, "severity"),
        "source":         _require(event, "source"),
        "review_status":  _require(event, "review_status"),
        "subject_ref":    event.get("subject_ref"),
        "payload":        event.get("payload"),
        "evidence_refs":  event.get("evidence_refs", []),
        "trace_id":       event.get("trace_id"),
        "correlation_id": event.get("correlation_id"),
        "causation_id":   event.get("causation_id"),
        "prev_hash":      _render_prev_hash(event.get("prev_hash")),
    }
    return _stable_stringify(canonical).encode("utf-8")


def _require(event: Mapping[str, Any], key: str) -> Any:
    if key not in event:
        raise KeyError(
            f"canonical_event_bytes: required envelope field '{key}' missing"
        )
    return event[key]


def _render_prev_hash(value: Any) -> str | None:
    """Normalize prev_hash → lowercase hex string OR JSON null.

    bytes / bytearray → hex
    str → lowercased, validated as hex
    None → None (rendered as JSON null)
    """
    if value is None:
        return None
    if isinstance(value, (bytes, bytearray)):
        return value.hex()
    if isinstance(value, str):
        lowered = value.lower()
        # Validate: only [0-9a-f] characters. Any malformed input is a
        # producer bug; surface it loudly here rather than silently
        # corrupt the canonical bytes.
        if any(c not in "0123456789abcdef" for c in lowered):
            raise ValueError(
                f"prev_hash string is not pure hex: {value!r}"
            )
        return lowered
    raise TypeError(
        f"prev_hash must be None, bytes, or hex str; got {type(value).__name__}"
    )


def _to_pg_micro_iso(ts: str) -> str:
    """Normalize an ISO-8601 string to Postgres microsecond width.

    Accepts:
      - '2026-05-22T10:00:01Z'
      - '2026-05-22T10:00:01.123Z'
      - '2026-05-22T10:00:01.123456Z'
      - '2026-05-22T10:00:01+00:00'

    Returns:
      - '2026-05-22T10:00:01.000000Z'  (always microsecond-width)
      - '2026-05-22T10:00:01.123000Z'

    The trailing `000Z` quirk in the TS implementation appends three
    extra zeros to the millisecond rendering — equivalent to widening
    millisecond width to microsecond width with the same value.
    """
    parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    parsed = parsed.astimezone(timezone.utc)
    # Always render with millisecond width, then pad to microseconds.
    base = parsed.strftime("%Y-%m-%dT%H:%M:%S")
    ms = parsed.microsecond // 1000  # drop sub-millisecond precision
    return f"{base}.{ms:03d}000Z"


def _stable_stringify(value: Any) -> str:
    """Deterministic JSON: alphabetically-sorted keys at every level.

    json.dumps(..., sort_keys=True) does the same on its own — but only
    if separators are set so float/string formatting is also stable. We
    keep this routine explicit because the TypeScript reference is also
    explicit, and a reader pairing the two should see the same shape.
    """
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    )
