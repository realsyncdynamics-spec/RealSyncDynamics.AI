# Audit-Übernahme — der fehlende Schreiber

**Gebaut am**: 2026-08-31
**Code**: `supabase/functions/audit-claim/` · `supabase/functions/_shared/audit-claim.ts`
· `src/features/audit/pendingAudit.ts`
**Tests**: `test/edge/audit-claim.test.ts`

---

## 1. Die Lücke

`gdpr_audits` trägt seit jeher `user_id`, `tenant_id` und `claimed_at`. Die
Lese-Policy ist bereits darauf geschrieben:

```sql
"gdpr_audits tenant_read": (tenant_id IS NOT NULL) AND is_tenant_member(tenant_id)
```

Ein Audit wird für einen Mandanten also **erst sichtbar, wenn es übernommen
ist**. Gemessen am 2026-08-30:

```
select count(*), count(claimed_at), count(tenant_id) from gdpr_audits;
→ 159 | 0 | 0
```

**Null.** Nichts im Repository schrieb diese Spalten; die `claimed_at`-Treffer
gehörten sämtlich zu `siteos_anonymous_builds`, einer anderen Tabelle.

Der Lesepfad war fertig und wartete auf einen Schreiber, den es nie gab. Damit
brach die Kette `Report → Auth → Tenant → Audit Claim` genau nach dem Bericht
ab — bestätigt in `canonical-funnel-decision.md` §1. Ein Kunde konnte scannen,
den Bericht lesen, sich registrieren — und fand sein Ergebnis im Konto nicht
wieder.

`PostRegisterOnboardingPage.tsx` trug dazu einen Kommentar, der die Stelle
bereits als die richtige markierte und auf „P0-B" verwies. Diese Änderung löst
ihn ein.

---

## 2. Kein zweites Claim-Modell

`canonical-funnel-decision.md` verbietet ausdrücklich ein zweites Claim-Modell.
Das Muster stammt deshalb unverändert aus `siteos/handlers/anonymous.ts`:

1. Bearer-Token → `auth.getUser()` — wer übernimmt, wird **bewiesen**, nicht
   im Body behauptet
2. Mitgliedschaft im Zielmandanten prüfen
3. Atomar übernehmen: `.eq('id', …).is('claimed_at', null)`
4. Prüfpfad-Eintrag über `_shared/auditLog.ts`

Geschrieben wird ausschliesslich mit der Service-Role: Auf `gdpr_audits` gibt
es **keine** INSERT- oder UPDATE-Policy, nur zwei SELECT-Policies. Der Browser
kann diese Spalten nicht setzen, auch nicht versehentlich.

---

## 3. Vertrauensmodell — ausdrücklich benannt

**Wer die `audit_id` kennt, darf sie einmal übernehmen.** Die Kennung ist eine
serverseitig vergebene UUIDv4 und nicht ratbar; sie erreicht nur, wem der
Ergebnis-Link gegeben wurde. Dieselbe Fähigkeits-Logik gilt bei
`siteos_anonymous_builds` und beim Teilen über `audit_share_get`.

Bewusst **nicht** verlangt wird, dass die E-Mail des Audits zur E-Mail des
Kontos passt:

- Der Optimizer-Pfad erhebt gar keine E-Mail (`gdpr-audit/index.ts`,
  `isOptimizerScan`) — eine Gleichheitsprüfung würde ihn komplett aussperren.
- Wer mit der Arbeitsadresse scannt und sich privat registriert, wäre sonst
  ausgeschlossen.

Eine Abweichung wird stattdessen als `email_mismatch` im Prüfpfad festgehalten:
**beobachtbar statt blockierend**. Wer das später verschärfen will, hat die
Daten dafür.

### Was eine falsche Übernahme kostet

Sie ist über die Oberfläche **nicht korrigierbar**. Landet ein Audit im
falschen Mandanten, verbirgt dieselbe Lese-Policy es dem richtigen dauerhaft.
Deshalb rät `resolveTenant` bei mehreren Mitgliedschaften **nicht**, sondern
antwortet mit `TENANT_AMBIGUOUS`.

