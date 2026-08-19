# RealSync SiteOS — Architektur

**Status**: Phase 1 umgesetzt · **Stand**: 2026-08-01
**Kurzfassung**: SiteOS ist kein Website-Baukasten, sondern die Website-Ebene des
bestehenden Governance-Betriebssystems. Jede Version einer Site ist geprüft,
gehasht und im Herkunftsnachweis erfasst.

---

## 1. Leitentscheidung: Erweiterung statt zweiter Plattform

Der Auftrag nennt als Zielstack Next.js 15 + Cloudflare Pages/Workers in einem
neuen Monorepo (`/apps/web|dashboard|admin`, `/packages/*`). Umgesetzt wurde
stattdessen eine **Erweiterung der bestehenden Plattform**. Die Begründung im
Einzelnen, weil die Abweichung bewusst ist und nicht aus Bequemlichkeit erfolgt:

| Punkt | Neues Next.js-Monorepo | Erweiterung (umgesetzt) |
| --- | --- | --- |
| Auth / Mandantentrennung | Neu aufzubauen | `TenantProvider`, `memberships`, `is_tenant_member()` unverändert nutzbar |
| RLS-Härtung | 25 Tabellen neu abzusichern | Bestehendes Muster fortgeschrieben |
| Governance-Runtime | Zweite, konkurrierende Instanz | SiteOS speist direkt in `incidents`, `governance_admin_log`, Provenance-Kette |
| Evidence / Provenance | Zweite Hash-Kanonisierung — und damit zwei Wahrheiten | Eine Kanonisierung, ein Nachweis |
| Billing (10 Stripe-Functions) | Neu zu verdrahten | Unverändert |
| Öffentliche Routen | Migrationsrisiko, Design-Lock der Startseite betroffen | Nicht angefasst |

Der Ausschlag gab der Nachweis. Ein zweites Deployment mit eigener
Evidence-Implementierung hätte zwei Hash-Ketten für dieselben Objekte erzeugt.
Auf einer Compliance-Plattform ist das kein Redundanz-, sondern ein
Integritätsproblem: Bei Abweichung ist keine der beiden Ketten belastbar.

**Was vom Zielstack übernommen wurde**: React 19, TypeScript (strict),
TailwindCSS, Cloudflare (Pages + Workers, bereits in Betrieb), Supabase,
PostgreSQL, Edge Functions, Stripe, Framer Motion.

**Was bewusst nicht übernommen wurde** — jeweils mit dem, was stattdessen gilt:

- **Next.js 15 / App Router / Server Components** → Die SPA läuft auf Vite 6 als
  statisches Cloudflare-Pages-Artefakt. Serverseitige Arbeit liegt bereits in
  169 Edge Functions; ein zweites Server-Runtime-Modell hätte den Datenzugriff
  gespalten. *Server Components sind damit nicht verfügbar — die aus dem
  Auftrag abgeleitete Anforderung „Server Components bevorzugen" ist im
  Datenpfad dadurch erfüllt, dass Scoring, Verkettung und Persistenz
  ausschließlich serverseitig in Edge Functions stattfinden, nie im Client.*
- **shadcn/ui** → `src/enterprise-os/components` ist das etablierte
  Komponenten-Set des Dashboards. Zwei Design-Systeme nebeneinander wären ein
  dauerhafter Konsistenzbruch.
- **Zustand / TanStack Query / React Flow** → Für den umgesetzten Umfang nicht
  erforderlich; drei Abhängigkeiten ohne aktuellen Nutzen. React Flow wird
  relevant, sobald der visuelle Blueprint-Editor kommt (Phase 2).
- **Getrennte `/apps/web|dashboard|admin`** → Die Trennung existiert bereits als
  Routen-Ebene (`/` öffentlich, `/app/*` auth-gated, `/app/admin/*`).
- **Glassmorphism / Neon-Cyan / Dark First** → `CLAUDE.md` schreibt für
  App/Dashboard Hard-Edge Industrial vor (keine Radien, Obsidian/Titanium).
  Diese Vorgabe hat Vorrang; Cyan wird als Akzentfarbe für SiteOS geführt.
  *Die Startseite (`src/pages/MainLanding.tsx`) ist design-locked und wurde
  nicht berührt.*

---

## 2. Aufbau

