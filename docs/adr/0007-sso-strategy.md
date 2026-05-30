# ADR 0007 — SSO-Strategie (OIDC zuerst, SAML danach)

> **Status:** Accepted · 2026-05-30
> **Related:** ADR 0004, ADR 0005 (Rollen-Mapping), ADR 0009 (Public Sector)

## Kontext

SSO ist Supabase-nativ (`signInWithSSO`, SAML 2.0 + OIDC). IST: 0 Provider. SSO ist im Enterprise-Vertrieb häufig **der** Dealbreaker. SAML-SSO erfordert Supabase-Pro/Team + SSO-Add-on (Kosten, vor Umsetzung zu klären).

## Entscheidung

**Reihenfolge — sequenziell, beide in P1. Nicht gleichzeitig bauen.**

- **P1a — OIDC zuerst:** Entra ID (Azure AD), Google Workspace. Größte Marktabdeckung, geringste Komplexität; etabliert die JIT-/Rollen-Mapping-Infrastruktur.
- **P1b — SAML 2.0 danach:** Okta, Ping, ADFS, **Behörden**. Gleiche Infrastruktur, zweites Protokoll.

### Zielfluss

```
Enterprise-Tenant → IdP (OIDC/SAML)
 → supabase.auth.signInWithSSO({ domain })
 → Supabase-Round-trip → Session (auth.users, aal, email-domain)
 → JIT-Provisioning (Edge Function `sso-provision`):
     verifizierte Domain → tenant_sso_domains → tenant_id
     IdP-Gruppe/Attribut → tenant_role_mappings → role
 → memberships (Default-Deny: viewer_auditor bei unmapped)
 → RLS (membership + role + aal)
```

### Verbindliche Regeln

- **Default-Deny:** unmapped IdP-Gruppe → `viewer_auditor`. Niemals implizit `admin`.
- **Domain-Bindung:** nur verifizierte Domains mappen auf einen Tenant.
- **SSO-Enforcement:** für SSO-Tenants Magic-Link/OAuth deaktivierbar (Pflicht bei Public Sector, ADR 0009).
- JIT-Provisioning über Edge Function (auditierbar), nicht über blinden Trigger.

## Konsequenzen

- Supabase-Plan/SSO-Add-on ist P1-Blocker → früh beschaffen.
- Rollen-Mapping ist Privilege-Escalation-Fläche → Default-Deny + Audit.
- Pro-Customer-Onboarding (IdP-Konfiguration) ist betrieblicher Aufwand, kein Code.