---

## 4. Idempotenz und Wettlauf

| Fall | Antwort |
|---|---|
| Frei | `ok: true, already_claimed: false` |
| Schon von **diesem** Mandanten | `ok: true, already_claimed: true` — kein Fehler |
| Von einem **anderen** Mandanten | `409 ALREADY_CLAIMED` |
| Wettlauf zwischen Lesen und Schreiben | `.is('claimed_at', null)` entscheidet in der Datenbank; der Verlierer prüft nach und antwortet je nach Gewinner |

Ein Reload oder ein zweiter Tab darf nicht in einem Konflikt enden — die
zweite Übernahme durch denselben Mandanten ist ein Reload, kein Angriff.

---

## 5. Der Weg durch die Oberfläche

```
/audit/result/:auditId        Kennung merken (nur die UUID)
        ↓                     localStorage: rsd.pending_audit_id
   Registrierung
        ↓
/unified-entry/onboarding     Effekt: claimPendingAudit(activeTenantId)
        ↓                     → POST /functions/v1/audit-claim
   gdpr_audits.tenant_id gesetzt → Audit im Konto sichtbar
```

**Gespeichert wird nur die Kennung** — keine Befunde, keine E-Mail, keine
Domain, kein Score. Der Bericht liegt serverseitig; ihn zusätzlich im Browser
zu halten hiesse, personenbezogene Daten ohne Not auf ein Gerät zu verteilen,
das der Betreiber nicht kontrolliert und für das er keine Löschfrist
durchsetzen kann. Nach der Übernahme wird die Notiz entfernt.

Der Aufruf steht in einem **eigenen Effekt**, nicht im Absende-Pfad der
Branchenfragen: Die Zuordnung soll auch gelingen, wenn der Nutzer die Fragen
abbricht. `claimPendingAudit` wirft nicht — die Übernahme ist ein Gewinn, kein
Tor, und darf die Registrierung nicht scheitern lassen.

---

## 6. Noch nicht deployt — und warum das hier steht

`audit-claim` liegt im Repository, ist aber noch **nicht in Produktion**; das
geschieht mit dem nächsten `deploy.yml`-Lauf nach dem Merge. Bis dahin steht
sie in `UNBACKED_CALLERS` (`src/config/production-edge-functions.ts`).

Das ist kein toter Knopf im Sinne von CLAUDE.md §14: Der Aufruf ist ein
stiller Effekt, kein Element in der Oberfläche. Schlägt er fehl, bleibt die
gemerkte Kennung liegen und der nächste Anlauf holt sie nach — der Nutzer
sieht keine Sackgasse, nur eine Zuordnung, die noch aussteht.

`test/backend/edge-function-contract.test.ts` wird rot, sobald die Function
deployt ist, und erinnert daran, den Eintrag zu entfernen. Das ist der
beabsichtigte „schöne Fall" jener Liste.

---

## 7. Was damit **nicht** gelöst ist

- **Bestandsdaten**: Die 159 vorhandenen Audits bleiben unübernommen. Eine
  rückwirkende Zuordnung wäre Raten — niemand weiss, welches Konto zu welchem
  anonymen Scan gehört. Wer es dennoch will, braucht die E-Mail als Brücke und
  eine ausdrückliche Entscheidung darüber, ob das zulässig ist.
- **Mehrere Audits**: Gemerkt wird genau eine Kennung. Wer zweimal scannt,
  bevor er sich registriert, übernimmt den zuletzt gesehenen Bericht. Eine
  Liste wäre möglich, ist aber ohne belegten Bedarf gebaute Komplexität.
- **Übernahme aus dem Konto heraus**: Es gibt keine Oberfläche, in der ein
  angemeldeter Nutzer eine fremde `audit_id` einträgt. Der Weg führt heute
  ausschliesslich über den gemerkten Bericht.