```
packages/siteos-core/          Framework- und laufzeitfreier Kern
  src/types.ts                 Domänenmodell (Blueprint, Befund, Score, Agent)
  src/canonical.ts             Kanonisierung + SHA-256 (Nachweis-Anker)
  src/blueprint/industries.ts  Branchen-Presets (Seitenplan + Compliance-Profil)
  src/blueprint/brief.ts       Prompt → Brief (deterministisch, modellfrei)
  src/blueprint/synthesize.ts  Brief → Blueprint
  src/analysis/blueprint.ts    Statische Prüfung (vor Deployment)
  src/analysis/observation.ts  Live-Prüfung (nach Deployment)
  src/render/escape.ts         Escaping + URL-Prüfung (gesamte XSS-Sicherheit)
  src/render/theme.ts          Theme → CSS (Wertprüfung) + WCAG-Kontrast
  src/render/renderer.ts       Blueprint → HTML
  src/deploy/artifact.ts       HTML → Dateibündel mit eigenem Hash
  src/scoring/scores.ts        Befunde → fünf Kennzahlen
  src/agents/registry.ts       Sieben Agenten: Zuständigkeit + Rechte
  src/agents/remediate.ts      Deterministische Behebung
  src/pipeline.ts              Verbindliche Reihenfolge in einem Aufruf

supabase/functions/
  siteos/                      Ein Function-Slot, vier Endpunkte (Router)
    index.ts                   Route-Map
    resolve.ts                 Pfad → Endpunkt (reine Funktion, testbar)
    handlers/discover.ts       Ausgangsseite lesen
    handlers/builder.ts        Prompt → geprüfter, nachweisbarer Blueprint
    handlers/runtime-scan.ts   Acht Analysen gegen die Live-Site
    handlers/agents.ts         Asynchrone Agentenausführung

supabase/migrations/
  20260728000000_siteos_core.sql   4 Tabellen + 1 RPC, additiv, RLS-gehärtet

src/features/siteos/           Dashboard (/app/siteos), lazy-geladen
```

Der Kern läuft unverändert in drei Laufzeiten — Browser (SPA), Deno (Edge
Functions), Node (Vitest). Möglich wird das durch zwei Festlegungen: keine
Abhängigkeiten außer `crypto.subtle`, und explizite `.ts`-Endungen in allen
relativen Importen (Deno verlangt sie, Vite und `tsc` mit
`allowImportingTsExtensions` akzeptieren sie).

---

## 3. Die tragenden Entwurfsentscheidungen

### 3.1 Das Compliance-Gerüst ist modellunabhängig

Der AI Builder trennt zwei Dinge sauber:

- **Deterministisch, regelbasiert**: Branche, Seitenplan, Pflichtseiten,
  Rechtsgrundlagen, Einwilligungsschranken, Transparenzhinweise.
- **Generativ, optional**: Copy, Leistungsbezeichnungen, FAQ-Formulierungen.

`mergeBrief()` lässt Modellvorschläge nur für vier compliance-neutrale Felder zu
(`name`, `summary`, `services`, `locality`). Eine als Zahnarztpraxis erkannte
Site kann durch keinen Modell-Output aus der Art.-9-Behandlung herausfallen.

Das hat einen Preis, der bewusst gezahlt wird: Ohne Modell entstehen generische
Texte. Der Vorteil überwiegt — ein Ausfall des Sprachmodells (Ollama-Ausfall,
Rate-Limit, Anbieterstörung) kostet Textqualität, nie Rechtskonformität. Der
Builder läuft vollständig ohne Modellzugriff.

### 3.2 Ein Blueprint ohne Nachweis gilt als nicht erzeugt

Die Reihenfolge in `pipeline.ts` ist verbindlich: Brief → Blueprint → **Hash** →
Prüfung → Bewertung. Ein Hash über eine ungeprüfte Struktur wäre wertlos.

Jede Version wird über `prev_hash` mit ihrer Vorgängerin verkettet und als
Custody-Event in die bestehende Provenance-Kette (Ed25519, HMAC-Fallback)
eingetragen — dieselbe `appendCustodyEvent()`, die auch der Evidence Vault nutzt.

Erzeugt eine Neugenerierung denselben Hash, wird **keine** neue Version angelegt
(`unchanged: true`). Sonst füllt jeder Klick auf „Neu generieren" die Kette mit
identischen Einträgen und entwertet den Prüfpfad.

### 3.3 Kennzahlen entstehen ausschließlich aus benannten Befunden

Alle fünf Scores sind reine Funktionen von `RuntimeFinding[]`. Keine verdeckten
Eingaben, keine Zufallsanteile. Jede Zahl im Dashboard ist bis auf einen
einzelnen Befund mit Rechtsnorm und Behebungsschritt zurückführbar — das ist die
Bedingung dafür, dass sie in einem Audit standhält.

