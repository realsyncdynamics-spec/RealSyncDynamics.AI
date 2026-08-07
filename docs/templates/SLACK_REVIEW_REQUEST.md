# Slack-Review-Request-Vorlage

**Zweck**: Anfrage für Code-Reviews im Team
**Verwendung**: Kopieren, anpassen, im entsprechenden Slack-Channel posten

---

## Standard-Nachricht

```text
@channel

Hallo Team! 👋

Ich habe gerade PR #[PR-Nummer] zur Review bereitgestellt:

**Titel**: [PR-Titel]
**Beschreibung**: [Kurze Beschreibung - 1-2 Sätze]
**Änderungen**: [Kurze Zusammenfassung der wichtigsten Änderungen]
**Risiko**: [Low/Medium/High]
**Priorität**: [Low/Medium/High]

**Links**:
- PR: [Link zum Pull Request]
- Preview: [Link zur Preview/Staging]
- Related Issue: [Link zum Issue, falls vorhanden]

Bitte nur reviewen, wenn ihr Zeit für vollständige Reviews habt.
Lieber zwei saubere Reviews als fünf oberflächliche.

**Fokusbereiche**:
- [ ] [Spezifischer Bereich 1]
- [ ] [Spezifischer Bereich 2]
- [ ] [Spezifischer Bereich 3]

**Deadline**: [Datum, falls relevant]

Vielen Dank im Voraus! ❤️
```

---

## Varianten

### Für kritische PRs

```text
@here

🚨 **Kritischer PR zur Review**: #[PR-Nummer]

**Titel**: [PR-Titel]
**Impact**: [Beschreibung des Impacts - z.B. "Blockiert Release", "Sicherheitsfix"]

Dieser PR hat hohe Priorität und sollte zeitnah reviewed werden.

Bitte nur reviewen, wenn ihr Zeit für vollständige Reviews habt.
Lieber zwei saubere Reviews als fünf oberflächliche.

**Deadline**: [Datum]
**Reviewer**: @[spezifische Personen]
```

### Für kleine/unkritische PRs

```text
@channel

Kleiner PR zur Review: #[PR-Nummer]

**Titel**: [PR-Titel]
**Änderungen**: [Sehr kurze Beschreibung]

Keine Eile, aber Feedback willkommen! 🙏

Bitte nur reviewen, wenn ihr Zeit für vollständige Reviews habt.
Lieber zwei saubere Reviews als fünf oberflächliche.
```

---

## Best Practices

1. **Immer angeben**:
   - PR-Nummer und Link
   - Kurze Beschreibung
   - Risiko- und Prioritätslevel

2. **Nicht tun**:
   - Keine generischen "Please review" Nachrichten ohne Kontext
   - Keine @here/@channel für kleine, unkritische PRs
   - Keine Deadlines ohne Absprache

3. **Erinnern**:
   - Immer den Hinweis auf qualitative Reviews einfügen
   - Bei komplexen PRs: Fokusbereiche angeben

4. **Follow-up**:
   - Nach 24-48 Stunden ohne Feedback: freundliche Erinnerung
   - Nach 72 Stunden: direkte Ansprache spezifischer Teammitglieder
