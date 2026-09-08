# Offene PRs — Abhängigkeiten, Duplikate, Empfehlung (Phase 0)

**Gemessen am 2026-09-08** über die GitHub-API und lokale `git diff`-Vergleiche
gegen `main` @ `9587905`. **37 offene PRs.**

> **§41 gilt**: Dieses Dokument mergt, schließt und löscht nichts. Es
> klassifiziert und schlägt vor.

---

## 1. Die vom Auftrag benannte Gruppe (#1254 – #1261)

Der Auftrag verlangt, diese sechs als **Abhängigkeitsgraph** zu behandeln, nicht
einzeln. Gemessen zerfallen sie in zwei Stränge:

```
main @ 9587905
  │
  ├── #1256  docs(builder): Zielbild, NO-GO, platform ruhend      [Doku, frei]
  │
  ├── #1257  Einstieg „Was möchtest du bauen?"                    [/unified-entry]
  │     │
  │     └── #1254  App Builder Workspace auf /builder/:slug       [Shell]
  │           │
  │           └── #1258  Seitenverwaltung (Phase 2, Schritt B)
  │                 │
  │                 └── #1259  Invarianten auf jedem Erzeugungspfad
  │                       ▲
  │                       │  #1260 ist der herausgelöste Kern von #1259
  │                       │
  │                 #1260  Page-Creation-Invarianten isoliert auf main
  │
  └── #1261  RealSync OS Kernel + Command Center                  [unabhängig]
```

**#1261 hängt an keinem der anderen.** Er berührt `src/core/realsync-os/*`,
`src/features/dashboard/*` und `src/features/siteos/commandExecutor.ts` — keine
Datei aus dem Builder-Strang.

---

## 2. #1259 und #1260 — kein Duplikat, sondern Kern und Hülle

Titel und Zeitpunkt legen ein Duplikat nahe. Die Messung zeigt etwas Genaueres:

| | Dateien | Zeilen |
|---|---|---|
| #1259 | 39 | +6942 / −275 |
| #1260 | 8 | +846 / −88 |

`comm -23` über die Dateilisten ist **leer**: **jede** Datei aus #1260 kommt in
#1259 vor. Fünf davon sind byte-identisch (`brief.ts`, `pages.ts`, `refine.ts`,
`core-import-graph.test.ts`, `page-invariants.test.ts`); drei tragen in #1259
zusätzliche Änderungen.

