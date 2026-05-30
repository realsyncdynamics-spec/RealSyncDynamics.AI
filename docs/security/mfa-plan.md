# MFA — Architektur & Status (Phase 3)

> **Status:** 2026-05-30. **Keine eigene MFA gebaut** — Supabase-nativ. Dieses Dokument hält Architektur + IST-Stand fest.
> **Verweise:** ADR 0006 (MFA/AAL2-Policy), `docs/architecture/enterprise-identity-p0a-mfa-plan.md`, P0c-Plan (AAL2 enforce, #496).

## Mechanismus (Supabase-nativ)
MFA = **TOTP via Supabase Auth** (`supabase.auth.mfa.*`). Kein Eigenbau. AAL-Stufen im JWT (`aal1`/`aal2`). Bereits **live**:
- `/settings/security` (`SecuritySettings.tsx`) — Enrollment (QR/Verify), Recovery-Codes, MFA entfernen.
- Edge Function `mfa-recovery-redeem` (ACTIVE) — Lockout-Escape via Recovery-Code.
- Edge Function `mfa-admin-reset` (ACTIVE) — owner/admin/super_admin setzt MFA eines Mitglieds zurück.
- DB: `tenant_security_settings` (`require_mfa_for_roles`, `enforce_mfa_all`), `mfa_recovery_codes` (gehasht).

## Rollen-Policy (ADR 0006)
| Rolle | MFA | Begründung |
|---|---|---|
| **owner** | **Pflicht** | volle Tenant-Kontrolle + Billing + Lifecycle |
| **admin** | **Pflicht** | Identity/Security-Verwaltung (Mitglieder, SSO, MFA) |
| **dpo** | **Pflicht** | Compliance-Freigaben (DSFA/Register signieren) |
| **auditor** *(viewer_auditor)* | konfigurierbar (Default optional) | liest + exportiert Evidence — Tenant kann erzwingen |
| **super_admin** (Plattform) | **Pflicht (zuerst)** | mächtigster Account, cross-tenant |
| editor | konfigurierbar | operativ, keine Freigaben |
| **Public-Sector-Tenant** (`is_public_sector`) | **alle Rollen Pflicht** | Behörden-Baseline (ADR 0009) |

## Durchsetzungs-Stand (observe → enforce)
- **IST (P0a):** MFA verfügbar; AAL2 wird **observe-only** geloggt (`logAal2Intent`), **nicht** erzwungen.
- **P0c (geplant, #496):** AAL2-Hard-Enforce für privilegierte Aktionen — gestaffelt observe→soft→hard, Edge-Function-Check (`requireAal2`) + RLS-Klausel (`auth.jwt()->>'aal'='aal2'`, service-role ausgenommen). Lockout-Schutz (Recovery + Admin-Reset) ist Voraussetzung und bereits live.

## Offene Operator-Aufgabe
Supabase-Dashboard → **Auth → MFA**: bestätigen, dass TOTP-Faktoren projektseitig aktiviert sind (nicht aus Repo prüfbar). HIBP-Leaked-Password-Schutz via `enable-leaked-password-protection.yml` aktivierbar.

## Fazit
MFA-**Fundament steht live** (Enrollment, Recovery, Admin-Reset, Rollen-Konfig). Was fehlt, ist ausschließlich das **harte Enforcement** (P0c) — bewusst als eigener, freigabepflichtiger Schritt geplant, um keine aktiven Sessions/Service-Jobs zu brechen.
