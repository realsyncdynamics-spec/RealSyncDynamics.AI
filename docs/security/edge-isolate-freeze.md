# Edge Isolate Freeze (Workers Policy/KV)

Cloudflare disclosed a remote Spectre-on-Workers-isolates class in Aug 2026.
Workers isolates can share a process, so isolate heap data is a high-value target.
For RealSync, this means policy plaintext and privileged credentials are not edge-safe.
Current policy/KV worker behavior is therefore frozen from production activation.
No Cloudflare policy/KV worker rollout, no KV namespace creation, no prod deploy of `src/workers`.

The freeze is not only Spectre-driven.
`/api/policies/{tenantId}/{policyId}` currently trusts URL tenant input and uses service role.
`kv-cache` currently reads `ai_policies` with service-role ****** and then filters in JS.
That bypasses RLS and can load full tenant policy JSON into `POLICY_CACHE`.
`handleInvalidateTenant` also has no membership authorization gate.

RealSync contract:
- Edge may verify JWT signature and expiration only.
- Edge may not hold service role keys.
- Edge may not hold session tokens.
- Edge may not cache policy plaintext.

Unfreeze requires: tenant from `requireAuthAndTenant`, service role removed from worker runtime, and non-plaintext policy handling that is safe under isolate + KV replication risk.
