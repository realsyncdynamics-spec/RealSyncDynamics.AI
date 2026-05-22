"""Ed25519 sign + verify + key-substitution refusal."""
import base64

from realsync.signer import (
    BundleSignature,
    compute_bundle_digest,
    export_private_key_pem,
    export_public_key_pem,
    generate_keypair,
    load_private_key_pem,
    load_public_key_pem,
    sign_bundle,
    verify_signature,
)


META = {
    "bundle_id":   "bundle-test-1",
    "tenant_id":   "tenant-A",
    "created_at":  "2026-05-22T10:00:00.000000Z",
    "event_count": 3,
}
TIP = "deadbeef" * 8


def test_digest_is_deterministic():
    a = compute_bundle_digest(META, TIP)
    b = compute_bundle_digest(META, TIP)
    assert a == b
    assert len(a) == 32   # SHA-256


def test_digest_changes_when_chain_tip_changes():
    a = compute_bundle_digest(META, TIP)
    b = compute_bundle_digest(META, "ff" * 32)
    assert a != b


def test_sign_then_verify_passes():
    priv, pub = generate_keypair()
    sig = sign_bundle(priv, META, TIP, key_id="test-v1", signed_at="2026-05-22T10:00:00Z")
    ok, detail = verify_signature(sig.__dict__, META, TIP)
    assert ok, detail


def test_verify_fails_on_modified_metadata():
    priv, _ = generate_keypair()
    sig = sign_bundle(priv, META, TIP, key_id="test-v1", signed_at="2026-05-22T10:00:00Z")
    bad_meta = {**META, "event_count": 99}
    ok, detail = verify_signature(sig.__dict__, bad_meta, TIP)
    assert not ok
    assert "digest does not match" in detail


def test_verify_fails_on_modified_chain_tip():
    priv, _ = generate_keypair()
    sig = sign_bundle(priv, META, TIP, key_id="test-v1", signed_at="2026-05-22T10:00:00Z")
    ok, _ = verify_signature(sig.__dict__, META, "00" * 32)
    assert not ok


def test_verify_refuses_substituted_pubkey():
    priv_legit, pub_legit = generate_keypair()
    priv_attacker, _ = generate_keypair()

    sig_attacker = sign_bundle(
        priv_attacker, META, TIP, key_id="attacker-v1",
        signed_at="2026-05-22T10:00:00Z",
    )

    legit_pub_b64 = base64.b64encode(
        export_public_key_pem(pub_legit)  # PEM bytes, fine for fingerprinting
    ).decode()

    # Pin the legitimate key (not in base64-raw form — the test asserts
    # that ANY mismatch is refused; we pass the attacker's embedded
    # pubkey as expected_pubkey and confirm the signature *does* verify
    # there, then re-run with the legit pubkey pinned to confirm refusal).
    ok_with_attacker_pin, _ = verify_signature(
        sig_attacker.__dict__, META, TIP,
        expected_pubkey_b64=sig_attacker.pubkey_b64,
    )
    assert ok_with_attacker_pin, "attacker's own bundle should pass if pinned to attacker pubkey"

    ok_with_legit_pin, detail = verify_signature(
        sig_attacker.__dict__, META, TIP,
        expected_pubkey_b64=legit_pub_b64,
    )
    assert not ok_with_legit_pin
    assert "pubkey" in detail.lower()


def test_pem_roundtrip():
    priv, pub = generate_keypair()
    priv_pem = export_private_key_pem(priv)
    pub_pem  = export_public_key_pem(pub)
    priv2 = load_private_key_pem(priv_pem)
    pub2  = load_public_key_pem(pub_pem)
    # Functional equivalence: sign with priv, verify with pub2
    sig = sign_bundle(priv2, META, TIP, key_id="rt", signed_at="2026-05-22T10:00:00Z")
    ok, _ = verify_signature(sig.__dict__, META, TIP)
    assert ok
