# 20 — Merge Exceptions

**Stand:** 01.11.2026  
**Zweck:** Versionierte Audit-Spur für Pull-Request-Merges, die eine aktive Review-Anforderung des Repository-Rulesets nicht regulär erfüllt haben.

## Governance-Basis

Das aktive Ruleset `main merge hygiene` gilt für `refs/heads/main`. In der am 01.11.2026 gelesenen Fassung verlangt es:

- mindestens **1 approving review**
- **Code-Owner-Review**
- Squash als zulässige Merge-Methode
- Required Checks: `build`, `Migration validation`, `conflict-state`, `hygiene`

Das Ruleset wurde am **11.09.2026** angelegt und zuletzt am **27.10.2026** geändert. Es enthält einen `pull_requests_only`-Bypass für eine Repository-Rolle.

**Wichtig:** Ein technisch zulässiger Bypass ist keine reguläre Review-Erfüllung. Diese Datei dokumentiert Ausnahmen; sie autorisiert keine zukünftigen Bypässe.

## Erfassungsmethode

Retrospektiv als Ausnahme markiert werden PRs, die nach der Ruleset-Aktualisierung vom 27.10.2026 nach `main` gemergt wurden, obwohl GitHub für den PR **0 Reviews** ausweist. Wo eine ausdrückliche Owner-Freigabe in GitHub belegt ist, wird sie genannt. Fehlende historische Freigabe-Evidence wird nicht nachträglich erfunden.

## Festgestellte Ausnahmen

| Datum | PR | Squash-Commit | Reviews | Scope | Freigabe-/Evidence-Status |
|---|---|---|---:|---|---|
| 30.10.2026 | #2095 | `8f4a7f7a182af2f5cc85c7a074d40847f863d3b6` | 0 | Runtime-affecting: DB-Migration + Stripe-Webhook / Bot-Budget-Wiring | PR-Body enthält `GO-Fix (Dominik, 30.10.2026)` und `Owner-GO`; keine unabhängige Review |
| 30.10.2026 | #2099 | `fa1544a0a1321d5f5481b7073c0886d80b007ee2` | 0 | Runtime-affecting: DB-Migration; PR beschreibt automatisches `db push` nach Merge | Retrospektiv erkannt; keine separate GitHub-Review/Freigabe-Evidence gefunden |
| 30.10.2026 | #2102 | `a2c30f22724dd893a82f3130a2d02ae5cd960832` | 0 | Runtime-affecting: DB-Migration + Edge Function; PR beschreibt automatischen Deploy nach Merge | Retrospektiv erkannt; keine separate GitHub-Review/Freigabe-Evidence gefunden |
| 30.10.2026 | #2103 | `adc96e41251d8d44e3bd962512309ea4019ecc0b` | 0 | Runtime-affecting: DB-Migration; PR beschreibt automatisches `db push` nach Merge | Retrospektiv erkannt; keine separate GitHub-Review/Freigabe-Evidence gefunden |
| 30.10.2026 | #2105 | `9ca40f3d0b62b2c429872b1ff7c95e745547528b` | 0 | Tests/Dokumentation; laut PR keine Migration und keine Edge-Function-Änderung | Retrospektiv erkannt; keine separate GitHub-Review/Freigabe-Evidence gefunden |
| 01.11.2026 | #2117 | `dbbd8a4b85423b52c19184860457c18889fb8951` | 0 | Dokumentation + Archivierung; kein Runtime-/Worker-/DO-Wiring | Explizit im PR dokumentiert: **Approved by Dominik Steiner (repository owner), 2026-11-01**; Audit-Kommentar #issuecomment-6554216655 |

## Bewertung

Die Fälle zeigen, dass der Bypass nicht nur einmalig und nicht nur für Dokumentation genutzt wurde. Mehrere Ausnahmen betrafen Migrationen oder Runtime-/Edge-Pfade.

Das ist eine Governance-Schuld, auch wenn der Ruleset-Bypass technisch erlaubt war. Für ein Governance-/Compliance-Produkt muss die Ausnahme selbst nachvollziehbar und versioniert sein.

## Vorwärtsregel

Ab 01.11.2026 gilt für jeden weiteren Review-Bypass:

1. **Kein stiller Bypass.** PR-Nummer, Head-/Merge-Commit, Ruleset, Grund, Scope und verantwortliche Freigabe müssen dokumentiert werden.
2. **Versionierte Evidence.** Die Ausnahme wird in dieser Datei ergänzt, vorzugsweise im betroffenen PR oder in einem unmittelbar folgenden Governance-PR.
3. **Runtime-affecting Änderungen:** Bypass nur mit ausdrücklich benannter Owner-Freigabe und vollständigem technischen Prüfpfad. Diese Datei ersetzt keine Security-/Deploy-Freigabe.
4. **Keine Präzedenzwirkung.** Ein früherer Bypass begründet keinen Anspruch auf einen weiteren.
5. **Durable-Object-Freeze bleibt unberührt.** Insbesondere autorisiert dieser Ledger kein DO-Binding, keine DO-Migration, kein `[exports.*]` und kein `src/workers`-Wiring.

## Prüfgrenze

Diese Erstaufnahme ist keine vollständige historische Rekonstruktion aller PRs seit Repository-Erstellung. Sie umfasst die konkret geprüften gemergten PRs nach der Ruleset-Aktualisierung vom 27.10.2026. Weitere ältere Ausnahmen werden nur aufgenommen, wenn sie anhand von GitHub-Historie belastbar belegt werden können.
