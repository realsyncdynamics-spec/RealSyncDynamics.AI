# Seiten-Invarianten: zwei Erzeugungspfade, eine Sicherheitslage — STOP

**Status: STOP. Eigener Fix, verbindlich VOR C0 und VOR C.**
Entschieden vom Eigentümer am 2026-09-07.

> „Wenn `refine.ts` Seiten ohne die in #1258 eingeführten Invarianten erzeugen
> kann, ist das ein **Governance- und Integritätsproblem, kein normaler
> Tech-Debt**. Insbesondere darf der Rechtsseitenschutz nicht von der
> Eintrittsroute abhängen. Es wird keine Action Engine auf einen Kern gesetzt,
> dessen Seiteninvarianten über einen zweiten Erzeugungspfad umgangen werden
> können."

Dieses Dokument hält den Befund, das Zielbild und den Umfang des Fixes fest.
**Kein Code geändert** — der Freeze für C bleibt, und dieser Schritt ist noch
nicht begonnen.

---

## 1. Der Befund, gemessen

Gemessen am 2026-09-07 gegen `main` @ `9587905` und den Branch von #1258.
**Zwei Pfade legen Seiten an. Sie halten unterschiedliche Regeln ein.**

| | `pages.ts` (`createPage`, `duplicatePage`, #1258) | `refine.ts` (`applyPageAddition`) |
|---|---|---|
| Obergrenze `MAX_PAGES_PER_SITE` | **ja**, vor jeder Erzeugung | **keine** |
| Slug-Validierung (`validatePageSlug`) | **ja** — kanonisch, reserviert, Kollision, Vorschlag statt stiller Umschreibung | **nein** — nur `slugify(title)` und eine Prüfung auf Pfadkollision |
| Reservierte Pfade (`RESERVED_PAGE_SLUGS`) | **ja** — Rechtspfade und `site` gesperrt | **nein** |
| Rechtsseiten-Schutz (`pageProtection`) | **ja**, auf Seitenebene | entfällt — der Pfad legt nur an |
| Herkunft der Blöcke | `buildBlock` mit Rechtsgrundlage, Hosts, KI-Kennzeichnung | `buildBlock`, gleich |

Beleg für die rechte Spalte: `grep -n "MAX_PAGES\|pages.length"
packages/siteos-core/src/blueprint/refine.ts` → **kein Treffer**. Die
Erzeugung prüft ausschließlich `if (bp.pages.some((page) => page.path ===
path)) return bp;`.

**Warum das mehr ist als eine fehlende Zahl**: Die Obergrenze und die
Slug-Regeln sind das, worauf sich alle nachgelagerten Aussagen stützen — bis
hin zur Unerreichbarkeit des `Date.now()`-Zweigs in `freeSlug`
(`tech-debt-freeslug-determinismus.md`). Eine Invariante, die nur auf zwei von
drei Wegen gilt, ist keine Invariante. Und sobald die KI ein dritter Weg wird,
entscheidet die Eintrittsroute darüber, welche Schutzregeln greifen.

---

## 2. Zielbild — eine kanonische Seitenoperation

Vom Eigentümer festgelegt:

> **ALLE Page Creation läuft durch EINE kanonische Page-Operation**, in der
> `slug-validate`, `max-pages-limit` und `legal-page-protection` **immer**
> greifen — unabhängig davon, ob die Seite manuell, per Refinement oder später
> per AI erzeugt wird. **Nicht drei Implementierungen mit jeweils leicht
> anderer Sicherheit.**

```text
manuell (Seitenliste)  ┐
Refinement (refine.ts) ├─→  EINE kanonische Page-Operation  →  Blueprint
KI-Actions (später)    ┘     · slug-validate
                             · max-pages-limit
                             · legal-page-protection
```

Der Rechtsseitenschutz hängt damit an der **Seite**, nicht an der Route, über
die jemand sie erzeugt.

---

## 3. Umfang des Fix-Schritts

Benannt, nicht umgesetzt. Bewusst eng:

| # | Inhalt |
|---|---|
| 1 | `refine.ts` erzeugt Seiten nicht mehr selbst, sondern ruft die kanonische Operation aus `pages.ts` |
| 2 | Damit gelten dort Obergrenze, Slug-Validierung und reservierte Pfade — ohne Sonderfall |
| 3 | Abgewiesenes wird benannt (`rejected`), nicht still verschluckt — wie heute bei `PageEdit` und `PageOperation` |
| 4 | Verhalten des Verfeinerungspfads bleibt im Übrigen unverändert: dieselben Blocktypen, dieselbe Navigation, dieselbe KI-Kennzeichnung |
| 5 | Tests: jede der drei Regeln greift auf **beiden** Wegen; ein Refinement über der Obergrenze legt keine Seite an; ein Refinement kann keinen reservierten Pfad belegen |

**Nicht** in diesem Schritt: LLM, Action-Schema, `tempId`/`pageRef`, atomare
Batches. Das ist C0 und kommt **danach**.

**Offen und hier ausdrücklich nicht entschieden**: Ob der Verfeinerungspfad
dieselbe Obergrenze (40) tragen soll oder eine eigene, und was mit bestehenden
Blueprints geschieht, die heute schon mehr Seiten führen. Beides gehört
entschieden, bevor der Fix geschrieben wird — nicht währenddessen.

---

## 4. Reihenfolge

```text
#1254  →  #1257 Revalidation  →  **Refinement-Invariant-Fix (dieses Dokument)**
       →  C0  →  Action Contract / Core Tests  →  C (AI Actions)
```

C0 ist freigegeben, aber **nicht vor** diesem Schritt. Begründung des
Eigentümers: „Es wird keine Action Engine auf einen Kern gesetzt, dessen
Seiteninvarianten über einen zweiten Erzeugungspfad umgangen werden können."

## 5. Folge für den Determinismus-Befund

`tech-debt-freeslug-determinismus.md` bleibt **PARTIAL / TECH-DEBT** und wird
**nicht** vorschnell behoben. Ein Fix allein in `pages.ts` wäre möglicherweise
Symptombehandlung: Der `Date.now()`-Zweig ist nur unter einer lokalen
Seitenzahl-Invariante unerreichbar, und genau diese gilt heute nicht global.
**Erst die Page-Creation-Invariante zentralisieren, danach den
Determinismusbeweis erneut führen.**
