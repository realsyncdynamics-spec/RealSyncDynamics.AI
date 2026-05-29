"""Hash-chain build + verify."""
import copy

from realsync.hashchain import build_chain, event_hash, verify_chain


BASE = {
    "id": "00000000-0000-0000-0000-000000000001",
    "tenant_id": "tenant-A",
    "global_seq": 1,
    "tenant_seq": 1,
    "spec_version": "1.0",
    "ts": "2026-05-22T10:00:01.000Z",
    "type": "scan.started",
    "severity": "info",
    "source": "gdpr-audit",
    "review_status": "auto",
    "subject_ref": None,
    "payload": {},
    "evidence_refs": [],
    "trace_id": None,
    "correlation_id": None,
    "causation_id": None,
    "prev_hash": None,
}


def _events(n: int) -> list[dict]:
    out = []
    for i in range(n):
        ev = copy.deepcopy(BASE)
        ev["global_seq"] = i + 1
        ev["tenant_seq"] = i + 1
        ev["ts"] = f"2026-05-22T10:00:{i:02d}.000Z"
        ev["id"] = f"00000000-0000-0000-0000-{i:012d}"
        out.append(ev)
    return out


def test_build_chain_fills_prev_hash_correctly():
    raw = _events(3)
    chained = build_chain(raw)
    assert chained[0]["prev_hash"] is None
    assert chained[1]["prev_hash"] == event_hash(chained[0]).hex()
    assert chained[2]["prev_hash"] == event_hash(chained[1]).hex()


def test_verify_chain_passes_on_fresh_build():
    chained = build_chain(_events(5))
    result = verify_chain(chained)
    assert result.ok is True
    assert result.first_bad_index is None


def test_verify_chain_flags_tampered_payload():
    chained = build_chain(_events(4))
    chained[2] = {**chained[2], "payload": {"tampered": True}}
    result = verify_chain(chained)
    assert result.ok is False
    # Event 3's prev_hash now disagrees with event 2's recomputed hash.
    assert result.first_bad_index == 3


def test_verify_chain_flags_missing_genesis_prev_hash():
    chained = build_chain(_events(2))
    chained[0] = {**chained[0], "prev_hash": "ab" * 32}
    result = verify_chain(chained)
    assert result.ok is False
    assert result.first_bad_index == 0
    assert "genesis" in result.detail


def test_verify_chain_empty_bundle_trivially_valid():
    result = verify_chain([])
    assert result.ok is True
    assert "empty" in result.detail
