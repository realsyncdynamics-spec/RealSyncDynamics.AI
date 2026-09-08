# RealSync OS — Ist-Zustand (Phase 0)

**Gemessen am 2026-09-08** gegen `main` @ `9587905` (Branch
`claude/realsync-os-consolidation-6ubnxq` steht zeichengleich auf diesem Commit).
Alle Zahlen stammen aus dem Merge-Baum bzw. der GitHub-API, **nicht** aus
fortgeschriebenen Angaben früherer Dokumente.

> **Klassifikation nach §40 des Auftrags**: `LIVE` · `PARTIAL` · `PROTOTYPE` ·
> `PLANNED` · `UNKNOWN`. Kein Punkt wird ohne Beleg von `PLANNED` nach `LIVE`
> gehoben.

---

## 1. Die drei Kennzahlen des Auftrags — und was daran nicht stimmte

Der Auftrag geht von der Annahme aus, PR #1261 baue ein neues
`/app/intelligence` Command Center und drohe damit als **dritte** parallele
Dashboard-Schicht. Beide Hälften dieser Annahme sind an der Messung
gescheitert:

| Annahme im Auftrag | Messung | Beleg |
|---|---|---|
| „#1261 baut `/app/intelligence`" | **Die Route existiert seit jeher auf `main`** | `src/App.tsx:756` |
| „#1261 fügt eine Dashboard-Schicht hinzu" | **#1261 fügt keine einzige Route hinzu** | im Diff: `path=` 0×, `Route ` 0×, `App.tsx` nicht berührt |
| „dann hätten wir drei Dashboards" | **Wir haben die drei bereits heute, ohne #1261** | siehe §2 |

**Die Konsolidierungsaufgabe ist damit keine `#1261`-Aufgabe, sondern eine
`main`-Aufgabe.** Sie besteht unabhängig davon, ob dieser PR gemergt wird.

Ein echter Befund bleibt trotzdem: Das PR-eigene Dokument
`docs/product/realsync-os-command-center.md` behauptet, der Kernel sei „an
`/app/intelligence` gebunden". Der Code bindet ihn an
`src/features/dashboard/DashboardView.tsx`. Dass diese Datei *zufällig* unter
`/app/intelligence` gerendert wird, macht die Aussage nicht richtig — sie
beschreibt eine Route, die der PR nie anfasst. Genau aus dieser Zeile ist die
Fehlannahme des Auftrags entstanden.

---

## 2. Die Oberflächen — Status `LIVE`

**Drei angemeldete Arbeitsflächen stehen heute nebeneinander auf `main`:**