Gewichte und Abzüge stehen zentral in `scoring/scores.ts`, weil sie in
Kundenberichten zitiert werden. **Eine Änderung dort ist versionsrelevant** und
verschiebt historische Vergleichbarkeit.

Ein kritischer Befund erhält einen Risiko-Aufschlag (`CRITICAL_RISK_SURCHARGE`).
Ohne ihn verschwindet ein einzelner schwerer Verstoß im gewichteten Mittel einer
sonst sauberen Site — genau der Fall, den das Risikomaß sichtbar machen soll.

### 3.4 Agenten reparieren nur, was genau eine richtige Lösung hat

`remediate.ts` behebt acht Befundklassen automatisch (fehlende Pflichtseite,
fehlende Rechtsgrundlage, fehlende Einwilligungsschranke, fehlender
Transparenzhinweis, fehlende Meta-Beschreibung …). Alles, was eine
redaktionelle oder rechtliche Entscheidung verlangt, bleibt liegen und wird als
`skipped` mit Begründung zurückgemeldet.

Ein automatisch erfundener Alternativtext oder eine erfundene Bewertung wäre
schlimmer als ein offener Befund, weil sie ihn verdeckt — im Fall der
Bewertungen zusätzlich irreführende Werbung nach § 5 UWG.

Agenten mit `requiresApproval` (Compliance, Content) warten im Zustand
`awaiting_approval`. Blueprint-ändernde Agenten schreiben **nie** in eine
bestehende Version, sondern erzeugen eine neue, verkettete — die alte bleibt
mitsamt Nachweis gültig.

### 3.5 Der Renderer löst ein, was der Blueprint verspricht

Ein Compliance-Versprechen im Blueprint ist wertlos, wenn es die
Auslieferung nicht erreicht — für einen Prüfer existiert nur, was im
ausgelieferten HTML steht. Der Renderer ist deshalb gegen die
Live-Analysatoren gebaut, nicht neben ihnen:

| Zusage im Blueprint | Umsetzung im HTML | Geprüft durch |
| --- | --- | --- |
| Standardsprache | `lang` am `<html>` | `accessibility.missing-lang` |
| Seitenbeschreibung | `<title>`, `meta[description]`, `link[rel=canonical]` | `seo.*-not-delivered` |
| Seitenstruktur | genau eine `<h1>` je Seite | `seo.missing-h1` / `seo.multiple-h1` |
| Pflichtseiten | Footer-Links auf Impressum/Datenschutz | `gdpr.*-link-not-delivered` |
| Generierter Inhalt | `data-ai-disclosure` | `eu-ai-act.disclosure-not-delivered` |
| Formularfelder | verbundenes `<label>` je Feld | `accessibility.form-without-labels` |
| Einwilligungsschranke | kein `src`/`iframe`, nur `data-consent-src` | `tdddg.third-party-before-consent` |

Diese Kopplung ist getestet: `test/siteos/render.test.ts` schickt den
gerenderten Output durch `analyzeObservation` und verlangt **null Befunde**
— für jede Seite, über mehrere Branchen. Bricht der Renderer eine Zusage,
schlägt der Test fehl, nicht erst ein Kunde.

Der Renderer ist ebenfalls deterministisch: gleicher Blueprint ⇒
byte-gleiches HTML. Damit ist auch das Auslieferungsartefakt hashbar.

**Escaping ist die gesamte Sicherheitsgrenze.** Der Renderer baut Strings,
nicht ein DOM (er muss in Deno ohne DOM laufen). Blueprint-Inhalte stammen
aus Prompts und Modellausgaben — beides nicht vertrauenswürdig. Deshalb
läuft jeder Wert durch `escape.ts`:

- `escapeHtml` deckt Inhalt UND Attribute mit einer Funktion ab; zwei
  Varianten laden dazu ein, im Zweifel die schwächere zu nehmen.
- `safeUrl` lässt nur `http`/`https`/`mailto`/`tel` und echte relative
  Pfade durch — `javascript:`, `data:` und protokollrelative `//host`
  werden verworfen, nicht escaped.
- `jsonLdPayload` escaped zusätzlich `<`, `>`, `&` und U+2028/U+2029, damit
  ein `</script>` in einem Namen den JSON-LD-Block nicht beenden kann.

### 3.6 CSS lässt sich nicht escapen — nur verwerfen

Die Theme-Werte stammen aus dem Blueprint und damit mittelbar aus Prompt
oder Modellausgabe. Ein Wert wie

