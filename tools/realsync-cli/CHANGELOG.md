# Changelog

All notable changes to `realsync-cli` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- `realsync inspect <bundle>` — fast metadata + event-type/severity/source breakdown without running cryptographic checks. Text and `--json` output.
- `realsync verify --json` — machine-readable verification report for auditor CI pipelines. Schema: `{result, bundle_id, tenant_id, ..., checks: [{name, ok, detail}]}`.
- `tests/test_cli.py` — exit-code + JSON-schema contract tests for all subcommands.
- `tests/test_perf.py` — scale demonstrations: 10k events build + chain + verify in < 3s (CI-loose threshold).
- `.github/workflows/test.yml` — CI matrix across Python 3.10 / 3.11 / 3.12; runs pytest plus end-to-end CLI smoke against the committed sample + tampered bundles.

## [0.1.0] — 2026-05-22

### Added
- Initial release. SPEC-001 evidence-bundle verifier.
- Modules: `canonical`, `bundle`, `hashchain`, `signer`, `verifier`, `cli`.
- Subcommands: `verify`, `replay`, `mint`, `keygen`.
- 26 tests covering TS-parity, hash-chain tamper detection, Ed25519 sign/verify, public-key-substitution refusal, end-to-end mint→verify→tamper.
- Demo bundles in `data/` (valid + tampered + public key).
- MIT-licensed.
