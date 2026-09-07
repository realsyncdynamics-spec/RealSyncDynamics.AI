# Konkurrierender Prompt „MAXIMUM CREATIVE FREEDOM" — NO-GO und Governance-Konflikt

**Status: NO-GO, festgestellt vom Eigentümer am 2026-09-07.**

Der Eigentümer hat am 2026-09-07 einen Master-System-Prompt für die Builder-KI
vorgelegt („REALSYNC WEB APP BUILDER — AUTONOMOUS FRONTEND ARCHITECT &
LANDING PAGE AI — MASTER SYSTEM PROMPT — MAXIMUM CREATIVE FREEDOM") und ihn
am selben Tag ausdrücklich gestoppt:

> „Dieser Prompt ist NO-GO. Er wird nicht ausgefuehrt, nicht sinngemaess doch
> verwendet, nicht geloescht und nicht heimlich umgeschrieben. Dokumentiere
> ihn ausschliesslich als konkurrierenden Prompt und Governance-Konflikt, mit
> den belegten Kollisionsstellen."

Dieses Dokument ist genau das. Es ist **keine** Zielbild-Änderung. Aus diesem
Prompt wird nichts abgeleitet, solange der Konflikt offen ist.

> **Herkunft dieses Dokuments**: Erstellt am 2026-09-07 auf eine kurze
> Zustimmung, die der Eigentümer nachträglich ausdrücklich als **nicht
> autorisiert** festgestellt hat. Der **Inhalt** ist mit der Owner-Freigabe vom
> selben Tag zur Weiterverwendung freigegeben; die **Herkunft** bleibt als
> unautorisiert vermerkt.

## Warum dieses Dokument existiert

Ein zurückgezogener Prompt, der nirgends steht, kommt wieder — als Idee, als
Halbsatz in einem späteren Auftrag, als „das hatten wir doch mal so gewollt".
Der Konflikt ist inhaltlich ernst und nicht durch Formulierung auflösbar:
**zwei Anweisungen desselben Eigentümers widersprechen sich**, und die ältere
ist bereits in Code, Tests und einer erteilten §10-Freigabe verankert.

Er wird deshalb aufbewahrt, benannt und offen gehalten — nicht entschieden.

---

## 1. Die Kollisionsstellen — belegt, nicht behauptet

### 1.1 „generate the actual implementation" gegen das Verbot freier Implementierung

**Wortlaut des Prompts, §33 OUTPUT CONTRACT:**

> „If the environment supports direct rendering or code generation, generate
> the actual implementation. Do not merely describe what could be built."

Ergänzend §5 FRONTEND ARCHITECTURE: „Build reusable components. Prefer:
component-driven architecture, semantic HTML, accessible components, reusable
design tokens …"

**Steht gegen** den Masterauftrag Phase 2 A–F desselben Eigentümers vom
2026-09-07, Punkt 1 („Nicht verhandelbare Architektur"):

> Die AI darf NIEMALS: beliebiges HTML direkt erzeugen und speichern,
> beliebiges SQL ausfuehren, direkt Datenbankzustaende manipulieren,
> beliebigen JavaScript-Code ausfuehren …

**Und gegen den Code, gemessen am 2026-09-07:**

| Beleg | Fundstelle | Aussage |
|---|---|---|
| Der Server rendert selbst | `packages/siteos-core/src/render/renderer.ts` (495 Z.) | Das ausgelieferte Dokument entsteht aus dem `SiteBlueprint`, nicht aus KI-Text |
| Das Artefakt ist gehasht | `render/presentation.ts`, Kopfkommentar | „`renderThemeCss` ist an die Compliance-Analyse gekoppelt und wird byte-gleich gehasht. Jede Erweiterung dort ändert den Hash jedes Artefakts." |
| Das Gate bindet an den Hash | Publish-Gate-Contract G6 (`docs/architecture/target-architecture.md:517`) | „Eine Evaluation gilt für genau einen Artefakt-Hash. Ändert sich das Artefakt, verfällt sie." |
| Der Browser darf keine Struktur liefern | `supabase/functions/siteos/handlers/edit.ts` (#1248) | Der Client sendet nur Reihenfolge, Art und redaktionelle Felder; Rechtsgrundlagen und Hosts leitet der Server ab |

**Folge, wenn man den Prompt ausführte**: KI-erzeugtes HTML wäre weder
geprüft noch ausgeliefert — der Renderer ignoriert es. Würde man den Renderer
umbauen, damit er es ausliefert, verlöre der Publish Gate seinen
Prüfgegenstand. Das ist kein Qualitäts-, sondern ein Architekturbruch.

### 1.2 „generate realistic product-specific content" gegen die Content-Freigabe vom 2026-09-01

**Wortlaut des Prompts, §18 CONTENT GENERATION:**

> „When content is missing, generate realistic product-specific content.
> Never use ‚Lorem ipsum.' Never use meaningless filler. Headlines must
> communicate value."

**Steht gegen** die §10-Freigabe vom 2026-09-01 (`CLAUDE.md` §10, „Erteilte
Freigaben"), die derselbe Eigentümer nach einem eigenen Screenshot erteilt
hat — Anlass war eine Vorschau, die „Persönliche Betreuung — Feste
Ansprechpartner statt Warteschleife" versprach. Urteil damals: „Das ist
komplett am Ziel vorbei." Entscheidung:

> **„Ja — aus dem Scan speisen"**, ausdrücklich mit der Maßgabe „wo der Scan
> nichts hergibt, bleibt der Block leer statt falsch."

**Und gegen den Code, gemessen am 2026-09-07:**

| Beleg | Fundstelle | Aussage |
|---|---|---|
| Der Test sperrt die Formulierungen namentlich | `test/siteos/preview-content-honesty.test.ts:115` | „persönliche Beratung" ist als verbotene Formulierung hinterlegt |
| Der Test verlangt die Leermarkierung | ebd. Z. 74–79 | `features.requiresRealContent === true`, wenn kein Beleg vorliegt |
| Die Regel steht in der Freigabe selbst | `CLAUDE.md` §10, 2026-09-01 | „Ein Vorschau-Block, der etwas über ein fremdes Unternehmen behauptet, braucht eine Quelle. … Plausibel klingender Fülltext ist keine Vorschau, sondern eine Behauptung, für die niemand einstehen kann." |
| Rechtlicher Bezug | ebd. | § 5 UWG (irreführende geschäftliche Handlung) |

**Folge, wenn man den Prompt ausführte**: `preview-content-honesty.test.ts`
bricht. Das ist nicht der Schaden, sondern nur sein Anzeiger — der Schaden
ist, dass ein Modell Leistungen, Vorzüge, Referenzen und Zusagen über ein
**fremdes reales Unternehmen** erfindet und das Produkt sie ausliefert.

Der Eigentümer hat diesen Punkt am 2026-09-07 zusätzlich entschieden:
„Behauptende Inhalte abweisen, `preview-content-honesty.test.ts` bleibt
unangetastet."

### 1.3 Weitere Kollisionen, nachrangig, aber vorhanden

| Prompt | Steht gegen | Beleg |
|---|---|---|
| §3 „Do not expose this internal reasoning." | Prüfpfad und Art. 50 EU AI Act; `ai-disclosure` ist ein angehefteter Block, der nicht entfernt werden kann | `PINNED_KINDS` in `blueprint/edit.ts` (#1248); CLAUDE.md §5 (Prüfpfad-Zusage) |
| §29 „Kritik → automatische Verbesserung", Loop bis „Publish" | G3 (fail-closed) und G4 („kein manuelles Überschreiben; eine Ausnahme ist immer ein Approval, nie ein Flag") | `target-architecture.md:515-516` |
| §2/§15 volle Freiheit über Farben, Typografie, Tokens, Design-System je Projekt | **Kein** Konflikt mit dem Design-Freeze §10 (der schützt die Plattform-Oberfläche, nicht die Kundenseite), wohl aber ohne Deckung im Modell: gebahnt ist nur `applySiteDesignTemplate()` mit drei Vorlagen | `render/templates.ts` |
| §10 Dashboard-Modus, §33 „Project structure / Reusable components" | Vokabular fehlt: 15 Block-Arten, 11 hinzufügbar, kein `pricing`, `dashboard`, `chart`, `gallery`, `tabs` | `EDITABLE_CONTENT` / `ADDABLE_KINDS` in `blueprint/edit.ts` (#1248) |
| §16/§17 Marken- und Referenz-Modus (Logo, Screenshots, Brand Guidelines) | Kein Asset-System, keine Bild-Blöcke; Schritt E ist PLANNED und hängt an #1253 | `docs/product/app-builder-zielbild.md` §5 |

### 1.4 Was am Prompt **nicht** kollidiert

Zur Fairness gegenüber dem Auftrag, und damit die Auflösung später nicht bei
Null anfängt: Design Intelligence (§3), Conversion-Architektur (§8),
Responsive als eigener Entwurf statt Verkleinerung (§6), Zustände
Default/Loading/Success/Empty/Error/Disabled (§25), Leerzustände (§26),
Formularreibung (§27), WCAG 2.2 AA (§19) und der Qualitätsdurchgang (§29,
ohne die Publish-Stufe) sind **Anspruchsniveau ohne Architekturkonflikt**.

Ein Teil davon ist bereits maschinell vorhanden: `analyzeBlueprint()` liefert
16 Befund-Codes, die der Publish Gate liest und die der Workspace seit #1254
im Tab „Probleme" zeigt.

---

## 2. Der Befund, der den Prompt begründet hat — er bleibt gültig

Der Prompt ist NO-GO; der Anlass war berechtigt. Gemessen am 2026-09-07 mit
dem Beispiel des Eigentümers gegen den **heutigen** Pfad
(`parseBrief` → `getIndustryPreset` → `deriveRequests`):

```text
Prompt   "Bau mir eine Website für einen Handwerksbetrieb. Modern, extrem
          vertrauenswürdig, mobil zuerst. Kunden sollen innerhalb von 30
          Sekunden einen Auftrag anfragen können."

industry  handwerk (sicher erkannt)
requests  []                     ← keine einzige Gestaltungsanweisung erkannt
pagePlan  / /leistungen /referenzen /anfrage /impressum /datenschutz
          /barrierefreiheit      ← Seitenplan der Branche, prompt-unabhängig
services  Beratung vor Ort · Ausführung · Wartung · Notdienst
                                 ← defaultServices, nicht aus dem Prompt
```

`deriveRequests` kennt acht Auslöser und fünf Seiten-Presets (`ADDABLE_PAGES`
in `blueprint/refine.ts:128`). „Modern", „extrem vertrauenswürdig", „mobil
zuerst" und „30 Sekunden bis zur Anfrage" treffen keinen davon und fallen
still auf den Boden.

**Die Lücke ist real. Der Weg dorthin ist die Frage.** Der Action Contract
(`docs/product/app-builder-action-contract.md`) schließt sie innerhalb der
Architektur; der Master-Prompt schließt sie, indem er die Architektur verlässt.

---

## 3. Was den Konflikt auflösen würde

Nicht entschieden — hier nur benannt, damit die Entscheidung vorbereitet ist:

1. **Trennung, die der Prompt nicht macht**: Struktur und Beschriftung darf
   die KI erfinden (Überschriften, CTA-Text, Reihenfolge, Seitentitel);
   Tatsachenbehauptungen über das Unternehmen nicht (Leistungen, Vorzüge,
   Referenzen, Kundenstimmen, Zahlen, Zusagen). Damit fiele §18 nicht ganz
   weg, sondern würde halbiert.
2. **„Implementation" umdeuten**: nicht Code, sondern vollständige
   Action-Liste. Der Anspruch „liefere ein fertiges Erlebnis, nicht eine
   Beschreibung" bleibt erfüllbar.
3. **Loop endet vor dem Gate**: automatische Verbesserungsrunden auf dem
   Entwurf, Publish immer mit Mensch.
4. **Vokabular erweitern statt umgehen**: Wenn Pricing-, Stats- oder
   Prozess-Flächen gewollt sind, sind das neue Block-Arten mit Schema und
   Renderer — eine Entscheidung, kein Prompt-Satz. Am 2026-09-07 hat der
   Eigentümer für Schritt C entschieden: **keine neuen Blocktypen.**

Punkt 1 und 3 sind vom Eigentümer am 2026-09-07 bereits in die Richtung
entschieden (behauptende Inhalte abweisen; Theme-Action zurückgestellt);
Punkt 2 und 4 bleiben offen.

---

## 4. Vollständiger Wortlaut

Der Prompt wird **nicht** in diesem Repository nacherzählt oder gekürzt
abgelegt, weil eine gekürzte Fassung genau das wäre, was der Eigentümer
untersagt hat („nicht heimlich umgeschrieben"). Maßgeblich ist seine
Original-Nachricht vom 2026-09-07 in der Arbeitssitzung
`session_01FnzJ27M6DpEmbTJi8gjiPU`, Abschnitte 1–34, beginnend mit
„REALSYNC WEB APP BUILDER / AUTONOMOUS FRONTEND ARCHITECT & LANDING PAGE AI"
und endend mit „BUILD THE BEST VERSION YOU CAN."

Zitate in diesem Dokument sind wörtlich und mit Abschnittsnummer belegt.
Wer den Konflikt auflöst, arbeitet gegen das Original, nicht gegen dieses
Dokument.

**Abschnittsverzeichnis des Originals** (damit nachprüfbar ist, dass nichts
unterschlagen wurde): 1 Core Mission · 2 Maximum Creative Freedom · 3 Design
Intelligence · 4 Creative Direction · 5 Frontend Architecture · 6 Responsive
Design · 7 Landing Page Mode · 8 Conversion Architecture · 9 Product
Experience Mode · 10 Dashboard Mode · 11 Interaction Design · 12
Micro-Interactions · 13 AI-Native Interfaces · 14 Web App Builder Experience ·
15 Design System Generation · 16 Brand Adaptation · 17 Reference Design Mode ·
18 Content Generation · 19 Accessibility · 20 Performance · 21 Security ·
22 RealSync Ecosystem · 23 Cloud/Deployment Awareness · 24 SEO Mode ·
25 Error Handling · 26 Empty States · 27 Form Design · 28 Onboarding ·
29 Iterative Design · 30 Never Ask Unnecessary Questions · 31 Creative
Escalation · 32 Design Quality Bar · 33 Output Contract · 34 Final Principle.

---

## 5. Geltung

- **Nicht ausführen, nicht sinngemäß verwenden**, auch nicht in Teilen, auch
  nicht „nur das Unstrittige".
- **Nicht löschen.** Dieses Dokument ist die Aufbewahrung.
- Für Schritt C gilt ausschließlich
  `docs/product/app-builder-action-contract.md`.
- Aufhebbar nur durch den Eigentümer, mit Datum und Umfang — wie jede
  §10-Freigabe.
