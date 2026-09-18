# Drei Rollen-Vokabulare — Detail

**Stand:** 2026-09-18  
Siehe auch ADR 0005, `memberGuards.ts`, Plan H.

Die drei Listen sind keine Synonyme. Sie sitzen auf **unterschiedlichen Tabellen und Lebenszyklen**.

---

## Vokabular A — Tenant-Mitgliedschaft (Kanon)

**Wo**

- Tabelle: `memberships` (ehemals organizations-Mitgliedschaft)
- CHECK nach Migration inkl. `dpo`
- TS: `src/features/tenants/memberGuards.ts` — `TENANT_ROLES`
- Edge: `supabase/functions/tenant-members`
- ADR: `docs/adr/0005-role-model.md` (Accepted 2026-05-30)

**Werte**

`owner | admin | dpo | editor | viewer_auditor`

plus Plattform, **nicht** in `memberships.role`:

`super_admin` / nach ADR 0011 `platform_operators` (RSD-intern, cross-tenant)

**Achsen laut ADR 0005**

| Rolle | Achse | Darf | Darf nicht |
| --- | --- | --- | --- |
| owner | Admin-Superset | Billing, Lifecycle, Ownership-Transfer, SSO/SCIM, Compliance-Freigabe | — |
| admin | Identity/Security | User/Rollen, MFA/SSO/Domains | Compliance-Freigabe, Billing-Cancel, Tenant-Delete; Owner nicht setzen/entfernen |
| dpo | Compliance orthogonal | DPIA/DSFA/Register freigeben, alles lesen, Evidence exportieren | Identity- und Billing-Verwaltung |
| editor | Operate | Scans, Findings, Entwürfe | Freigaben, Verwaltung |
| viewer_auditor | Read | Lesen + Audit-Bundle exportieren | Schreiben |

Hierarchie: `owner ⊃ admin`. `dpo` steht **neben** admin, nicht darunter.

Default bei unmapped SSO/SCIM: `viewer_auditor` (fail-closed).

Verworfen laut ADR: `compliance_officer` (= dpo), `security_officer` (= admin).

**Guards (kodiert)**

- Nur owner/admin dürfen Rollen setzen oder Member entfernen
- Nur owner darf owner vergeben oder owner entfernen
- Letzter Owner: kein Demote, kein Remove, kein Self-Demote (`LAST_OWNER`, `SELF_DEMOTE`, `SELF_REMOVE`)

Das ist das einzige Vokabular, das Plan H als Tenant-Auth anerkennt.

---

## Vokabular B — Runtime-Membership (`tenant_memberships`)

**Wo**

- Migration `20260602100000_runtime_events_backbone.sql`
- Helper `has_tenant_membership()`
- Rollen-CHECK: `owner | admin | member | viewer`
- Einmaliger Backfill aus `memberships`, **kein Sync-Trigger**

**Werte**

`owner | admin | member | viewer`

**Unterschied zu A**

| A | B |
| --- | --- |
| editor | member |
| viewer_auditor | viewer |
| dpo | fehlt |

Folgen:

- Ein DPO in A ist in B nicht abbildbar → Runtime-Policies, die nur B prüfen, verlieren die Compliance-Achse.
- `member` ist unscharf (Operate + evtl. mehr).
- Nach dem Backfill divergieren die Tabellen bei jedem Role-Change in A.

B ist ein **zweites Tenant-Bindungsmodell** für Runtime-Events, kein zweites Produktrollenmodell. Plan H: B nicht erweitern; nicht als Auth-Quelle für CRM/People.

Live, welche RLS-Policies `is_tenant_member()` (A) vs `has_tenant_membership()` (B) nutzen: UNKNOWN ohne DB-Inventur.

---

## Vokabular C — Terminal-Session (`terminal_session_members`)

**Wo**

- Edge `supabase/functions/update-member-role/index.ts`
- Tabelle: `terminal_session_members` (`session_id`, `tenant_id`, `role`, `user_id`)
- RPC `update_member_role`
- Migration u. a. Phase-6 Exports (`owner/editor/viewer/approver`)

**Werte**

`owner | editor | viewer | approver`

**Das ist keine Tenant-Rolle.** Es ist die Rolle **in einer Terminal-/Kollaborations-Session**.

| Rolle C | Bedeutung in der Function |
| --- | --- |
| owner | Session-Owner; darf Rollen ändern; Self-Downgrade gesperrt |
| approver | darf fremde Session-Rollen ändern (wie owner in dieser Function) |
| editor | Session-Operate |
| viewer | Session-Read |

Caller-Check: nur `owner` **oder** `approver` der **selben session_id**.

Kollisionen mit A:

- C hat kein `admin`, kein `dpo`
- C `owner` ≠ Tenant-`owner`
- C `approver` existiert in A nicht; in H nur als Capability `approval.act`, nicht als Tenant-Rolle
- Service-Role-Update nach Caller-Read: eigenes Risikoprofil, getrennt von `tenant-members`

C darf Tenant-Auth nicht überschreiben. Ein Session-Approver wird dadurch kein Tenant-Admin.

---

## Gegenüberstellung

| Token | A Tenant | B Runtime | C Session |
| --- | --- | --- | --- |
| owner | ja, Tenant-Souverän | ja, anderes CHECK | ja, nur Session |
| admin | ja | ja | nein |
| dpo | ja, orthogonal | **fehlt** | **fehlt** |
| editor | ja, Operate | nein (→ member) | ja, Session |
| member | nein | ja | nein |
| viewer_auditor | ja | nein (→ viewer) | nein |
| viewer | nein | ja | ja, Session |
| approver | nein | nein | ja, Session-Recht |

Gleicher String, drei Bedeutungen — vor allem `owner` und `editor`.

---

## Ableitung für das Computing-OS

1. UI People/Team zeigt und schreibt nur A.
2. Session-UI (Terminal) zeigt C und schreibt C, mit sichtbarem Label „Sessionrolle“.
3. Keine Dropdown-Mischung der Listen.
4. Employee-Profil bekommt keine dieser Strings als Auth-Feld.
5. Bevor CRM-Writes an Rollen hängen: klären, welche Helper-Funktion die Ziel-RLS wirklich nutzt (A vs B).
