# ADR 0006 — MFA-Policy & AAL2-Matrix

> **Status:** Accepted · 2026-05-30
> **Related:** ADR 0004, ADR 0005 (Rollen), ADR 0009 (Public Sector)

## Kontext

MFA ist Supabase-nativ (TOTP via `auth.mfa.*`, AAL1→AAL2). IST: 0 enrollte Faktoren. Privilegierte Rollen und der Plattform-Admin sind heute nur durch Magic-Link/OAuth (AAL1) geschützt.

## Entscheidung

### MFA-Pflicht

| Rolle | MFA |
|---|---|
| `owner` | **Pflicht** |
| `admin` | **Pflicht** |
| `dpo` | **Pflicht** |
| `super_admin` (Plattform) | **Pflicht — zuerst umzusetzen** |
| `editor` | konfigurierbar (Default optional) |
| `viewer_auditor` | konfigurierbar (Default optional) |

- **Public-Sector-Tenants** (`tenants.is_public_sector = true`): **MFA Pflicht für ALLE Rollen**, nicht optional, nicht abschaltbar (ADR 0009).
- Tenant-Admin kann „MFA für alle erzwingen" global aktivieren (`tenant_security_settings`).
- **Recovery** (Einmal-Codes, gehasht) + **Super-Admin-Reset** sind Pflichtbestandteil der MFA-Auslieferung — niemals MFA ohne Recovery-Pfad ausliefern.

### AAL2-Matrix (Step-up erforderlich)

| Aktion | Rolle(n) |
|---|---|
| Benutzer einladen/entfernen/deaktivieren | owner, admin |
| Rolle ändern | owner, admin |
| Ownership übertragen | owner |
| MFA-Pflicht (Tenant) ändern | owner, admin |
| MFA eines Mitglieds zurücksetzen | owner, admin, super_admin |
| SSO aktivieren/konfigurieren/Enforcement | owner, admin |
| Domain hinzufügen/verifizieren | owner, admin |
| SCIM-Token erzeugen/rotieren/widerrufen | owner, admin |
| Security-Settings ändern | owner, admin |
| API-Keys erzeugen/rotieren | owner, admin |
| **DSFA/DPIA final freigeben** | owner, dpo |
| Tenant löschen | owner |
| Vollexport (Art. 15)/Lösch-Workflow | owner, dpo |
| Signiertes Evidence/Audit-Bundle exportieren | owner, dpo, admin, viewer_auditor |
| Billing: Zahlungsmethode/Plan kündigen | owner |

**AAL1 genügt:** Dashboards lesen, Scans starten, Findings/Dokumente entwerfen, Reports ansehen, Standard-Audit.

### Durchsetzung

- RLS-Write-Policies auf sensiblen Tabellen zusätzlich an `(auth.jwt()->>'aal') = 'aal2'` koppeln.
- Rollout **„observe → enforce"**; Service-Role/Automation ausgenommen.

## Konsequenzen

- Lockout-Risiko → Recovery + Reset zwingend gemeinsam.
- AAL2-Retrofit kann aktive AAL1-Sessions brechen → Übergangsphase „observe".
- `super_admin` zuerst MFA-härten (mächtigster Account).
