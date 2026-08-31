# TASK — Claims vs Runtime Audit

**Version:** 1.0
**Auftrag:** Claims-vs-Runtime Audit
**Modus:** Read-only
**Keine Implementierung**

---

# 1. Ziel

Dieses Audit stellt ausschließlich fest, ob die aktuell kommunizierten Produkt-, Pricing-, Compliance-, SLA- und Leistungsversprechen von RealSyncDynamics.AI durch die im Repository nachweisbare technische Implementierung gedeckt sind.

Die Aufgabe ist **nicht**, neue Features zu bauen.
Die Aufgabe ist **nicht**, Pricing zu entwerfen.
Die Aufgabe ist **nicht**, eine neue Architektur vorzuschlagen.

Die Aufgabe ist:

> **Claim → technische Evidenz → Status → Enforcement → Risiko**

Die bestehende Infrastruktur ist als Ausgangspunkt zu behandeln. Es darf nichts als „fehlend" bewertet werden, nur weil es nicht an der erwarteten Stelle gefunden wurde.

---

# 2. Verbindliche Evidenzregel

Kein Status ohne konkreten Beleg.

Eine Aussage darf nur als `VERIFIED` bewertet werden, wenn mindestens ein konkreter technischer Beleg angegeben werden kann.

Gültige Evidenz:

* Dateipfad + Zeilennummer
* Testdatei + Testname
* API-Route + Implementierungsstelle
* Datenbanktabelle + relevante Spalte / Constraint / Policy
* konkrete Migration
* konkrete Stripe-Implementierung / Konfiguration
* konkrete TypeScript-/Go-SDK-Implementierung
* konkrete Terraform-Ressource
* konkrete Worker-/Function-Implementierung

Beispiel:

```text
VERIFIED
Evidence:
src/entitlements/check.ts:42-71
Test:
tests/entitlements/plan-access.spec.ts
test: "denies feature without entitlement"
```

Nicht ausreichend:

```text
"Das scheint implementiert zu sein."
"Das Backend unterstützt das."
"Die Architektur sieht danach aus."
"Das ist laut Dokumentation vorhanden."
```

Dokumentation allein ist keine technische Verifikation.

---

# 3. UNKNOWN vs NOT_FOUND

Diese beiden Zustände sind strikt zu unterscheiden.

## NOT_FOUND

`NOT_FOUND` bedeutet:

> Nach vollständiger Repository-Prüfung wurde keine technische Implementierung gefunden.

Beispiel:

```text
NOT_FOUND
Search:
src/**
supabase/**
workers/**
tests/**
No implementation found.
```

## UNKNOWN

`UNKNOWN` bedeutet:

> Der Zustand kann aus dem Repository nicht zuverlässig festgestellt werden.

Typische Fälle:

* Produktionskonfiguration nicht zugänglich
* tatsächlicher Production State unbekannt
* externer Provider-Zustand nicht verifizierbar
* produktive Stripe-Konfiguration nicht sichtbar
* reale Limits können nicht aus dem Code bestimmt werden
* tatsächliches Deployment nicht verifizierbar

Beispiel:

```text
UNKNOWN
Reason:
Production runtime is not accessible from this session.
Required production check:
Verify deployed Worker configuration for AI Gateway provider routing.
```

**UNKNOWN darf niemals in NOT_FOUND umgewandelt werden.**

---

# 4. Statusmodell

Für jeden Claim sind folgende Status zulässig:

```text
VERIFIED
PARTIAL
UNVERIFIED
CONTRADICTED
UNSUPPORTED
NOT_FOUND
UNKNOWN
OUTDATED
UNDERMARKETED
```

Zusätzlich ist bei technisch relevanten Claims ein Enforcement-Status erforderlich:

```text
HARD
SOFT
DISPLAY_ONLY
UNKNOWN
```

---

# 5. Enforcement

Für jedes Limit oder Entitlement muss geprüft werden:

> Wird es technisch erzwungen oder lediglich angezeigt?

Prüfe insbesondere:

* API Calls
* Bot Responses
* Domains
* Tenants
* Seats
* Automation Runs
* Storage
* Policy Packs
* AI Gateway Usage
* Agent Usage
* Integrationen
* sonstige Plan Limits

Beispiele:

```text
HARD
Backend verweigert Überschreitung und automatisierter Test bestätigt dies.

SOFT
Backend prüft das Limit, aber kein ausreichender Regressionstest vorhanden.

DISPLAY_ONLY
Limit erscheint ausschließlich im Frontend/Pricing.

UNKNOWN
Nicht feststellbar.
```

Ein auf der Pricing-Seite angezeigtes Limit gilt **nicht** als technisch enforced.

---

# 6. HARTE PHASENTRENNUNG

Das Audit besteht aus drei Phasen.

Nach jeder Phase muss Claude Code stoppen.

Keine Phase darf automatisch in die nächste übergehen.

---

# PHASE 1 — INVENTORY

## Ziel

Feststellen, was im Repository tatsächlich vorhanden ist.

Prüfe mindestens:

