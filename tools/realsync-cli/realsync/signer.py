"""
Ed25519 bundle signing + verification.

Bundles are signed over their `bundle_digest` — a SHA-256 over a stable
canonicalization of the bundle metadata + the final hash-chain tip.

Signature scope (what is signed):
  canonical = stable_json({
      "bundle_id":    metadata.bundle_id,
      "tenant_id":    metadata.tenant_id,
      "created_at":   metadata.created_at,
      "event_count":  metadata.event_count,
      "chain_tip":    hex(SHA256(canonical(last_event))),
  })
  bundle_digest = SHA256(canonical)
  signature     = Ed25519_sign(private_key, bundle_digest)

Why sign the digest, not the whole bundle: the digest commits to the
entire chain (via chain_tip), and signing a fixed-length digest is what
Ed25519 is designed for. A verifier with the public key and the bundle
file alone can reproduce the digest and check the signature.

Why bundle the public key in the signature block: an external auditor
only needs ONE file (the signed bundle), not a separate trust-store
lookup. Authenticity of the public key itself is established via a
trust root that lives outside this CLI (e.g. published on the SaaS
operator's `.well-known/realsync-keys.json` endpoint).
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Mapping

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)


SIGNATURE_ALGORITHM = "Ed25519"


@dataclass(frozen=True)
class BundleSignature:
    """Self-contained signature record stored on the bundle."""

    algorithm:      str        # always "Ed25519" for now
    key_id:         str        # caller-supplied identifier (e.g. "prod-2026Q2-v3")
    pubkey_b64:     str        # raw 32-byte public key, base64
    bundle_digest:  str        # hex SHA-256 of the signed canonical bundle
    signature_b64: str         # raw 64-byte signature, base64
    signed_at:     str         # ISO-8601 timestamp at signing


# ─────────────────────────────────────────────────────────────────
# Digest construction
# ─────────────────────────────────────────────────────────────────

def compute_bundle_digest(
    metadata:  Mapping[str, object],
    chain_tip: str,
) -> bytes:
    """Return SHA-256 of the canonical bundle digest input.

    Caller passes the verified chain_tip (hex SHA-256 of canonical bytes
    of the last event). This binds the signature to the exact event
    sequence; mutating any event changes the chain_tip and invalidates
    the signature.
    """
    canonical = {
        "bundle_id":   metadata["bundle_id"],
        "tenant_id":   metadata["tenant_id"],
        "created_at":  metadata["created_at"],
        "event_count": metadata["event_count"],
        "chain_tip":   chain_tip,
    }
    payload = json.dumps(
        canonical,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")
    return hashlib.sha256(payload).digest()


# ─────────────────────────────────────────────────────────────────
# Key handling
# ─────────────────────────────────────────────────────────────────

def generate_keypair() -> tuple[Ed25519PrivateKey, Ed25519PublicKey]:
    """Generate a fresh keypair. Used by the mint subcommand for demos."""
    priv = Ed25519PrivateKey.generate()
    return priv, priv.public_key()


def export_private_key_pem(priv: Ed25519PrivateKey) -> bytes:
    """Serialize a private key as PEM (unencrypted — demo only)."""
    return priv.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )


def export_public_key_pem(pub: Ed25519PublicKey) -> bytes:
    """Serialize a public key as PEM for sidecar distribution."""
    return pub.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )


def load_private_key_pem(pem: bytes) -> Ed25519PrivateKey:
    key = serialization.load_pem_private_key(pem, password=None)
    if not isinstance(key, Ed25519PrivateKey):
        raise TypeError("key is not Ed25519")
    return key


def load_public_key_pem(pem: bytes) -> Ed25519PublicKey:
    key = serialization.load_pem_public_key(pem)
    if not isinstance(key, Ed25519PublicKey):
        raise TypeError("key is not Ed25519")
    return key


# ─────────────────────────────────────────────────────────────────
# Sign / verify
# ─────────────────────────────────────────────────────────────────

def sign_bundle(
    priv:         Ed25519PrivateKey,
    metadata:     Mapping[str, object],
    chain_tip:    str,
    key_id:       str,
    signed_at:    str,
) -> BundleSignature:
    """Produce a BundleSignature over (metadata, chain_tip)."""
    digest = compute_bundle_digest(metadata, chain_tip)
    sig    = priv.sign(digest)

    pub = priv.public_key()
    pub_raw = pub.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )

    import base64
    return BundleSignature(
        algorithm=     SIGNATURE_ALGORITHM,
        key_id=        key_id,
        pubkey_b64=    base64.b64encode(pub_raw).decode("ascii"),
        bundle_digest= digest.hex(),
        signature_b64= base64.b64encode(sig).decode("ascii"),
        signed_at=     signed_at,
    )


def verify_signature(
    signature: Mapping[str, str],
    metadata:  Mapping[str, object],
    chain_tip: str,
    expected_pubkey_b64: str | None = None,
) -> tuple[bool, str]:
    """Verify a signature against a freshly-computed digest.

    If `expected_pubkey_b64` is supplied, the embedded pubkey is checked
    against it FIRST — refusing to silently accept a substituted key is
    important when the trust root is external.
    """
    import base64

    if signature.get("algorithm") != SIGNATURE_ALGORITHM:
        return False, f"unsupported algorithm: {signature.get('algorithm')!r}"

    embedded_pub = signature.get("pubkey_b64")
    if not embedded_pub:
        return False, "signature.pubkey_b64 missing"
    if expected_pubkey_b64 is not None and embedded_pub != expected_pubkey_b64:
        return False, "embedded pubkey does not match expected pubkey"

    try:
        pub_raw = base64.b64decode(embedded_pub)
        pub = Ed25519PublicKey.from_public_bytes(pub_raw)
    except Exception as e:
        return False, f"pubkey malformed: {e}"

    try:
        sig_raw = base64.b64decode(signature["signature_b64"])
    except Exception as e:
        return False, f"signature_b64 malformed: {e}"

    fresh_digest = compute_bundle_digest(metadata, chain_tip)
    if fresh_digest.hex() != signature.get("bundle_digest"):
        return False, "bundle_digest does not match recomputed digest"

    try:
        pub.verify(sig_raw, fresh_digest)
    except InvalidSignature:
        return False, "Ed25519 signature invalid for the supplied keypair"
    except Exception as e:
        return False, f"verify call raised: {e}"

    return True, "signature verified"
