# SF-002 — Offline REA analysis worker (draft)

This is an **opt-in local execution adapter**, not a deployed worker, endpoint, agent session, or permission grant. This stacked PR depends on SF-001 (`feat/sf-001-factory-contracts`) and does not modify the existing AI-OS gateway.

## Security and operations

- Use a dedicated worker host with rootless Docker and a separate low-privilege OS account. Never expose the Docker socket to web apps, coding agents or analysis containers.
- Only a separately authenticated orchestrator may construct `TrustedActor` and approved `FactoryJob` objects. TypeScript types are not authentication; never pass user-supplied actor/job objects straight to `runReaStaticJs`.
- Stage input in a private preapproved directory, owned by the trusted host worker, and readable by container UID 65534. Path, scope, status and image checks fail closed.
- Build and scan a local image containing the official version-pinned `rea-agents` release and compatible Node (REA requires Node 22.23.4+, 24.22.1+, or 26.12.1+). **Do not install packages at runtime.** Use only a verified `realsync/factory-rea@sha256:<64 lowercase hex>` image reference. No image is provided by this PR.
- The static JavaScript CLI runs with `--network=none`, read-only filesystem and input bind, dropped capabilities, UID 65534, no privilege escalation, fixed CPU/memory/process limits and no host secrets or GitHub tokens.
- The CLI adapter enforces 2 MiB output and 120 seconds max; failures request forced container cleanup. Also enforce OS/daemon-level limits in case Docker stops responding.
- REA output is untrusted. Its SHA-256 receipt is not a signed attestation or proof of correct findings; evidence persistence and independent checking require a later approved service.
- `reaMcpStdioDescriptor()` names the official `rea mcp` stdio entrypoint **only**. An interactive REA MCP broker, tool-by-tool allowlist and coding-agent wiring are not implemented in SF-002. REA itself is not a sandbox.

## Acceptance

In a full checkout run `npm run lint` and `npx vitest run test/factory-worker/`. On a separate approved offline host: test a synthetic JS app, verify actual image digest, output/evidence, zero egress, no host writes, timeout cleanup, identity validation and resource quotas. No production or third-party scan. SF-001 review, worker-host review and human approval are prerequisites to executing this adapter.
