# Admin-/Branch-Protection-E-Mail-Vorlage

**Zweck**: Anfrage von Admin- oder Maintain-Rechten für Release-Vorbereitung
**Verwendung**: Kopieren, anpassen, an Repository-Administratoren senden

---

## Betreff
Anfrage: Admin-/Maintain-Rechte für Release-Vorbereitung Phase 5

## E-Mail-Inhalt

```text
Hallo [Name],

für die anstehende Release-Vorbereitung von RealSyncDynamics.AI (Phase 5) benötigen wir dringend erweiterte Berechtigungen, um die folgenden Aufgaben durchzuführen:

### Geplante Maßnahmen
- Branch Protection Rules für main anpassen (Required Reviews, Status Checks)
- Repository Secrets für CI/CD aktualisieren
- Environments (Staging/Production) konfigurieren
- Release-Branches erstellen und schützen

### Aktuelle Situation
- Es gibt derzeit [tatsächliche Anzahl prüfen] offene Pull Requests, die für das Release priorisiert sind
- Die kritischen PRs für diese Release-Phase sind: #904 (SiteOS), #901 (AI Builder), #905 (Phase-5-Roadmap), #897, #896
  → Diese Priorisierung basiert auf unserer internen Release-Planung, nicht auf objektiven Repository-Metriken

### Requested Berechtigungen
Idealerweise: **Admin-Rechte**

Falls Admin-Rechte aktuell nicht möglich sind, reichen vorübergehend **Maintain + Repository Settings**, damit die Release-Vorbereitung nicht blockiert wird.

### Zeitrahmen
- Benötigt ab: [Datum]
- Voraussichtliches Ende: [Datum, ca. 2-4 Wochen]
- Nach Release: Rechte können wieder entzogen werden

### Begründung
Ohne diese Rechte können wir:
- Keine Branch Protection für den main-Branch einrichten
- Keine Required Status Checks erzwingen
- Keine Secrets für die CI/CD-Pipeline aktualisieren
- Keine geschützten Release-Branches erstellen

Dies blockiert die gesamte Release-Pipeline und verzögert die Auslieferung kritischer Features.

Bitte lasst uns wissen, wie wir vorgehen können. Bei Fragen stehe ich gerne für eine kurze Abstimmung zur Verfügung.

Vielen Dank im Voraus!

Beste Grüße,
[Dein Name]
[Deine Rolle]
RealSyncDynamics.AI
```

---

## Anpassungshinweise

1. **Offene PRs**: Immer die tatsächliche Anzahl prüfen (`gh pr list --repo owner/repo --state open | wc -l`)
2. **Kritische PRs**: Nur als "Release-Priorisierung" bezeichnen, nicht als objektive Priorität des Repositories
3. **Zeitrahmen**: Realistische Zeitfenster angeben
4. **Alternative**: Immer die Maintain + Repository Settings Option anbieten

## Verifizierung vor dem Senden

- [ ] Aktuelle Anzahl offener PRs geprüft
- [ ] PR-Nummern sind aktuell und korrekt
- [ ] Zeitrahmen ist realistisch
- [ ] Empfänger sind die richtigen Repository-Administratoren
