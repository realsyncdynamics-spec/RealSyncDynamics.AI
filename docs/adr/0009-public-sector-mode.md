# ADR 0009 — Public Sector Mode

> **Status:** Accepted · 2026-05-30
> **Related:** ADR 0004, ADR 0006 (MFA/AAL2), ADR 0007 (SSO)

## Kontext

`tenants.is_public_sector` existiert bereits. Behörden erwarten eine nicht-verhandelbare Sicherheitsbaseline (MFA, SSO, lückenlose Auditierung, gesperrte Sicherheits-Downgrades). Diese Baseline soll **automatisch** aus dem Flag folgen — nicht pro Tenant manuell konfiguriert.

## Entscheidung

Für jeden Tenant mit `is_public_sector = true` gilt **automatisch und erzwungen**:

| Baseline | Verhalten |
|---|---|
| **MFA** | Pflicht für **alle** Rollen (nicht nur owner/admin/dpo), nicht abschaltbar |
| **SSO** | Pflicht — Login ausschließlich über den konfigurierten IdP; Magic-Link/OAuth deaktiviert |
| **Audit Logs** | Pflicht — vollständige, append-only Protokollierung; nicht reduzierbar, Retention nicht unter gesetzliches Minimum absenkbar |
| **Security-Settings** | **gesperrt** — Tenant-Admin kann die Baseline nicht abschwächen (MFA-Pflicht aus, SSO aus, Audit aus sind blockiert); nur Verschärfung möglich |
| **Datenresidenz** | Default `eu_local` empfohlen (Reuse `ai_data_residency_policy`) |

**Durchsetzungsort:** Die Baseline wird serverseitig erzwungen (RLS + Edge-Function-Checks + Security-Settings-Validierung), nicht nur in der UI. Die Tenant-Admin-Konsole zeigt die gesperrten Schalter als „durch Public-Sector-Modus vorgegeben".

**Umschaltung des Flags** (`is_public_sector`) ist ausschließlich `super_admin` vorbehalten und auditpflichtig (kein Self-Service-Downgrade).

## Konsequenzen

- Behörden erhalten eine konsistente, beweisbare Sicherheitslage „out of the box".
- Erfordert, dass MFA/SSO/Audit-Bausteine (ADR 0006/0007) die „enforced/locked"-Variante unterstützen.
- Setzt SSO voraus → Public-Sector-Go-live frühestens mit P1.
