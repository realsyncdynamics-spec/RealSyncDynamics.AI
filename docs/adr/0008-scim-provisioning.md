# ADR 0008 — SCIM-Provisioning (Scope & Timing)

> **Status:** Accepted · 2026-05-30
> **Related:** ADR 0004, ADR 0007 (SSO/JIT)

## Kontext

SCIM 2.0 ist **nicht** Supabase-nativ — es wäre Eigenbau (Edge Functions als SCIM-Endpoints). SSO mit JIT-Provisioning (ADR 0007) deckt das **Joiner**-Szenario bereits ab; SSO-Enforcement deckt **Leaver** faktisch (kein IdP-Zugang → kein Login). Der inkrementelle SCIM-Mehrwert ist automatisches **Deprovisioning** und Gruppen-Sync — kaufentscheidend erst bei großen/regulierten Accounts.

## Entscheidung

**SCIM ist KEIN Bestandteil von Version 1. Verbindliche Reihenfolge: P0 = MFA · P1 = SSO · P2 = SCIM.**

Zielbild für P2 (nur dokumentiert, nicht jetzt gebaut):
- SCIM-2.0-Endpoints `scim-users`, `scim-groups` (Edge Functions), tenant-scoped Bearer-Auth.
- Tabellen `scim_tokens` (gehasht, rotierbar), `scim_resource_map` (external_id ↔ user/membership).
- Gruppen→Rollen-Mapping via `tenant_role_mappings` (Reuse aus ADR 0007), Default-Deny.
- Reihenfolge in P2: Token-Mgmt → Users-CRUD → Groups/Role-Mapping → Deprovision-Härtung → IdP-Tests.

## Konsequenzen

- v1 verkauft sich mit **MFA + SSO**; SCIM als Upsell/Enterprise-Plus.
- Interim-Leaver-Lücke geschlossen durch SSO-Enforcement + Admin-Deaktivierung.
- SCIM ist die größte neue Angriffsfläche → separates Threat-Model **vor** P2-Code.