| Route | Rendert | LOC | Gateway | Tenant-Kontext |
|---|---|---|---|---|
| `/assistant` | `pages/CreatorDashboard` | 599 | `processAIGatewayRequest` (`core/ai-gateway/gateway`) | **kein `useTenant`** |
| `/app/dashboard` | `DashboardRouter` → `GovernanceAiWorkspace` | 182 | `AiGatewayEdgeClient` (`core/ai-gateway/edgeClient`) | `useTenant` |
| `/app/intelligence` | `features/dashboard/DashboardView` | — | (bis #1261 keiner) | `tenantId` |

**Die gute Nachricht zuerst, weil sie die Konsolidierung entscheidet:** Beide
KI-Flächen laufen am Ende auf **dieselbe** Edge Function `ai-gateway`.
`gateway.ts:17` importiert `AiGatewayEdgeClient` und delegiert dorthin
(`gateway.ts:95`). Es gibt **keine** zweite Laufzeit, **kein** zweites
Modell-Routing, **keinen** zweiten Schlüsselpfad. Kein Secret verlässt den
Browser: `gateway.ts:97` benutzt den Anon-Key, die Provider-Schlüssel liegen
wie vorgeschrieben in `Deno.env` der Edge Function.

> **Folge für §38 (Reihenfolge)**: Die Dashboard-Konsolidierung ist ein
> **Zusammenlegen von Oberflächen**, keine Neuimplementierung eines Kerns. Das
> ist erheblich billiger als der Auftrag unterstellt — und es entkräftet die
> Sorge aus §18, es könne ein zweiter Agent-Runtime entstehen. Er ist nicht da.

**Der schwerwiegendste Befund dieses Dokuments — nachgemessen am 2026-09-08**:

Die erste Fassung hielt hier fest, `CreatorDashboard` importiere als einzige
der drei Flächen kein `useTenant`, und leitete daraus einen Zweifel an
`/assistant` ab. Die Nachmessung zeigt: **Der Befund ist richtig, die
Zuordnung war falsch — und die Lage ist breiter.**

**Kein einziger KI-Aufruf im Produkt trägt Mandanten- oder Nutzeridentität.**
Gemessen über alle fünf Aufrufstellen (`CreatorDashboard`, `KodeeView`,
`GovernanceAiWorkspace`, `auditCopilotApi`, `assistantQuickChatApi`):

| Stelle | Beleg |
|---|---|
| Jeder Aufruf sendet den **Anon-Key** als Bearer-Token | `edgeClient.ts:103–104`, alle fünf Aufrufer nutzen `getSupabaseAnonKey()` |
| **Kein** Aufrufer setzt `tenantId` | das Feld `GatewayRequest.tenantId` ist unbenutzt |
| Selbst wenn er es täte, käme es nicht an | `ai-gateway/index.ts:109` setzt `tenant_id: null` **fest** |
| Die Function ist sich dessen bewusst | Kommentar Z. 64: „Der Gateway hat heute keinen Tenant-Kontext — es greifen ausschließlich GLOBALE `ai_policies`" |

Das ist also **kein Versehen einer Fläche**, sondern eine dokumentierte
Eigenschaft des gesamten KI-Pfades. `verify_jwt = true` ist erfüllt (der
Anon-Key *ist* ein gültiges Projekt-JWT), die Function läuft — sie sieht nur
niemanden.

**Was daraus folgt, und das ist der eigentliche Punkt:**

1. **Kontingente sind am Gateway nicht durchsetzbar.**
   `limit.ai_calls_monthly`, `limit.ai_tokens_monthly` und
   `limit.llm_queries_monthly` stehen in `shared/pricing.ts` — durchgesetzt
   wird an dieser Stelle **nichts** davon. Die Suche nach Quota-Code in der
   Function ist leer, und das ist keine Auslassung, sondern die Folge: Ohne
   Subjekt gibt es nichts, wogegen man durchsetzen könnte.
2. **Durchgesetzt wird stattdessen nach IP** — `enforceRateLimit`,
   voreingestellt 10/Minute und 100/Stunde, im Arbeitsspeicher je Instanz
   (bei Kaltstart zurückgesetzt, im Code so vermerkt). Das ist ein
   Missbrauchsschutz, keine Abrechnung. Ein Enterprise-Kunde mit 50
   Arbeitsplätzen hinter **einer** NAT-Adresse teilt sich einen 10er-Eimer;
   derselbe Kunde auf 50 Adressen bekommt das Fünfzigfache.
3. **Die Token-Ökonomie (§12 des Auftrags) ist genau hier blockiert.** Ein
   Guthabenmodell setzt voraus, dass bekannt ist, wessen Guthaben belastet
   wird.
4. **Der Anon-Key ist per Definition öffentlich** (CLAUDE.md §2). Wer die
   Seite lädt, kann `POST /functions/v1/ai-gateway` auch ohne Konto rufen,
   begrenzt allein durch die IP-Fenster. Das ist das Missbrauchsszenario aus
   §30 des Auftrags — bemessen, nicht dramatisiert: begrenzt, aber real und
   nicht einem Konto zurechenbar.

**Für die Konsolidierung heißt das etwas Erfreuliches**: Der Mandantenbezug ist
**kein** Argument für oder gegen eine der drei Flächen — alle drei sind gleich
betroffen. Er ist eine eigene Aufgabe, eine Ebene tiefer, und sie gehört vor
Phase 6 erledigt, nicht vor Phase 2.

---

## 3. Oberflächen-Wildwuchs — Status `LIVE`, und das ist das Problem

| Gemessen | Zahl | Methode |
|---|---|---|
| Routen in `src/App.tsx` | **480** | `grep -oE 'path="[^"]*"' \| sort -u` |
| davon Weiterleitungen | 48 | `grep -c 'Navigate to='` |
| Dashboard-artige Dateien | **47** | `find src -name '*Dashboard*\|*Workspace*\|*CommandCenter*\|*Shell*'` |
| Seiten in `src/pages/` | 114 | `ls src/pages/*.tsx \| wc -l` |
| `AppGate`-geschützt | 56 | `grep -c 'AppGate'` |
| in `GovernanceBrowserShell` | 129 | `grep -c 'GovernanceBrowserShell'` |

**Mehrfache Einstiege in denselben Zweck** (vollständige Liste in
`docs/architecture/route-inventory.md`):

- **Scan/Audit**: `/audit` · `/scan` · `/scan/start` · `/unified-entry/scan` ·
  `/optimizer/scan` · `/claude-code-optimizer/scan` · `/os/audit` ·
  `/audit-pro` · `/marisk-audit` · `/cookie-scanner` · `/tools/cookie-scanner`
- **Anmeldung**: `/login` · `/signup` · `/register` · `/welcome` · `/os/login` ·
  `/os/signup` · `/os/welcome` · `/unified-entry/register` · `/demo-login` ·
  `/demo-tour/signup`
- **Preise**: `/pricing` · `/pricing/:slug` · `/pricing/whatsapp` ·
  `/os/pricing` · `/optimizer/pricing` · `/governance-os-pricing`
- **Kasse**: `/checkout/:planKey` · `/os/checkout` · `/optimizer/checkout` ·
  `/demo-tour/checkout` (+ `success`/`cancelled`)

Der `/os/*`-Zweig (23 Routen) ist dabei die auffälligste geschlossene
Parallelwelt: eigene Anmeldung, eigene Preisseite, eigene Kasse, eigene
`/os/app/*`-Ebene mit 12 Routen.

**Der Auftrag hat hier recht, und die Messung stützt ihn stärker als seine
eigene Begründung**: Nicht #1261 erzeugt Parallelität — sie ist der Normalfall
im Bestand.

---

## 4. Was bereits kanonisch ist — Status `LIVE`

Damit die Konsolidierung nichts neu erfindet, was schon steht:

| Gegenstand | Kanonische Quelle | Status |
|---|---|---|
| Preise, Pläne, Berechtigungen | `shared/pricing.ts` | `LIVE`, eine Quelle |
| Dashboard-Gates (Route → Entitlement) | `src/core/access/featureAccess.ts` (150 Z., 26 Routen) | `LIVE` |
| Modell-Routing, Provider, Schlüssel | Edge Function `ai-gateway` | `LIVE`, eine Laufzeit |
| Seitenoperationen des Blueprints | `packages/siteos-core/.../pages.ts` | **erst mit PR #1260** |
| Deployment | Cloudflare Pages (`wrangler.toml`) | `LIVE` |

**Vercel-Prüfung nach §19**: kein `vercel.json`, **0** Vercel-Treffer in
`package.json`. Die Vorgabe „Vercel nicht wieder einführen" ist im Ist-Zustand
eingehalten.

**Der Kernel-Vorgriff**: `/command-center` und `/ai-command-center` leiten
bereits heute auf `/assistant` weiter (`src/App.tsx:603–604`). Die vom Auftrag
in §25 verlangte Alias-Mechanik existiert also schon als Muster — sie ist nur
nie auf `/app/dashboard` und `/app/intelligence` angewandt worden.

---

## 5. Token-Ökonomie — Status `PARTIAL`

Der Auftrag (§12) behandelt Tokens als neu einzuführen. Vorhanden sind
bereits:

- Tabellen `public.token_usage` und `agent_token_usage`
- Migrationen `20260515700000_token_tracking`,
  `20260705100000_enable_ai_token_metering`, `20260706011047_agent_token_budget`,
  `20260901010000_agent_os_runner_token`
- Kontingent-Schlüssel `limit.ai_tokens_monthly`, `limit.ai_cost_monthly_cents`,
  `limit.ai_calls_monthly`, `limit.llm_queries_monthly` in `shared/pricing.ts`

**Was fehlt**, und deshalb `PARTIAL`: kein Guthabenbegriff (Verbrauch wird
gezählt, ein Restwert nicht geführt), kein Nachkauf, keine kundensichtbare
Anzeige. Einzelheiten und die offene Kostenfrage:
`docs/product/token-economy.md`.

---

## 6. Trial und Free Scan — Status `LIVE`, entgegen der Annahme des Auftrags

§26 verlangt einen 14-Tage-Trial als „echten Produktzustand". Gemessen in
`shared/pricing.ts`:

| Plan | `trialDays` |
|---|---|
| Free Audit | 0 |
| **Starter** | **14** |
| **Growth** | **14** |
| Agency · Enterprise · Partner | 0 |

Der 14-Tage-Trial ist auf beiden Self-Service-Plänen bereits hinterlegt. Zu
bauen ist er nicht; zu prüfen ist, ob der Funnel ihn erreicht — siehe
`docs/product/onboarding-funnel.md`.

---

## 7. Ruhende Bestandteile — Status `PROTOTYPE`, mit einem Betriebsbefund

`platform/` (Python/FastAPI + Next.js, per `docker compose`) ist von der
Root-`package.json` **0×** referenziert — die Einstufung als ruhend aus
CLAUDE.md §7 hält der Messung stand.

**Aber**: `platform/**` steht in der **Einschluss**-Liste von
`.github/workflows/deploy-cloudflare-pages.yml` (Zeilen 8 und 23, unter
`paths:`, nicht `paths-ignore:`). Eine Änderung an einem ruhenden Python-Dienst
löst damit ein Cloudflare-Pages-Deploy der Vite-SPA aus, obwohl der SPA-Build
kein Byte aus `platform/` liest. Kein Sicherheitsproblem, aber ein
Deploy-Auslöser ohne Ursache — und er widerspricht der Einstufung „ruhend"
genau dort, wo sie durchgesetzt werden müsste.

---

## 8. Was dieses Dokument **nicht** gemessen hat

Damit die nächste Sitzung nicht Lücken für Befunde hält:

- **Kein Zugriff auf die Live-Datenbank** in dieser Sitzung. Alle Aussagen zu
  Produktion stammen aus dem Repo. Die in CLAUDE.md §5 beschriebene Regel
  (vor Produktionsaussagen gegen die Live-DB messen) ist hier **nicht**
  erfüllt — deshalb steht in diesem Dokument keine einzige Aussage über
  Produktionsdaten.
- **Kein gerendertes Bild.** Die Bewertung der beiden Oberflächen beruht auf
  Code, nicht auf dem Browser. CLAUDE.md §10 (Freigabe 2026-09-01 (3)) hält
  ausdrücklich fest, dass zwei Befunde nur im Rendering sichtbar waren.
- **Die 30 Nebenrepositories** sind nach Metadaten klassifiziert, nicht nach
  Inhalt — siehe `docs/architecture/repository-inventory.md`.
- **Keine Kostenrechnung.** §30 verlangt sie vor der Preisfestlegung; sie ist
  in Phase 0 nicht geleistet und blockiert damit §11 und §27.
