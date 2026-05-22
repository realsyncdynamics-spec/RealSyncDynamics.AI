"""
Hash-chain construction + verification for SPEC-001 evidence bundles.

Each event carries a `prev_hash` field that equals SHA-256 of the
canonical bytes of the PREVIOUS event. The first event in a bundle
(genesis) has `prev_hash = None`. Verification recomputes every
expected hash from scratch and compares — a single modified field
anywhere in the chain invalidates every event from that point on.

This is the core append-only proof: insertions, deletions, or in-place
edits all break the chain. The verifier reports the FIRST broken link
so an investigator can see the corruption boundary.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Sequence

from .canonical import canonical_event_bytes


@dataclass(frozen=True)
class HashChainResult:
    """Outcome of verifying a full chain."""

    ok: bool
    first_bad_index: int | None        # 0-based event index where chain breaks
    expected_prev_hex: str | None       # what prev_hash should have been
    actual_prev_hex:   str | None       # what prev_hash actually was
    detail: str


def event_hash(event: dict) -> bytes:
    """Return the SHA-256 of the canonical bytes of an event."""
    return hashlib.sha256(canonical_event_bytes(event)).digest()


def build_chain(events: Sequence[dict]) -> list[dict]:
    """Return a new list of events with `prev_hash` set per the chain rule.

    Does NOT mutate the input. Genesis event gets `prev_hash = None`;
    every subsequent event gets `prev_hash = hex(SHA256(canonical(prev)))`.

    Used by the mint subcommand to produce a fresh signable bundle from
    a list of raw events. Production code paths in the main system do
    this server-side at insert time.
    """
    chained: list[dict] = []
    prev_hex: str | None = None
    for ev in events:
        ev_with_prev = {**ev, "prev_hash": prev_hex}
        chained.append(ev_with_prev)
        prev_hex = event_hash(ev_with_prev).hex()
    return chained


def verify_chain(events: Sequence[dict]) -> HashChainResult:
    """Verify the hash chain.

    Walks the list once. The first event's `prev_hash` MUST be None
    (genesis). Each subsequent event's `prev_hash` MUST equal the hex of
    SHA-256(canonical_bytes(previous_event)).

    On mismatch, returns the index of the first bad link plus both the
    expected and the actually-stored prev_hash so a reader can audit the
    corruption directly. Hash-prefix-only would hide which side drifted.
    """
    if len(events) == 0:
        return HashChainResult(
            ok=True,
            first_bad_index=None,
            expected_prev_hex=None,
            actual_prev_hex=None,
            detail="empty bundle (trivially valid)",
        )

    # Genesis check.
    genesis = events[0]
    genesis_prev = _normalize_prev_hex(genesis.get("prev_hash"))
    if genesis_prev is not None:
        return HashChainResult(
            ok=False,
            first_bad_index=0,
            expected_prev_hex=None,
            actual_prev_hex=genesis_prev,
            detail="genesis event must have prev_hash=null",
        )

    prev_hex = event_hash(genesis).hex()

    for i in range(1, len(events)):
        ev = events[i]
        actual = _normalize_prev_hex(ev.get("prev_hash"))
        if actual != prev_hex:
            return HashChainResult(
                ok=False,
                first_bad_index=i,
                expected_prev_hex=prev_hex,
                actual_prev_hex=actual,
                detail=f"hash-chain break at event {i}",
            )
        prev_hex = event_hash(ev).hex()

    return HashChainResult(
        ok=True,
        first_bad_index=None,
        expected_prev_hex=None,
        actual_prev_hex=None,
        detail=f"chain verified ({len(events)} events)",
    )


def _normalize_prev_hex(raw: object) -> str | None:
    """Accept None / hex-str / bytes / bytearray; return hex-str or None.

    A producer that emits malformed prev_hash (e.g. a number) gets
    surfaced via TypeError rather than silently treated as a mismatch.
    """
    if raw is None:
        return None
    if isinstance(raw, str):
        lowered = raw.lower()
        if any(c not in "0123456789abcdef" for c in lowered):
            raise ValueError(f"prev_hash is not hex: {raw!r}")
        return lowered
    if isinstance(raw, (bytes, bytearray)):
        return raw.hex()
    raise TypeError(
        f"prev_hash must be None, str, or bytes; got {type(raw).__name__}"
    )
