# SF-006 – CI evidence for SF-004 offline integration

**Status:** Review-only. This step provides a GitHub Actions test runner for the existing SF-003/SF-005/SF-004 JavaScript modules; it does not turn the Software Factory into an autonomous coding agent.

## Scope
- Dedicated GitHub Actions job for the four checked-in Node.js test suites (handoff, loop engine, composition, actual module imports).
- Syntax check of ten relevant JavaScript modules and test files.
- Node.js 22, built-in `node:test`, no dependency installation, no cloud credentials.
- Repository-only permissions (`contents: read`), checkout does not retain credentials, five-minute time limit.
- Triggered on the SF-006 review branch and matching pull requests; no dispatch, merge, publication, database mutation or deployment action.

## Evidence contract
A green CI job means only that the named repository tests ran successfully on a hosted GitHub Actions runner at the referenced commit. **It does not attest a rootless or network-isolated sandbox**, independent verification of a Git checkout, real REA or Claude/Codex execution, server-side tenant authorization, budget reservation, durable transaction persistence, or a production-ready release.

A CI job that has not finished must be reported as **pending**, never as passed. Refer to the run URL, commit SHA, test suite count and conclusion when reporting success or failure. Keep SF-004 `awaiting_verification` irrespective of the CI result.

## Subsequent acceptance gates
1. Compare SF-001/002 contracts against open parallel draft PRs #2346/#2347, then resolve drift before any merge.
2. Run independent checkout+SHA attestation and negative tests inside an isolated rootless container with network denied and resource ceilings.
3. Integrate authenticated server-side authorization, tenant fencing/leases and transactional PostgreSQL state.
4. Persist independent test and cost evidence, then enforce mandatory human review and a separate release approval.

**No permission to merge into main or deploy is implied by this CI gate.**
