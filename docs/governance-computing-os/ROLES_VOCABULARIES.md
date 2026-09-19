# Drei Rollen-Vokabulare

**Stand:** 2026-09-18  
**Status:** Ist-Beschreibung + Soll-Mapping. Keine Migration.

Die drei Listen sind keine drei Tenant-Modelle. Sie sitzen auf **drei verschiedenen Tabellen** und lösen drei verschiedene Fragen. Vermischen ist der Fehler.

| | A Kanon | B Runtime-Spiegel | C Session-Kollaboration |
| --- | --- | --- | --- |
| Frage | Wer darf im Tenant was? | Ist der User überhaupt Mitglied? | Wer darf in *dieser* Terminal-Session Rollen ändern? |
| Tabelle | `memberships` | `tenant_memberships` | `terminal_session_members` |
| Rollen | `owner admin dpo editor viewer_auditor` | `owner admin member viewer` | `owner editor viewer approver` |
| ADR | 0005 (accepted) | SPEC-001 RLS-Helper | Phase 6.3 Terminal |
| Schreiben | `tenant-members` | Backfill, kein Sync | `update-member-role` |

---

## A — Tenant-Kanon (ADR 0005)

**Tabelle:** `public.memberships`  
**CHECK:** `role IN ('owner','admin','dpo','editor','viewer_auditor')`  
(`20260622000000_fix_memberships_role_check_name.sql`)  
**Code:** `src/features/tenants/memberGuards.ts`, `supabase/functions/tenant-members/index.ts`

Fünf Tenant-Rollen, eine Plattform-Rolle getrennt:

| Rolle | Achse | Darf | Darf nicht |
| --- | --- | --- | --- |
| `owner` | Administration, Superset | Billing, Tenant-Lifecycle, Ownership-Transfer, Security/SSO/SCIM, Compliance-Freigabe, Mitglieder inkl. Owner setzen/entfernen | letzten Owner demoten/entfernen |
| `admin` | Identity / Security | Benutzer/Rollen (nicht Owner), MFA/SSO/SCIM/Domains, operativ | Owner vergeben/entziehen, Billing-Cancel, Tenant-Delete, Compliance-Freigabe |
| `dpo` | Compliance, orthogonal | DSFA/DPIA/Register freigeben, alles lesen, Evidence exportieren | Identity- oder Billing-Verwaltung |
| `editor` | Operate | Scans, Findings, Dokument-Entwürfe | Freigaben, Mitgliederverwaltung |
| `viewer_auditor` | Read + Export | lesen, Evidence/Audit-Bundle exportieren | Änderungen |
| `super_admin` | Plattform, nicht Tenant | Cross-Tenant-Support, MFA-Reset | sitzt **nicht** in `memberships.role`. ADR 0011: `platform_operators`, nicht `profiles.is_super_admin` |

Hierarchie laut ADR: `owner` ⊃ `admin`. `dpo` ist **nicht** über oder unter `admin` — Separation of Duties.

Verworfen in ADR 0005: `compliance_officer` (= `dpo`), `security_officer` (= `admin`). Keine weiteren Spezialrollen.

Default bei unmapped SSO/SCIM: `viewer_auditor` (Default-Deny).

### Guards (A)

`checkSetRole` / `checkRemove`:

- Nur `owner` oder `admin` mutieren Mitglieder.
- Nur `owner` ändert oder entfernt `owner`.
- `LAST_OWNER` / `SELF_DEMOTE` / `SELF_REMOVE`.
- Whitelist = die fünf Rollen. Alles andere `BAD_ROLE`.

AAL2 (Frontend, ADR 0006): privilegiert sind `owner`, `admin`, `dpo`, `viewer_auditor`. `editor` ist nicht privilegiert. Public-Sector-Tenant: alle Rollen. Edge `observeAal2` blockt weiter nicht.

---

## B — Runtime-Mitgliedschaft (SPEC-001)

