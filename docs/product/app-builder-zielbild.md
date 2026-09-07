# RealSync App Builder — Zielbild (Phase 2)

**Stand 2026-09-07.** Richtungskorrektur des Eigentümers, verbindlich. Dieses
Dokument ersetzt die bisherige Phase-2-Planung („Workspace nach Art einer
Web-IDE") und hält fest, was RealSync stattdessen wird, was ausdrücklich
nicht, und was sich dadurch am bereits geplanten Schnitt A–F ändert.

Gemessen gegen `main` @ `9587905`, PR #1248 @ `fea75ec`, PR #1254 @ `de35e35`
und das Live-Projekt `ebljyceifhnlzhjfyxup` (nur `SELECT`). Kein Code geändert.

---

## 1. Was RealSync wird — und was nicht

**Zielbild: ein AI App Builder nach dem Muster von Emergent.** Der Kunde
beschreibt, was er bauen will; die KI baut die App; der Kunde iteriert
visuell und per Sprache. Dazwischen liegt bei RealSync die Governance Runtime
als Kontrollschicht — sie ist der Unterschied, nicht ein Anhang.

**Nicht das Zielbild: ein Replit-Klon.** Replit ist zuerst eine IDE — Code,
Terminal, Dateien, eine Laufzeit je Projekt. Nichts davon ist Teil von
RealSync.

| Ausdrücklich **nicht** gewollt | Warum |
|---|---|
| Terminal | Ausführung beliebiger Befehle ist nicht governbar |
| Ausführung beliebigen Codes | dito; das Artefakt ist statisch und gehasht (§7 der Zielarchitektur, Publish Gate) |
| Beliebige npm-Projekte | ein zweiter Build-Pfad neben dem Renderer |
| Eigene Runtime je Kunde | ein zweiter Betriebs- und Sicherheitsraum je Mandant |
| Beliebige SQL-Befehle durch die KI | die KI schreibt **nie** in die Datenbank (§3) |
| Zweiter Backend-Stack | Supabase Edge Functions bleiben der einzige Server |
| Zweiter Auth-Stack | Supabase Auth, `memberships`, RLS bleiben die einzige Identität |
| Zweiter Deployment-Stack | Cloudflare Pages über den Publish Gate, nichts daneben |

Diese Liste ist nicht neu — `docs/architecture/target-architecture.md` §12
schließt „Drittes Frontend", „zweite Evidence-Kette" und einen zweiten
Audit-Pfad bereits aus. Neu ist die Anwendung auf den Builder: Ein Terminal
oder eine Kunden-Runtime wäre genau der zweite Stack, den das Zielbild
verbietet.

---

## 2. Zielkette (normativ)

```text
Natürliche Sprache
      ↓
AI Actions                 strukturiert, gegen Schema, nie HTML, nie Blueprint
      ↓
validiertes App Schema     SiteBlueprint — Ableitung im Kern (packages/siteos-core)
      ↓
Puck / visueller Editor    Redaktion und Struktur, dieselbe Edit-Pipeline
      ↓
governed Artifact          Renderer → Dateien + artifact_sha256
      ↓
Evaluation                 Publish Gate (G1–G6), PDP, Person bei Bedarf
      ↓
Cloudflare Publish         Pages, öffentliche URL, an Evaluation gebunden
```

**Puck ist die visuelle Editorschicht innerhalb dieser Kette, nicht der
App Builder.** Der Editor aus #1248 bleibt richtig: Er editiert die Liste
`{ type, props }` einer Seite und schickt nur Reihenfolge, Art und
redaktionelle Felder (`PageEdit`) an `siteos/edit`. Die KI-Schicht darüber
erzeugt dieselbe Art von Anfrage — nicht mehr und nichts anderes.

**Eine Pipeline, zwei Eingänge.** Ob eine Änderung aus dem Puck-Editor oder
aus dem Assistenten kommt, ist für den Server nicht unterscheidbar und soll
es auch nicht sein: `applyPageEdits` (`blueprint/edit.ts`) leitet
Rechtsgrundlagen, Drittanbieter-Hosts und KI-Kennzeichnung ab, hält
Navigation, Fuß, KI-Hinweis und Rechtstexte angeheftet und nennt alles, was
sie verwirft, unter `rejected`. Eine zweite Pipeline für die KI wäre der
Fragmentierungsbefund aus CLAUDE.md §5 (Bot-PEP) eine Ebene höher.

---

## 3. Die KI schreibt nie direkt

Die Regel, die alles andere trägt:

1. Die KI **schlägt strukturierte Änderungen vor** (Actions).
2. Actions werden **validiert** — Schema, bekannte IDs gegen den geladenen
   Blueprint, erlaubte Felder aus `EDITABLE_CONTENT`, angeheftete Arten.
3. Der Kunde sieht die **Vorschau der Änderungen** als Liste und übernimmt sie
   mit einem **ausdrücklichen Knopf**.
4. Erst die Übernahme erzeugt über `siteos/edit` eine **neue Version** in der
   Kette — mit `base_sha256`, Vorgänger-Hash, Analyse, Bewertung, Herkunft und
   Prüfpfad (`persist.ts`).

Zwischen Vorschlag und Version liegen Governance und Validierung. Es gibt
keinen Pfad, auf dem ein Modell-Output ohne diese Stationen in
`siteos_blueprints` landet — heute nicht (Insert nur `service_role`, geprüft
in `test/runtime/db/siteos-rls.db.test.ts`) und im Zielbild nicht.

**Der Vorbau existiert schon, deterministisch.** `refineBlueprint`
(`blueprint/refine.ts`) nimmt eine Anweisung und liefert `changes` mit
stabilem `code` und kundenlesbarem `summary` („Was passiert ist, in einem
Satz. Wird dem Kunden gezeigt."), dazu `refusals` für Nichtverstandenes.
`siteos/edit` antwortet ebenso mit `changes` und `rejected`. Die Liste
„Hero aktualisiert · CTA hinzugefügt · Navigation unverändert" ist also kein
neues Konzept, sondern die Anzeige einer Struktur, die beide Pfade bereits
erzeugen. Schritt C setzt ein LLM davor, das dasselbe Vokabular spricht.

---

## 4. UX-Zielbild

```text
┌─ oben ───────────────────────────────────────────────────────────────────┐
│ Projekt · Version · Hash · Governance-Status · Vorschau · Speichern · Veröffentlichen │
├─ links ──────┬─ Mitte ───────────────────────────┬─ rechts ──────────────┤
│ Pages        │ Live Canvas                        │ AI Assistant          │
│ Components   │ Desktop / Tablet / Mobile          │ Properties            │
│ Assets       │ Drag & Drop                        │ Problems              │
│ Data         │ direkte Bearbeitung                │ Governance            │
│ Integrations │                                    │                       │
└──────────────┴────────────────────────────────────┴───────────────────────┘
```

**Der Assistent** stellt eine Frage: „Was möchtest du ändern?" Der Kunde
antwortet in Sprache, etwa „Mach die Startseite moderner und füge einen
Termin-buchen-Button hinzu." Die KI antwortet **nicht mit einer geänderten
Seite**, sondern mit der Liste der vorbereiteten Änderungen:

```text
Hero aktualisiert
CTA „Termin buchen" hinzugefügt
Navigation unverändert
Datenschutz und Impressum unverändert

[ Änderungen übernehmen ]   [ Verwerfen ]
```

Erst der Knopf erzeugt die Version. „Unverändert" wird ausdrücklich genannt,
weil es für Rechtstexte und Navigation die eigentliche Zusage ist.

**Zielbeispiel.** „Erstelle mir eine Website für meinen Sanitärbetrieb" ergibt
Home, Leistungen, Über uns, Kontakt, Terminbuchung, Impressum, Datenschutz,
Navigation, Footer, SEO und ein responsives Layout. Danach: „Mach die
Startseite dunkler" (Theme), „Füge eine Seite für Wärmepumpen hinzu"
(Seitenoperation), „Ändere den CTA auf Kostenlosen Termin vereinbaren"
(redaktionelles Feld). Alle drei sind Actions, keine davon ist HTML.

---

## 5. Verbindliche MVP-Reihenfolge

| Schritt | Inhalt | Stand | Beleg |
|---|---|---|---|
| **A** Builder Workspace | `/builder/:slug`, Puck, Pages, Canvas, Properties, Save, Preview, Problems, Governance | **geliefert** (Draft) | PR #1254 @ `de35e35`, 12/12 Checks grün gegen `main`, vom Eigentümer unabhängig geprüft |
| **B** Page Management | create, rename, slug, duplicate, delete; **Legal Pages geschützt** | PLANNED — startet erst auf ausdrückliches „go" | — |
| **B+** Seiten-Invarianten | **eine** kanonische Page-Operation; `slug-validate`, `max-pages-limit`, `legal-page-protection` greifen auf **jedem** Erzeugungspfad | PLANNED — **STOP-Befund, vor C0 und C** | `docs/product/page-creation-invarianten.md` |
| **C0** Atomare Batches | `tempId`/`pageRef`, Operationsgraph, Modi `partial` und `atomic`, Graphprüfung vor Ausführung | **freigegeben** 2026-09-07, beginnt nach B+ | `docs/product/app-builder-action-contract.md` §3a |
| **C** AI Builder | „Baue mir …" → Actions, keine HTML; validiert; dieselbe Edit-Pipeline wie manuelle Änderungen | PLANNED — **vor D**, LLM erst nach C0 | `…action-contract.md` |
| **D** Publish | Governance Gate, Evaluation, Artifact Hash, Cloudflare Deployment, öffentliche URL | PLANNED — Secrets und Produktions-Deployment strikt getrennt, setzt der Eigentümer | — |
| **E** Assets | echtes Asset-System, Upload, Image Blocks, Mandantentrennung, **separate Security-Migration** | PLANNED — eigener PR, erst Bucket, dann Renderer | #1253 räumt vorher die offene Policy ab |
| **F** E2E | Prompt → App → Edit → Save → Governance → Publish → öffentliche URL | PLANNED — Testkonto als CI-Secret, nur in Actions, setzt der Eigentümer | — |

Die Reihenfolge ist Abhängigkeit, nicht Vorliebe: C erzeugt Seitenoperationen
und braucht deshalb B; D veröffentlicht, was A–C erzeugt haben; F beweist die
ganze Kette und braucht D.

**Verbindliche technische Reihenfolge** (Owner-Freigabe 2026-09-07):

```text
#1254  →  #1257 Revalidation  →  B+ Refinement-Invariant-Fix  →  C0
       →  Action Contract / Core Tests  →  C (AI Actions)  →  D  →  E  →  F
```

Zwei Schritte sind seit dem 2026-09-07 dazwischengeschoben, beide aus einem
gemessenen Befund und nicht aus Vorliebe: **B+**, weil zwei Erzeugungspfade für
Seiten unterschiedliche Schutzregeln einhalten, und **C0**, weil der Kern eine
atomare Action-Batch heute nicht trägt. Das LLM kommt erst nach beiden.

---

## 6. Delta-Report: was sich gegenüber dem bisherigen Schnitt ändert

Bezug: Kartierung und PR-Schnitt vom 2026-09-07 09:45 UTC (Sitzungsdokument,
die Kernaussagen stehen in `docs/SITEOS_ARCHITECTURE.md` §5d und im Text von
#1254). Geprüft am Code von `de35e35`, nicht an der Erinnerung.

### 6.1 Rechtes Panel: Properties und Governance werden Tabs

| Heute (`de35e35`) | Zielbild | Delta |
|---|---|---|
| Rechts: „Ausgewählter Baustein" (`<Puck.Fields />`, `SiteOsBlockEditor.tsx:213–216`), darunter Assistent und Design | Rechts: **AI Assistant · Properties · Problems · Governance** als Tabs | Properties ist vorhanden, aber ohne Tab-Identität; Problems und Governance liegen **unten** (`bottomTab`, `AppBuilderWorkspacePage.tsx:406–409`) statt rechts |
| Unten: Probleme · Konsole · Verlauf · Governance | Unten: frei (Konsole und Verlauf können bleiben) | Problems und Governance ziehen nach rechts oder werden dort gespiegelt |
| Kopfzeile: Slug · Version · Hash · Speicherzustand | zusätzlich **Governance-Status** (letzte Bewertung: publishable / blockiert / keine) | ein Chip aus `listEvaluations`, keine neue Quelle |

**Einordnung**: Umbau der Shell, kein neues Datenmodell. Die vier Tabs lesen
dieselben Quellen wie heute (`analyzeBlueprint`, Gate-Bewertung,
`provenance_*`, `listBlueprintChain`). Das gehört als **Nachtrag zu A** vor
B — sonst baut B Seitenoperationen in ein Layout, das C wieder umstellt.

### 6.2 Assistent: Vorschau der Änderungen plus Übernehmen-Knopf

| Heute (`de35e35`) | Zielbild | Delta |
|---|---|---|
| Eingabe + fünf Vorschläge → `rebuild()` → `/unified-entry/transformation?url=&instruction=` → **Neubau** der Site aus der Quelle | Eingabe → Liste vorbereiteter Änderungen → **„Änderungen übernehmen"** → neue Version der **gespeicherten** Fassung | die Interaktion ist heute „ersetzen", morgen „vorschlagen, zeigen, übernehmen" |
| ohne `?source=` gesperrt | funktioniert auf jeder gespeicherten Fassung, Quelle nicht nötig | die Sperre entfällt mit C |
| Vorschläge sind feste Prompts an den Erstbau | Vorschläge sind Actions gegen die aktuelle Fassung | — |

**Was heute schon trägt**: `refineBlueprint` liefert `changes[]` mit `code`
und `summary` und `refusals[]`; `siteos/edit` liefert `changes` und
`rejected`. Die Vorschau-Liste kann aus genau diesen Strukturen gerendert
werden — für die grammatikgedeckten Anweisungen (Theme, Hero-Text, Site-Name,
Seite anlegen aus fünf Presets, Block hinzufügen/entfernen) **ohne LLM**. Das
ist der erste Ausbau des Assistenten und gehört zu C, nicht zu A.

**Was fehlt**: der Übersetzer Actions → `PageEdit` (heute erzeugt
`refineBlueprint` direkt einen Blueprint; im Zielbild darf der Client keinen
Blueprint schicken, also muss der Vorschlag als Action-Liste zum Server, der
sie über `applyPageEdits` anwendet). Das ist der Kern von C.

### 6.3 Schritt B: duplicate und Schutz der Legal Pages

| Bisheriger Schnitt B | Zielbild | Delta |
|---|---|---|
| create, rename, delete, Slug-Validierung, Navigation nachziehen, `legal-text` nicht löschbar | zusätzlich **duplicate**; Legal Pages **geschützt** (nicht löschen, nicht umbenennen, Slug nicht ändern, Rechtstext-Block nicht entfernbar) | duplicate ist neu; der Schutz wird von „nicht löschbar" auf alle vier Operationen ausgeweitet |

**Beleg für die Grundlage**: `synthesize.ts:382` führt `LEGAL_PATHS`
(`/impressum`, `/datenschutz`, `/barrierefreiheit`, `/agb`, `/widerruf`);
`edit.ts:97` führt `PINNED_KINDS` mit `legal-text`. Der Schutz ist damit
**auf Blockebene** vorhanden (Block nicht entfernbar, nicht verschiebbar) und
**auf Seitenebene** noch nicht (es gibt keine Seitenoperationen). B führt die
Seitenebene ein und muss den Schutz dort wiederholen — an derselben Stelle
im Kern, nicht im Client.

**duplicate** braucht neue Block-IDs für die Kopie (IDs sind je Site
eindeutig; `applyPageEdits` adressiert Bestandsblöcke über ihre ID), einen
freien Slug (`slugify` + Kollisionsprüfung je Site) und einen Eintrag in der
Navigation. Rechtsseiten sind von duplicate ausgenommen — eine zweite
Datenschutzerklärung ist kein Feature.

### 6.4 Schritt C liegt vor D

Bisher: C nach B, D „nur wenn die Ergebnisse sauber sind" — die Reihenfolge
war schon so, wird aber jetzt als Abhängigkeit festgehalten: D veröffentlicht
Versionen, die A–C erzeugt haben; E2E (F) beweist die Kette von der Sprache
bis zur URL und ist ohne C nicht der Zielpfad.

**Was in C nicht mehr offen ist**: Die Modellwahl liegt hinter dem
`ai-gateway` (Ops `generate`, `extract_json`, `embed`; `response_schema`;
Provider-Kette im Code **LM Studio → Anthropic → OpenAI**, `ai-gateway/index.ts`
Zeile 296 ff.; §8.1 der Zielarchitektur nennt Ollama als bevorzugten Provider —
die beiden Aussagen stimmen nicht überein, siehe §7 Nr. 3). C bindet keinen Provider und keinen Schlüssel — es spricht
`extract_json` mit dem Action-Schema. Welcher Provider in Produktion
antwortet, ist eine Router-Frage und ein Betreiberschritt (Secrets).

### 6.5 Was unverändert bleibt

- Route `/builder/:slug`, Slug als Identifikator, ein Builder statt zwei.
- Abbildung der Wunsch-Bausteine auf die 15 vorhandenen `BlockKind`;
  Container und Columns bleiben PLANNED.
- Security-Basis aus #1248: kein frei kontrollierbarer Blueprint aus dem
  Browser, `base_sha256`, Insert nur `service_role`.
- E als eigener PR, erst Bucket dann Renderer; #1253 vorher.
- F mit Testkonto als CI-Secret, nur in Actions.

---

## 7. Offene Punkte und Risiken

Evidenzklassen: LIVE (gemessen, läuft) · PARTIAL (Code vorhanden, Pfad nicht
vollständig) · PROTOTYPE (belegt, aber nicht produktionsfähig) · PLANNED
(nicht vorhanden) · UNKNOWN (nicht messbar von hier).

| # | Punkt | Klasse | Beleg | Risiko | Wer entscheidet |
|---|---|---|---|---|---|
| 1 | **Action-Schema** — Vokabular für Puck und KI, Validator im Kern | PLANNED | kein `blueprint/actions.ts`; `PageEdit` deckt Blöcke, nicht Seiten | Ohne Schema wird C ein Prompt-Parser mit Sonderfällen. Das Schema ist versionsrelevant (Codes wie Befund-Codes: nie umbenennen) | Eigentümer: Schema als Entscheidung, nicht als Nebenarbeit |
| 2 | **LLM-Output ist nicht deterministisch** — derselbe Prompt ergibt nicht dieselbe Action-Liste | PLANNED | `synthesize.ts` ist deterministisch und gehasht; ein LLM davor ist es nicht | Reproduzierbarkeit endet am Vorschlag. Akzeptabel, **wenn** die Übernahme (nicht der Vorschlag) die Version erzeugt und der Prüfpfad die Action-Liste speichert | Architektur: Actions werden im Prüfpfad abgelegt (`siteos.blueprint.edit` trägt heute `change_codes`) |
| 3 | **Provider in Produktion** — welcher antwortet, mit welchen Kosten | UNKNOWN | `ai-gateway` verlangt `LM_STUDIO_BASE_URL` (sonst 503 `LM_STUDIO_NOT_CONFIGURED`) und liest `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` aus Env oder Vault; Vorhandensein nicht messbar, ohne Secrets zu lesen (verboten). **Abweichung**: §8.1 der Zielarchitektur nennt Ollama als bevorzugten Provider, der Code beginnt bei LM Studio | C kann in Produktion mit 503 stumm bleiben oder Kosten erzeugen; Doku und Code nennen verschiedene erste Provider | Eigentümer (Betreiberschritt; Doku oder Code angleichen) |
| 4 | **Erfundene Inhalte** — die KI erfindet Leistungen, Referenzen, Zusagen | PARTIAL | §10-Freigaben vom 2026-09-01: leere Blöcke statt Fülltext, `requiresRealContent`, `preview-content-honesty.test.ts` | Ein LLM erfindet leichter als eine Grammatik. Actions dürfen `testimonials`, Highlights und Rechtstexte nicht befüllen; Schema muss das ausschließen, nicht nur der Prompt | Architektur, in C zu testen |
| 5 | **Legal Pages auf Seitenebene** | PARTIAL | Blockebene geschützt (`PINNED_KINDS`), Seitenebene existiert nicht | B muss den Schutz im Kern wiederholen; ein Client-Schutz allein wäre umgehbar | B, Kern |
| 6 | **duplicate** — ID-Vergabe, Slug-Kollision, Navigation | PLANNED | — | mittel; Kernlogik mit Tests | B |
| 7 | **Publish-Pfad** — `cloudflare-deployer` nimmt ein einzelnes `html`, kennt weder Artefakt-Bündel noch `evaluation_id` noch `artifact_sha256` | PARTIAL | `cloudflare-deployer/index.ts:5,30,71`; Gate bindet an `artifact_sha256` (`publish-gate.ts:196,243`) | D muss den Deployer umbauen, nicht nur aufrufen — sonst wird etwas anderes ausgeliefert als bewertet (G6) | D, Architektur |
| 8 | **Cloudflare-Secrets** | UNKNOWN | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` als Function-Secrets; Vorhandensein nicht messbar | ohne sie kein LIVE-Claim für D, per Auftrag | Eigentümer |
| 9 | **Governance-Status in der Kopfzeile** ohne Bewertung | LIVE (Daten) | Prod: 0 Zeilen in `siteos_publish_evaluations` (Messung 2026-09-07) | Der Chip zeigt bei den meisten Sites „keine Bewertung" — ehrlich, aber leer; kein erfundener Status | — |
| 10 | **Mobile** — Drag & Drop auf Touch | PARTIAL | Puck-Leinwand bei 390 px ohne Überlauf gemessen; Drag & Drop per Touch nicht geprüft | UX-Zielbild nennt Drag & Drop; ob Puck das auf Touch trägt, ist offen | messen in A-Nachtrag |
| 11 | **Data / Integrations** — im UX-Zielbild links genannt, ohne Modell | PLANNED | Platzhalter „In Vorbereitung" in A | Erwartung ohne Deckung; kein Schritt in A–F trägt sie | Eigentümer: Umfang nach F oder streichen |
| 12 | **Kontingent** — KI-Aufrufe des Assistenten gegen `limit.*` | UNKNOWN | `ai-gateway` hat Rate-Limit und Kosten-Ledger; ob Builder-Aufrufe einem Plan-Limit zugeordnet werden, ist nicht festgelegt | Kosten ohne Gate; dieselbe offene Frage wie bei blockierten Bot-Nachrichten (CLAUDE.md §5) | Eigentümer, Pricing |
| 13 | **`siteos/edit` in Produktion** | PARTIAL | Router-Slot, Deploy erst mit dem nächsten `deploy.yml`-Lauf nach Merge von #1248 | Bis dahin ist Speichern im Workspace in Produktion nicht möglich | Merge-Reihenfolge #1248 → #1254 |

---

## 8. Verhältnis zu anderen Dokumenten

| Dokument | Verhältnis |
|---|---|
| `docs/architecture/target-architecture.md` §8.2 | normative Fassung der Zielkette aus §2; dieses Dokument ist die Produktsicht |
| `docs/SITEOS_ARCHITECTURE.md` §5c, §5d | Ist-Zustand von Editor und Workspace (#1248, #1254) |
| `CLAUDE.md` §1, §14 | Ist-Zustand; nennt dieses Dokument als Zielbild des Builders |
| PR #1254 | Schritt A; die Deltas aus §6.1 sind dort **nicht** enthalten und folgen als Nachtrag |
| PR #1253 | Sicherheitsvoraussetzung für E |

**Pflege**: §5 (Stand je Schritt) und §7 (Risiken) werden je gemergtem
Schritt fortgeschrieben, mit Datum und Beleg. Eine Zeile ohne Beleg ist ein
Wartungsfehler.
