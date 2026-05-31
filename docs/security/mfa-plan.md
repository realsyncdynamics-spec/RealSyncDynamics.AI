# MFA — Architektur & Status (Phase 3)

> **Status:** 2026-05-30. **Keine eigene MFA gebaut** — Supabase-nativ. Dieses Dokument hält Architektur + IST-Stand fest.
> **Verweise:** ADR 0006 (MFA/AAL2-Policy), `docs/architecture/enterprise-identity-p0a-mfa-plan.md`, P0c-Plan (AAL2 enforce, #496).

## Enforcement-Lagebild (Stand P0d Phase 1)
| Schicht | Status | Belegt durch |
|---|---|---|
| **UI Enforcement** | **ACTIVE** | `RequireAal2` (#504) — privilegierte Routen hart gegated |
| **Edge Enforcement** | **OBSERVE** | `_shared/requireAal2.ts` → `observeAal2()` loggt `AAL2_OK` / `AAL2_REQUIRED_OBSERVED` in privilegierten Functions, **blockt NICHT** |
| **RLS Enforcement** | **NOT ENABLED** | bewusst (Service-Role umgeht RLS ohnehin; späterer Defense-in-Depth-Schritt) |

**Edge-Observe-Functions (P0d Phase 1):** `tenant-members`, `mfa-admin-reset`, `stripe-portal`, `tenant-invite` (nur `create/list/revoke`), `tenant-audit`, `gdpr-export`, `gdpr-delete`, `evidence-export`.
**Bewusst NICHT beobachtet:** `mfa-recovery-redeem` (Lockout-Escape, muss AAL1 bleiben), `tenant-invite:accept`, Cron-/Vault-Jobs, `stripe-webhook`, sowie `gdpr-audit` + `evidence-vault-export` (**kein User-JWT** → kein `aal` beobachtbar; durch UI-Guard abgedeckt).
**Hard-Enforce** (401 `AAL2_REQUIRED`) ist der **separate, freigabepflichtige** Folgeschritt — erst nach Auswertung der Observe-Telemetrie.

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
- **P0a (Vorstufe):** MFA verfügbar; AAL2 wurde **observe-only** geloggt (`logAal2Intent`), nicht erzwungen.
- **P0c (IST — UI-Hard-Enforce, dieser Stand):** Privilegierte Bereiche sind clientseitig **hart gegated** über den Guard `RequireAal2` (`src/core/access/RequireAal2.tsx`) mit reiner, getesteter Policy (`src/core/access/aal2-policy.ts`). Hat ein privilegierter Nutzer nur AAL1, wird der Bereich **blockiert** und „MFA erforderlich" + CTA angezeigt (Step-up „MFA bestätigen" bei vorhandenem Faktor via `stepUpTotp`, sonst „MFA einrichten" → `/settings/security`). Kein Eigenbau — ausschließlich `supabase.auth.mfa.*`.
- **P0c-Rest (geplant, freigabepflichtig — NICHT in diesem Stand):** server-seitige Defense-in-Depth: Edge-Function-Check (`requireAal2`) + RLS-Klausel (`auth.jwt()->>'aal'='aal2'`, service-role ausgenommen). **Erfordert eine Migration** → bewusst separat, um keine aktiven Sessions/Service-Jobs zu brechen.

## Enforcement-Matrix (IST, UI-Layer)
**Privilegierte Rollen** (`PRIVILEGED_ROLES`): `owner`, `admin`, `dpo`, `viewer_auditor` (Auditor). `editor`/reine Viewer sind **nicht** privilegiert. **Public-Sector-Tenant:** alle Rollen.

| Bereich | Route | Komponente | AAL2 erzwungen |
|---|---|---|---|
| Tenant-/Team-/User-Verwaltung (inkl. MFA-Admin-Reset) | `/app/team`, `/settings/team` | `TenantAdminConsole` | ✅ |
| Team-Invites | `/tenant/invites` | `InvitesView` | ✅ |
| Evidence-Export / Auditor-Konsole | `/app/evidence`, `/governance/auditor` | `AuditorConsoleView` | ✅ |
| Billing-Verwaltung | `/billing/usage` | `UsageView` | ✅ |
| **NICHT gegated (bewusst):** MFA-Setup/Step-up/Recovery | `/settings/security` | `SecuritySettings` | ❌ (sonst Endlosschleife) |
| **NICHT gegated:** Invite-Annahme | `/tenant/invite/:token` | `AcceptInviteView` | ❌ (neue Mitglieder vor Rollen-/MFA-Zuweisung) |
| Öffentliche Seiten, Login, normale Viewer-Reads | — | — | ❌ |

## Bekannte Grenzen
- **UI-Layer-Enforcement:** `RequireAal2` blockt die Oberfläche. Echte Durchsetzung gegen direkte API-Aufrufe erfordert zusätzlich die server-seitige Schicht (RLS/Edge `requireAal2`) — **migrationspflichtig, freigabepflichtig, nicht in diesem Stand**.
- **Kein Block ohne Session:** Liegt keine Session vor, greift der vorgelagerte `AuthGate` (Login) — der AAL2-Guard lässt durch, um „nicht eingeloggt" nicht mit „MFA fehlt" zu verwechseln.
- **`/settings/security` ungated:** notwendig, damit Enrollment/Step-up/Recovery erreichbar bleiben (kein Lockout-Loop).

## Offene Operator-Aufgabe
Supabase-Dashboard → **Auth → MFA**: bestätigen, dass TOTP-Faktoren projektseitig aktiviert sind (nicht aus Repo prüfbar). HIBP-Leaked-Password-Schutz via `enable-leaked-password-protection.yml` aktivierbar.

## Fazit
MFA-**Fundament steht live** (Enrollment, Recovery, Admin-Reset, Rollen-Konfig) **und ist auf UI-Ebene für privilegierte Bereiche hart erzwungen** (P0c, dieser Stand). Was noch fehlt, ist die **server-seitige Defense-in-Depth** (RLS/Edge `requireAal2`) — migrationspflichtig und bewusst als eigener, freigabepflichtiger Schritt geführt, um keine aktiven Sessions/Service-Jobs zu brechen.
