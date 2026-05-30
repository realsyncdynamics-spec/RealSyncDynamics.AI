# P0a — MFA Umsetzungsplan (Design, noch nicht implementiert)

> **Status:** Ready for build approval · 2026-05-30
> **Basiert auf:** ADR 0004–0009. **Kein Code in diesem Dokument** — nur der verbindliche Bauplan für den ersten Umsetzungsschritt.
> **Scope P0a:** TOTP-MFA (Supabase-nativ) für privilegierte Rollen + Recovery + Super-Admin-Reset + Enforcement-Grundlage. **Nicht** in P0a: SSO, SCIM, volle Admin-Konsole, AAL2-RLS-„enforce" (nur „observe").

## 1. Ziel & Abgrenzung
- MFA-Enrollment/Challenge/Recovery für `owner, admin, dpo, super_admin`.
- `tenant_security_settings` als Grundlage für „MFA für alle erzwingen" und Public-Sector-Baseline.
- AAL2 zunächst **observe** (Logging), noch kein hartes RLS-Enforce (das ist P0c).

## 2. Datenmodell (additiv, RLS-konform — Design)
1. `tenant_security_settings`
   - `tenant_id uuid PK → tenants(id)`
   - `require_mfa_for_roles text[]` (Default `{owner,admin,dpo}`)
   - `enforce_mfa_all boolean` (Default false; Public-Sector erzwingt true)
   - `created_at/updated_at`
   - RLS: lesen = Tenant-Mitglieder; schreiben = `owner/admin` (+ AAL2 in P0c).
2. `mfa_recovery_codes`
   - `id, tenant_id, user_id, code_hash text, used_at timestamptz null, created_at`
   - RLS: nur eigener User (`auth.uid()`); Insert/Invalidate über Edge Function (Service-Role), nie Klartext clientseitig.
3. **Keine** Änderung an `auth.mfa_factors` (Supabase-managed).
4. `governance_admin_log` (bestehend) erhält MFA-Events (enrolled, verified, reset, recovery_used) — nur neue Event-Typen, kein Schema-Change.

## 3. Edge Functions (Design)
- `mfa-admin-reset` — Input `{ tenant_id, target_user_id }`. Auth: `super_admin` **oder** Tenant-`owner/admin` (+ AAL2 in P0c). Wirkung: enrollte Faktoren des Ziel-Users entfernen (Supabase Admin API), Recovery-Codes invalidieren, Audit-Log schreiben. Rate-limit + Audit Pflicht.
- `security-settings` — CRUD für `tenant_security_settings`; Validierung gegen Public-Sector-Lock (ADR 0009: darf Baseline nicht abschwächen).
- (Recovery-Code-Generierung kann in `security-settings` oder eigener `mfa-recovery` Function liegen — Entscheidung bei Build.)

## 4. Frontend (Design)
- **`/settings/security`** (neu): Faktor-Status, „MFA einrichten" (QR via `auth.mfa.enroll` → `challenge`/`verify`), Recovery-Codes anzeigen/regenerieren, Faktor entfernen.
- **App-Shell MFA-Gate:** Nach Login prüfen — wenn Rolle ∈ `require_mfa_for_roles` (oder `enforce_mfa_all`) und kein verifizierter Faktor → Pflicht-Onboarding auf `/settings/security`, App gesperrt bis Enrollment.
- **Step-up-Prompt (observe):** vor AAL2-Aktionen (ADR 0006-Matrix) Step-up anbieten; in P0a nur protokollieren, nicht blockieren.
- Reuse: `TenantProvider`/`useTenant` (Rolle), `getSupabase()`.

## 5. RLS / Policy (Design)
- `tenant_security_settings` + `mfa_recovery_codes` RLS wie oben.
- AAL2: in P0a **nur Observe** (Event-Log „would_require_aal2"). Hartes `(_auth.jwt()->>'aal')='aal2'`-Enforce auf sensible Writes folgt in **P0c** nach „observe"-Auswertung.
- Service-Role/Cron bleiben ausgenommen.

## 6. Rollout-Reihenfolge (innerhalb P0a)
1. Migration `tenant_security_settings` + `mfa_recovery_codes` (+ `dpo` zum `memberships`-CHECK, ADR 0005).
2. `/settings/security` Enrollment/Recovery-UI.
3. `mfa-admin-reset` + `security-settings` Edge Functions.
4. App-Shell-Gate für Pflicht-Rollen (+ Public-Sector `enforce_mfa_all`).
5. AAL2-Observe-Logging.

## 7. Abnahmekriterien
- owner/admin/dpo/super_admin können TOTP einrichten, verifizieren, Recovery nutzen.
- Pflicht-Rolle ohne Faktor wird ins Enrollment gezwungen.
- Super-Admin/Owner kann MFA eines Users zurücksetzen (auditiert).
- Public-Sector-Tenant erzwingt MFA für alle.
- Lockout ohne Recovery ist unmöglich (Recovery + Reset vorhanden).
- Keine bestehende Funktion/Compliance-Funktion gebrochen; `tsc` + Tests grün.

## 8. Risiken vor Build (Freigabe-relevant)
- **Lockout:** Recovery + Reset MÜSSEN gemeinsam in P0a — nicht splitten.
- **AAL2 nur observe** in P0a, damit keine aktiven Sessions brechen (enforce erst P0c).
- **`dpo`-CHECK-Erweiterung** rein additiv testen (kein bestehender Wert verletzt).
- **Recovery-Codes** nur gehasht speichern, Klartext nur einmalig clientseitig anzeigen.
