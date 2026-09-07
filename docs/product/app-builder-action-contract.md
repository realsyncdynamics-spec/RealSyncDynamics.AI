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
| 11 | `updateSeo` | Seitentitel und Beschreibung | **einzige Kernerweiterung**, siehe §5 |

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
| `updateSeo` aufnehmen? | **Ja**, im Umfang enthalten |
| `UpdateThemeAction`? | **Zurückgestellt** — steht nicht in der Liste |
| Behauptende Inhalte (Testimonials, Vorzüge) aus der KI? | **Abweisen.** `test/siteos/preview-content-honesty.test.ts` bleibt unangetastet |
| Neue Blocktypen für C (`pricing`, `dashboard`, `chart`)? | **Keine** |

**Zu `updateSeo`**: Es ist die einzige der elf Actions, für die der Kern heute
keinen Weg hat — `applyPageEdits` bearbeitet Blockinhalte, nicht die
Seitenfelder `title` und `description`. Die Erweiterung ist klein und bleibt
innerhalb der bestehenden Pipeline (dieselbe Funktion, ein zusätzliches
Feldpaar je Seite). Sie ist durch die Aufnahme in die Elferliste gedeckt;
umgesetzt wird sie erst mit C.

## 6. Offen — nicht selbst zu entscheiden

Beide bleiben **UNKNOWN** und werden nicht durch Umsetzung vorweggenommen:

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