**Tabelle:** `public.tenant_memberships`  
**CHECK:** `role IN ('owner','admin','member','viewer')` Default `'member'`  
(`20260602100000_runtime_events_backbone.sql`)

| Rolle B | Bedeutung in dieser Tabelle |
| --- | --- |
| `owner` | gleicher Name wie A, andere Tabelle |
| `admin` | gleicher Name wie A, andere Tabelle |
| `member` | **kein** A-Äquivalent; Default-Operate |
| `viewer` | **kein** `viewer_auditor`; reines Lesen ohne Auditor-Semantik |

`has_tenant_membership(tenant_id)` prüft nur **Existenz**, nicht die Rolle. RLS auf `runtime_events` und Zähler nutzt diesen Helper.

Einmaliger Backfill aus `memberships`. **Kein Sync-Trigger.** Danach Drift.

B ist Absicherung „gehört der User zum Tenant?“ für die Event-Pipeline. B ist nicht das IAM-Modell für CRM/People/AI Execute.

Fehlt in B: `dpo`, `editor`, `viewer_auditor`, `approver`.

---

## C — Terminal-Session (Phase 6.3)

**Tabelle:** `public.terminal_session_members`  
**Edge:** `supabase/functions/update-member-role/index.ts`  
**Union:** `'owner' \| 'editor' \| 'viewer' \| 'approver'`

Das ist **Session-IAM**, nicht Tenant-IAM. `member_id` zeigt auf eine Session-Zeile (`session_id` + `tenant_id` + `user_id`).

| Rolle C | In der Session |
| --- | --- |
| `owner` | Session-Owner; darf Rollen ändern |
| `approver` | darf fremde Session-Rollen ändern (`owner` oder `approver`) |
| `editor` | arbeiten in der Session |
| `viewer` | lesen |

Caller muss in **derselben Session** `owner` oder `approver` sein. Self-Downgrade von Session-Owner ist gesperrt. Persistenz über RPC `update_member_role`.

`approver` existiert in A und B nicht. Es darf nicht als sechste Tenant-Rolle in `memberships` landen.

---

## Mapping (Lesen, kein Backfill)

### B → A (wenn jemand B-Rollen anzeigt)

| B | A |
| --- | --- |
| owner | owner |
| admin | admin |
| member | editor |
| viewer | viewer_auditor |

`dpo` hat in B kein Feld. Ein DPO, der nur in A steht, gilt für `has_tenant_membership` nur, wenn der Backfill ihn als irgendetwas nach B kopiert hat. Das ist der Drift-Fall.

### C → A (nicht 1:1)

| C | A |
| --- | --- |
| owner (Session) | nicht automatisch Tenant-`owner` |
| approver | Tenant-`editor` + Capability `approval.act` (Soll, Plan H) |
| editor | editor |
| viewer | viewer_auditor |

Session-`owner` kann Tenant-`editor` sein. Die Strings heißen gleich und meinen Verschiedenes.

### A → Capabilities (Soll, unverändert Plan H)

Rollen bleiben grob. Feine Rechte (`ai.execute`, `crm.stage_high_value`, `connector.write`) sind Capabilities + Policy + Approval, keine neuen CHECK-Werte.

---

## Kollisionen, die schiefgehen

1. UI schreibt C-`approver` in `memberships.role` → CHECK A rejected oder, schlimmer, Constraint vorher gelockert.
2. Runtime-RLS nutzt nur B-Existenz → ein User ohne B-Row aber mit A-Membership sieht keine `runtime_events`.
3. Code prüft `role === 'viewer'` (B/C) gegen A-Daten, wo der Wert `viewer_auditor` heißt → stilles Deny oder silent miss.
4. Employee-Profil übernimmt irgendeine der drei Listen als Auth → Plan-H-Verbot.

## Was nicht getan wird (Freeze)

- `tenant_memberships` droppen oder syncen
- `approver` in A aufnehmen
- CHECK-Constraints ändern
- Live-DB vermuten: welche Tabelle RLS *heute* wirklich bindet, bleibt UNKNOWN ohne Infra-Check
