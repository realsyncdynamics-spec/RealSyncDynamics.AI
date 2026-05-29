"""
Bundle I/O + shape-level validation.

A SPEC-001 bundle is a JSON document with three top-level keys:

  metadata   — { bundle_id, tenant_id, created_at, event_count }
  events     — list of envelope-shaped dicts (see canonical.ENVELOPE_FIELDS)
  signature  — BundleSignature record (see signer.BundleSignature)

This module handles only LOAD + STRUCTURAL validation. Hash-chain
verification lives in `hashchain.py`, signature verification in
`signer.py`, and the composed end-to-end check in `verifier.py`.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


REQUIRED_TOP_LEVEL = ("metadata", "events", "signature")
REQUIRED_METADATA  = ("bundle_id", "tenant_id", "created_at", "event_count")
REQUIRED_SIGNATURE = (
    "algorithm",
    "key_id",
    "pubkey_b64",
    "bundle_digest",
    "signature_b64",
    "signed_at",
)


def load_bundle(path: str | Path) -> dict[str, Any]:
    """Read a JSON bundle from disk. Raises on missing / malformed input."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"bundle file not found: {p}")
    with p.open("r", encoding="utf-8-sig") as f:    # utf-8-sig: tolerate BOM
        return json.load(f)


def save_bundle(bundle: dict[str, Any], path: str | Path) -> None:
    """Write a bundle to disk with stable JSON ordering.

    Used by the mint subcommand. Determinism here means the file diff
    against `git` only changes when content changes — readable PRs.
    """
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", encoding="utf-8") as f:
        json.dump(
            bundle, f,
            sort_keys=True,
            indent=2,
            ensure_ascii=False,
            allow_nan=False,
        )
        f.write("\n")


def validate_structure(bundle: dict[str, Any]) -> tuple[bool, str]:
    """Shape check: required keys present and types plausible.

    Does NOT verify any cryptographic claim — separate concern.
    """
    for k in REQUIRED_TOP_LEVEL:
        if k not in bundle:
            return False, f"missing top-level key: {k}"

    metadata = bundle.get("metadata")
    if not isinstance(metadata, dict):
        return False, "metadata must be an object"
    for k in REQUIRED_METADATA:
        if k not in metadata:
            return False, f"missing metadata field: {k}"

    if not isinstance(bundle["events"], list):
        return False, "events must be a list"
    if metadata["event_count"] != len(bundle["events"]):
        return False, (
            f"event_count mismatch: metadata says {metadata['event_count']}, "
            f"events list has {len(bundle['events'])}"
        )

    signature = bundle.get("signature")
    if not isinstance(signature, dict):
        return False, "signature must be an object"
    for k in REQUIRED_SIGNATURE:
        if k not in signature:
            return False, f"missing signature field: {k}"

    return True, "structure valid"


def validate_tenant_scope(bundle: dict[str, Any]) -> tuple[bool, str]:
    """All events MUST belong to the tenant declared in metadata.

    Cross-tenant leakage in a bundle is the canonical multi-tenant bug
    we refuse to accept silently.
    """
    expected = bundle["metadata"]["tenant_id"]
    for i, ev in enumerate(bundle["events"]):
        if ev.get("tenant_id") != expected:
            return False, (
                f"event {i} belongs to tenant {ev.get('tenant_id')!r}, "
                f"expected {expected!r}"
            )
    return True, f"all {len(bundle['events'])} events scoped to {expected}"


def validate_sequence(bundle: dict[str, Any]) -> tuple[bool, str]:
    """Tenant-sequence numbers must be monotonically increasing and contiguous.

    Gaps would indicate either an export bug or deliberate redaction —
    both should be visible to the auditor. global_seq is allowed to
    have gaps (other tenants interleave), tenant_seq is not.
    """
    events = bundle["events"]
    if len(events) == 0:
        return True, "no events"
    prev_seq = events[0].get("tenant_seq")
    if prev_seq is None:
        return False, "event 0 has no tenant_seq"
    for i in range(1, len(events)):
        cur = events[i].get("tenant_seq")
        if cur is None:
            return False, f"event {i} has no tenant_seq"
        if cur != prev_seq + 1:
            return False, (
                f"tenant_seq gap at event {i}: expected {prev_seq + 1}, got {cur}"
            )
        prev_seq = cur
    return True, f"tenant_seq contiguous from {events[0]['tenant_seq']}"
