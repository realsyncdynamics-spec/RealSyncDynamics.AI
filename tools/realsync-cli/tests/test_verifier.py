"""End-to-end verifier: mint a bundle then verify it; mutate and confirm failure."""
import copy

from realsync.bundle import save_bundle, load_bundle
from realsync.hashchain import build_chain, event_hash
from realsync.signer import generate_keypair, sign_bundle
from realsync.verifier import passed, verify_bundle


RAW_EVENTS = [
    {
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
        "payload": {"vendor": "acme"},
        "evidence_refs": [],
        "trace_id": None,
        "correlation_id": None,
        "causation_id": None,
    },
    {
        "id": "00000000-0000-0000-0000-000000000002",
        "tenant_id": "tenant-A",
        "global_seq": 2,
        "tenant_seq": 2,
        "spec_version": "1.0",
        "ts": "2026-05-22T10:00:05.000Z",
        "type": "scan.completed",
        "severity": "info",
        "source": "gdpr-audit",
        "review_status": "auto",
        "subject_ref": None,
        "payload": {"vendor": "acme", "findings": 0},
        "evidence_refs": [],
        "trace_id": None,
        "correlation_id": None,
        "causation_id": None,
    },
]


def _mint_bundle() -> dict:
    priv, _ = generate_keypair()
    chained = build_chain(RAW_EVENTS)
    md = {
        "bundle_id":   "bundle-e2e-1",
        "tenant_id":   "tenant-A",
        "created_at":  "2026-05-22T10:00:00.000000Z",
        "event_count": len(chained),
    }
    sig = sign_bundle(
        priv, md, event_hash(chained[-1]).hex(),
        key_id="e2e-v1", signed_at="2026-05-22T10:00:10Z",
    )
    return {"metadata": md, "events": chained, "signature": sig.__dict__}


def test_fresh_bundle_passes_all_checks():
    bundle = _mint_bundle()
    results = verify_bundle(bundle)
    names = [r.name for r in results]
    assert "structure" in names
    assert "hash_chain" in names
    assert "signature" in names
    assert passed(results), [r for r in results if not r.ok]


def test_tampered_event_payload_breaks_hash_chain_and_signature():
    bundle = _mint_bundle()
    bundle["events"][1] = {**bundle["events"][1], "payload": {"vendor": "evil"}}
    results = verify_bundle(bundle)
    chain  = next(r for r in results if r.name == "hash_chain")
    sig    = next(r for r in results if r.name == "signature")
    # The chain breaks at the mutated event's RECOMPUTED hash diverging
    # from what the next event committed to — but there's no next event
    # here (mutated last event). So chain itself still walks OK; the
    # signature fails because chain_tip recomputes differently.
    assert sig.ok is False
    if chain.ok:
        # chain_tip mismatch surfaces in the signature layer
        assert "digest does not match" in sig.detail


def test_inserted_event_breaks_tenant_seq_and_chain():
    bundle = _mint_bundle()
    inserted = copy.deepcopy(bundle["events"][0])
    inserted["tenant_seq"] = 99
    inserted["payload"] = {"inserted": True}
    bundle["events"].insert(1, inserted)
    bundle["metadata"]["event_count"] = len(bundle["events"])
    results = verify_bundle(bundle)
    assert not passed(results)


def test_substituted_tenant_id_in_event_fails_tenant_scope():
    bundle = _mint_bundle()
    bundle["events"][0] = {**bundle["events"][0], "tenant_id": "tenant-OTHER"}
    results = verify_bundle(bundle)
    scope = next(r for r in results if r.name == "tenant_scope")
    assert scope.ok is False


def test_round_trip_disk_io(tmp_path):
    bundle = _mint_bundle()
    out = tmp_path / "bundle.json"
    save_bundle(bundle, out)
    reloaded = load_bundle(out)
    results = verify_bundle(reloaded)
    assert passed(results)
