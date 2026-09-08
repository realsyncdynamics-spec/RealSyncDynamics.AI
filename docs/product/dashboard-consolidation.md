# Dashboard-Konsolidierung — Befund und Vorschlag (Phase 0)

**Gemessen am 2026-09-08** gegen `main` @ `9587905`.
**Status: Vorschlag. Nicht umgesetzt.** §41 des Auftrags verbietet in dieser
Phase jede Umsetzung; §10 der CLAUDE.md verlangt für Änderungen an Bestehendem
ohnehin die Fragepflicht.

---

## 1. Der Befund in einem Satz

Es gibt heute **drei** angemeldete Arbeitsflächen mit demselben Anspruch, und
**keine** davon stammt aus einem offenen PR.

| # | Route | Rendert | Charakter |
|---|---|---|---|
| A | `/assistant` | `pages/CreatorDashboard` (599 Z.) | Chat-Assistent, dunkel |
| B | `/app/dashboard` | `DashboardRouter` → `GovernanceAiWorkspace` (182 Z.) | Governance Control Plane, hell |
| C | `/app/intelligence` | `features/dashboard/DashboardView` | Kennzahlen + Kommandozeile |

Die Screenshots des Auftrags zeigen A und B. C war in der Auftragslage nicht
sichtbar und ist der eigentliche Beleg dafür, dass die Parallelität **vor**
allen offenen PRs entstanden ist.

---

## 2. Warum die Konsolidierung billiger ist als angenommen

Der Auftrag befürchtet (§6, §18) doppelte Laufzeiten, doppelten Zustand,
doppelte Datenhaltung. Gemessen trifft das **nicht** zu:

- A ruft `processAIGatewayRequest` (`core/ai-gateway/gateway.ts`)
- B ruft `AiGatewayEdgeClient` (`core/ai-gateway/edgeClient.ts`)
- **`gateway.ts:17` importiert `AiGatewayEdgeClient` und delegiert an ihn**
  (`gateway.ts:95`)

Beide Wege enden in derselben Edge Function `ai-gateway`. Es gibt eine
Laufzeit, ein Modell-Routing, einen Schlüsselpfad. Was doppelt ist, sind die
**Client-Wrapper und die Oberflächen** — nicht der Kern.

> Das verschiebt die Aufgabe von „Systeme zusammenführen" zu „Oberflächen
> zusammenlegen". Die Reihenfolge aus §38 bleibt richtig, der Aufwand von
> Phase 2 sinkt erheblich.

---

## 3. Der Mandantenbezug — nachgemessen, und er entlastet die Entscheidung

**Die erste Fassung dieses Abschnitts war falsch zugeordnet.** Sie hielt fest,
`CreatorDashboard` importiere als einzige der drei Flächen kein `useTenant`,
und nannte die Erhebung von `/assistant` deshalb „den riskantesten Schritt des
ganzen Umbaus". Die Beobachtung stimmte; der Schluss daraus nicht.

Nachgemessen am 2026-09-08 über **alle** Aufrufstellen des KI-Pfades:
**keine** von ihnen trägt Mandanten- oder Nutzeridentität. Jede sendet den
Anon-Key als Bearer-Token; `ai-gateway/index.ts:109` setzt `tenant_id`
ohnehin **fest auf `null`**. Einzelheiten und Folgen:
`docs/architecture/realsync-os-current-state.md` §2.

**Damit ist der Mandantenbezug kein Auswahlkriterium mehr.** A, B und C sind
gleich betroffen — er taugt nicht als Argument für oder gegen eine der drei
Flächen.

> **Folge für die Reihenfolge**: Der Punkt ist aus Schritt 0 von §7
> herausgenommen. Er blockiert **nicht** Phase 2 (Oberflächen zusammenlegen),
> weil das Zusammenlegen ihn weder verbessert noch verschlechtert. Er blockiert
> **Phase 6** (Token-Ökonomie), denn ein Guthaben braucht ein Subjekt.
> Ihn vor Phase 2 zu hängen hätte den Umbau ohne Gewinn aufgehalten.

---

## 4. Oberflächen-Matrix (§34)