* Multi-Tenant
* Tenant Isolation
* Authentication
* Authorization
* Policy Engine
* Policy Packs
* Evidence Vault
* Hash Chain
* AI Gateway
* REST API
* TypeScript SDK
* Go SDK
* Terraform Provider
* Bots / Channels
* Governance Runtime
* Audit
* Entitlements
* Subscription System
* Stripe
* Checkout
* Webhooks
* Dashboard
* Pricing
* Feature Flags
* Usage Limits
* RLS
* API Authorization
* Tests
* E2E Tests
* Deployment Configuration
* Cloudflare
* Supabase
* Agents

Für jeden Bereich:

```text
STATUS
EVIDENCE
TEST
ENFORCEMENT
UNKNOWN/NOT_FOUND REASON
```

---

## Phase-1-Spezialprüfung: Limits

Erstelle eine separate Tabelle für sämtliche im Code auffindbaren Limits.

| Capability | Plan | Limit | Enforcement | Evidence | Test |
| ---------- | ---- | ----: | ----------- | -------- | ---- |

Besonders prüfen:

```text
Bots
Responses
Domains
Automation Runs
API Calls
Storage
Tenants
Seats
Agents
AI Gateway Usage
```

---

## Phase-1 Output

Schreibe ausschließlich:

```text
docs/audit/01_INVENTORY.md
```

Die Enforcement-Tabelle steht **am Ende** des Dokuments.

Danach:

# STOP

Keine Claims-Matrix.
Keine Pricing-Analyse.
Keine Verbesserungsvorschläge.
Keine Implementierung.

---

# PHASE 2 — CLAIMS MATRIX

Diese Phase darf **erst nach expliziter Freigabe** gestartet werden.

## Ziel

Die aktuelle Website, Pricing-Seite und relevante Marketing-/FAQ-Texte erfassen und gegen Phase 1 prüfen.

Für jeden Claim:

```text
CLAIM-ID
SOURCE
EXACT CLAIM
PLAN
CAPABILITY
STATUS
ENFORCEMENT
EVIDENCE
TEST
RISK
```

---

# 7. Pricing Comparison Table

Prüfe insbesondere, ob die Vergleichstabelle tatsächliche Capabilities abbildet oder lediglich sichtbare Bullet-Points zählt.

Ein höherer Plan darf nicht aufgrund einer geringeren Anzahl sichtbarer Bullet-Zeilen als leistungsschwächer erscheinen.

Kein:

```text
count(plan.bullets)
```

als semantische Aussage über Leistungsumfang.

Die technische Prüfung soll nur feststellen, ob ein solcher Darstellungsfehler existiert.

**Noch keine Korrektur implementieren.**

---

# 8. Agency Multi-Tenant Claim

Prüfe insbesondere:

```text
Agency
Mandanten: 1
```

gegen Aussagen wie:

```text
Governance für viele Kunden gleichzeitig
```

und:

```text
Multi-Tenant
```

Ermittle anhand der technischen Evidenz:

* tatsächliche Tenant-Struktur
* Tenant Isolation
* Tenant Limits
* Parent/Child-Struktur
* technisch erzwungene Limits

Nicht interpretieren.
Nur belegen.

---

# 9. SLA / Support Claims

Erfasse alle Aussagen zu:

* Support
* Reaktionszeiten
* Eskalationen
* Enterprise SLA
* Agency SLA
* Onboarding
* Zugang
* Rückmeldung

Besonders prüfen:

```text
8h
4h
15 Minuten
24 Stunden
```

Jede Zusage erhält einen eigenen Claim.

---

# 10. Legal Routes

Prüfe insbesondere:

```text
/impressum
/legal/impressum
/agb
/legal/terms
```

Erfasse:

* doppelte Seiten
* Redirects
* Canonicals
* Sitemap
* interne Links
* Footer Links
* widersprüchliche Inhalte

Keine Korrektur implementieren.

---

# 11. Locale / Currency

Prüfe deutsche Preis- und Zahlenformatierung.

Beispiel:

```text
10,200 €
1,347 €
```

ist auf einer deutschen Seite zu untersuchen.

Erfasse ausschließlich den Befund.
Keine Implementierung.

---

# 12. Compliance Claims

Prüfe besonders:

```text
ISO 27001
NIS2
TISAX
DORA
```

Für jedes Policy Pack feststellen:

* Controls
* Rules
* Mapping
* Evidence
* Assessment
* Reporting
* Automation
* Zertifizierungsbezug

Strikt unterscheiden zwischen:

```text
Framework / Control Support
Certification
Legal Compliance Guarantee
```

Ein vorhandenes Policy Pack darf nicht automatisch als Zertifizierung interpretiert werden.

---

# 13. Operational Claims

Prüfe auch operative Versprechen:

```text
Zugang innerhalb von 15 Minuten
Onboarding-Rückmeldung innerhalb von 24 Stunden
```

Diese Claims müssen als eigene Claims erfasst werden.

Technische Repository-Evidenz kann diese operative Realität möglicherweise nicht bestätigen.

Dann:

```text
UNKNOWN
```

und nicht `VERIFIED`.

---

# 14. Subprocessor / AI Gateway

