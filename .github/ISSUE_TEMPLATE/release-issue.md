---
name: "Release Issue"
about: "Standardvorlage für Release-bezogene Issues mit Merge-Kriterien und Validierung"
title: "[Release] [Komponente] - [Kurzbeschreibung]"
labels: ["release", "needs-review"]
---

## Release Issue

**Status:** 
- [ ] Draft
- [ ] Ready for Review
- [ ] In Progress
- [ ] Blocked
- [ ] Done

**Priorität:** 
- [ ] P0 - Release-Blocker (verhindert Release)
- [ ] P1 - Kritisch für Phase (muss im aktuellen Release)
- [ ] P2 - Wichtig (sollte im aktuellen Release)
- [ ] P3 - Nice-to-have (kann warten)

**Release-Ziel:** 
- [ ] Phase 5
- [ ] Phase 6
- [ ] Hotfix
- [ ] Feature-Release

---

## Beschreibung

[Klare, technische Beschreibung des Problems/Features. Bitte nur verifizierte Fakten, keine Annahmen.]

**Hintergrund:**
[Kontext und Begründung, warum dies für das Release wichtig ist]

**Abhängigkeiten:**
- [ ] PR #XXX muss gemerged sein
- [ ] Issue #YYY muss geschlossen sein
- [ ] Infrastruktur (z.B. Secrets, Environments) muss verfügbar sein

---

## Akzeptanzkriterien

### Funktionelle Anforderungen
- [ ] Kriterium 1
- [ ] Kriterium 2
- [ ] Kriterium 3

### Nicht-funktionelle Anforderungen
- [ ] Performance: [z.B. < 2s Response Time]
- [ ] Security: [z.B. Keine neuen Vulnerabilities]
- [ ] Testabdeckung: [z.B. > 80%]

---

## Merge-Kriterien

**✅ Alle folgenden Kriterien müssen erfüllt sein, bevor gemerged werden kann:**

- [ ] **CI erfolgreich** - Alle GitHub Actions Checks grün
- [ ] **Keine offenen Review-Blocker** - Alle Review-Kommentare adressiert
- [ ] **Keine bekannten Security-Regressionen** - Security-Scan sauber
- [ ] **Staging Smoke-Test erfolgreich** - Funktioniert in Staging-Umgebung
- [ ] **Rollback dokumentiert** - Rollback-Prozedur im PR oder verlinkt
- [ ] **Dokumentation aktualisiert** - Alle relevanten Docs angepasst

---

## Technische Details

### Betroffene Komponenten
- [ ] Frontend
- [ ] Backend
- [ ] Database
- [ ] Infrastructure
- [ ] Documentation

### Testabdeckung
- [ ] Unit Tests hinzugefügt/aktualisiert
- [ ] Integration Tests hinzugefügt/aktualisiert
- [ ] E2E Tests hinzugefügt/aktualisiert
- [ ] Manuelle Tests durchgeführt

### Security-Checkliste
- [ ] Keine Secrets im Code
- [ ] Input Validation implementiert
- [ ] CORS/CSRF Schutz aktiv
- [ ] Rate Limiting berücksichtigt

---

## Review-Hinweise

### Code-Qualität
- [ ] Folgt Repository-Standards (ESLint, Prettier, etc.)
- [ ] Keine Code-Duplikation
- [ ] Gute Naming-Conventions
- [ ] Kommentare für komplexe Logik

### Testing
- [ ] Alle Tests passieren
- [ ] Edge Cases abgedeckt
- [ ] Error Handling getestet

### Documentation
- [ ] Code-Kommentare vorhanden
- [ ] README/Architektur-Docs aktualisiert
- [ ] API-Dokumentation (falls zutreffend)

---

## Validierung

### Vor dem Merge
- [ ] `npm run lint` - Keine Lint-Errors
- [ ] `npm test` - Alle Tests grün
- [ ] `npm run build` - Build erfolgreich
- [ ] Manuelle Tests in Staging

### Nach dem Merge
- [ ] Deployment erfolgreich
- [ ] Monitoring zeigt keine Fehler
- [ ] Performance-Metriken im grünen Bereich

---

## Rollback-Prozedur

**Falls etwas schiefgeht:**

1. **Automatischer Revert:**
   ```bash
   gh pr create --title "Revert: [PR-Titel]" --body "Automatischer Revert von #XXX" --base main --head [branch]
   ```

2. **Manueller Rollback:**
   - [ ] Datenbank-Migrationen zurückrollen
   - [ ] Konfigurationen zurücksetzen
   - [ ] Betroffene Services neu starten

**Rollback-Risiko:**
- [ ] Niedrig (keine Datenverluste)
- [ ] Mittel (Datenverluste möglich)
- [ ] Hoch (Datenverluste wahrscheinlich)

---

## Checklisten

### Für den Autor
- [ ] PR-Beschreibung vollständig
- [ ] Alle Tests passieren
- [ ] Dokumentation aktualisiert
- [ ] Reviewer zugewiesen

### Für den Reviewer
- [ ] Code verstanden
- [ ] Tests geprüft
- [ ] Security-Aspekte berücksichtigt
- [ ] Performance-Impact bewertet

---

## Links & Referenzen

- **Verwandte Issues:** #XXX, #YYY
- **Verwandte PRs:** #ZZZ
- **Dokumentation:** [Link]
- **Design/Architektur:** [Link]

---

**Hinweis:** Bitte nur verifizierte Fakten eintragen. Annahmen oder Schätzungen bitte klar als solche kennzeichnen.
