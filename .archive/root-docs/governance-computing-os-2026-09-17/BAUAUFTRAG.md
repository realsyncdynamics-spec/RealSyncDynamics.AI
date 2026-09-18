# RealSyncDynamics.AI — Governance Computing OS

**Status:** Zielarchitektur / Claude-Code-Cowork-Bauauftrag  
**Stand:** 2026-09-17  
**Geltung:** Nicht gegen `main`, nicht gegen eingefrorenen Abnahmebranch, keine Migration, kein Deploy, kein KV-Create, kein Worker-Activate.  
**Bestehende Grundlage bleibt autoritativ:** Vite + React + TypeScript + Tailwind · Cloudflare Pages · Supabase Auth/Postgres/Edge Functions/RLS · Stripe · bestehendes Governance Runtime / Evidence-Modell.

Vollständige Fassung inkl. Navigation, CRM/People/Documents/AI/Connectors/Agents, Policy P-01–P-10 und Plan A–K:
siehe Sibling `EXECUTIVE.md` und das lokale Artifact `GOVERNANCE_COMPUTING_OS_BAUAUFTRAG.md`.

## Freeze

Kein Merge. Kein Deploy. Kein `main`. Kein automatischer PR. Kein `wrangler kv create`. Kein Policy-Worker-Activate.

Reihenfolge: Ist-Infra → Auth/Tenant → Policy-Query-Semantik → erst dann KV/Deploy/Schema.

## Entscheidung

Kein CRM-Anbau. Ziel: Governance Computing Workspace unter gemeinsamer Tenant-/Evidence-/Policy-Schicht.

## Pflicht vor Code

Inventur, dann Deliverables A–K. Implementierung erst nach Abnahme und nur auf freigegebenem Branch.
