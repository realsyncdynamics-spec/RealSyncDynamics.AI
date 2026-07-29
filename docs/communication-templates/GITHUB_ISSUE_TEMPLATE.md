# GitHub Issue Vorlage

**Zweck:** Standardisierte Issue-Erstellung mit klaren Merge-Kriterien

---

## Issue-Titel

[KURZE BESCHREIBUNG] - [KOMPONENTE]

---

## Issue-Body

```markdown
### Beschreibung

[Detaillierte Beschreibung des Problems oder der gewünschten Funktion]

### Akzeptanzkriterien

- [ ] [Kriterium 1]
- [ ] [Kriterium 2]
- [ ] [Kriterium 3]

### Merge-Kriterien

- [ ] CI erfolgreich
- [ ] Keine offenen Review-Blocker
- [ ] Keine bekannten Security-Regressionen
- [ ] Staging Smoke-Test erfolgreich

### Technische Details

**Komponente:** [KOMPONENTE]  
**Priorität:** [Hoch/Mittel/Niedrig]  
**Labels:** [LABEL1, LABEL2]  
**Meilenstein:** [MEILENSTEIN]

### Abhängigkeiten

- Blockiert durch: [ISSUE/PR-NUMMERN]
- Blockiert: [ISSUE/PR-NUMMERN]

### Notizen

[Zusätzliche Informationen oder Kontext]
```

---

## Merge-Kriterien Checkliste

Diese Kriterien müssen erfüllt sein, bevor ein PR gemergt werden kann:

### 1. CI erfolgreich
- Alle automatisierten Tests passieren
- Build-Prozess erfolgreich
- Linting ohne Fehler

### 2. Keine offenen Review-Blocker
- Alle Review-Kommentare wurden adressiert
- Keine offenen Diskussionen
- Mindestens 1 Approval von einem Teammitglied

### 3. Keine bekannten Security-Regressionen
- Security-Scan ohne kritische Findings
- Keine neuen Sicherheitslücken eingeführt
- Compliance-Checks bestanden

### 4. Staging Smoke-Test erfolgreich
- Manuelle Tests auf Staging-Umgebung
- Kritische User Journeys funktionieren
- Keine Regressionen in bestehenden Funktionen

---

## Prioritätsstufen

| Priorität | Beschreibung | SLA |
|-----------|--------------|-----|
| Hoch | Kritisch für Release, Blockierer | 24 Stunden |
| Mittel | Wichtig, aber nicht blockierend | 1 Woche |
| Niedrig | Nice-to-have, Verbesserungen | 4 Wochen |

---

## Beispiel

```markdown
### Beschreibung

Die Branch Protection Rules müssen angepasst werden, um die Release-Pipeline zu ermöglichen.

### Akzeptanzkriterien

- [ ] Branch Protection für main aktiviert
- [ ] Required Reviews auf 2 gesetzt
- [ ] Status Checks für CI/CD aktiviert

### Merge-Kriterien

- [ ] CI erfolgreich
- [ ] Keine offenen Review-Blocker
- [ ] Keine bekannten Security-Regressionen
- [ ] Staging Smoke-Test erfolgreich

### Technische Details

**Komponente:** CI/CD  
**Priorität:** Hoch  
**Labels:** enhancement, ci-cd, release-blocker  
**Meilenstein:** v1.0.0

### Abhängigkeiten

- Blockiert durch: #897
- Blockiert: #902, #905
```

---

**Version:** 1.0  
**Letzte Aktualisierung:** 2026-07-29  
**Verantwortlich:** Engineering Team
