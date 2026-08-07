# Release Checklist - Phasenbasierte Priorisierung

**Zweck**: Strukturierte Abarbeitung der Release-Vorbereitung mit klaren Phasen und Gates
**Verwendung**: Für jede Release-Vorbereitung anpassen und abhaken

---

## Übersicht

Diese Checkliste ist in **4 Phasen** unterteilt, um das Risiko zu minimieren, dass Infrastrukturänderungen von späteren PRs überholt werden.

### Phasen-Ablauf

```
Phase A: Infrastruktur-Grundlage
    ↓
Phase B: Kritische Feature-PRs (hohe Priorität)
    ↓
Phase C: Wichtige Feature-PRs (mittlere Priorität)
    ↓
Phase D: Abschluss & Deployment
```

---

## Phase A: Infrastruktur-Grundlage

**Ziel**: Alle grundlegenden Infrastrukturkomponenten müssen stehen, bevor Features gemerged werden.

### Repository-Zugriff & Berechtigungen
- [ ] Admin-Rechte für Release-Verantwortliche (oder Maintain + Repository Settings)
- [ ] Branch Protection Rules für `main` konfiguriert
- [ ] Required Reviews: Mindestens 2
- [ ] Required Status Checks: CI muss grün sein
- [ ] Code Owners Datei aktuell

### Secrets & Environments
- [ ] Alle CI/CD Secrets in GitHub Secrets hinterlegt
- [ ] Staging Environment konfiguriert
- [ ] Production Environment konfiguriert
- [ ] Secrets für alle externen Dienste (Supabase, Cloudflare, etc.) vorhanden

### CI/CD Pipeline
- [ ] Alle Workflows grün auf `main`
- [ ] Branch Protection erzwingt Status Checks
- [ ] Test Coverage Report funktioniert
- [ ] Build Artifacts werden korrekt generiert

---

## Phase B: Kritische Feature-PRs

**Ziel**: Die für das Release kritischen PRs mit hoher Priorität abarbeiten.

### Priorisierte PRs (Beispiel - anpassen!)
- [ ] **#904** - SiteOS: AI-native Website-Ebene
  - [ ] Code Review abgeschlossen
  - [ ] Merge-Kriterien erfüllt (siehe unten)
  - [ ] Rollback-Plan dokumentiert
  
- [ ] **#901** - AI-App-Builder + Governance-Backend Monorepo
  - [ ] Code Review abgeschlossen
  - [ ] Merge-Kriterien erfüllt
  - [ ] Rollback-Plan dokumentiert

### Merge-Kriterien für jeden PR
- [ ] CI erfolgreich (alle Checks grün)
- [ ] Keine offenen Review-Blocker
- [ ] Keine bekannten Security-Regressionen
- [ ] Staging Smoke-Test erfolgreich
- [ ] Migrations-Timestamps korrekt (nach letzter `main`-Migration)
- [ ] Migrationen sind idempotent

---

## Phase C: Wichtige Feature-PRs

**Ziel**: Wichtige, aber nicht kritische Features nach den kritischen PRs mergen.

### PRs mit mittlerer Priorität (Beispiel - anpassen!)
- [ ] **#897** - [Beschreibung]
  - [ ] Code Review abgeschlossen
  - [ ] Merge-Kriterien erfüllt
  - [ ] Rollback-Plan dokumentiert
  
- [ ] **#902** - [Beschreibung]
  - [ ] Code Review abgeschlossen
  - [ ] Merge-Kriterien erfüllt
  - [ ] Rollback-Plan dokumentiert

- [ ] **#896** - [Beschreibung]
  - [ ] Code Review abgeschlossen
  - [ ] Merge-Kriterien erfüllt
  - [ ] Rollback-Plan dokumentiert

- [ ] **#905** - Phase-5 Release-Roadmap (Dokumentation)
  - [ ] Code Review abgeschlossen
  - [ ] Merge-Kriterien erfüllt

