# GOV-OS-ABNAHME-001

RealSyncDynamics.AI / Governance OS — Review- und Abnahmeliste (belegpflichtig).

- Dokument: `GOV-OS-ABNAHME-001`
- Version: `1.0`
- Datum: `2026-09-15`
- Geltung: Production-Abnahme

## Grundsatz

Jede Position ist eine Abnahme- und Belegposition. Ein Feature ist erst FERTIG, wenn diese Kette nachgewiesen ist:

```
CODE → TEST → EINZELBELEG → BACKEND → DATABASE → ENTITLEMENT → STRIPE → FRONTEND → PRODUCTION
```

Keine Belege → kein PASS. Ein erwarteter Fehler (z. B. 403) gilt nicht als Nachweis, dass ein Gate funktioniert. Positiv- und Negativfall sind separat zu belegen.

## Empfohlene Reihenfolge

1. Governance OS Functional Pass
2. Gate-Prüfung mit Einzelbeleg
3. Frontend-Monetarisierung
4. Entitlements / Plan Catalog
5. Stripe E2E
6. Supabase Production
7. Cloudflare Production
8. Kompletter Frontend-Flow

---

## A. Aktuelle Claude-Code-Sitzungen zuerst prüfen

### 1. Governance OS Functional Pass

- [ ] Session öffnen
- [ ] Welche Funktionen wurden tatsächlich getestet?
- [ ] Welche Tests wurden ausgeführt?
- [ ] Ergebnis je Funktion: PASS / FAIL / BLOCKED
- [ ] Keine PASS-Aussage ohne konkreten Testbeleg
- [ ] Fehler / Warnings dokumentieren
- [ ] Geänderte Dateien prüfen
- [ ] Git Commit / PR feststellen
- [ ] Ergebnis gegen Production-Stand abgleichen

Abnahme: PASS / FAIL / BLOCKED

### 2. Gate-Prüfung mit Einzelbeleg

Für jedes Gate einzeln. 403 darf nicht als „Gate funktioniert“ gewertet werden.

- [ ] Gate eindeutig definiert
- [ ] Geprüfte tenantId eindeutig
- [ ] Tatsächlicher Backend-Read geprüft
- [ ] Insert / Mutation geprüft
- [ ] Usage / Limit-Prüfung geprüft
- [ ] HTTP-Status geprüft
- [ ] Response-Body geprüft
- [ ] 403 nicht als Funktionsnachweis gewertet
- [ ] Positivfall getestet
- [ ] Negativfall getestet
- [ ] Einzelbeleg vorhanden

Abnahme: PASS / FAIL / BLOCKED

### 3. Frontend-Monetarisierung

- [ ] Pricing im Frontend entspricht dem kanonischen Plan Catalog
- [ ] Starter €79 korrekt
- [ ] Weitere Pakete korrekt
- [ ] Checkout erzeugt korrekte Stripe Session
- [ ] Richtige price_id
- [ ] Richtige tenantId
- [ ] Webhook wird verarbeitet
- [ ] Subscription / Entitlement wird korrekt vergeben
- [ ] Frontend zeigt richtigen Plan
- [ ] Gesperrte Funktionen bleiben gesperrt
- [ ] Freigeschaltete Funktionen funktionieren
- [ ] Kein Credits- / Usage-Modell für `siteos.builder`

Abnahme: PASS / FAIL / BLOCKED

---

## B. Governance-OS-Kern

### 4. Entitlements

- [ ] `siteos.builder` vorhanden
- [ ] `siteos.publish` vorhanden
- [ ] `evidence.vault` vorhanden
- [ ] Entitlement Registry = Plan Catalog
- [ ] TypeScript-Union entspricht Registry
- [ ] Keine veralteten Entitlements
- [ ] Keine unbekannten Entitlements
- [ ] Capability ≠ Verbrauch
- [ ] `limit.sites` bleibt numerisches Limit

Abnahme: PASS / FAIL

### 5. Plan Catalog / SSoT

- [ ] Genau eine kanonische Quelle
- [ ] Frontend verwendet SSoT
- [ ] Backend verwendet SSoT
- [ ] Stripe Mapping stimmt
- [ ] Entitlements stimmen
- [ ] Limits stimmen
- [ ] Keine hardcodierten Preise an anderer Stelle
- [ ] Keine divergierenden Plan-Definitionen

Abnahme: PASS / FAIL

### 6. Multi-Tenancy

- [ ] Jede relevante Anfrage hat geprüfte tenantId
- [ ] Reads verwenden geprüfte tenantId
- [ ] Inserts verwenden geprüfte tenantId
- [ ] Updates verwenden geprüfte tenantId
- [ ] Keine Manipulation über `body.tenantId`
- [ ] Cross-Tenant-Zugriff negativ getestet
- [ ] RLS aktiv
- [ ] RLS funktioniert tatsächlich
- [ ] 403 / 401 korrekt interpretiert

Abnahme: PASS / FAIL

---

## C. Builder / SiteOS

### 7. App Builder