**#1260 ist die auf `main` isolierte Teilmenge von #1259** — genau das sagt
sein Titel („isoliert auf main"), und die Messung bestätigt es.

**Empfehlung**: #1260 **zuerst**. Er ist klein, steht auf `main`, trägt drei
Testdateien und schließt zwei belegte Befunde:

1. **Zwei Wege, eine Seite anzulegen, mit verschiedenen Regeln.** `refine.ts`
   baute Seiten ohne Obergrenze, ohne Slug-Prüfung, ohne die reservierten
   Rechtspfade — `pages.ts` mit allen dreien. Damit hing es an der
   Eintrittsroute, ob `/impressum` überschrieben werden konnte. Das ist der
   Fragmentierungsbefund des Auftrags (§15) auf Datenebene.
2. **ReDoS** (CodeQL `js/polynomial-redos`) in `slugify` — erreichbar,
   seit fremde Titel über `validatePageSlug` dorthin gelangen. Der Fix ist mit
   einem Vergleichstest gegen die frühere Fassung abgesichert, damit sich kein
   Blueprint-Hash ändert.

Danach schrumpft #1259 um diese acht Dateien und wird selbst überschaubarer.
**Nicht schließen** — er trägt Workspace, Panels, `edit.ts`, `persist.ts` und
einen RLS-Test, die #1260 nicht hat.

---

## 3. #1261 — der Kern der Auftragsfrage

Der Auftrag will ihn anhalten, weil er `/app/intelligence` als dritte
Dashboard-Schicht einführe. **Gemessen im Diff:**

| Prüfung | Ergebnis |
|---|---|
| `path=` | 0× |
| `Route ` | 0× |
| `App.tsx` berührt | nein |
| `/app/intelligence` im Code | 0× |
| `/app/intelligence` in der PR-Doku | 1× |

Die Route existiert **seit jeher auf `main`** (`src/App.tsx:756`). Der PR
erweitert die dort bereits gerenderte `DashboardView` um ein Panel und legt
darunter einen Kernel (Planner → PolicyEngine → Executor).

**Empfehlung**: `MERGE CANDIDATE` nach zwei kleinen Auflagen — Korrektur der
irreführenden Doku-Zeile und Wiederherstellung des in `DashboardView.tsx`
gelöschten Status-Adapter-Kommentars. Einzelheiten:
`docs/product/dashboard-consolidation.md` §6.

**Der Kernel ist nicht das Risiko — die Oberflächenzahl ist es, und die ist
älter als dieser PR.**

---

## 4. PR-Matrix (§35)

| PR | Zweck | Abhängigkeit | Duplikat | Risiko | Empfehlung |
|---|---|---|---|---|---|
| **1261** | OS-Kernel + Command Center | keine | nein | mittel | **MERGE nach Doku-Korrektur** |
| **1260** | Seiten-Invarianten, ReDoS | keine (auf `main`) | Kern von #1259 | **niedrig** | **ZUERST MERGEN** |
| **1259** | Invarianten + Workspace | #1258 | enthält #1260 | hoch (39 Dateien) | nach #1260 rebasen |
| **1258** | Seitenverwaltung | #1254 | nein | mittel | nach #1260 |
| **1254** | Builder-Workspace-Shell | #1257 | nein | mittel | Reihenfolge halten |
| **1257** | Einstieg „Was bauen?" | keine | Funnel-Überschneidung mit #1227/#1236 | mittel | mit Funnel-PRs abstimmen |
| **1256** | Doku Zielbild/NO-GO | keine | überschneidet dieses Phase-0-Set | niedrig | mit Phase 0 zusammenführen |
| 1253 | Storage-Policy schließen | keine | nein | **Sicherheit** | Eigentümer-Freigabe nötig |
| 1248 | Puck-Block-Editor | Builder-Strang | nein | hoch | nach Builder-Strang |
| 1245 | Market Intelligence MVP | keine | nein | niedrig | unabhängig |
| 1244 | Design Welle 3 | **Basis = #1229** | nein | Design-Freeze §10 | stacked; nach #1229 |
| 1243 | Ratsche Plan-Namen | keine | nein | niedrig | unabhängig, stützt Pricing |
| 1242 | Edge-Liste auf 188 | keine | nein | niedrig | **früh mergen** (färbt fremde PRs rot) |
| 1240 | Presence Layer Scope 1 | keine | Überschneidung mit SiteOS? | mittel | prüfen |
| 1238 | Production E2E Audit | keine | überschneidet Phase 0 | niedrig | zusammenführen |
| 1236 | P0-Journey/Taxonomie | keine | Funnel: #1257, #1227 | mittel | **Funnel-Konflikt klären** |
| 1235 | Migrations-Kollisionsprüfung | keine | nein | niedrig | mergen (CI-Schutz) |
| 1234 | Deployment-Kette + CI-Fixes | keine | nein | niedrig | mergen |
| 1231 | 7 Statusdokumente löschen | keine | nein | niedrig | §9-Hygiene, frei |
| 1229 | Palette tokenisieren | keine | nein | **Design-Freeze §10** | Freigabe nötig |
| 1227 | Onboarding in /flow | keine | Funnel: #1236, #1257 | mittel | **Funnel-Konflikt klären** |
| 1226 | Agenten-Bestandsaufnahme | keine | nein | niedrig | Doku |
| 1225 | Funnel §5 nachmessen | keine | nein | niedrig | Doku |
| 1224 | Runbook-Vorabevidenz | keine | nein | niedrig | Doku |
| 1223 | CLAUDE.md nachmessen | keine | überschneidet Phase 0 | niedrig | zusammenführen |
| 1219 | GitHub beidseitig | keine | nein | mittel | unabhängig |
| 1218 | drift-alert erweitern | keine | nein | niedrig | mergen |
| 1217 | RLS-Abdeckungs-Guard | keine | nein | **niedrig, hoher Wert** | mergen |
| 1214 | Kontingente Agency/Partner | keine | **Pricing-Konflikt** | mittel | siehe `pricing-v2.md` |
| 1211 | E2E-Auth-Setup | keine | nein | niedrig | mergen |
| 1207 | Agenten-Organisationsebene | #1202? | Überschneidung #1202 | hoch | prüfen |
| 1206 | toter Migrations-Verweis | keine | nein | niedrig | mergen |
| 1202 | B1-Rechteausweitung + Agenten | keine | Überschneidung #1207 | **Sicherheit** | prüfen |
| 1201 | Nav-Kommentar | keine | nein | niedrig | mergen |
| 1164 | AI-Gateway Routing R1+R2 | keine | **berührt `ai-gateway`** | hoch | **vor Konsolidierung klären** |
| 1128 | Policy-Audit, Verdict-Adapter | keine | nein | mittel | prüfen |
| 1121 | Edge-Typfehler 19→0 | keine | nein | niedrig | mergen |

---

## 5. Drei Konflikte, die keine PR-Frage sind

1. **Funnel-Dreieck**: #1236, #1227 und #1257 verändern alle den Einstieg. Sie
   sind je für sich sinnvoll und zusammen widersprüchlich. Gehört entschieden,
   bevor einer von ihnen mergt.
2. **`ai-gateway`**: #1164 baut das Routing der Function um, auf die **beide**
   Dashboard-Flächen laufen. Die Konsolidierung aus Phase 2 und dieser PR
   berühren dieselbe Stelle.
3. **Design-Freeze**: #1229 und #1244 ändern Palette und angemeldete
   Oberfläche. CLAUDE.md §10 verlangt dafür die Drei-Fragen-Regel; im Repo ist
   für diese beiden keine Freigabe hinterlegt.

---

## 6. Empfohlene Reihenfolge

**Welle 1 — risikoarm, entlastet die anderen**
`#1242` (Rotfärbung fremder PRs) → `#1235`, `#1234`, `#1218`, `#1217`, `#1211`,
`#1206`, `#1201`, `#1121`, `#1231`

**Welle 2 — Kern**
`#1260` → `#1261` (nach Doku-Korrektur)

**Welle 3 — Builder-Strang**
`#1257` → `#1254` → `#1258` → `#1259` (rebased) → `#1248`

**Blockiert bis Eigentümer-Entscheid**
`#1253` (Storage) · `#1229`/`#1244` (§10) · `#1214` (Pricing) ·
`#1236`/`#1227`/`#1257` (Funnel) · `#1164` (Gateway)
