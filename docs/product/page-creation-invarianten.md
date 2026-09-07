# Seiten-Invarianten: zwei Erzeugungspfade, eine Sicherheitslage — STOP

**Status: STOP-Befund entschieden, Fix gebaut und geprüft — PR #1259 (Draft).**
Entschieden vom Eigentümer am 2026-09-07, verbindlich VOR C0 und VOR C.

> „Wenn `refine.ts` Seiten ohne die in #1258 eingeführten Invarianten erzeugen
> kann, ist das ein **Governance- und Integritätsproblem, kein normaler
> Tech-Debt**. Insbesondere darf der Rechtsseitenschutz nicht von der
> Eintrittsroute abhängen. Es wird keine Action Engine auf einen Kern gesetzt,
> dessen Seiteninvarianten über einen zweiten Erzeugungspfad umgangen werden
> können."

Dieses Dokument hält den Befund, das Zielbild, die Entscheidung und den
Umfang des Fixes fest. Der Fix liegt seit dem 2026-09-07 als **eigener
Draft-PR #1259** vor; der Freeze für C bleibt unverändert bestehen.

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

---

## 3a. Beide offenen Punkte sind entschieden (Owner, 2026-09-07)

### Obergrenze: **dieselbe 40**, keine eigene für Refinement

> „Es gibt **KEINE** separate Refinement-Grenze. Kein „40 für UI, 100 für
> Refinement" — das würde genau die erkannte Invarianzverletzung konservieren."

Die Obergrenze ist eine zentrale Invariante der kanonischen Page-Operation und
gilt unabhängig davon, ob eine Seite durch Refinement, manuelle
Seitenoperation, spätere KI-Action oder einen sonstigen internen Pfad entsteht.
**Eine Seitenerzeugung darf niemals einen Blueprint auf mehr als 40 Seiten
bringen.** Die Prüfung gehört **in** den kanonischen Operationspfad und darf
nicht ausschließlich in einzelnen Aufrufern liegen.

### Bestand über 40 Seiten: **Bestandsschutz statt Zwangsmigration**

Bestehende Blueprints werden **nicht** rückwirkend invalidiert, gekürzt oder
automatisch migriert. Sie bleiben erhalten und dürfen weiterhin gelesen,
gerendert und im Rahmen der bestehenden Autorisierung bearbeitet werden —
Löschen und Ändern erlaubt, sofern autorisiert. Abgelehnt wird **nur** das
Hinzufügen einer neuen Seite. Die 40er-Grenze ist damit eine
**Create-Invariante**, keine destruktive Migration.

**Keine automatische Datenmigration**: Es werden keine Bestandsseiten
gelöscht, zusammengeführt, verschoben oder anderweitig verändert, um die
Grenze nachträglich zu erfüllen. Eine neue Sicherheits- und Integritätsregel
darf keinen bisher gültigen Kundenbestand zerstören.

### Präzisierung der Prüfung

Nicht der Zustand des Projekts wird beurteilt, sondern das **Ergebnis der
Operation**:

```ts
// falsch — friert Bestände ein, statt sie bereinigbar zu lassen
if (pages.length > 40) reject();

// richtig
if (operationCreatesPages && resultingPageCount > 40) reject();
```

**Verbindliche Beispielkette:**

| Ausgangslage | Operation | Ergebnis |
|---|---|---|
| 47 | — | bleibt erhalten |
| 47 | neue Seite → 48 | **abgelehnt** |
| 47 | Löschung → 46 | erlaubt |
| 45 | Bereinigung → 39 | erlaubt |
| 39 | neue Seite → 40 | erlaubt |
| 40 | neue Seite → 41 | **abgelehnt** |

**Hinweis zur Umsetzung, gemessen**: Für eine **einzelne** Seite sind die
beiden Formulierungen deckungsgleich (`length >= 40` ⟺ `length + 1 > 40`) —
die heutige Prüfung in `pages.ts` erfüllt die Beispielkette also bereits. Der
Unterschied wird erst bei Mehrfach-Anlagen sichtbar, wie sie ein Action-Batch
in C0 erzeugt, und bei der Versuchung, die Grenze als pauschalen Wächter über
das ganze Projekt zu schreiben. Genau das schließt die Präzisierung aus.

---

## 4. Reihenfolge

```text
#1254  →  #1257 Revalidation  →  **Refinement-Invariant-Fix — PR #1259**
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

---

## 6. Umsetzungsstand — PR #1259 (Draft)

| Erfordernis aus §3 | Umgesetzt in `2dc8c07` |
|---|---|
| 1 · `refine.ts` ruft die kanonische Operation | `applyPageAddition` ruft `applyPageOperations` mit `op: 'create'` |
| 2 · Obergrenze, Slug-Validierung, reservierte Pfade gelten dort | ergibt sich daraus; kein Sonderfall |
| 3 · Abgewiesenes wird benannt | `refusals` mit einem Satz je Grund statt stummem `return` |
| 4 · Verhalten sonst unverändert | dieselben Blockarten, dieselbe Navigation, dieselbe KI-Kennzeichnung — im Test gegen den kanonischen Weg verglichen |
| 5 · Tests auf **beiden** Wegen | `test/siteos/page-invariants.test.ts`, 8 Tests |

**Ein Hindernis, das gemeldet und nicht umgangen wurde**: `pages.ts`
importierte `briefFromBlueprint` aus `refine.ts`. Der kanonische Aufruf in der
Gegenrichtung hätte einen Importzyklus `pages → refine → pages` erzeugt — im
Kern kein Schönheitsfehler, weil er unverändert in Browser, Deno und Node
läuft und eine nicht initialisierte Bindung je nach Auswertungsreihenfolge nur
**eine** der drei Laufzeiten trifft. `briefFromBlueprint` liegt deshalb jetzt
in `brief.ts`; `refine.ts` re-exportiert sie unverändert, der öffentliche
Index bleibt gleich. Gesichert durch `test/siteos/core-import-graph.test.ts`,
der negativ gegengeprüft ist: Mit dem alten Import meldet er den Zyklus
namentlich und schlägt fehl.

**Nicht getan**: keine Datenmigration, kein C0, kein Action-Schema, kein LLM,
kein Merge.
