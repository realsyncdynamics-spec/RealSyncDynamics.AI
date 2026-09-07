# Action Contract (Schritt C) — vom Eigentümer festgelegt

**Entschieden am 2026-09-07 vom Eigentümer. Verbindlich.**
**C wird noch nicht gebaut** — der Contract steht, die Umsetzung wartet auf
eine gesonderte Freigabe (Freeze vom 2026-09-07).

Dieses Dokument ist die Vertragsseite von Schritt C: **was** die KI ausdrücken
darf und **auf welchem Weg** ihre Vorschläge zu einer Version werden. Es ist
versionsrelevant wie Befund-Codes — was hier steht, steht später im Prüfpfad
jeder KI-Änderung und wird nicht umbenannt.

Der konkurrierende Prompt „MAXIMUM CREATIVE FREEDOM" ist **NO-GO** und für
Schritt C ohne Wirkung: `docs/product/app-builder-master-prompt-konflikt.md`.

> **Herkunft von Freigaben** (Regel vom 2026-09-07): Der Eigentümer kann in die
> Arbeitssitzung nicht selbst schreiben. Jede Freigabe erreicht die Sitzung
> ausschließlich über den Auftraggeber. Kurze Zustimmungen („ja", „ok", „go")
> ohne erkennbare Owner-Anweisung gelten als **nicht autorisiert**; bei Zweifel
> gilt HERKUNFT UNKLAR — nichts tun, Eingabe zitieren, auf Bestätigung warten.

---

## 1. Grundsatz

> „Das ist ein Action-Schema und kein direktes Datenbank-API."
> — Eigentümer, 2026-09-07

Die KI liefert ausschließlich `AppAction[]`. Sie erzeugt kein HTML, keinen
Blueprint, kein SQL, keinen Code. Der Server validiert, autorisiert, übersetzt
in **vorhandene** Operationen und legt eine Version an. Es entsteht **keine
zweite Persistenz und keine zweite Edit-Pipeline** — die Actions münden in
denselben Pfad wie eine Änderung aus dem Puck-Editor.

## 2. Die elf Actions — freigegebener Umfang

Weder mehr noch weniger. Namen wie festgelegt.

| # | Action | Zweck | Übersetzt auf |
|---|---|---|---|
| 1 | `createPage` | neue Seite | `PageOperation create` (#1258) |
| 2 | `updatePage` | Titel und/oder Slug ändern | `PageOperation rename` / `slug` (#1258) |
| 3 | `duplicatePage` | Seite kopieren | `PageOperation duplicate` (#1258) |
| 4 | `deletePage` | Seite entfernen | `PageOperation delete` (#1258) |
| 5 | `addBlock` | Block einfügen | `PageEdit`, neuer Block ohne `id` → `buildBlock` |
| 6 | `updateBlock` | redaktionelle Felder ändern | `PageEdit` mit `content` |
| 7 | `removeBlock` | Block entfernen | `PageEdit` ohne den Block |
| 8 | `moveBlock` | Reihenfolge ändern | `PageEdit` mit neuer Folge |
| 9 | `duplicateBlock` | Block kopieren | `PageEdit` mit neuem Block gleicher Art |
| 10 | `updateNavigation` | Navigationslinks setzen | `PageEdit` auf jeden `navigation`-Block |
| 11 | `updateSeo` | Seitentitel und Beschreibung | **PLANNED / CORE EXTENSION** — heute kein Pfad im Kern, siehe §5a |

## 3. Verbindliche Pipeline

```text
LLM
 → JSON / AppAction
 → Schema Validation
 → Authorization
 → Action auf bestehendes PageEdit
 → buildBlock / Blueprint
 → Compliance Profile
 → Version
 → Evaluation
 → Audit / Evidence
```

Keine Stufe darf übersprungen, zusammengelegt oder clientseitig
vorweggenommen werden. Insbesondere:

- **Schema Validation** und **Authorization** laufen serverseitig. Eine
  Vorschau im Browser ist Anzeige, kein Gate — dieselbe Trennung wie zwischen
  Client- und Serverprüfung bei `siteos/edit`.
- **Compliance Profile** wird nach jeder Änderung neu abgeleitet, nicht
  fortgeschrieben. Dass das nötig ist, hat #1258 belegt: `applyPageEdits`
  ließ `consentCategories`, `legalBases` und `dpiaRequired` auf dem Stand des
  Erstbaus stehen, obwohl `analyzeBlueprint` und der Publish Gate sie lesen.
- **Version** entsteht erst bei der Übernahme durch den Kunden, nicht beim
  Vorschlag.

## 3a. Multi-Action-Batches — atomar (Entscheidung 2026-09-07)

**Freigegeben**: Eine Batch darf eine Seite anlegen und im **selben**
validierten Request auf sie verweisen:

```text
createPage(tempId: "p1", title: "Wärmepumpen")
addBlock(pageRef: "p1", kind: "hero")
addBlock(pageRef: "p1", kind: "features")
```

Die Auflösung der temporären Referenz erfolgt **serverseitig**. Verbindliche
Semantik, in dieser Reihenfolge:

```text
validate all actions
  → resolve page references und temporäre IDs
  → validate resulting operation graph
  → apply atomically
  → build blueprint
  → compliance profile
  → version
```

**Kein Teilzustand darf persistiert werden, wenn eine spätere Action der Batch
fehlschlägt.** Entweder die ganze Batch wird eine Version, oder keine.

### Was das heute **nicht** ist — und warum kein Workaround gebaut wird

Ausdrücklich **nicht gewünscht**: die Reihenfolge in
`supabase/functions/siteos/handlers/edit.ts:140-141` (erst `applyPageEdits`,
dann `applyPageOperations`) kosmetisch umzudrehen. Für eine **deklarative**
Action-Liste ist „erst alle Edits, dann alle Seitenoperationen" die falsche
**Semantik**, nicht bloß die falsche Reihenfolge — ein Umdrehen verschöbe das
Problem auf den umgekehrten Fall (Block ändern, dann Seite löschen).

**Der Kern trägt diese Transaktion heute nicht.** Gemessen am 2026-09-07:

| Erfordernis | Stand heute | Fundstelle |
|---|---|---|
| Temporäre IDs / `pageRef` | existiert nicht — Operationen adressieren über `path` | `PageOperation` in `blueprint/pages.ts` |
| Ein Graph über Edits **und** Seitenoperationen in Reihenfolge | existiert nicht — zwei getrennte Durchläufe | `handlers/edit.ts:140-141` |
| Alles-oder-nichts | **nein** — beide Funktionen überspringen Ungültiges und wenden den Rest an; Abgewiesenes landet in `rejected` | `applyPageOperations` und `applyPageEdits` sammeln `rejected` und setzen die Schleife fort |

Die dritte Zeile ist die wesentliche: Heute ist die Semantik **Teilanwendung
plus Ablehnungsliste**. Das ist für die Oberfläche richtig (ein abgewiesener
Slug soll nicht die ganze Sitzung verwerfen) und für eine Action-Batch falsch.

### Schritt C0 — eigener technischer Schritt **vor** der LLM-Integration

Daraus folgt kein Workaround in PR C, sondern ein eigener, kleiner Schritt
davor. Umfang, bewusst eng gehalten:

| # | Inhalt |
|---|---|
| 1 | `pageRef`/`tempId` als Adressierung neben `path`, mit serverseitiger Auflösung |
| 2 | **Ein** Operationsgraph über Edits und Seitenoperationen in deklarierter Reihenfolge, statt zwei Durchläufen |
| 3 | Zwei Anwendungsmodi: `partial` (heutiges Verhalten, für Puck und die Seitenliste) und `atomic` (für Action-Batches). Der Modus ist Teil der Anfrage, nicht geraten |
| 4 | Zyklen- und Konsistenzprüfung des Graphen vor dem Anwenden (`validate resulting operation graph`) |
| 5 | Tests: Batch mit fehlschlagender letzter Action hinterlässt **keine** Version; `partial` bleibt unverändert |

**Nicht** in C0: LLM, Prompting, Gateway, neue Blocktypen, `updateSeo`.

C0 ist **nicht freigegeben** — hier steht nur, was er wäre. Er wartet wie
alles Übrige auf eine Freigabe, die ausschließlich über den Auftraggeber
dieser Sitzung kommt.

## 4. Was es nicht gibt

> „Es gibt kein `createHTML`, kein `executeSQL`, kein `runCode`, kein
> `fetchURL` und nichts Vergleichbares."

Ebenso ausgeschlossen: Dateizugriff, Shell, Paketinstallation, eigene Runtime,
Zugriff auf Secrets oder `service_role`, das Umgehen von Governance-Gates und
das Veröffentlichen ungeprüfter Änderungen.

**C bleibt strikt auf bestehende Blocktypen und bestehende
SiteOS-Fähigkeiten beschränkt.** Was das Vokabular nicht ausdrückt, wird nicht
angenähert, sondern als nicht umsetzbar gemeldet.

Das Vokabular, Stand #1248 — 15 Block-Arten, 11 davon hinzufügbar:

```text
hero · features · services · about · team · testimonials · faq
contact-form · booking · map · cta                    ← ADDABLE_KINDS
navigation · footer · legal-text · ai-disclosure      ← PINNED_KINDS
```

Angeheftete Arten sind weder hinzufügbar noch entfernbar noch verschiebbar;
ihr Inhalt ist nicht editierbar. Rechtsseiten und Startseite sind auf
Seitenebene geschützt (#1258).

## 5. Entschiedene Fragen

Vier meiner sechs offenen Fragen sind damit beantwortet:

| Frage | Entscheidung |
|---|---|
| `updateSeo` aufnehmen? | **Ja**, im Ziel-Contract enthalten — aber **PLANNED / CORE EXTENSION**, nicht LIVE (§5a) |
| `UpdateThemeAction`? | **Zurückgestellt** — steht nicht in der Liste |
| Behauptende Inhalte (Testimonials, Vorzüge) aus der KI? | **Abweisen.** `test/siteos/preview-content-honesty.test.ts` bleibt unangetastet |
| Neue Blocktypen für C (`pricing`, `dashboard`, `chart`)? | **Keine** |

## 5a. `updateSeo` — im Ziel-Contract, aber **nicht LIVE**

**Status: PLANNED / CORE EXTENSION.** Festgelegt am 2026-09-07.

`updateSeo` bleibt Bestandteil des Ziel-Action-Contracts. Es funktioniert
heute **nicht**, und nichts darf das Gegenteil behaupten — weder dieses
Dokument, noch ein PR-Text, noch die Oberfläche.

**Grund**: `applyPageEdits` bearbeitet Blockinhalte. Die Felder, um die es hier
geht — `SitePage.title` und `SitePage.description` — liegen auf der Seite, nicht
in einem Block. Es gibt dafür heute keine Edit-Operation, keine Validierung,
keinen Prüfpfad-Code und keinen Test.

**Bedingungen für eine spätere Aktivierung** — alle, nicht einige:

1. SEO-Felder benannt und gegen das **bestehende** Seitenmodell geprüft
   (welche Felder, welche Längen, welches Verhältnis zu `noindex` und zu
   `seo.missing-description` aus `analyzeBlueprint`).
2. Serverseitige Edit-Operation, die diese Felder ändert — nicht clientseitig,
   nicht über einen Umweg.
3. Validierung an derselben Vertrauensgrenze wie die übrigen Actions.
4. Version, Hash und Evaluation wie bei jeder anderen Änderung.
5. Tests, die 1–4 belegen.

Erst wenn diese fünf Punkte stehen, wird der Status auf LIVE gesetzt — mit
Beleg, nicht mit Absicht.

## 6. Offen — nicht selbst zu entscheiden

Beide bleiben **UNKNOWN** (bestätigt am 2026-09-07). Keine Eigenentscheidung,
keine Ableitung aus Architekturannahmen, kein naheliegender Default: UNKNOWN
ist hier das **richtige** Ergebnis und bleibt stehen, bis Belege vorliegen.
Sie werden auch nicht durch Umsetzung vorweggenommen:

| # | Frage | Warum sie offen ist |
|---|---|---|
| 1 | Prüfpfad-Familie `action.*` neben `block.*` / `page.*` | Vokabular des Prüfpfads ist versionsrelevant; ein einmal vergebener Code wird nicht umbenannt |
| 2 | Kontingent: zählen KI-Aufrufe des Assistenten gegen ein `limit.*`, und gegen welches | Preisfrage. Dieselbe Klasse wie die offene Frage bei blockierten Bot-Nachrichten (`CLAUDE.md` §5) |

## 7. Reihenfolge

Vom Eigentümer am 2026-09-07 festgelegt:

```text
#1254  →  #1257 Recheck gegen den tatsächlichen main-Stand  →  #1258 Audit
       →  Action Contract  →  PR C  →  PR D  →  E  →  F
```

- **#1254 zuerst.** #1257 ist NO-GO vor #1254 — Reihenfolgeabhängigkeit, keine
  Vorliebe. Keine Umgehung durch Rebase oder Force-Push ohne erneute Prüfung.
- **#1258 bleibt**, wird nicht zurückgebaut und nicht in einen anderen PR
  verschoben. Der Compliance-Profil-Fix bleibt ausdrücklich enthalten.
- Gemergt wird ausschließlich vom Eigentümer.

## 8. Verhältnis zu anderen Dokumenten

| Dokument | Verhältnis |
|---|---|
| `app-builder-master-prompt-konflikt.md` | der NO-GO-Prompt; für C ohne Wirkung |
| `app-builder-zielbild.md` | Produktsicht A–F; §5 nennt C als PLANNED |
| `docs/architecture/target-architecture.md` §8.2 | normative Zielkette; dieser Contract füllt ihre zweite Stufe |
| `docs/SITEOS_ARCHITECTURE.md` §5c | Edit-Pipeline, in die C mündet |
| `docs/product/tech-debt-freeslug-determinismus.md` | offener Determinismus-Befund im Kern (TECH-DEBT / PARTIAL), berührt C0 |
