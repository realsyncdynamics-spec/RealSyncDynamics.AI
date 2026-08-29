# `_shared/public-scan` — Analyse-Schicht des öffentlichen Scans

**Diese Module haben derzeit bewusst keinen Aufrufer.** Das ist kein
vergessener Code, sondern ein bekannter Zwischenstand mit benanntem Ziel.

## Warum sie hier liegen

Sie sind die Analyse-Hälfte von PR #1129. Der Entscheid vom 2026-08-23
(`docs/product/canonical-funnel-decision.md`) hat `/audit` + `gdpr_audits` zum
kanonischen Einstieg und Datensatz erklärt. Die Persistenz-Hälfte jenes PR —
`public_site_scans`, die Function `public-site-scan`, die Seiten unter `/scan` —
wurde daraufhin zurückgezogen, weil sie einen zweiten Datensatz eingeführt
hätte. Die Analyse blieb, weil an ihr nichts falsch war:

| Modul | Was es leistet |
|---|---|
| `target.ts` | SSRF-Schranke: Schema, Port, Host, private Adressliterale, IPv4-gemappte IPv6-Adressen |
| `observe.ts` | Abruf mit `redirect: 'manual'`, Prüfung **jedes** Sprungs, streamende Größenbegrenzung |
| `detectors.ts` | Zusatzerkennung: KI-Dienste, Chat-Widgets, Google Fonts, Consent-Manager — über **Host-Vergleich**, nicht über Host-Muster |
| `report.ts` | Abbildung der acht Prüfdimensionen auf sechs Kundenkategorien, Urteilsstufen, Haftungshinweis |

Drei gemessene Sicherheitskorrekturen stecken darin (Weiterleitungs-Umgehung
der SSRF-Schranke, quadratische Rückverfolgung, unscharfe Host-Erkennung), dazu
die Sprachregel als Test statt als Kommentar. Sie sind durch
`test/public-scan/*` abgedeckt und laufen in CI mit.

## Wohin sie gehen

`/audit` ruft heute `gdpr-audit` auf. Die Zusammenführung ist in
`docs/architecture/canonical-builder-target-matrix.md` beschrieben: Die
Analyse-Schicht speist den kanonischen Audit-Pfad, ohne dass ein zweiter
Datensatz entsteht.

## Regel

Wer diese Module verdrahtet, verdrahtet sie gegen `gdpr_audits` — nicht gegen
einen neuen Datensatz. Wer sie löschen will, löscht damit die drei
Sicherheitskorrekturen und 162 Tests; dann bitte erst den Entscheid ändern.
