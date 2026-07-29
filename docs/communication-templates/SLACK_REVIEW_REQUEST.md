# Slack Review Request Vorlage

**Zweck:** Anfrage für Code-Reviews im Team

---

## Slack-Nachricht

```
@channel 

Hallo Team! 

Ich habe gerade PR #[PR_NUMMER] für [KURZE BESCHREIBUNG] erstellt und würde mich über eure Reviews freuen.

**PR:** [PR_LINK]
**Komponente:** [KOMPONENTE]
**Priorität:** [Hoch/Mittel/Niedrig]
**Zeitaufwand für Review:** [ZEITAUFWAND]

### Was wurde geändert:
- [ÄNDERUNG 1]
- [ÄNDERUNG 2]
- [ÄNDERUNG 3]

### Besondere Aufmerksamkeit bitte auf:
- [BEREICH 1]
- [BEREICH 2]

**Bitte nur reviewen, wenn ihr Zeit für vollständige Reviews habt.**
Lieber zwei saubere Reviews als fünf oberflächliche.

Danke im Voraus! ❤️

---
*Deadline für Review: [DATUM]*
```

---

## Erweiterte Version mit Kontext

```
@here 

Hey Team, 

ich brauche eure Hilfe bei PR #[PR_NUMMER]: [TITEL]

**Hintergrund:**
[KONTEXT - Warum ist dieser PR wichtig?]

**Was macht dieser PR:**
[KURZE ZUSAMMENFASSUNG DER ÄNDERUNGEN]

**Technische Details:**
- Dateien geändert: [ANZAHL]
- Zeilen hinzugefügt: [ANZAHL]
- Zeilen entfernt: [ANZAHL]
- Tests: [ANZAHL] neu / [ANZAHL] angepasst

**Review-Fokus:**
✅ [BEREICH 1 - z.B. Security-Checks]
✅ [BEREICH 2 - z.B. Performance-Optimierungen]
✅ [BEREICH 3 - z.B. API-Kontrakte]

**Bitte nur reviewen, wenn ihr Zeit für vollständige Reviews habt.**
Lieber zwei saubere Reviews als fünf oberflächliche.

**Deadline:** [DATUM] (falls relevant)

PR-Link: [PR_LINK]

Vielen Dank! 🙏
```

---

## Review-Anfragen für kritische PRs

```
@channel 

⚠️ **KRITISCHER PR: #[PR_NUMMER] - [TITEL]** ⚠️

Dieser PR ist ein Release-Blockierer und muss bis [DATUM] gemergt werden.

**Warum kritisch:**
[BEGRÜNDUNG - z.B. "Blockiert Release v1.0.0", "Sicherheitsfix"]

**Änderungen:**
[KURZE BESCHREIBUNG]

**Review-Priorität:** HOCH
**Benötigte Approvals:** [ANZAHL]

**Bitte nur reviewen, wenn ihr Zeit für vollständige Reviews habt.**
Lieber zwei saubere Reviews als fünf oberflächliche.

PR: [PR_LINK]

@[SPEZIFISCHE_PERSONEN] - Könntet ihr bitte priorisiert reviewen?
```

---

## Anpassungsnotizen

1. **Qualitätsfokus:** Ergänzung hinzugefügt, dass nur vollständige Reviews gewünscht sind.
2. **Effizienz:** "Lieber zwei saubere Reviews als fünf oberflächliche" - fördert qualitative Reviews.
3. **Struktur:** Klare Trennung zwischen normalen und kritischen PRs.
4. **Kontext:** Mehr Hintergrundinformationen für besseres Verständnis.

---

## Variablen

| Variable | Beschreibung | Beispiel |
|----------|--------------|----------|
| [PR_NUMMER] | PR-Nummer | "902" |
| [PR_LINK] | Link zum PR | "https://github.com/org/repo/pull/902" |
| [KURZE BESCHREIBUNG] | Kurze Beschreibung | "Branch Protection Konfiguration" |
| [KOMPONENTE] | Betroffene Komponente | "CI/CD" |
| [PRIORITÄT] | Prioritätsstufe | "Hoch" |
| [ZEITAUFWAND] | Geschätzter Zeitaufwand | "15-30 Minuten" |
| [ÄNDERUNG 1-3] | Hauptänderungen | "Branch Protection Rules angepasst" |
| [BEREICH 1-2] | Fokusbereiche für Review | "Security-Checks" |
| [DATUM] | Deadline-Datum | "2026-08-15" |
| [TITEL] | PR-Titel | "feat: add branch protection rules" |
| [KONTEXT] | Hintergrundinformation | "Benötigt für Release v1.0.0" |
| [ANZAHL] | Numerische Werte | "5" |
| [BEGRÜNDUNG] | Begründung für Kritikalität | "Blockiert Release" |
| [SPEZIFISCHE_PERSONEN] | @Mentions | "@maxmuster @annamuster" |

---

## Best Practices

1. **Spezifische Personen ansprechen:** Bei kritischen PRs gezielt Teammitglieder mit relevantem Know-how ansprechen.
2. **Zeitaufwand angeben:** Hilft Reviewern, die Review-Priorisierung zu planen.
3. **Fokusbereiche definieren:** Gibt Reviewern klare Orientierung.
4. **Deadlines kommunizieren:** Besonders bei Release-Blockierern.
5. **Positiver Ton:** Immer höflich und wertschätzend formulieren.

---

**Version:** 1.0  
**Letzte Aktualisierung:** 2026-07-29  
**Verantwortlich:** Engineering Team
