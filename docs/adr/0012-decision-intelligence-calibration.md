# ADR 0012 — Statistische Kalibrierung ist Evidenz, keine Autorisierung

> **Status:** Proposed · 2026-09-21
> **Entscheid:** Eigentümer · **Umsetzung:** offen (kein Wiring in diesem ADR)
> **Related:** ADR 0010 (Native Evolution Governance),
> ADR 0011 (Agenten-Organisationsmodell)
> **Bindet:** jede künftige Anbindung eines Decision-Providers — bevor eine
> solche Anbindung entworfen wird

## Kontext

Ein Decision-Provider liefert maschinell erzeugte Entscheidungsvorschläge. Für
die Güte solcher Vorschläge gibt es ein etabliertes statistisches Maß:
**Kalibrierung** — die Frage, ob die vom Provider ausgewiesene Konfidenz mit
der beobachteten Trefferquote übereinstimmt.

Genau hier liegt eine Verwechslungsgefahr, die teuer wird, wenn sie erst in der
Implementierung auffällt: Ein gut kalibrierter Provider ist **verlässlich**, aber
Verlässlichkeit ist keine Befugnis. Wer Kalibrierung als Freigabekriterium
behandelt, hat eine statistische Kennzahl an die Stelle einer
Governance-Entscheidung gesetzt — und damit die Autorisierung an einen
Messwert delegiert, den der Provider selbst mit beeinflusst.

Für eine Plattform, deren Produktversprechen Nachweisbarkeit gegenüber DSGVO
und EU AI Act ist, wäre das ein Konstruktionsfehler an der empfindlichsten
Stelle: Die Frage „durfte das passieren?" wäre nicht mehr getrennt
beantwortbar von der Frage „wie gut trifft das Modell?".

## Entscheidung

**Statistische Kalibrierung ist Evidenz für die Verlässlichkeit eines
Decision-Providers. Sie ist keine Autorisierung.**

Die Autoritätskette bleibt vierstufig und in dieser Reihenfolge:

```text
schema_valid → calibration_passed → policy_authorized → execution_verified
```

| Stufe | Beantwortet | Ist keine Aussage über |
|---|---|---|
| `schema_valid` | Ist der Vorschlag wohlgeformt? | Ob er stimmt |
| `calibration_passed` | Ist der Provider nachweislich verlässlich? | Ob er handeln darf |
| `policy_authorized` | Darf dieser Schritt in diesem Kontext erfolgen? | Ob er korrekt ausgeführt wurde |
| `execution_verified` | Ist das Ergebnis belegt? | — |

Zwei Folgerungen, die diese Reihenfolge festschreibt:

1. **Kalibrierung kann Autorisierung nicht ersetzen.** Ein perfekt kalibrierter
   Provider durchläuft `policy_authorized` genauso wie ein schlecht
   kalibrierter. Es gibt keinen Konfidenzwert, der die Policy-Stufe überspringt.
2. **Kalibrierung kann Autorisierung vorziehen, nicht aufheben.** Eine
   gescheiterte Kalibrierung stoppt früher — die Policy-Stufe wird gar nicht
   erst erreicht. Die Kette ist konjunktiv, nicht gewichtend: keine Stufe
   kompensiert eine andere.

## Bewusst nicht entschieden

Dieses ADR zieht eine Grenze, es baut nichts. Ausdrücklich **nicht** Gegenstand:

- keine Jev-Integration
- kein Provider-Wiring
- kein Auto-Execution-Pfad
- keine Änderung an `ai_policies`, an der Runtime, an Auth oder an der
  Tenant-Logik
- keine Migration, kein Deploy

## Offene Punkte

Diese Fragen bleiben bewusst offen und gehören in den jeweiligen
Umsetzungsentwurf, nicht in dieses ADR:

- Welches Kalibrierungsmaß gemessen wird und gegen welche Schwelle
- Über welches Zeitfenster und welche Stichprobe gemessen wird
- Wo das Messergebnis persistiert wird und wer es lesen darf
- Was bei `calibration_passed = false` betrieblich passiert (Sperre,
  Degradation, Eskalation)
- Wie `execution_verified` konkret belegt wird

## Konsequenzen

**Positiv.** Die vier Stufen sind getrennt prüfbar und getrennt auditierbar.
Ein Auditor kann fragen „war der Provider verlässlich?" und „war der Schritt
erlaubt?", ohne dass eine Antwort die andere verdeckt. Wird später ein
Provider ausgetauscht, wandert nur `calibration_passed` mit — die
Autorisierungslogik bleibt unberührt.

**Kosten.** Jeder künftige Decision-Pfad trägt vier Prüfungen statt einer, auch
dort, wo der Provider sehr gut kalibriert ist. Das ist gewollt: Die Stufen sind
nicht redundant, sie beantworten verschiedene Fragen.

**Risiko bei Nichtbeachtung.** Eine Implementierung, die Konfidenz als
Freigabe liest, ist von außen nicht von einer korrekten zu unterscheiden —
solange nichts schiefgeht. Der Fehler zeigt sich erst im Schadensfall, und dann
im Prüfpfad. Deshalb steht diese Grenze **vor** dem ersten Provider-Entwurf.