| Surface | Route | Zweck | Keep | Merge | Expert | Redirect | Evidenz |
|---|---|---|---|---|---|---|---|
| CreatorDashboard | `/assistant` | Chat-Assistent | ✅ als Standard | — | — | — | `App.tsx:903` |
| GovernanceAiWorkspace | `/app/dashboard` | Governance-Fläche | — | → `/assistant` | ✅ Expert | Alias | `App.tsx:760` |
| DashboardView | `/app/intelligence` | Kennzahlen + Kommando | — | → `/assistant` | ✅ Expert | Alias | `App.tsx:756` |
| CommandSessionPanel | (keine) | Kernel-Panel (PR #1261) | ✅ als Panel | — | ✅ | — | PR #1261, keine Route |
| `/os/app/*` (12 Routen) | `/os/app/…` | Parallelwelt | — | — | — | zu klären | `App.tsx` |
| `/command-center` | — | — | — | — | — | **bereits → `/assistant`** | `App.tsx:603` |
| `/ai-command-center` | — | — | — | — | — | **bereits → `/assistant`** | `App.tsx:604` |
| SuperAdminDashboard u. a. 40 weitere | verschieden | Fachflächen | ✅ | — | — | — | `find`-Liste |

**Die letzten beiden Zeilen sind der Präzedenzfall**: Die vom Auftrag in §25
verlangte Alias-Mechanik ist im Repo bereits erprobt. Sie muss nicht erfunden,
nur ausgeweitet werden.

---

## 5. Vorschlag — eine Shell, zwei Modi

```
                       /assistant
                            │
              ┌─────────────┴─────────────┐
              │                           │
        STANDARD MODE                EXPERT MODE
   (heute CreatorDashboard)   (heute GovernanceAiWorkspace
                               + DashboardView + #1261-Panel)
              │                           │
              └─────────────┬─────────────┘
                            │
                  derselbe Mandant, derselbe Run
                            │
                    Edge Function `ai-gateway`
                        (bereits gemeinsam)
```

`/app/dashboard` und `/app/intelligence` bleiben als **Aliase** bestehen —
nach dem Muster von `/command-center`. CLAUDE.md §12 verbietet das Brechen
öffentlicher Route-Contracts; Weiterleitungen sind ausdrücklich erlaubt.

---

## 6. Was das für PR #1261 heißt

Der Auftrag will #1261 anhalten, bis dieser Entscheid gefallen ist, mit der
Begründung, er baue eine dritte Dashboard-Schicht.

**Gemessen trifft die Begründung nicht zu.** Im Diff von #1261:

| Prüfung | Ergebnis |
|---|---|
| `path=` | **0×** |
| `Route ` | **0×** |
| `App.tsx` berührt | **nein** |
| `/app/intelligence` im Code | **0×** (nur 1× in einer Doku-Zeile des PRs) |

#1261 fügt `src/core/realsync-os/*` (Planner, PolicyEngine, Executor,
Capabilities, CommandCenter), ein Panel (`CommandSessionPanel.tsx`) und
+54 Zeilen in der **bestehenden** `DashboardView` hinzu, dazu drei Testdateien.

Damit ist er **kein Kandidat für eine dritte Schicht, sondern der erste
Baustein des in §43 gezeichneten Kernels** — genau der Ebene, die unter beiden
Modi liegen soll.

**Empfehlung**: #1261 nicht wegen Parallelität blockieren. Zwei Auflagen
bleiben, beide klein:

1. Die Doku-Zeile „an `/app/intelligence` gebunden" korrigieren — sie
   beschreibt eine Route, die der PR nicht anfasst, und hat bereits eine
   Fehlannahme erzeugt.
2. Der Diff entfernt in `DashboardView.tsx` den Kommentar, der erklärt, warum
   Kennzahlen ausschließlich über den Status-Adapter laufen („unterscheidet
   ‚nicht belegbar' von ‚gemessene Null'"). Dieser Kommentar dokumentiert eine
   Governance-Eigenschaft und sollte stehen bleiben.

---

## 7. Umsetzungsreihenfolge (Vorschlag, nicht begonnen)

| Schritt | Inhalt | Voraussetzung |
|---|---|---|
| 1 | Modus-Umschalter in `/assistant` (Standard/Expert) | §10-Freigabe |
| 2 | `GovernanceAiWorkspace` als Expert-Modus einhängen | Schritt 1 |
| 3 | `DashboardView` + Kernel-Panel in Expert-Modus | #1261, Schritt 2 |
| 4 | `/app/dashboard`, `/app/intelligence` → Alias | Schritt 3, Redirect-Tests |
| 5 | `/os/app/*` entscheiden | Eigentümer |

Schritt 1 ändert eine bestehende, backend-gebundene Oberfläche und fällt damit
unter die **Fragepflicht nach CLAUDE.md §10.3** — Wortlaut dort. Er wird nicht
vorab „zum Zeigen" umgesetzt.
