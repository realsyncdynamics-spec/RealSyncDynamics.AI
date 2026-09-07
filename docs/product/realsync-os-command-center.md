# RealSync OS — Command Center

**Branch:** `feat/realsync-os-kernel`  
**Stand:** 2026-09-08  
**Status:** Kernel + Command-Center-Loop (additiv, kein Parallelstack)

## Loop

```
Intent → Plan → Policy / Approval Gate → Execution State → Evidence Event
```

Der Command Center ersetzt die bisherige „Frage → Route“-Logik nicht physisch im Dashboard,
sondern stellt den verbindlichen Ablauf bereit, an den das Dashboard als nächstes angebunden wird.

## API

```ts
import {
  openCommandSession,
  approveSession,
  advanceSession,
  runIntentToCompletion,
} from '@/core/realsync-os';

const intent = {
  id: crypto.randomUUID(),
  text: 'Landingpage bauen, DSGVO prüfen und deployen',
  tenantId: 'tenant-1',
  actorId: 'user-1',
  createdAt: new Date().toISOString(),
};

const session = runIntentToCompletion(intent, { autoApprove: false });
// session.phase === 'awaiting_approval' bei high/critical Steps
```

## Substrate

- Planner und PolicyEngine bleiben Source of Truth.
- SiteOS Blueprints, Agent Runs, Evidence, Risk und Provenance bleiben Runtime-Substrate.
- Command Center erzeugt nur OS-Events und Step-State. Kein zweites Builder-Backend.

## Nächste Bindings

1. Dashboard-Command-Eingabe auf `openCommandSession`.
2. Approval-UI auf `approveSession` / `rejectSession`.
3. SiteOS-Agent-Run als Executor hinter `advanceSession` (statt No-Op succeed).
4. DesignOS / RealSync Build als zweite Oberfläche auf demselben Kernel.
