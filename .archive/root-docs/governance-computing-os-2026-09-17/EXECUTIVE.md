# Governance Computing OS — Executive Summary

**Stand:** 2026-09-17  
**Status:** Zielbild. Keine Implementierungs-, Merge-, Deploy- oder Migrationsfreigabe.

## Entscheidung

RealSyncDynamics.AI wird kein Governance-Dashboard mit CRM-Anbau.  
Es wird ein **Governance Computing OS**: operative Unternehmensführung (CEO, CRM, People, Documents, Projects, Browser) und kontrollierte AI (Workspace, Agents, Connectors) unter **einer** Tenant-, Policy-, Evidence- und Audit-Schicht.

Governance bleibt Kontrolllayer, nicht die ganze Anwendung.

## Was das Produkt leistet

| Schicht | Inhalt |
| --- | --- |
| Human Workspace | CEO Command Center, Work, CRM, People, Documents, Browser |
| AI Workspace | Ask / Analyze / Research / Summarize / Compare / Create / Plan / Execute |
| Gate | Auth, Tenant, RLS, Policy, Entitlement, Approval, Cost |
| Außen | MCP / OAuth / REST / Webhooks — Tool-Allowlisting, keine stillen Writes |
| Nachweis | Jede relevante AI-Aussage und jede Aktion → Quelle → Evidence |

## Architekturprinzipien

1. Bestehender Stack bleibt autoritativ (Vite/React/TS, Cloudflare Pages, Supabase Auth/RLS/Edge, Stripe, Evidence Runtime). Kein Stack-Wechsel.
2. Claude nur über AI Gateway, nie direkt aus beliebigen UI-Komponenten. Provider abstrahiert.
3. Retrieval erst nach Tenant → RLS/ACL. Kein „alles suchen, dann filtern“.
4. Person ≠ Permission. Rollen bleiben im bestehenden Auth-Modell.
5. KPIs nur aus echten Daten. Fehlt Anschluss: `NO DATA / NOT CONNECTED`.
6. Write-fähige AI: Intent → Policy → Permission → Approval → Tool → Verification → Audit → Evidence.

## Konkrete Policy-Beispiele

Default: **fail-closed**. Keine Policy-Match → Deny. Jede Entscheidung schreibt Audit + `evidence_ref`.

### P-01 Cross-Tenant Isolation
```
when: any.read | any.write | ai.retrieve | tool.invoke
if:   resource.tenant_id != actor.tenant_id
then: DENY
note: gilt auch für Embeddings, MCP, Agent-Context
```

### P-02 AI Retrieval nur nach ACL
```
when: ai.retrieve | agent.context_build
must: eligible = documents.filter(tenant + RLS + ACL)
then: retrieve(eligible) only
deny: global vector search, post-filter
```

### P-03 Keine stillen Writes
```
when: tool.capability in [write, update, delete, share, merge, send]
must: policy.allow AND permission.allow AND (approval if risk >= medium)
then: execute → verify → audit → evidence
else: DENY, no side effect
```

### P-04 Execute-Gate (AI Workspace)
```
when: ai.mode == EXECUTE
steps: intent → policy → permission → human_approval → tool → verify → evidence
deny:  EXECUTE without approval_id
```

### P-05 Connector Tool-Allowlist (Beispiel GitHub)
```
allow: github.read_repo, github.read_issue, github.read_pr
deny:  github.merge_pr, github.delete_repo, github.write_secret
scope: tenant_id + connected_account
```

### P-06 Dokumentklassifikation
```
when: document.classification in [confidential, personal_data, contract]
deny:  ai.export_external, connector.share, browser.save_unscoped
allow: summarize / analyze inside tenant after ACL
retention: contract = 10y, personal_data = purpose-bound
```

### P-07 CRM Pipeline-Änderung
```
when: opportunity.stage_change
must: actor.has(crm.write) AND audit.reason
then: write stage + previous_stage + actor + ts → evidence
deny: agent stage_change without approval if value >= 25.000
```

### P-08 Personenrechte
```
when: people.employee.update
deny: treating employee_id as authorization source
must: roles from Auth/RLS, not from employee profile fields
```

### P-09 Cost / Entitlement
```
when: ai.invoke
if:   tenant.quota.remaining < estimated_tokens OR plan !includes(mode)
then: DENY
log:  model, tokens, cost, actor, purpose
```

### P-10 EU AI Act / DSGVO Kurzregeln
```
high_risk_context (HR, credit-like scoring, automated decision):
  deny autonomous EXECUTE
  require human oversight + purpose + legal basis
personal_data in prompt/context:
  require purpose, minimization, no training-use, audit
```

Diese Beispiele sind Soll-Semantik für den späteren Policy-Plan (Deliverable H). Sie aktivieren keinen Worker und ändern keine Production-Policies.

## Was bewusst nicht gebaut wird

- Salesforce-Klon
- zweiter Browser neben dem Produkt
- isolierte Mini-Apps
- Vendor-Logik hart in der UI
- parallele Auth-/Tenant-Mechanismen
- Production-Änderungen aus diesem Dokument

## Freeze

Kein Merge, kein Deploy, kein `main`, keine Production-Migration, kein KV-Create, kein Policy-Worker, kein automatischer PR.

## Nächster Schritt

Inventur auf später freigegebenem Branch. Danach Plan A–K (Ist/Soll, Routes, Schema, Edge Functions, Connector-/Tool-/Permission-Modell, Migration, Test, Rollback). Implementierung erst nach Abnahme dieses Plans.
