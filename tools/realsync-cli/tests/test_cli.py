"""CLI smoke tests: --json output, inspect subcommand, exit codes.

Subprocess-style tests would give the strongest guarantee but add Python
launch overhead per test. We invoke `main()` in-process and capture
stdout via the capsys fixture — same exit-code contract, faster.
"""
import json

import pytest

from realsync.cli import main


SAMPLE   = "data/sample_bundle.json"
TAMPERED = "data/tampered_bundle.json"


def test_verify_pass_exit_zero(capsys):
    assert main(["verify", SAMPLE]) == 0
    assert "PASSED" in capsys.readouterr().out


def test_verify_fail_exit_one(capsys):
    assert main(["verify", TAMPERED]) == 1
    assert "FAILED" in capsys.readouterr().out


def test_verify_json_is_valid_json(capsys):
    code = main(["verify", SAMPLE, "--json"])
    out = capsys.readouterr().out
    parsed = json.loads(out)
    assert parsed["result"] == "PASSED"
    assert parsed["tenant_id"] == "tenant-acme-corp"
    assert code == 0
    # Each check carries a stable contract; downstream tooling pivots on these names.
    names = {c["name"] for c in parsed["checks"]}
    assert {"structure", "tenant_scope", "tenant_seq", "hash_chain", "signature"} <= names


def test_verify_json_fail_reports_broken_layer(capsys):
    code = main(["verify", TAMPERED, "--json"])
    out = capsys.readouterr().out
    parsed = json.loads(out)
    assert parsed["result"] == "FAILED"
    assert code == 1
    chain = next(c for c in parsed["checks"] if c["name"] == "hash_chain")
    assert chain["ok"] is False
    # The diagnostic surfaces the exact corruption boundary.
    assert "event 2" in chain["detail"]
    assert "expected_prev=" in chain["detail"]
    assert "actual_prev="   in chain["detail"]


def test_verify_wrong_tenant_short_circuits(capsys):
    code = main(["verify", SAMPLE, "--tenant", "tenant-imposter", "--json"])
    parsed = json.loads(capsys.readouterr().out)
    assert code == 1
    assert parsed["result"] == "FAILED"
    # Short-circuit means we DON'T see chain/signature checks in the report.
    names = {c["name"] for c in parsed["checks"]}
    assert "tenant_match" in names
    assert "hash_chain"   not in names
    assert "signature"    not in names


def test_inspect_text_output(capsys):
    assert main(["inspect", SAMPLE]) == 0
    out = capsys.readouterr().out
    assert "EVIDENCE BUNDLE INSPECTION" in out
    assert "by type:"     in out
    assert "by severity:" in out


def test_inspect_json_output(capsys):
    assert main(["inspect", SAMPLE, "--json"]) == 0
    parsed = json.loads(capsys.readouterr().out)
    assert parsed["bundle_id"] == "bundle-demo-001"
    assert parsed["event_count"] == 3
    assert "by_type"     in parsed
    assert "by_severity" in parsed
    assert "by_source"   in parsed
    # Stable shape: dict keyed by type name → count.
    assert all(isinstance(v, int) for v in parsed["by_type"].values())


def test_replay_exits_zero(capsys):
    assert main(["replay", SAMPLE]) == 0
    out = capsys.readouterr().out
    assert "EVENT REPLAY" in out


def test_unknown_subcommand_errors(capsys):
    with pytest.raises(SystemExit):
        main(["nonsense"])