---

## Phase D: Abschluss & Deployment

**Ziel**: Finale Vorbereitungen und Deployment.

### Domain & DNS
- [ ] Custom Domain in Cloudflare Pages/GitHub Pages konfiguriert
- [ ] DNS-Records korrekt gesetzt (A/AAAA oder CNAME je nach Provider)
- [ ] SSL-Zertifikat gültig und auto-renewal aktiv
- [ ] Domain propagiert (TTL abgewartet)

### Monitoring
- [ ] Monitoring Dashboard konfiguriert
- [ ] Alerts für kritische Metriken eingerichtet
- [ ] Slack/PagerDuty Integration getestet
- [ ] Log-Retention konfiguriert

### Release
- [ ] Release-Branch erstellt
- [ ] Release-Tag gesetzt
- [ ] Changelog aktualisiert
- [ ] Deployment auf Staging erfolgreich
- [ ] Finaler Smoke-Test auf Staging
- [ ] Deployment auf Production
- [ ] Post-Deployment Verification

---

## Release Gate

**Vor dem Merge der letzten kritischen PR (Phase B → C Übergang):**

| Kriterium | Status | Verantwortlich | Datum |
|----------|--------|---------------|-------|
| CI grün | [ ] | [Name] | [Datum] |
| Smoke Tests bestanden | [ ] | [Name] | [Datum] |
| Secrets vorhanden | [ ] | [Name] | [Datum] |
| Branch Protection aktiv | [ ] | [Name] | [Datum] |
| Domain erreichbar | [ ] | [Name] | [Datum] |
| Monitoring aktiv | [ ] | [Name] | [Datum] |
| Rollback dokumentiert | [ ] | [Name] | [Datum] |

**Status**: ❌ Nicht bereit / ⏳ In Arbeit / ✅ Bereit für Release

---

## Rollback-Kriterien

**Für jede kritische PR (Phase B) muss ein Rollback-Plan dokumentiert sein:**

### Rollback-Optionen
1. **Revert Commit**: `git revert <commit-hash>`
2. **GitHub Revert PR**: Automatisch über GitHub UI
3. **Manueller Rollback**: [Spezifische Schritte dokumentieren]

### Rollback-Test
- [ ] Rollback-Prozedur für jede kritische PR getestet
- [ ] Rollback-Zeit dokumentiert (Ziel: < 5 Minuten)
- [ ] Rollback-Verantwortlicher benannt

---

## Release Outcome

**Nach Abschluss der Phase 5 soll die Plattform den End-to-End-Workflow abbilden:**

```
Discover → Classify → Enforce → Prove
```

### Erfolgskriterien

- [ ] **Website Discovery**: Automatische Erkennung und Indexierung von Websites
- [ ] **AI System Register**: Registrierung aller AI-Systeme
- [ ] **Vendor Register**: Registrierung aller Anbieter
- [ ] **Risk Register**: Risikobewertung und -kategorisierung
- [ ] **Evidence Vault**: Nachweisführung und Audit-Trail
- [ ] **Audit Export**: Exportfunktionalität für Audits
- [ ] **Runtime Monitoring**: Echtzeit-Überwachung der Systeme

---

## Anpassungshinweise

1. **PR-Nummern**: Immer die aktuellen PR-Nummern aus dem Repository verwenden
2. **Priorisierung**: Die Einteilung in Phase B/C basiert auf der Release-Priorisierung, nicht auf objektiven Metriken
3. **Verantwortliche**: Immer konkrete Personen benennen
4. **Daten**: Immer aktuelle Daten eintragen

## Verifizierung

- [ ] Alle Checkboxen in Phase A sind abgehakt
- [ ] Alle kritischen PRs in Phase B sind gemerged
- [ ] Alle Merge-Kriterien sind erfüllt
- [ ] Release Gate ist grün
- [ ] Rollback-Pläne sind dokumentiert
- [ ] Release Outcome Kriterien sind definiert
