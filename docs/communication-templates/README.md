# Kommunikationstemplates

**Zweck:** Standardisierte Vorlagen für Team-Kommunikation und Release-Management

---

## Übersicht

Dieses Verzeichnis enthält angepasste Vorlagen für verschiedene Kommunikationsszenarien im Entwicklungsprozess. Alle Vorlagen basieren auf überprüfbaren Fakten und vermeiden unbelegte Annahmen.

---

## Verfügbare Vorlagen

### 1. [Admin-/Branch-Protection-Mail](ADMIN_BRANCH_PROTECTION_EMAIL.md)

**Zweck:** Anfrage von Admin- oder Maintain-Rechten für Release-Vorbereitung

**Wichtige Anpassungen:**
- Keine unbelegten Aussagen (z.B. "40+ offene PRs")
- Priorisierung als "interne Release-Priorisierung" gekennzeichnet
- Lösungsorientierte Alternative: Maintain + Repository Settings
- Klare Zeitrahmen

**Verwendung:** Wenn Admin-Rechte für Infrastrukturänderungen benötigt werden

---

### 2. [GitHub Issue Vorlage](GITHUB_ISSUE_TEMPLATE.md)

**Zweck:** Standardisierte Issue-Erstellung mit klaren Merge-Kriterien

**Wichtige Anpassungen:**
- Merge-Kriterien hinzugefügt:
  - CI erfolgreich
  - Keine offenen Review-Blocker
  - Keine bekannten Security-Regressionen
  - Staging Smoke-Test erfolgreich

**Verwendung:** Für alle neuen Issues im Repository

---

### 3. [DNS-Konfiguration Mail](DNS_CONFIGURATION_EMAIL.md)

**Zweck:** Anleitung zur DNS-Konfiguration für Deployment

**Wichtige Anpassungen:**
- Technisch korrekte Anweisungen (kein "CNAME auf @ setzen")
- Plattform-spezifische Anleitungen für Cloudflare Pages und GitHub Pages
- Hinweis: CNAME am Apex wird nicht von allen Providern unterstützt
- Cloudflare CNAME Flattening erwähnt
- Alternative: A/AAAA Records für Provider ohne CNAME-Support

**Verwendung:** Wenn DNS-Konfiguration für Deployment benötigt wird

---

### 4. [Slack Review Request](SLACK_REVIEW_REQUEST.md)

**Zweck:** Anfrage für Code-Reviews im Team

**Wichtige Anpassungen:**
- Qualitätsfokus: "Bitte nur reviewen, wenn ihr Zeit für vollständige Reviews habt"
- Effizienz: "Lieber zwei saubere Reviews als fünf oberflächliche"
- Strukturierte Vorlagen für normale und kritische PRs
- Klare Fokusbereiche für Reviewer

**Verwendung:** Für alle Review-Anfragen im Team-Slack

---

### 5. [Release Checkliste](RELEASE_CHECKLIST.md)

**Zweck:** Phasenbasierte Release-Vorbereitung

**Wichtige Anpassungen:**
- **Phasenbasierte Struktur:**
  - Phase A: Infrastruktur-Grundlagen (Repository-Zugriff, Branch Protection, Secrets, Environments)
  - Phase B: Kritische Infrastruktur-PRs (#897, #902)
  - Phase C: Wichtige Feature-PRs (#896, #905)
  - Phase D: Deployment & Monitoring (Domain, Monitoring, Release)

- **Release Gate:** Checkliste vor dem Merge der letzten kritischen PR
  - CI grün
  - Smoke Tests bestanden
  - Secrets vorhanden
  - Branch Protection aktiv
  - Domain erreichbar
  - Monitoring aktiv
  - Rollback dokumentiert

- **Rollback-Plan:** Für jede kritische PR
  - Revert Commit
  - GitHub Revert PR

- **Release Outcome:** Fachliches Ziel für Phase 5
  - End-to-End-Workflow: Discover → Classify → Enforce → Prove
  - Erfolgskriterien für alle Register und Funktionen

**Verwendung:** Für Release-Vorbereitung und -Management

---

## Grundprinzipien aller Vorlagen

1. **Faktenbasiert:** Keine unbelegten Aussagen
2. **Technisch korrekt:** Anweisungen sind plattformunabhängig oder plattformspezifisch korrekt
3. **Lösungsorientiert:** Alternativen und Workarounds werden angeboten
4. **Transparenz:** Klare Kennzeichnung von internen Priorisierungen
5. **Qualitätsfokus:** Betonung auf gründliche Arbeit statt oberflächlicher Aktivitäten

---

## Anpassung der Vorlagen

Alle Vorlagen enthalten:
- **Variablen:** Platzhalter in eckigen Klammern (z.B. `[NAME]`, `[DATUM]`)
- **Beispiele:** Beispielwerte für jede Variable
- **Anpassungsnotizen:** Erklärung der wichtigsten Änderungen

**Vor dem Versand:**
1. Alle Variablen ersetzen
2. Links testen
3. Inhalte auf Aktualität prüfen
4. Empfängerliste verifizieren

---

## Versionierung

| Version | Datum | Änderungen |
|---------|-------|------------|
| 1.0 | 2026-07-29 | Initialversion basierend auf Team-Feedback |

---

## Verantwortlich

**Maintainer:** Engineering Team  
**Kontakt:** support@realsyncdynamics.ai

---

## Verwandte Dokumente

- [DEPLOY-CHECKLIST.md](../DEPLOY-CHECKLIST.md) - Technische Deployment-Checkliste
- [BETA_INVITE_EMAIL_TEMPLATE.md](../BETA_INVITE_EMAIL_TEMPLATE.md) - Beta-Einladungsvorlage
- [GOVERNANCE_BETA_ONBOARDING.md](../GOVERNANCE_BETA_ONBOARDING.md) - Beta-Onboarding
