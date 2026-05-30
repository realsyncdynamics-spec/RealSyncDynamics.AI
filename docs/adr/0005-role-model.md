# ADR 0005 — Tenant-Rollenmodell

> **Status:** Accepted · 2026-05-30
> **Related:** ADR 0004 (Enterprise Identity), ADR 0006 (MFA/AAL2)

## Kontext

IST: `memberships.role` CHECK = `owner, admin, editor, viewer_auditor`; Plattform-Flag `profiles.is_super_admin`. Enterprise/Behörden brauchen eine Compliance-Hoheit (DPO), die von der technischen Administration getrennt ist (Separation of Duties). Risiko: Wildwuchs an Spezialrollen (`compliance_officer`, `security_officer`, …) erzeugt Doppelrollen und Wartungslast.

## Entscheidung

**5 Tenant-Rollen + 1 Plattform-Rolle. Endgültig.**

| Rolle | Achse | Kern-Kompetenz |
|---|---|---|
| `owner` | Administration (Superset) | alles inkl. Billing, Tenant-Lifecycle, Ownership-Transfer, Security/SSO/SCIM, Compliance-Freigabe |
| `admin` | Administration (Identity/Security) | Benutzer/Rollen, MFA/SSO/SCIM/Domains/Security-Settings, operativ — **keine** Compliance-Freigabe, kein Billing-Cancel, kein Tenant-Delete |
| `dpo` | Compliance (Hoheit) | DSFA/DPIA & Register freigeben/signieren, alles lesen, Evidence exportieren — **keine** Identity-/Billing-Verwaltung |
| `editor` | Operate | Scans, Findings, Dokument-Entwürfe — keine Freigaben, keine Verwaltung |
| `viewer_auditor` | Read | lesen + Evidence/Audit-Bundle exportieren — keine Änderungen |
| `super_admin` *(Plattform, `profiles.is_super_admin`)* | RSD-intern | Cross-Tenant-Support, MFA-Reset — auditpflichtig |

**Verworfen:** `compliance_officer` (= `dpo`), `security_officer` (= `admin`). Keine Doppelrollen.

**Migration (später, additiv):** `memberships.role`-CHECK um `'dpo'` erweitern. Bestehende Rollen unverändert. Default-Rolle bei unmapped SSO/SCIM = `viewer_auditor` (Default-Deny).

## Konsequenzen

- Separation of Duties ist strukturell verankert (`admin` ≠ `dpo`); muss in RLS **und** UI durchgesetzt werden, sonst ist `dpo` kosmetisch.
- Hierarchie: `owner` ⊃ `admin`; `dpo` ist orthogonal (Compliance), nicht über/unter `admin`.
- `super_admin` ist bewusst getrennt von Tenant-Rollen und unterliegt MFA-Pflicht (ADR 0006).
