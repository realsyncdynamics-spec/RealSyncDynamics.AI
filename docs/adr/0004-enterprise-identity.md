# ADR 0004 — Enterprise Identity (Dach-Entscheidung)

> **Status:** Accepted · 2026-05-30
> **Context:** RealSyncDynamics.AI soll für zahlungskräftige Enterprise-Kunden und Behörden beschaffungsfähig werden. Der IST-Auth-Stand (Magic-Link + OAuth, Multi-Tenant-RLS) ist self-service-tauglich, aber ohne MFA, SSO/SAML, SCIM und Tenant-Admin-Konsole nicht enterprise-/behördenfähig.
> **Deciders:** Founder/Product + Architecture
> **Supersedes:** —
> **Companion-ADRs:** 0005 (Rollenmodell), 0006 (MFA), 0007 (SSO), 0008 (SCIM), 0009 (Public Sector Mode)

## Kontext

Verifizierter IST-Stand (Repo + Live-DB, 2026-05-30):
- Auth: Supabase Magic-Link (`signInWithOtp`) + OAuth (Google, Azure, LinkedIn-OIDC, GitHub).
- Tenant-Rollen: `owner, admin, editor, viewer_auditor` (CHECK auf `memberships.role`).
- Plattform-Admin: `profiles.is_super_admin` (RSD-intern).
- Tenant-Flags: `tenants.is_public_sector`, `tenants.ai_data_residency_policy`.
- MFA: `auth.mfa_factors` = 0 enrollt. SSO: `auth.sso_providers`/`auth.saml_providers` = 0. SCIM: nicht vorhanden.
- MFA und SSO sind **Supabase-nativ** (TOTP-API bzw. SAML/OIDC-SSO). SCIM ist **Eigenbau**.

## Entscheidung

Die Enterprise-Identity-Architektur wird verbindlich festgelegt:

1. **Rollenmodell:** 5 Tenant-Rollen (`owner, admin, dpo, editor, viewer_auditor`) + 1 Plattform-Rolle (`super_admin`). Keine Spezialrollen-Proliferation. → ADR 0005.
2. **MFA:** Pflicht für `owner, admin, dpo, super_admin`; konfigurierbar für `editor, viewer_auditor`; Public-Sector = Pflicht für **alle**. → ADR 0006.
3. **SSO:** OIDC zuerst (Entra ID, Google Workspace), SAML 2.0 direkt danach (Okta/Ping/ADFS/Behörden). JIT-Provisioning mit Default-Deny. → ADR 0007.
4. **SCIM:** kein Bestandteil von v1; Reihenfolge **P0 = MFA · P1 = SSO · P2 = SCIM**. → ADR 0008.
5. **Public Sector Mode:** automatisch erzwungene Sicherheitsbaseline für `is_public_sector`-Tenants. → ADR 0009.
6. **Step-up-Sicherheit:** privilegierte Aktionen erfordern AAL2 (Step-up-MFA) — siehe AAL2-Matrix in ADR 0006.
7. **Tenant-Admin-Konsole:** 8 kundenorientierte Menüpunkte (Team · Rollen & Berechtigungen · Sicherheit · Single Sign-On · **Identität & Domains** · Prüfprotokoll · Datenresidenz · Abrechnung). Keine Technik-Menüs.

**Leitprinzip:** Separation of Duties — Administration (`owner/admin`) ist von Compliance-Hoheit (`dpo`) getrennt. Supabase bleibt der Identity-Provider; eigene Logik (JIT, SCIM) sitzt in Edge Functions + RLS.

## Konsequenzen

- **Positiv:** Beschaffungsfähigkeit für Enterprise/Behörden; MFA/SSO überwiegend Integration statt Neubau; klare Governance vor erster Migration.
- **Negativ/Abhängigkeit:** SAML-SSO erfordert Supabase-Pro/SSO-Add-on (Kosten); SCIM ist neue Hochrisiko-Angriffsfläche (bewusst P2); `dpo`-Rolle und AAL2 erfordern RLS-Erweiterungen.
- **Reihenfolge:** Erste Umsetzung ist **P0a MFA** (additiv, RLS-konform, Supabase-nativ).

## Alternativen

- *Viele Spezialrollen (compliance_officer, security_officer, …):* verworfen — Doppelrollen, Wartungslast. `compliance_officer` = `dpo`; `security_officer` = `admin`.
- *SCIM in v1:* verworfen — SSO+JIT deckt Joiner; SSO-Enforcement deckt Leaver faktisch.
- *Eigene Auth statt Supabase:* verworfen — MFA/SSO sind nativ verfügbar; kein IAM-Eigenbau (vgl. PRODUCT_FOCUS).
