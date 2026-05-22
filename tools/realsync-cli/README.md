# realsync-cli

**Offline verifier for RealSyncDynamics.AI governance evidence bundles.**

A signed evidence bundle is a sealed record of governance events — tracker detections, AI-system findings, policy violations, approval gates, remediations — produced by the RealSyncDynamics.AI runtime. `realsync-cli` lets an external auditor verify that bundle locally, without access to the producing system or any network call. Needed: the bundle file, the operator's published public key, this CLI.

The producing system uses SPEC-001 envelopes. This verifier mirrors that schema byte-for-byte; parity is enforced by test fixtures hand-extracted from the TypeScript reference.

> Conceptual reference prototype. The cryptographic primitives are real (Ed25519, SHA-256); the operational maturity (key-rotation UX, distribution of trust roots, signed timestamps) is not. Use at your own risk.

## What it proves

Three layers of evidence, independently:

| Layer | Mechanism | Catches |
|---|---|---|
| **Tenant scope** | every event's `tenant_id` ↔ metadata | cross-tenant leakage |
| **Hash chain** | each event's `prev_hash` = SHA-256(canonical(previous event)) | any in-place edit, insertion, or deletion |
| **Ed25519 signature** | signed over (metadata, chain_tip) | tampering with the final event or metadata, or substituted bundles |

Defence in depth. To pass all three an attacker would have to re-derive the entire chain AND own the operator's private key.

## Install

Requires **Python 3.10+**. Ed25519 is not in the Python standard library, so one dependency is unavoidable.

### Linux / macOS

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### Windows (PowerShell 5.1 or 7+)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
```

If `Activate.ps1` is blocked: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` once.

## Usage

### Verify a bundle

```bash
realsync verify data/sample_bundle.json
```

Pin the expected tenant (refuses on mismatch — protects against bundle confusion):

```bash
realsync verify data/sample_bundle.json --tenant tenant-acme-corp
```

Pin the expected public key (refuses if the embedded key was substituted):

```bash
realsync verify data/sample_bundle.json --pubkey data/demo.pub.pem
```

Machine-readable output for auditor CI pipelines:

```bash
realsync verify data/sample_bundle.json --json | jq '.checks[] | select(.ok == false)'
```

Exit code `0` on PASS, `1` on any FAIL.

### Inspect (fast triage, no crypto)

```bash
realsync inspect data/sample_bundle.json
realsync inspect data/sample_bundle.json --json
```

Shows metadata, time range, and event counts grouped by `type`, `severity`, and `source`. Runs in milliseconds even for very large bundles — does not recompute any hashes. **Always follow up with `verify` before trusting the content.**

### Replay events chronologically

```bash
realsync replay data/sample_bundle.json
```

### Mint a fresh bundle (demo helper)

```bash
realsync keygen --private-out demo.key.pem --public-out demo.pub.pem
realsync mint \
  --events     raw_events.json \
  --private-key demo.key.pem \
  --out        my_bundle.json \
  --bundle-id  bundle-2026-q2 \
  --key-id     demo-v1
```

`raw_events.json` is a JSON array of envelopes WITHOUT `prev_hash` set — `mint` builds the chain.

## Tests

```bash
pytest
```

37 cases:

- **Canonical bytes parity** with TypeScript reference (9 cases — known-good fixtures + edge cases)
- **Hash chain** build + verify, tamper detection at any position (5 cases)
- **Ed25519** sign + verify + pubkey-substitution refusal + PEM round-trip (7 cases)
- **End-to-end** mint→verify, tamper→fail-with-specific-layer, disk round-trip (5 cases)
- **CLI contracts** exit codes + `--json` schema + short-circuit behaviour (9 cases)
- **Scale** 10k events build + chain + verify in well under three seconds (2 cases)

CI runs the full suite plus the CLI smoke against the committed sample + tampered bundles on Python 3.10 / 3.11 / 3.12 via GitHub Actions (`.github/workflows/test.yml`). The workflow only activates when this directory is extracted to a standalone repository (GitHub Actions requires `.github/workflows/` at repo root); use `git subtree split --prefix=tools/realsync-cli HEAD` to extract.

## Design notes

- **No standard-library-only stance.** Ed25519 in pure Python is reckless; the `cryptography` package ships OpenSSL-backed wheels for every supported OS — installation requires no compiler.
- **Determinism is the contract.** Same envelope → same canonical bytes → same hash → same signature. Any drift here breaks cross-implementation verifiability; the parity tests fail loudly.
- **Refuse-by-default for pinned identifiers.** If the caller pins `--tenant` or `--pubkey`, a mismatch short-circuits the whole report. Silent acceptance of substituted identifiers is the canonical multi-tenant verifier bug.
- **Surface the corruption boundary.** When a chain breaks, the report shows the exact event index plus expected-vs-actual prev_hash. An auditor sees the lie, not just the verdict.

## License

MIT. See `LICENSE`.
