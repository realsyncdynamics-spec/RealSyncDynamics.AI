# P0c — AAL2 „observe → enforce" (Architektur- & Build-Plan)

> **Status:** Plan, NICHT implementiert · 2026-05-30
> **Basis:** ADR 0006 (MFA/AAL2-Matrix). **Kein Code in diesem Dokument.**
> **Ziel:** Den in P0a/P0b vorbereiteten AAL2-Observe-Pfad zu **echtem Enforcement** für privilegierte Aktionen härten — schrittweise, ohne aktive Sessions/Automation zu brechen.

## 0. IST-Stand (verifiziert)
- MFA (TOTP) live; `mfa.ts` hat `logAal2Intent()` = **observe-only** (console.info, blockiert nie).
- AAL2 wird heute **nirgends** hart erzwungen — weder in RLS noch in Edge Functions noch im UI.
- Privilegierte Schreib-Pfade laufen über Edge Functions (`tenant-members`, `mfa-admin-reset`, `governance-*`) mit owner/admin-Gate, aber **ohne** AAL2-Prüfung.
- Supabase stellt AAL im JWT bereit: `auth.jwt()->>'aal'` (RLS) bzw. `getAuthenticatorAssuranceLevel()` (Client) bzw. das `aal`-Claim im Function-JWT.

## 1. Scope P0c
**Erzwinge AAL2 für die Aktionen der ADR-0006-Matrix** — in drei Stufen (observe → soft → hard), mit Ausnahmen für Service-Role/Automation. **Nicht** in P0c: SSO/SCIM, Public-Sector-Hard-Lock (P1), neue Rollen.

### AAL2-Pflicht-Aktionen (aus ADR 0006)
Benutzer einladen/entfernen · Rolle ändern · Ownership übertragen · MFA-Pflicht ändern · MFA-Reset · SSO/Domain (P1) · SCIM-Token (P2) · Security-Settings · API-Keys · **DSFA/DPIA-Freigabe** · Tenant löschen · Art.15-Export/Lösch-Workflow · signiertes Evidence/Audit-Bundle · Billing-Kündigung.

## 2. Durchsetzungs-Ebenen (Defense in Depth)
1. **Edge Function (primär, P0c-Kern):** Jede privilegierte Function prüft das `aal`-Claim des User-JWT. Helper `requireAal2(jwt)` in `_shared` (neu) → bei `aal != 'aal2'` → `403 AAL2_REQUIRED`. Betrifft: `tenant-members` (set_role/remove), `mfa-admin-reset`, später `governance-dpias` (approve), `gdpr-delete`, `evidence-export`.
2. **RLS (sekundär, gestaffelt):** sensible **Write**-Policies zusätzlich an `(auth.jwt()->>'aal') = 'aal2'` koppeln — **nur** dort, wo Clients direkt schreiben (nicht service-role-Pfade). Service-Role ist per Definition aal-frei → **ausgenommen** (`TO authenticated` Policies, nicht `service_role`).
3. **UI (Komfort, kein Sicherheits-Verlass):** Vor AAL2-Aktion Step-up-Prompt (`mfa.challenge`/`verify`); `logAal2Intent` → echter `requireStepUp()`-Flow.

## 3. Rollout-Stufen (zwingend sequenziell)
- **Stufe 1 — observe (IST):** `logAal2Intent` protokolliert. Bleibt als Telemetrie.
- **Stufe 2 — soft-enforce (P0c-a):** Edge Functions geben bei fehlendem AAL2 eine **Warnung im Response** zurück (`{ ok:true, warning:'aal2_recommended' }`), blockieren aber noch nicht. UI zeigt Step-up-Angebot. Sammelt reale Daten, ob Nutzer MFA haben.
- **Stufe 3 — hard-enforce (P0c-b):** Edge Functions **blockieren** (`403 AAL2_REQUIRED`); RLS-Write-Policies verlangen `aal2`. Erst nach Auswertung von Stufe 2 (genug Nutzer mit MFA enrollt) und nachdem ein **Bypass für Lockout** existiert.

