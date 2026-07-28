# RealSync SiteOS — Architektur

**Status**: Phase 1 umgesetzt · **Stand**: 2026-07-28
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
  src/scoring/scores.ts        Befunde → fünf Kennzahlen
  src/agents/registry.ts       Sieben Agenten: Zuständigkeit + Rechte
  src/agents/remediate.ts      Deterministische Behebung
  src/pipeline.ts              Verbindliche Reihenfolge in einem Aufruf

supabase/functions/
  siteos-builder/              Prompt → geprüfter, nachweisbarer Blueprint
  siteos-runtime-scan/         Acht Analysen gegen die Live-Site
  siteos-agents/               Asynchrone Agentenausführung

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

### 3.5 Datenminimierung im Scanner

`siteos-runtime-scan` liest das HTML für die Analyse, speichert es aber nicht.
Persistiert werden nur die abgeleiteten Signale (Header, TTFB, Transfergröße,
Drittanbieter-Hosts, Cookie-Namen). Ein HTML-Archiv fremder Websites wäre eine
Datenhaltung ohne Zweck (Art. 5 Abs. 1 lit. c DSGVO).

---

## 4. Sicherheit

- **Schreibpfade nur über Edge Functions.** Die `siteos_*`-Tabellen haben
  ausschließlich `SELECT`-Policies für Tenant-Mitglieder. Versionsnummern und
  Hash-Verkettung dürfen nicht clientseitig gesetzt werden — sonst ist der
  Prüfpfad manipulierbar.
- **SSRF-Schranke.** `siteos-runtime-scan` ruft eine vom Aufrufer bestimmte URL
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

**Umgesetzt**: Domänenkern mit 84 Tests, AI Builder (Prompt → geprüfter
Blueprint), acht Runtime-Analysen, fünf Kennzahlen, sieben Agenten mit
deterministischer Behebung, Datenmodell mit RLS, drei Edge Functions, Dashboard
unter `/app/siteos`.

**Noch nicht umgesetzt** — bewusst außerhalb dieser Phase:

- **Renderer und Deployment-Pfad.** Der Blueprint beschreibt eine Site
  vollständig, wird aber noch nicht zu HTML gerendert und ausgeliefert. Bis
  dahin arbeitet `siteos-runtime-scan` gegen extern gehostete Adressen. *Das ist
  die größte offene Lücke: ohne Renderer erzeugt der Builder eine geprüfte
  Beschreibung, keine erreichbare Website.*
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
npx vitest run test/siteos/      # 84 Tests des Kerns
supabase db push                 # Migration
supabase functions deploy siteos-builder siteos-runtime-scan siteos-agents
```

Optionale Umgebungsvariable: `SITEOS_BUILDER_MODEL` — Modell-ID für den
Herkunftsnachweis, wenn der Aufruf keine mitgibt. Ohne sie meldet die Analyse
`eu-ai-act.undocumented-model` (Art. 50 EU AI Act).

Bestehende Signaturschlüssel (`PROVENANCE_ED25519_PRIVATE_KEY`,
`PROVENANCE_SIGNING_SECRET`) werden mitgenutzt; neue Schlüssel sind nicht nötig.
