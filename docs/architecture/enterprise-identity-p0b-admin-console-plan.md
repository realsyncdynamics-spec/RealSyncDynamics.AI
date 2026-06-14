# P0b — Tenant-Admin-Konsole (Architektur- & Build-Plan)

> **Status:** Plan, NICHT implementiert · 2026-05-30
> **Basis:** ADR 0004–0009. **Kein Code, keine Migration, kein SSO-/SCIM-Build in diesem Dokument.**
> **Ziel:** Eine kundenorientierte Self-Service-Admin-Konsole, die owner/admin (und lesend dpo/auditor) Identität, Sicherheit und Governance eines Tenants verwalten lässt. Macht die Plattform für Enterprise greifbar.

## 0. Leitprinzip
P0b ist überwiegend **Assembly + 1 echte Lücke**, kein Greenfield. Viele Bausteine existieren bereits auf `main` und werden in eine konsolidierte Shell gehängt. SSO/SCIM erscheinen als **Status-/Vorbereitungs-Tabs** (kein Protokoll-Build).

## 1. Vorhandene Bausteine (auf main verifiziert — werden wiederverwendet)
| Baustein | Datei | Nutzung in P0b |
|---|---|---|
| Invites (create/list/revoke/accept) | `src/features/tenants/InvitesView.tsx` + `tenant-invite` Edge Fn | Tab **Team** |
| Audit-Log-View | `src/features/governance/AdminLogView.tsx` + `tenant-audit` | Tab **Prüfprotokoll** |
| MFA/Security | `src/features/settings/SecuritySettings.tsx` (+ `tenant_security_settings`) | Tab **Sicherheit** |
| Datenresidenz | `src/features/settings/AiResidencySettings.tsx` (`tenants.ai_data_residency_policy`) | Tab **Datenresidenz** |
| Billing | `src/features/billing/BillingView.tsx` + `stripe-portal` | Tab **Abrechnung** |
| Rollen-Quelle | `memberships` (owner/admin/dpo/editor/viewer_auditor), `is_tenant_admin()` | Tab **Rollen** |
| Tenant-Kontext | `TenantProvider`/`useTenant` | Shell-Guard |

## 2. Die 8 Tabs — Soll & Quelle
| # | Tab | Inhalt | Status |
|---|---|---|---|
| 1 | **Team** | Mitgliederliste + Rolle je Mitglied · Einladen (Reuse InvitesView) · Entfernen/Deaktivieren | 🟡 Liste+Remove **neu**, Invite vorhanden |
| 2 | **Rollen & Berechtigungen** | Rolle setzen (owner/admin/dpo/editor/viewer_auditor) · Berechtigungs-Matrix (read-only Erklärung) | 🟡 Rollen-Change-UI **neu** |
| 3 | **Sicherheit** | MFA-Status je Mitglied · MFA-Pflicht-Toggle (Reuse SecuritySettings-Logik) · MFA-Reset (Reuse `mfa-admin-reset`) | ✅ Reuse + Member-MFA-Statusliste **neu** |
| 4 | **Single Sign-On** | **Status-/Vorschau-Tab**: „SSO in Vorbereitung (P1)" + erklärt OIDC/SAML-Roadmap | 🟢 Placeholder (kein SSO-Build) |
| 5 | **Identität & Domains** | Verifizierte Unternehmens-Domains (Liste + Add/Verify-UI als Vorbereitung; Verifizierungs-Backend P1) | 🟢 UI-Shell, Backend P1 |
| 6 | **Prüfprotokoll** | Tenant-scoped Audit-Log (Reuse AdminLogView) | ✅ Reuse |
| 7 | **Datenresidenz** | EU/EU-lokal (Reuse AiResidencySettings) | ✅ Reuse |
| 8 | **Abrechnung** | Plan + Stripe-Portal-Link (Reuse BillingView) | ✅ Reuse |

