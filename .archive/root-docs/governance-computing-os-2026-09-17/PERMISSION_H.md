# Plan H — Permission Model

**Stand:** 2026-09-18  
**Status:** Soll-Semantik. Keine Migration, kein RLS-Rewrite, kein Worker.

## 1. Trennlinien

```
Identity          Auth user (Supabase)
Tenant binding    memberships.tenant_id + role
Authorization     role + entitlement + policy + AAL2 where required
Employee record   People-Modul (später) — Anzeige, nie Auth-Quelle
```

Person ≠ Permission. Edge Functions, die `employee.role` oder eine Profilspalte als Recht lesen, sind Deny.

## 2. Drei Ist-Vokabulare

| Quelle | Rollen | Bewertung |
| --- | --- | --- |
| A `memberGuards.ts` / `memberships` CHECK | `owner admin dpo editor viewer_auditor` | **Kanon für Tenant-Auth** |
| B `tenant_memberships` | `owner admin member viewer` | Drift-Tabelle, kein zweites Auth |
| C Exports / `update-member-role` | `owner editor viewer approver` | Legacy-Spiegel, nicht erweitern |

Kanon A ist bereits der getestete TS-Spiegel (ADR 0005, `tenant-members` Edge). B und C dürfen Anzeige/Legacy mappen, nicht entscheiden.

### Mapping B/C → A (nur Lesen)

| Fremd | Kanon A |
| --- | --- |
| member | editor |
| viewer | viewer_auditor |
| approver | editor + Capability `approval.act` (nicht neue DB-Rolle in diesem Plan) |
| dpo | bleibt dpo (kein B/C-Äquivalent) |

Kein automatischer Backfill in diesem Dokument.

## 3. Capability-Schicht (Soll)

Rollen sind grob. Feine Rechte sind Capabilities. Enforcement: Edge + RLS, nicht UI.

| Capability | owner | admin | dpo | editor | viewer_auditor |
| --- | :---: | :---: | :---: | :---: | :---: |
| tenant.manage / members.write | ✓ | ✓¹ | | | |
| billing.manage | ✓ | ✓ | | | |
| policy.write | ✓ | ✓ | ✓ | | |
| dsr.act / dpia.write | ✓ | ✓ | ✓ | | |
| evidence.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| evidence.export | ✓ | ✓ | ✓ | | ✓² |
| crm.read | ✓ | ✓ | | ✓ | ✓ |
| crm.write | ✓ | ✓ | | ✓ | |
| crm.stage_high_value | ✓ | ✓ | | approval | deny |
| docs.read (nach ACL) | ✓ | ✓ | ✓ | ✓ | ✓ |
| docs.write | ✓ | ✓ | | ✓ | |
| connector.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| connector.write / tool.write | ✓ | ✓ | | approval | deny |
| ai.ask / analyze | ✓ | ✓ | ✓ | ✓ | ✓ |
| ai.execute | ✓ | ✓ | | approval | deny |
| agent.run.read | ✓ | ✓ | ✓ | ✓ | ✓ |
| agent.run.write | ✓ | ✓ | | approval | deny |

¹ admin darf owner weder setzen noch entfernen (`memberGuards`).  
² Export + `RequireAal2` (bereits `/app/evidence/auditor`).

Default: **fail-closed**. Keine Capability → Deny. Jede Deny/Allow-Entscheidung → Audit + `evidence_ref` bei Write.

## 4. Bestehende Guards wiederverwenden

Nicht neu erfinden:

- `checkSetRole` / `checkRemove` in `memberGuards.ts` (LAST_OWNER, SELF_DEMOTE, owner-only für owner)
- `requireAuthAndTenant` in Edge `_shared/auth.ts`
- `AppGate` auf `/app/*`
- `RequireAal2` frontend; Edge bleibt observe-only bis eigener Security-Auftrag
- Entitlements/Plan-Gates (`gateFeature`) bleiben **plan**, nicht Rolle

Reihenfolge jeder Aktion:

```
Auth session → tenant membership (Kanon A)
  → entitlement / plan
  → capability
  → policy engine (eine, nicht zwei)
  → AAL2 if tagged
  → approval if write + risk
  → execute → audit → evidence
```

## 5. People-Modul

Wenn Employee-Tabellen kommen (nicht in diesem Freeze):

- `employees.id` ≠ `auth.uid` zwingend 1:1 für Login
- `employees.title` / `employees.team_role` sind Organisationsdaten
- Authorization nur über `memberships.role` + Capabilities
- UI darf Role anzeigen, Edge darf sie aus dem Employee-Row nicht glauben

## 6. Was dieser Plan explizit nicht tut

- `tenant_memberships` droppen oder syncen
- CHECK-Constraints ändern
- `approver` als vierte produktive Rolle einführen
- Policy-Worker / KV
- CRM-Tabellen anlegen

## 7. Vor Implementierung nötig

1. Live-DB: welche Tabelle ist tatsächlich Bindung für RLS (`memberships` vs `tenant_memberships`) — UNKNOWN ohne Infra-Inventur.
2. Eine Policy-Engine (A vs B, Plan A).
3. AppGate-Lücken an Shell-Routen als separater Security-Fix.