- [ ] Builder nur mit `siteos.builder`
- [ ] Fehlendes Entitlement → Zugriff verweigert
- [ ] Vorhandenes Entitlement → Zugriff erlaubt
- [ ] `limit.sites` wird korrekt geprüft
- [ ] Keine Credits
- [ ] Site-Erstellung funktioniert
- [ ] Site-Speicherung funktioniert
- [ ] Site-Liste funktioniert
- [ ] Site-Bearbeitung funktioniert

Abnahme: PASS / FAIL

### 8. Publish

- [ ] `siteos.publish` korrekt geprüft
- [ ] Builder allein reicht nicht automatisch zum Publish
- [ ] Publish ohne Berechtigung → BLOCK
- [ ] Publish mit Berechtigung → PASS
- [ ] Domain / Deployment korrekt
- [ ] Veröffentlichte Site erreichbar
- [ ] Keine Umgehung über API

Abnahme: PASS / FAIL

---

## D. Stripe / Billing

### 9. Checkout End-to-End

Starter €79 → Stripe → Webhook → Entitlement

- [ ] Checkout öffnen
- [ ] Korrekter Preis
- [ ] Korrekter Plan
- [ ] Stripe Session erzeugt
- [ ] `checkout.session.completed`
- [ ] Webhook empfangen
- [ ] Webhook validiert
- [ ] Tenant korrekt bestimmt
- [ ] Entitlement vergeben
- [ ] `tenant_entitlements.siteos.builder` korrekt gesetzt
- [ ] Limit korrekt gesetzt
- [ ] Dashboard aktualisiert

Abnahme: PASS / FAIL / BLOCKED

---

## E. Production-Verifikation (zwingend separat)

### 10. Cloudflare Production

- [ ] Production SHA ermitteln
- [ ] Production SHA = aktueller HEAD
- [ ] Cloudflare Pages Deployment erfolgreich
- [ ] Production URL erreichbar
- [ ] Smoke Test erfolgreich

Status: PASS / FAIL / NICHT VERIFIZIERT

### 11. Supabase Production

Pflichtmigrationen:

- `20260912170000_siteos_builder_entitlements`
- `20260912171000_canonical_plan_catalog`

- [ ] Beide Migrationen in Production angewendet
- [ ] Schema entspricht erwartetem Stand
- [ ] RLS aktiv
- [ ] Relevante Tabellen vorhanden

Status: PASS / FAIL / NICHT VERIFIZIERT

### 12. Stripe Testmode

```
Starter €79
  → Checkout Session
  → checkout.session.completed
  → Webhook
  → Tenant identifizieren
  → Grant
  → tenant_entitlements
  → siteos.builder = true
  → Builder freigeschaltet
```

- [ ] Jeder Schritt nachgewiesen
- [ ] Keine manuelle Datenbankkorrektur
- [ ] Kein Mock
- [ ] Echter Webhook
- [ ] Echter Entitlement-Grant

Status: PASS / FAIL / NICHT VERIFIZIERT

---

## F. Frontend

### 13. Dashboard

- [ ] Dashboard lädt ohne Fehler
- [ ] Navigation funktioniert
- [ ] Pricing sichtbar
- [ ] Builder sichtbar
- [ ] Richtige Feature-Sperren
- [ ] Richtige Feature-Freischaltungen
- [ ] Keine toten Buttons
- [ ] Keine Fake-Funktionen
- [ ] Keine „Coming Soon“-Funktion wird als verfügbar dargestellt

Abnahme: PASS / FAIL

### 14. Landing Page

- [ ] CTA funktioniert
- [ ] Free Governance Scan funktioniert
- [ ] Scan → Report
- [ ] Report → Dashboard
- [ ] Dashboard → Feature
- [ ] Feature → Checkout
- [ ] Checkout → Entitlement
- [ ] Entitlement → Funktion

Abnahme: PASS / FAIL

---

## G. Sicherheits- / Governance-Abnahme

- [ ] RLS geprüft
- [ ] Tenant-Isolation geprüft
- [ ] Auth geprüft
- [ ] MFA-relevante Gates geprüft
- [ ] API-Gates geprüft
- [ ] Admin-Gates geprüft
- [ ] Keine Secrets im Frontend
- [ ] Keine Service-Role-Key-Leaks
- [ ] Webhook-Signatur geprüft
- [ ] Audit-Logs vorhanden
- [ ] Evidence Vault funktioniert
- [ ] Nachweise unveränderbar / prüfbar

Abnahme: PASS / FAIL

---

## H. Automatisierte Tests

- [ ] Unit Tests grün
- [ ] Integration Tests grün
- [ ] E2E Tests grün
- [ ] Keine still übersprungenen kritischen Tests
- [ ] Keine Tests mit falschem Tenant
- [ ] Keine Tests, die nur HTTP-Status prüfen
- [ ] Response-Body wird geprüft
- [ ] Positiv- und Negativfälle vorhanden
- [ ] Production Smoke Test vorhanden

Abnahme: PASS / FAIL

---

## Finale Abnahme

Gesamtergebnis nur PASS, wenn A–H mit Beleg geschlossen sind und Block E nicht auf NICHT VERIFIZIERT steht.

Finale: PASS / FAIL / BLOCKED

Reviewer: Name / Datum / Commit-SHA  
Owner: Name / Datum