```
accent: "red } body { display: none } .x {"
```

würde in einem naiv zusammengesetzten Stylesheet ausbrechen. Anders als bei
HTML gibt es dagegen **kein Escaping** — CSS kennt keine Entity-Schreibweise,
die einen Wert neutralisiert.

`render/theme.ts` folgt deshalb derselben Linie wie `safeUrl`: jeder Wert
muss ein enges Muster erfüllen, sonst greift der dokumentierte Default.
`var()`, `url()` und `calc()` sind ausgeschlossen — alle drei erlauben
Konstruktionen, die ausbrechen oder externe Ressourcen laden. Das
Stylesheet enthält damit ausschließlich Werte, die dieses Modul selbst
gebilligt hat.

Der Umfang des Stylesheets ist bewusst klein: Kontrast, Zeilenlänge,
sichtbarer Fokus (`:focus-visible` wird nie auf `none` gesetzt),
fokussierbare Sprungmarke und `prefers-reduced-motion`. Das ist
Grundbedienbarkeit, kein Design-System.

`contrastRatio()` und `meetsWcagAA()` rechnen nach WCAG 2.2 — 1.4.3.

Die beiden Funktionen behandeln nicht bestimmbare Farben (benannt,
funktional) **absichtlich unterschiedlich**, und der Unterschied ist der
Punkt:

- `meetsWcagAA()` wertet `null` als *nicht bestanden* — richtig für ein
  Gate, das im Zweifel blockiert.
- Der Analysator (`accessibility.insufficient-contrast`) meldet bei `null`
  **nichts**. Ein Befund über eine nicht berechenbare Farbe wäre eine
  Falschmeldung im Kundenbericht — `rebeccapurple` ist nicht berechenbar,
  aber deswegen nicht schlecht.

**Der Check hat sofort einen echten Defekt gefunden:** das Marken-Blau
#0052FF erreicht auf Obsidian nur **3.44:1** und verfehlt AA. Als
Default-Akzent generierter Seiten hätte das jede Site mit einem
hochstufigen Barrierefreiheits-Befund ausgeliefert. Der Default ist
deshalb auf **#4C82FF** (5.60:1, gleiche Farbfamilie) geändert; das
Dashboard behält das Marken-Blau. Zwei Tests halten Messwert und
Entscheidung fest, damit sie nicht versehentlich zurückgedreht werden.

### 3.7 Die Nachweiskette endet nicht am Blueprint

Ein Prüfer sieht nicht den Blueprint, sondern die ausgelieferten Dateien.
Eine Kette, die vor dem letzten Schritt aufhört, belegt nicht, was
tatsächlich im Netz stand. `deploy/artifact.ts` schließt sie:

```
Blueprint-Hash → Artefakt-Hash → veröffentlichte Site
```

Der Artefakt-Hash deckt Pfade **und** Inhalte ab — nur die Inhalte zu
hashen würde ein Umbenennen von Seiten verschweigen. Die Dateiliste wird
vor dem Hashen nach Pfad sortiert: eine reine Umsortierung der Seiten im
Blueprint ändert nichts an der ausgelieferten Site und darf deshalb den
Hash nicht ändern. Beide Eigenschaften sind getestet.

### 3.8 Datenminimierung im Scanner

`siteos/runtime-scan` liest das HTML für die Analyse, speichert es aber nicht.
Persistiert werden nur die abgeleiteten Signale (Header, TTFB, Transfergröße,
Drittanbieter-Hosts, Cookie-Namen). Ein HTML-Archiv fremder Websites wäre eine
Datenhaltung ohne Zweck (Art. 5 Abs. 1 lit. c DSGVO).

---

## 4. Sicherheit

- **Schreibpfade nur über Edge Functions.** Die `siteos_*`-Tabellen haben
  ausschließlich `SELECT`-Policies für Tenant-Mitglieder. Versionsnummern und
  Hash-Verkettung dürfen nicht clientseitig gesetzt werden — sonst ist der
  Prüfpfad manipulierbar.
- **SSRF-Schranke.** `siteos/runtime-scan` ruft eine vom Aufrufer bestimmte URL
  ab. Erlaubt sind nur `http`/`https` auf Standard-Ports und öffentliche Hosts;
  private Adressliterale (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, IPv6
  ULA/Link-local) und interne Namen werden abgewiesen.
  *Bekannte Grenze:* DNS-Rebinding ist damit nicht ausgeschlossen — dafür müsste
  der Host vor dem Abruf aufgelöst und die Verbindung an die geprüfte IP
  gebunden werden. Der Filter senkt die Angriffsfläche, ersetzt aber keine
  Netzsegmentierung.
