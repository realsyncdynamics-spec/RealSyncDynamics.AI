"""
Command-line entry point.

Subcommands:
  verify   — Run full check battery on a bundle, exit 0 if PASS, 1 if FAIL.
  replay   — Render events in chronological order.
  mint     — Generate a fresh signed bundle from raw events (demo helper).
  keygen   — Emit a new Ed25519 keypair to disk (demo helper).

Run from project root:  python -m realsync.cli <subcommand> [args]
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from . import __version__
from .bundle import load_bundle, save_bundle
from .hashchain import build_chain, event_hash
from .signer import (
    export_private_key_pem,
    export_public_key_pem,
    generate_keypair,
    load_private_key_pem,
    sign_bundle,
)
from .verifier import format_report, format_report_json, passed, verify_bundle


def cmd_verify(args: argparse.Namespace) -> int:
    bundle = load_bundle(args.bundle)
    expected_pub = None
    if args.pubkey:
        # Embedded vs sidecar match — used when the auditor pins a key.
        import base64
        from cryptography.hazmat.primitives import serialization
        pub = serialization.load_pem_public_key(Path(args.pubkey).read_bytes())
        raw = pub.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        expected_pub = base64.b64encode(raw).decode("ascii")

    results = verify_bundle(
        bundle,
        expected_tenant=args.tenant,
        expected_pubkey_b64=expected_pub,
    )
    if args.json:
        print(json.dumps(
            format_report_json(bundle, results),
            sort_keys=True, indent=2, ensure_ascii=False,
        ))
    else:
        print(format_report(bundle, results))
    return 0 if passed(results) else 1


def cmd_inspect(args: argparse.Namespace) -> int:
    """Fast triage: metadata + event-type/severity breakdown without verifying.

    For auditor first-pass: "what is in this bundle". Skips all
    cryptographic work — large bundles return in milliseconds. Always
    run `verify` afterwards before trusting the content.
    """
    from collections import Counter

    bundle = load_bundle(args.bundle)
    md = bundle.get("metadata", {})
    sig = bundle.get("signature", {})
    events = bundle.get("events", [])

    types     = Counter(ev.get("type", "?") for ev in events)
    severity  = Counter(ev.get("severity", "?") for ev in events)
    sources   = Counter(ev.get("source", "?") for ev in events)
    ts_first  = events[0].get("ts") if events else None
    ts_last   = events[-1].get("ts") if events else None

    if args.json:
        print(json.dumps({
            "bundle_id":   md.get("bundle_id"),
            "tenant_id":   md.get("tenant_id"),
            "created_at":  md.get("created_at"),
            "event_count": len(events),
            "key_id":      sig.get("key_id"),
            "algorithm":   sig.get("algorithm"),
            "ts_first":    ts_first,
            "ts_last":     ts_last,
            "by_type":     dict(types),
            "by_severity": dict(severity),
            "by_source":   dict(sources),
        }, sort_keys=True, indent=2, ensure_ascii=False))
        return 0

    print("=" * 72)
    print("EVIDENCE BUNDLE INSPECTION (no verification)")
    print("=" * 72)
    print(f"  bundle_id   : {md.get('bundle_id', '?')}")
    print(f"  tenant_id   : {md.get('tenant_id', '?')}")
    print(f"  created_at  : {md.get('created_at', '?')}")
    print(f"  event_count : {len(events)}")
    print(f"  key_id      : {sig.get('key_id', '?')}")
    print(f"  algorithm   : {sig.get('algorithm', '?')}")
    if events:
        print(f"  ts_first    : {ts_first}")
        print(f"  ts_last     : {ts_last}")
    print("-" * 72)
    print("  by type:")
    for k, v in sorted(types.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"    {v:5d}  {k}")
    print("  by severity:")
    for k, v in sorted(severity.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"    {v:5d}  {k}")
    print("  by source:")
    for k, v in sorted(sources.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"    {v:5d}  {k}")
    print("=" * 72)
    return 0


def cmd_replay(args: argparse.Namespace) -> int:
    bundle = load_bundle(args.bundle)
    md = bundle.get("metadata", {})
    print("=" * 72)
    print("EVENT REPLAY")
    print("=" * 72)
    print(f"  bundle_id   : {md.get('bundle_id', '?')}")
    print(f"  tenant_id   : {md.get('tenant_id', '?')}")
    print(f"  event_count : {md.get('event_count', '?')}")
    print("-" * 72)
    for i, ev in enumerate(bundle.get("events", [])):
        print(
            f"[{i:03d}] seq={ev.get('tenant_seq', '?')} "
            f"ts={ev.get('ts', '?')} type={ev.get('type', '?')}"
        )
        print(f"      payload: {json.dumps(ev.get('payload', {}), sort_keys=True)}")
        prev = ev.get("prev_hash")
        if prev is not None:
            print(f"      prev_hash: {prev[:16]}…")
    print("=" * 72)
    return 0


def cmd_mint(args: argparse.Namespace) -> int:
    """Build a signed bundle from a list of raw events.

    Reads:
      - events JSON file (an array)
      - private key PEM file
    Writes:
      - signed bundle JSON
    """
    raw_events = json.loads(Path(args.events).read_text(encoding="utf-8-sig"))
    if not isinstance(raw_events, list):
        print("ERROR: events file must contain a JSON array", file=sys.stderr)
        return 2

    priv = load_private_key_pem(Path(args.private_key).read_bytes())
    chained = build_chain(raw_events)

    tenant_id = chained[0]["tenant_id"] if chained else args.tenant
    if not tenant_id:
        print("ERROR: cannot infer tenant_id (empty events + no --tenant)", file=sys.stderr)
        return 2

    metadata = {
        "bundle_id":   args.bundle_id,
        "tenant_id":   tenant_id,
        "created_at":  args.created_at or _now_iso(),
        "event_count": len(chained),
    }
    chain_tip = event_hash(chained[-1]).hex() if chained else ""
    signature = sign_bundle(
        priv,
        metadata,
        chain_tip,
        key_id=args.key_id,
        signed_at=_now_iso(),
    )
    bundle = {
        "metadata":  metadata,
        "events":    chained,
        "signature": signature.__dict__,
    }
    save_bundle(bundle, args.out)
    print(f"wrote signed bundle: {args.out}")
    return 0


def cmd_keygen(args: argparse.Namespace) -> int:
    priv, pub = generate_keypair()
    Path(args.private_out).write_bytes(export_private_key_pem(priv))
    Path(args.public_out).write_bytes(export_public_key_pem(pub))
    print(f"wrote private key : {args.private_out}")
    print(f"wrote public key  : {args.public_out}")
    return 0


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")[:-4] + "Z"


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="realsync",
        description="Governance evidence bundle verifier (SPEC-001).",
    )
    p.add_argument(
        "--version", action="version", version=f"realsync-cli {__version__}",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    pv = sub.add_parser("verify", help="Verify a bundle (structure + chain + signature).")
    pv.add_argument("bundle", help="Path to bundle JSON")
    pv.add_argument("--tenant", help="Expected tenant_id (refuses on mismatch)")
    pv.add_argument("--pubkey", help="Path to expected pubkey PEM (refuses on key substitution)")
    pv.add_argument("--json", action="store_true", help="Emit machine-readable JSON report")
    pv.set_defaults(func=cmd_verify)

    pi = sub.add_parser("inspect", help="Fast metadata + event-type triage (no crypto).")
    pi.add_argument("bundle", help="Path to bundle JSON")
    pi.add_argument("--json", action="store_true", help="Emit machine-readable JSON")
    pi.set_defaults(func=cmd_inspect)

    pr = sub.add_parser("replay", help="Print events in chronological order.")
    pr.add_argument("bundle", help="Path to bundle JSON")
    pr.set_defaults(func=cmd_replay)

    pm = sub.add_parser("mint", help="Build a signed bundle from raw events (demo helper).")
    pm.add_argument("--events", required=True, help="Path to events JSON array")
    pm.add_argument("--private-key", required=True, help="Path to Ed25519 private key PEM")
    pm.add_argument("--out", required=True, help="Output bundle JSON path")
    pm.add_argument("--bundle-id", required=True)
    pm.add_argument("--key-id", required=True, help="Stable key identifier (e.g. 'prod-2026Q2-v3')")
    pm.add_argument("--created-at", help="Override metadata.created_at (defaults to now)")
    pm.add_argument("--tenant", help="Tenant id (only used if events list is empty)")
    pm.set_defaults(func=cmd_mint)

    pk = sub.add_parser("keygen", help="Generate a fresh Ed25519 keypair (demo helper).")
    pk.add_argument("--private-out", required=True)
    pk.add_argument("--public-out",  required=True)
    pk.set_defaults(func=cmd_keygen)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
