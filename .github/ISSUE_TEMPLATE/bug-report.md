---
name: "Bug Report"
about: "Vorlage für Bug-Reports mit Reproduktionsschritten und Validierung"
title: "[Bug] [Komponente] - [Kurzbeschreibung]"
labels: ["bug", "needs-triage"]
---

## Bug Report

**Status:** 
- [ ] New
- [ ] Triaged
- [ ] In Progress
- [ ] Fixed
- [ ] Verified

**Priorität:** 
- [ ] P0 - Kritisch (System nicht nutzbar)
- [ ] P1 - Hoch (wichtige Funktion betroffen)
- [ ] P2 - Mittel (beeinträchtigt Nutzererlebnis)
- [ ] P3 - Niedrig (kosmetisches Problem)

**Umgebung:**
- OS: [Windows/macOS/Linux]
- Browser: [Chrome/Firefox/Safari/Edge]
- Version: [z.B. Chrome 120]
- Device: [Desktop/Tablet/Mobile]

---

## Beschreibung

[Klare und präzise Beschreibung des Bugs]

---

## Reproduktionsschritte

1. Gehe zu [URL/Seite]
2. Klicke auf [Element]
3. Führe [Aktion] aus
4. Beobachte: [Erwartetes vs. Tatsächliches Verhalten]

---

## Erwartetes Verhalten

[Was sollte passieren?]

## Tatsächliches Verhalten

[Was passiert tatsächlich?]

---

## Screenshots/Logs

[Füge Screenshots, Video-Aufnahmen oder Log-Ausschnitte hinzu]

```
[Code/Log-Ausschnitt]
```

---

## Technische Details

### Browser Console Errors
```
[Fehlermeldungen aus der Browser-Konsole]
```

### Network Requests
- Request URL: [URL]
- Status Code: [Code]
- Response: [Response]

### Backend Logs
```
[Relevante Log-Einträge vom Backend]
```

---

## Abhängigkeiten

- [ ] Tritt nur in Kombination mit [Feature/Modul] auf
- [ ] Tritt nur in [Umgebung] auf
- [ ] Tritt nur mit [Daten] auf

---

## Workaround

[Falls bekannt, beschreibe einen temporären Workaround]

---

## Akzeptanzkriterien für Fix

- [ ] Bug ist reproduzierbar
- [ ] Root Cause identifiziert
- [ ] Fix implementiert
- [ ] Fix getestet (Reproduktion nicht mehr möglich)
- [ ] Regression Tests hinzugefügt
- [ ] Dokumentation aktualisiert (falls nötig)

---

## Merge-Kriterien

- [ ] CI erfolgreich (alle Checks grün)
- [ ] Keine offenen Review-Blocker
- [ ] Keine bekannten Security-Regressionen
- [ ] Staging Smoke-Test erfolgreich
- [ ] Regression Tests passieren
- [ ] Rollback-Prozedur dokumentiert

---

## Rollback-Prozedur

[Beschreibung, wie der Fix zurückgerollt werden kann, falls neue Probleme auftreten]

---

## Links & Referenzen

- **Verwandte Issues:** #XXX
- **Verwandte PRs:** #YYY
- **Dokumentation:** [Link]

---

**Hinweis:** Bitte so viele Details wie möglich angeben, um die Reproduktion und Behebung zu erleichtern.
