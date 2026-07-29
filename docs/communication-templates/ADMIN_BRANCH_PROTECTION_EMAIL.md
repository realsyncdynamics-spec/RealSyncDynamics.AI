# Admin-/Branch-Protection-Mail Vorlage

**Zweck:** Anfrage von Admin- oder Maintain-Rechten für Release-Vorbereitung

**Empfänger:** Repository-Administratoren

---

## Betreff

Anfrage: Admin-/Maintain-Rechte für Release-Vorbereitung

---

## Email-Body

```
Hallo [NAME],

für die anstehende Release-Vorbereitung benötigen wir dringend erweiterte Rechte auf dem Repository [REPOSITORY_NAME].

Aktuell blockieren fehlende Berechtigungen die folgenden Aufgaben:
- Branch Protection Rules anpassen
- Repository Settings für Environments konfigurieren
- Secrets für CI/CD-Pipelines verwalten

### Release-Priorisierung (interne Planung)

Die folgenden PRs sind für unser Release kritisch und sollten priorisiert werden:
- PR #[NUMMER] - [KURZBESCHREIBUNG]
- PR #[NUMMER] - [KURZBESCHREIBUNG]
- PR #[NUMMER] - [KURZBESCHREIBUNG]

*Hinweis: Dies ist unsere interne Release-Priorisierung, nicht die objektive Priorität des Repositories.*

### Lösungsvorschlag

Falls Admin-Rechte aktuell nicht möglich sind, reichen vorübergehend **Maintain + Repository Settings**, damit die Release-Vorbereitung nicht blockiert wird.

### Zeitrahmen

- Benötigt ab: [DATUM]
- Geplant bis: [DATUM]
- Rückgabe der Rechte: Sofort nach Release-Abschluss

Bitte lasst uns wissen, wie wir vorgehen können.

Vielen Dank für eure Unterstützung!

Beste Grüße,
[DEIN NAME]
[DEINE POSITION]
```

---

## Anpassungsnotizen

1. **Keine unbelegten Aussagen:** Die Anzahl offener PRs wurde entfernt, da diese sich schnell ändern kann.
2. **Klare Kennzeichnung:** Die Priorisierung ist als "interne Release-Priorisierung" gekennzeichnet.
3. **Lösungsorientiert:** Alternative mit Maintain + Repository Settings wurde ergänzt.
4. **Zeitrahmen:** Klare Zeitangaben für Transparenz.

---

## Variablen

| Variable | Beschreibung | Beispiel |
|----------|--------------|----------|
| [NAME] | Name des Empfängers | "Max Mustermann" |
| [REPOSITORY_NAME] | Name des Repositories | "RealSyncDynamics.AI" |
| [NUMMER] | PR-Nummer | "902" |
| [KURZBESCHREIBUNG] | Kurze Beschreibung des PR | "Branch Protection Konfiguration" |
| [DATUM] | Datum im Format YYYY-MM-DD | "2026-08-15" |
| [DEIN NAME] | Dein Name | "Dominik Seed" |
| [DEINE POSITION] | Deine Position | "Lead Engineer" |

---

**Version:** 1.0  
**Letzte Aktualisierung:** 2026-07-29  
**Verantwortlich:** Engineering Team