- **Mandantenprüfung vor jeder Operation** über `memberships`; fremde
  Blueprint-IDs sind nicht adressierbar (Abfragen sind tenant-gefiltert).
- **Fremde IDs im Freigabepfad**: `approve` greift nur auf Läufe im Zustand
  `awaiting_approval` desselben Mandanten; alles andere liefert 409.
- **Doppelausführung**: Der Übergang `queued → running` läuft als bedingtes
  UPDATE. Treffen SPA-Klick und Cron gleichzeitig ein, gewinnt genau einer.

---

## 5. Integration in die bestehende Governance-Runtime

| SiteOS-Ereignis | Wirkung im Bestand |
| --- | --- |
| Blueprint erzeugt | Custody-Event in `provenance_manifests` / `provenance_custody_events` |
| Blueprint erzeugt / Agent ändert | Eintrag in `governance_admin_log` (Prüfpfad) |
| Kritischer Live-Befund | `incidents`-Datensatz mit 72-h-Frist (Art. 33 DSGVO) |
| Compliance-Profil | verweist auf `policy_packs` und `governance_controls` |
| Site | optional an `website_projects` gebunden — Domains, Deployment-Logs und Cloudflare-Anbindung werden wiederverwendet, nicht nachgebaut |

---

## 6. Stand und Grenzen

**Umgesetzt**: Domänenkern mit 155 Tests, AI Builder (Prompt → geprüfter
Blueprint), Renderer (Blueprint → HTML, gegen die Live-Analyse abgesichert),
acht Runtime-Analysen, fünf Kennzahlen, sieben Agenten mit deterministischer
Behebung, Datenmodell mit RLS, drei Edge Functions, Dashboard unter
`/app/siteos`.

**Noch nicht umgesetzt** — bewusst außerhalb dieser Phase:

- **Deployment-Pfad.** Der Renderer erzeugt das HTML (siehe §3.5), aber es
  wird noch nicht auf Cloudflare Pages hochgeladen und unter einer Domain
  veröffentlicht. Das ist die verbliebene Hälfte der ursprünglich größten
  Lücke: aus dem Blueprint entsteht jetzt ein vollständiges, geprüftes
  Auslieferungsartefakt — was fehlt, ist der Upload samt Domain-Anbindung.
  Dafür sind Cloudflare-Zugangsdaten und eine Entscheidung über das
  Deployment-Ziel nötig (`website_projects.cloudflare_project_id` ist
  vorbereitet). Bis dahin arbeitet `siteos/runtime-scan` gegen extern
  gehostete Adressen.
- **Rechtstexte im gerenderten HTML.** Der Renderer setzt für
  `legal-text`-Blöcke nur die Stelle (`<!-- legal:content -->`) und das
  `data-legal-document`-Attribut. Der Text selbst kommt zur Build-Zeit aus
  dem Legal-Modul (`scripts/generate-static-legal-pages.mjs`) — der
  Renderer erfindet keinen Rechtstext.
- **Keine Komponentenbibliothek.** Das Stylesheet deckt Grundgestaltung ab
  (Kontrast, Zeilenlänge, Fokus, Sprungmarke); Layout-Varianten je Block
  fehlen.
- Visueller Drag-&-Drop-Editor (React Flow)
- Mehrsprachigkeit über die Modellebene hinaus (`locales` ist vorbereitet,
  Übersetzungspfad fehlt)
- White-Label, SSO, öffentliche API, Audit-Export für SiteOS-Objekte
- Anbindung der Agenten an den bestehenden Cron
  (`governance-monitoring-scheduler`) — heute werden sie aus der SPA angestoßen
- Theme Engine und Component Library als Rendering-Artefakte

---

## 7. Betrieb

```bash
npm run lint                     # tsc --noEmit
npx vitest run test/siteos/      # 155 Tests des Kerns
supabase db push                 # Migration
supabase functions deploy siteos            # ein Slot, vier Endpunkte
```

Optionale Umgebungsvariable: `SITEOS_BUILDER_MODEL` — Modell-ID für den
Herkunftsnachweis, wenn der Aufruf keine mitgibt. Ohne sie meldet die Analyse
`eu-ai-act.undocumented-model` (Art. 50 EU AI Act).

Bestehende Signaturschlüssel (`PROVENANCE_ED25519_PRIVATE_KEY`,
`PROVENANCE_SIGNING_SECRET`) werden mitgenutzt; neue Schlüssel sind nicht nötig.
