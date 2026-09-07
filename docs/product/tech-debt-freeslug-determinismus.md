# TECH-DEBT / PARTIAL — `Date.now()` in `freeSlug` gegen die Determinismus-Zusage

**Status: TECH-DEBT / PARTIAL. Nicht behoben, bewusst.**
Bewertet am 2026-09-07 auf Anweisung (C-GATE Punkt 5). Eigenes Dokument, weil
der Fund getrennt bewertet wird und nicht zu #1258 gehört.

> **Owner-Entscheidung vom 2026-09-07**: „Jetzt **nicht** vorschnell fixen. Die
> Sitzung hat korrekt gehandelt. Der Zweig ist nur unter einer lokalen
> Seitenzahl-Invariante unerreichbar, und diese Invariante gilt derzeit nicht
> global. Ein Fix allein in `pages.ts` wäre möglicherweise nur
> Symptombehandlung. **Erst die Page-Creation-Invariante zentralisieren, danach
> den Determinismusbeweis erneut führen.** Bis dahin PARTIAL / TECH-DEBT und
> separat."
>
> Der Schritt, auf den gewartet wird, ist der Refinement-Invariant-Fix:
> `docs/product/page-creation-invarianten.md`. Danach — und nur danach — wird
> der Beweis neu geführt; gelingt er dann, folgt der kleine deterministische
> Fix.

## Der Fund

`packages/siteos-core/src/blueprint/pages.ts` (Branch von PR #1258) sagt in
Zeile 40 zu:

> „Rein und deterministisch: gleiche Eingabe ⇒ gleicher Blueprint ⇒ gleicher
> Hash."

Zeile 353, im Rückfall von `freeSlug`, bricht das:

```ts
return `${stem.slice(0, 50)}-${Date.now().toString(36)}`;
```

**Größenordnung**: Der Artefakt-Hash setzt Determinismus voraus — gleiche
Eingabe muss gleichen Blueprint, gleiches Artefakt und gleichen Hash ergeben.
Der Publish Gate bindet eine Evaluation an genau einen `artifact_sha256`
(Contract G6). Eine Zeitquelle im Kern ist deshalb keine Stilfrage.

## Warum nichts geändert wurde

Die Vorgabe war eindeutig: einen kleinen deterministischen Fix nur dann
vorbereiten, wenn **beweisbar** ist, dass die Entfernung keine Semantik
ändert — Beweis heißt Test plus Argument, nicht Plausibilität.

**Der Beweis gelingt nicht.** Der Versuch, im Einzelnen:

### Was sich zeigen lässt

`freeSlug` probiert `stem-2` … `stem-999`. Belegt sein können höchstens so
viele Namen, wie es Seiten gibt, plus die sechs reservierten
(`RESERVED_PAGE_SLUGS`). Die beiden Aufrufer in `pages.ts` prüfen vorher
`MAX_PAGES_PER_SITE = 40`:

| Aufrufer | Prüfung vor dem Aufruf |
|---|---|
| `createPage` | `if (bp.pages.length >= MAX_PAGES_PER_SITE) … return` |
| `duplicatePage` | dieselbe Prüfung |

Unter dieser Bedingung sind höchstens **46** Namen belegt, während allein die
Gruppe `n = 100 … 999` **900** paarweise verschiedene Kandidaten liefert (dort
ist die Kürzung `stem.slice(0, 64 - 4)` konstant, die Kandidaten unterscheiden
sich also nur im Suffix). Die Schleife findet dann immer einen freien Slug,
und Zeile 353 ist unerreichbar.

### Woran der Beweis scheitert

Die Bedingung „höchstens 40 Seiten" gilt **nicht** für jeden Schreibpfad.
`packages/siteos-core/src/blueprint/refine.ts`, `applyPageAddition` legt eine
Seite an — **ohne jede Obergrenze**:

```ts
const path = preset ? preset.path : `/${slugify(title)}`;
if (bp.pages.some((page) => page.path === path)) return bp;   // nur Kollision
// … keine Prüfung gegen MAX_PAGES_PER_SITE
```

`grep -n "MAX_PAGES\|pages.length" refine.ts` liefert **keinen** Treffer.
Damit kann ein Blueprint über wiederholte Verfeinerungen mehr als 40 Seiten
tragen, und `movePage` ruft `validatePageSlug` (das seinerseits `freeSlug` für
den Vorschlag nutzt) ohne Mengenprüfung.

Die Unerreichbarkeit hängt also an einer Invariante, die **zwei von drei**
seitenerzeugenden Pfaden einhalten und der dritte nicht. Das ist eine
Plausibilitätsannahme, kein Beweis — und damit genau der Fall, für den die
Anweisung „nichts eigenmächtig ändern" vorsieht.

## Der zweite Befund, der dabei abfiel

**Zwei Pfade legen Seiten an, mit unterschiedlichen Regeln:**

| Pfad | Obergrenze | Slug-Prüfung | Rechtsseiten-Schutz |
|---|---|---|---|
| `pages.ts` (`createPage`, `duplicatePage`) | 40 | `validatePageSlug` (kanonisch, reserviert, Kollision) | ja |
| `refine.ts` (`applyPageAddition`) | **keine** | nur Pfadkollision | — (legt nur an) |

Das ist unabhängig vom Determinismus-Fund eine Inkonsistenz: Die Obergrenze,
die Schritt B einführt, lässt sich über den Verfeinerungspfad umgehen.

**Entschieden am 2026-09-07**: Das ist ein **Governance- und
Integritätsproblem, kein normaler Tech-Debt** — der Rechtsseitenschutz darf
nicht von der Eintrittsroute abhängen. Eigener Fix **vor** C0 und **vor** C,
mit Befund, Zielbild und Umfang in
`docs/product/page-creation-invarianten.md`.

## Was ein Fix bräuchte

Nicht umgesetzt, nur benannt, damit die spätere Entscheidung nicht bei Null
anfängt:

1. Die Invariante **an einer Stelle** herstellen: entweder `applyPageAddition`
   an `MAX_PAGES_PER_SITE` binden, oder die Grenze aus `pages.ts` entfernen und
   an einer gemeinsamen Stelle prüfen.
2. Danach ist der Rückfall beweisbar unerreichbar und kann durch eine
   deterministische Form ersetzt werden — Vorschlag: Schleifengrenze aus der
   tatsächlichen Belegung ableiten und bei Verletzung der Invariante werfen,
   statt einen möglicherweise kollidierenden Namen zurückzugeben.
3. Test, der beides festhält: Grenze greift auf allen Pfaden; zwei identische
   Läufe ergeben byte-gleiche Blueprints.

## Einordnung

Der Zweig ist **heute** über die beiden `pages.ts`-Pfade nicht erreichbar; über
den Verfeinerungspfad nur nach mehr als 900 hinzugefügten, gleichnamig
nummerierten Seiten. Der praktische Schaden ist damit gering. Klein ist der
Befund trotzdem nicht: Er beschreibt eine Zusicherung, die der Code an einer
Stelle nicht hält, in einem Modul, dessen Hash die Publish-Freigabe trägt.

**Nicht geändert. Wartet auf Entscheidung.**
