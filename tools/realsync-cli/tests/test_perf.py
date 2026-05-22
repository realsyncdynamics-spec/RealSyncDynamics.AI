"""Scale demonstrations.

Documents what 'auditor-grade' performance looks like on this verifier:
10k events should build + chain + verify in well under one second on
modern hardware. If a future refactor regresses this by an order of
magnitude, the test fails loudly — the verifier is on the critical path
for any auditor's CI integration.

These are functional scale tests, not benchmarks; thresholds are
intentionally loose (3s for 10k events) so CI variance doesn't cause
flakes. Real perf regressions are 10–100x.
"""
import time

from realsync.hashchain import build_chain, event_hash, verify_chain
from realsync.signer import generate_keypair, sign_bundle
from realsync.verifier import passed, verify_bundle


def _make_events(n: int) -> list[dict]:
    return [
        {
            "id":             f"00000000-0000-0000-0000-{i:012d}",
            "tenant_id":      "tenant-perf",
            "global_seq":     i + 1,
            "tenant_seq":     i + 1,
            "spec_version":   "1.0",
            "ts":             f"2026-05-22T10:{(i // 60) % 60:02d}:{i % 60:02d}.000Z",
            "type":           "scan.completed" if i % 5 else "scan.started",
            "severity":       "info",
            "source":         "gdpr-audit",
            "review_status":  "auto",
            "subject_ref":    None,
            "payload":        {"i": i, "vendor": f"vendor{i % 50}.com"},
            "evidence_refs":  [],
            "trace_id":       None,
            "correlation_id": None,
            "causation_id":   None,
        }
        for i in range(n)
    ]


def test_10k_events_chain_then_verify_under_three_seconds():
    raw = _make_events(10_000)

    t0 = time.perf_counter()
    chained = build_chain(raw)
    t1 = time.perf_counter()
    result = verify_chain(chained)
    t2 = time.perf_counter()

    assert result.ok is True
    build_s  = t1 - t0
    verify_s = t2 - t1
    # Loose threshold — local laptop hits ~0.3s + 0.3s. CI machines can
    # be slower; 3s is well above any plausible non-regression.
    assert build_s  < 3.0, f"build_chain took {build_s:.2f}s for 10k events"
    assert verify_s < 3.0, f"verify_chain took {verify_s:.2f}s for 10k events"


def test_10k_event_full_bundle_verify_under_three_seconds():
    raw = _make_events(10_000)
    chained = build_chain(raw)
    md = {
        "bundle_id":   "perf-10k",
        "tenant_id":   "tenant-perf",
        "created_at":  "2026-05-22T11:00:00.000000Z",
        "event_count": len(chained),
    }
    priv, _ = generate_keypair()
    sig = sign_bundle(
        priv, md, event_hash(chained[-1]).hex(),
        key_id="perf-v1", signed_at="2026-05-22T11:00:00Z",
    )
    bundle = {"metadata": md, "events": chained, "signature": sig.__dict__}

    t0 = time.perf_counter()
    results = verify_bundle(bundle)
    t1 = time.perf_counter()

    assert passed(results)
    elapsed = t1 - t0
    assert elapsed < 3.0, f"verify_bundle took {elapsed:.2f}s for 10k events"