## 3. Die einzige echte Build-Lücke: Member-/Rollen-Verwaltung
Heute fehlt eine **Mitglieder-Liste mit Rollen-Änderung/Entfernung**. Benötigt:
- **Edge Function `tenant-members`** (analog `tenant-invite`-Muster): `op: list | set_role | remove`.
  - Auth: owner/admin (via `is_tenant_admin`); AAL2-observe (P0a-Muster), hartes Enforce P0c.
  - Guards: kein Self-Demote des letzten owner; kein Cross-Tenant; Rollen-Whitelist = ADR 0005.
  - Audit: jeder `set_role`/`remove` → `governance_admin_log`.
- **Kein neues Schema** nötig (nutzt `memberships`). Optional später: `dpo` ist bereits im CHECK (P0a).

## 4. Shell & Routing
- Neue Seite **`/settings/team`** (oder `/admin/tenant`) — Tab-Shell, lazy-geladen wie andere Settings-Views.
- Guard: nur Mitglieder; Schreib-Aktionen nur owner/admin (UI hidet, Server erzwingt via RLS/Function).
- Einstieg: Karte „Team & Zugriff" im Settings-Hub (`SettingsView.tsx`) + Link aus Dashboard.
- Read-only-Sicht für dpo/viewer_auditor (sieht Team/Prüfprotokoll, keine Schreibaktionen).

## 5. RLS/Sicherheit
- Member-Reads: bestehende `memberships`-RLS (Tenant-Mitglieder).
- Schreib-Pfade ausschließlich über `tenant-members` Edge Fn (service-role + serverseitige owner/admin-Prüfung) — **keine** direkten Client-Writes auf `memberships`.
- AAL2: Aktionen aus ADR-0006-Matrix (Rolle ändern, entfernen, MFA-Reset) → in P0b **observe** (Logging), hartes Enforce bleibt P0c.

## 6. Explizit NICHT in P0b
- ❌ SSO/SAML/OIDC-Implementierung (P1) — nur Status-/Vorschau-Tab.
- ❌ SCIM (P2).
- ❌ Domain-Verifizierungs-Backend (P1) — nur UI-Shell.
- ❌ Hartes AAL2-Enforcement (P0c).
- ❌ Public-Sector-Hard-Enforcement (folgt mit SSO/P1).

## 7. Build-Reihenfolge (nach Freigabe)
1. `tenant-members` Edge Fn (list/set_role/remove) + Guards + Audit + config.toml-Doku.
2. Shell `/settings/team` mit 8-Tab-Gerüst; Tabs 6/7/8 = Reuse, 3 = Reuse+MFA-Statusliste.
3. Tab Team (Liste + Remove) + Tab Rollen (set_role + Matrix).
4. Tabs 4/5 als Placeholder/Vorschau.
5. Settings-Hub-Karte + Dashboard-Link.
6. Tests: Unit (Guards: last-owner, cross-tenant, role-whitelist) + e2e (`/settings/team` rendert, Schreibaktion owner-gated).
7. `tsc` + pre-deploy-lint + CTA-Gate grün; PR.

## 8. Aufwand (grob, Dev-Tage)
| Block | PT |
|---|---|
| `tenant-members` Edge Fn + Guards + Tests | 2–3 |
| Shell + 8 Tabs (5 Reuse, 2 Placeholder, 1 neu) | 3–4 |
| Member/Rollen-UI | 2–3 |
| Tests + Politur | 1–2 |
| **Summe P0b** | **~8–12** |

## 9. Risiken vor Build
1. **Last-Owner-Schutz** zwingend (kein Tenant ohne owner).
2. **Self-Demote/Self-Remove** des handelnden Admins absichern.
3. **Rollen-Whitelist** strikt = ADR 0005 (kein Freitext).
4. Placeholder-Tabs (SSO/Domains) dürfen **nichts** versprechen, was P1 ist (ehrliche „in Vorbereitung"-Sprache, keine verbotenen CTAs).
5. AAL2 nur observe — kein Lockout-Risiko in P0b.
