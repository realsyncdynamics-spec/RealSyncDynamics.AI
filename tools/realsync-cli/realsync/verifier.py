"""
End-to-end bundle verification — composes structure + chain + signature.

Output is a list of `CheckResult` records so the CLI can render a
deterministic report. Each check carries a stable name (matches the
public-API contract for downstream tooling) and a verdict.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from . import bundle as bundle_mod
from .hashchain import event_hash, verify_chain
from .signer import verify_signature


@dataclass(frozen=True)
class CheckResult:
    name:    str
    ok:      bool
    detail:  str


def verify_bundle(
    bundle: dict[str, Any],
    expected_tenant: str | None = None,
    expected_pubkey_b64: str | None = None,
) -> list[CheckResult]:
    """Run the full check battery in dependency order.

    Subsequent checks short-circuit on earlier structural failure —
    running hash-chain verification against a malformed bundle would
    produce noise that obscures the real fault.
    """
    results: list[CheckResult] = []

    # 1. Structural shape
    ok, detail = bundle_mod.validate_structure(bundle)
    results.append(CheckResult("structure", ok, detail))
    if not ok:
        return results

    # 2. Tenant scope
    if expected_tenant is not None:
        actual_tenant = bundle["metadata"]["tenant_id"]
        tenant_match = actual_tenant == expected_tenant
        results.append(CheckResult(
            "tenant_match",
            tenant_match,
            f"metadata.tenant_id={actual_tenant!r}, expected={expected_tenant!r}",
        ))
        if not tenant_match:
            # No point continuing — caller is verifying the wrong bundle.
            return results

    ok, detail = bundle_mod.validate_tenant_scope(bundle)
    results.append(CheckResult("tenant_scope", ok, detail))
    if not ok:
        return results

    # 3. tenant_seq monotonicity
    ok, detail = bundle_mod.validate_sequence(bundle)
    results.append(CheckResult("tenant_seq", ok, detail))
    # tenant_seq gaps are fatal for the chain too — short-circuit.
    if not ok:
        return results

    # 4. Hash chain
    chain = verify_chain(bundle["events"])
    if chain.ok:
        results.append(CheckResult("hash_chain", True, chain.detail))
    else:
        results.append(CheckResult(
            "hash_chain",
            False,
            f"{chain.detail} | expected_prev={chain.expected_prev_hex}"
            f" | actual_prev={chain.actual_prev_hex}",
        ))
        # Without a valid chain, the signature's chain_tip claim is
        # already invalid by construction — but we still verify the
        # signature so the auditor can see WHICH integrity layer broke.
    chain_tip = (
        event_hash(bundle["events"][-1]).hex() if bundle["events"] else ""
    )

    # 5. Ed25519 signature
    ok, detail = verify_signature(
        bundle["signature"],
        bundle["metadata"],
        chain_tip,
        expected_pubkey_b64=expected_pubkey_b64,
    )
    results.append(CheckResult("signature", ok, detail))

    return results


def passed(results: list[CheckResult]) -> bool:
    return all(r.ok for r in results)


def format_report(
    bundle: dict[str, Any],
    results: list[CheckResult],
) -> str:
    """Render a human-readable report for the CLI.

    Stable column widths so a screenshot of the output reads cleanly.
    """
    md = bundle.get("metadata", {})
    sig = bundle.get("signature", {})
    lines: list[str] = []
    lines.append("=" * 72)
    lines.append("EVIDENCE BUNDLE VERIFICATION REPORT")
    lines.append("=" * 72)
    lines.append(f"  bundle_id   : {md.get('bundle_id', '?')}")
    lines.append(f"  tenant_id   : {md.get('tenant_id', '?')}")
    lines.append(f"  created_at  : {md.get('created_at', '?')}")
    lines.append(f"  event_count : {md.get('event_count', '?')}")
    lines.append(f"  key_id      : {sig.get('key_id', '?')}")
    lines.append("-" * 72)
    for r in results:
        verdict = "PASS" if r.ok else "FAIL"
        lines.append(f"  [{verdict}] {r.name:<14} {r.detail}")
    lines.append("-" * 72)
    overall = "PASSED" if passed(results) else "FAILED"
    lines.append(f"  RESULT      : {overall}")
    lines.append("=" * 72)
    return "\n".join(lines)


def format_report_json(
    bundle: dict[str, Any],
    results: list[CheckResult],
) -> dict[str, Any]:
    """Machine-readable verification report.

    Intended for auditor CI pipelines: parse exit code first (0/1), then
    pull `checks` array for the corruption-boundary details. Schema is
    intentionally flat — nested objects add no value here and complicate
    jq queries.
    """
    md = bundle.get("metadata", {})
    sig = bundle.get("signature", {})
    return {
        "result":      "PASSED" if passed(results) else "FAILED",
        "bundle_id":   md.get("bundle_id"),
        "tenant_id":   md.get("tenant_id"),
        "created_at":  md.get("created_at"),
        "event_count": md.get("event_count"),
        "key_id":      sig.get("key_id"),
        "checks": [
            {"name": r.name, "ok": r.ok, "detail": r.detail}
            for r in results
        ],
    }