Prüfe:

1. Welche Provider nennt die Datenschutz-/Subprozessoren-Dokumentation?
2. Welche Provider kann der AI Gateway tatsächlich aufrufen?
3. Gibt es Provider im Gateway, die nicht in der relevanten Liste auftauchen?
4. Gibt es umgekehrt gelistete Provider ohne technische Verwendung?
5. Gibt es dynamische Provider-Konfiguration?

Eine Abweichung ist als potenzieller Datenschutz-/Art.-28-Befund zu markieren.

Nicht rechtlich abschließend bewerten.

---

# Phase-2 Output

Schreibe ausschließlich:

```text
docs/audit/02_CLAIMS_REALITY_MATRIX.md
```

Danach:

# STOP

Keine Pricing-Entwicklung.
Keine Paketempfehlungen.
Keine Implementierung.

---

# PHASE 3 — RISK / GAP ANALYSIS

Diese Phase darf erst nach expliziter Freigabe gestartet werden.

## Ziel

Aus Phase 1 und Phase 2 ausschließlich die belegten Abweichungen zusammenführen.

Kategorien:

```text
CRITICAL
HIGH
MEDIUM
LOW
UNKNOWN
```

Prüfe:

* unsupported claims
* contradicted claims
* fehlendes Enforcement
* Pricing-Widersprüche
* SLA-Widersprüche
* operative Zusagen
* Legal Routes
* Compliance Claims
* Subprocessor/Gateway-Abweichungen
* Production Unknowns
* technische Kostenrisiken durch fehlende Limits

---

# 15. Production Unknowns

Alles, was aus dem Repository nicht verifiziert werden kann, muss als konkrete Produktionsprüfung ausgegeben werden.

Format:

```text
CHECK-ID
Unknown State
Why Repository Cannot Verify It
Required Production Check
Expected Evidence
```

Beispiel:

```text
CHECK-001
Unknown:
Production AI Gateway provider routing
Reason:
Production configuration is not accessible.
Required check:
Verify deployed Worker environment and provider routing.
Expected evidence:
Cloudflare Worker deployment/configuration.
```

---

# 16. Final Decision A/B/C

Am Ende ausschließlich feststellen:

## A — RUNTIME COVERED

Die relevanten Claims sind technisch ausreichend gedeckt.

oder

## B — PARTIALLY RUNTIME COVERED

Es bestehen begrenzte Lücken oder widersprüchliche Claims.

oder

## C — SIGNIFICANT GAP

Wesentliche Claims sind nicht technisch gedeckt oder technisch nicht ausreichend abgesichert.

Diese Entscheidung muss anhand der dokumentierten Evidenz begründet werden.

---

# 17. NICHT TEIL DIESES AUFTRAGS

Folgende Tätigkeiten sind ausdrücklich ausgeschlossen:

* neue Pricing-Pakete entwickeln
* Preise bestimmen
* Add-ons entwickeln
* Stripe-Produkte anlegen
* Stripe-Preise ändern
* Dashboard umbauen
* neue Features implementieren
* Entitlement-System umbauen
* Architektur refactoren
* Marketingtexte ändern
* Legaltexte ändern
* Claims korrigieren
* Tests implementieren
* Produktionskonfiguration verändern
* Datenbankmigrationen erstellen

Der Auftrag ist ein **Read-only Audit**.

---

# 18. Historische Audit-Dateien

Das bestehende Repository kann ältere Audit-Dokumente enthalten, insbesondere:

```text
AUDIT/
```

und beispielsweise:

```text
AUDIT/02_CLAIMS_REALITY_MATRIX.md
```

Diese Dokumente sind **keine aktuelle Source of Truth**.

Sie dürfen ausschließlich als historische Referenz erkannt werden.

Aktuelle Aussagen müssen anhand des aktuellen Repository-Zustands neu geprüft werden.

Insbesondere dürfen alte Produktionszahlen nicht ungeprüft übernommen werden.

---

# 19. Arbeitsregel

Wenn eine Information nicht belegt werden kann:

**UNKNOWN.**

Wenn nach vollständiger Repository-Suche keine Implementierung gefunden wird:

**NOT_FOUND.**

Wenn die Implementierung existiert, aber nicht vollständig den Claim erfüllt:

**PARTIAL.**

Wenn technische Evidenz dem Claim widerspricht:

**CONTRADICTED.**

Keine Vermutungen.
Keine Plausibilitätsbewertungen als technische Beweise.
Keine Rekonstruktion aus alten Roadmaps.

---

# 20. Abschlussregel

Nach jeder Phase muss Claude Code den Lauf beenden und auf weitere Anweisung warten.

Es ist ausdrücklich verboten, Phase 1 → Phase 2 → Phase 3 automatisch durchzulaufen.

**PHASE 1 → STOP**
**PHASE 2 → STOP**
**PHASE 3 → FINAL REPORT → STOP**

Erst nach Abschluss dieses Audits darf ein separater Auftrag für:

```text
Pricing
Packaging
Add-ons
Stripe
Dashboard
Entitlements
```

erstellt werden.

# Ende der Spec