## 4. Kritische Sicherheits-/Betriebs-Risiken
1. **Lockout-Kette:** Wer MFA braucht (owner/admin/dpo) aber keinen Faktor hat, darf nicht ausgesperrt werden → vor Stufe 3 **Enrollment-Pflicht-Gate** (aus P0a, App-Shell) muss greifen + Recovery + `mfa-admin-reset` vorhanden (sind sie). super_admin-Bypass für Notfall.
2. **Service-Role/Cron:** RLS-`aal2`-Klausel darf **nie** service-role treffen (Cron/Webhooks haben kein aal) → Policies strikt `TO authenticated` scopen; service-role-Policies unverändert.
3. **Aktive AAL1-Sessions:** Bei Stufe-3-Flip verlieren laufende Sessions ohne AAL2 Schreibrechte → Step-up-Flow muss reibungslos sein; Kommunikation/Doku.
4. **JWT-aal-Verfügbarkeit:** sicherstellen, dass das `aal`-Claim im Function-JWT ankommt (Supabase setzt es; testen).
5. **Teilweiser Rollout:** Functions und RLS müssen **konsistent** flippen, sonst Lücke (Function blockt, RLS nicht / oder umgekehrt).

## 5. Voraussichtlich geänderte/neue Dateien
- **Neu:** `supabase/functions/_shared/aal.ts` — `requireAal2(jwt)` / `getAal(jwt)` (pure, unit-testbar).
- **Geändert (Functions):** `tenant-members`, `mfa-admin-reset`, schrittweise `governance-dpias`, `gdpr-delete`, `evidence-export` — AAL2-Check einbauen (Stufe 2 soft, dann 3 hard).
- **Geändert (Client):** `src/core/access/mfa.ts` — `logAal2Intent` → `requireStepUp(action)` mit Challenge/Verify-Flow; UI-Hook.
- **Migration (additiv, Stufe 3):** RLS-Write-Policies auf `tenant_security_settings`, `dpias`, ggf. `memberships` um `aal2`-Klausel ergänzen — **als neue Migration**, append-only.
- **Tests:** `aal.test.ts` (pure Guard), Function-Unit (403 ohne aal2), e2e (Step-up-Prompt erscheint).

## 6. Build-Reihenfolge (nach Freigabe)
1. `_shared/aal.ts` + Unit-Tests.
2. Stufe 2 (soft) in `tenant-members` + `mfa-admin-reset`: Warnung statt Block; Client-`requireStepUp` + UI-Prompt.
3. Telemetrie auswerten (genug MFA-Enrollment?) — **Gate vor Stufe 3**.
4. Stufe 3 (hard): Functions blockieren; additive RLS-Migration mit `aal2`-Klausel (service-role ausgenommen).
5. Auf weitere Functions ausrollen (dpias-approve, gdpr-delete, evidence-export).
6. Tests + Gates grün; PR (nicht mergen).

## 7. Aufwand (grob, Dev-Tage)
| Block | PT |
|---|---|
| `_shared/aal.ts` + Tests | 1 |
| Stufe 2 soft (2 Functions + Client-Step-up + UI) | 2–3 |
| Telemetrie-Auswertung | (Betrieb) |
| Stufe 3 hard (Functions + RLS-Migration) | 2–3 |
| Ausrollen auf weitere Functions | 2 |
| **Summe P0c** | **~7–9** |

## 8. Explizit NICHT in P0c
- ❌ SSO/SCIM (P1/P2) · ❌ Public-Sector-Hard-Lock (P1) · ❌ neue Rollen · ❌ Direkt-Sprung auf hard-enforce ohne soft-Stufe.

## 9. Freigabe-relevante Entscheidungen (vor Build zu klären)
1. **Soft-Phase-Dauer:** wie lange Stufe 2 laufen, bevor Stufe 3? (Vorschlag: bis X% der privilegierten Nutzer MFA enrollt haben.)
2. **Scope Stufe 3:** zuerst nur `tenant-members`+`mfa-admin-reset`, oder gleich inkl. dpias/gdpr/evidence?
3. **super_admin-Bypass:** Notfall-Override ja/nein (Empfehlung: ja, auditiert).
