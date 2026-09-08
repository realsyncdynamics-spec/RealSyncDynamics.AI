# RealSync OS — Command Center

**Branch:** `feat/realsync-os-kernel`  
**Stand:** 2026-09-08  
**Status:** Kernel + Command-Center-Loop an `/app/intelligence` gebunden. SiteOS ist der Executor.

## Loop

```
Intent → Plan → Policy / Approval Gate → SiteOS Execution → Observe → Verify → Evidence Event
```

Die bisherige „Frage → Route"-Logik in `DashboardView` ist ersetzt:

- `RUN` öffnet `openCommandSession` (kein Blind-Execute, keine Navigation).
- Der Plan wird angezeigt. Production/Governance bleibt approval-pflichtig.
- `APPROVE PLAN` ruft `approveSession` und danach `runUntilTerminal` mit `createSiteOsExecutor`.
- `REJECT` bleibt ein Policy-Event.

## API

```ts
import {
  openCommandSession,
  approveSession,
  advanceSession,
  runUntilTerminal,
  createSiteOsExecutor,
} from '@/core/realsync-os';

const session = openCommandSession(intent);
approveSession(session, intent.actorId);
await runUntilTerminal(session, { executeStep: createSiteOsExecutor(tenantId) });
```

`runIntentToCompletion` führt **nicht** mehr automatisch aus. `autoApprove` default ist `false`.

## Substrate mapping

| Plan action | Tool | Verhalten |
|---|---|---|
| analyze_project / discover | `siteos.listSites` | echte Site-Liste, keine Demo-Zahlen |
| create_design_system | `siteos.builder` | Beobachtung: Tokens kommen mit dem Blueprint |
| write_frontend | `siteos/builder` | echter Build, kein Fake-Success |
| verify_frontend | `siteos/runtime-scan` | nur mit Live-URL, sonst `NOT IMPLEMENTED` |
| optimize_visibility | `siteos/agents` seo | queued Run oder ehrliche Leermeldung |
| evaluate_governance | `siteos/agents` compliance | queued Run; awaiting_approval wird nicht umgangen |
| publish | `siteos/publish-gate` | evaluiert nur. Kein `approvePublish`, kein Deploy |

Ohne gebundenen Executor: mutierende Steps → `NOT IMPLEMENTED`. Nie No-Op-Succeed.

## Nicht enthalten

- DesignOS / RealSync Build als eigene Oberfläche
- Continuous Operations / autonome Remediation nach Deploy
- Canva / Microsoft / MCP Connector-Runtime
