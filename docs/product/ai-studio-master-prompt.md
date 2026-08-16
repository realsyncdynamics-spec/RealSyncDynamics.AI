# Master-Prompt: RealSyncDynamics.AI Frontend (Google AI Studio)

**Zweck**: Ein einziger Prompt, der die komplette neue Oberfläche vorgibt — Routing,
Screens, Komponenten, Mobile, Dashboard, AI Workspace, Feature-/Billing-Ebene und
die Anbindung an das **bestehende** Backend.

**Stand**: 2026-08-16 · Grundlage: `docs/architecture/target-architecture.md`,
`docs/architecture/asset-lifecycle-contract.md`, `CLAUDE.md`

---

## Vor dem Absenden: drei Entscheidungen

Der Prompt unten enthält an drei Stellen eine Vorbelegung. Wer sie anders will,
ändert genau diese Zeilen — sonst generiert das Modell an der Realität vorbei.

| # | Entscheidung | Stand | Warum das zählt |
| --- | --- | --- | --- |
| 1 | **Sprache der Oberfläche** | **Deutsch — entschieden (2026-08-16)** | Die Screen-Spezifikation ist auf Englisch verfasst, das bestehende Produkt (`/app`, Landing, Rechtstexte, Fehlermeldungen) ist durchgehend deutsch. Zwei Sprachen im selben Dashboard sind kein Stilproblem, sondern ein Vertrauensproblem. **Alle sichtbaren Texte, Beschriftungen, Zustände, Fehlermeldungen und Leerzustände sind deutsch — ohne Ausnahme.** Englisch bleibt nur in Code-Bezeichnern und Maschinen-Schlüsseln. |
| 2 | **Startseite** | **nicht anfassen** | `src/pages/MainLanding.tsx` ist design-locked (`CLAUDE.md` §10, Baseline `3b972f3`). Screen 1 der Spezifikation ist ein Neuentwurf und braucht eine ausdrückliche Freigabe. Der Prompt legt sie deshalb unter einer **neuen Route** an, statt die bestehende zu überschreiben. |
| 3 | **Preise im UI** | **aus der SSoT** | Alle Beträge in der Spezifikation (79 €, 18,40 €, 29 €/Monat …) sind Beispielwerte. Hartkodiert wären sie sofort falsch. |

---

## Der Prompt

Ab hier alles kopieren.

---

Du baust die neue Oberfläche für **RealSyncDynamics.AI**, eine EU-souveräne AI-Governance-Plattform.

## 0. Die wichtigste Regel

**Ändere kein Backend, keine Geschäftslogik, kein Datenmodell und keine Authentifizierung.**
Du baust ausschließlich eine neue Frontend-Erfahrung um die **vorhandenen** APIs,
Authentifizierung, Datenmodelle und Backend-Dienste herum. Vorhandene Funktionalität
und Integrationen bleiben erhalten.

Konkret verboten:
- Keine neuen Tabellen, keine Migrationen, keine geänderten Edge Functions.
- Keine neuen Endpunkte. Wenn dir Daten fehlen, zeige den Zustand „nicht verfügbar" —
  erfinde keinen Endpunkt und keine Zahl.
- Keine Änderung an Auth-Flows, Tenant-Auflösung oder Berechtigungslogik.

## 0.1 Sprache: Deutsch — ohne Ausnahme

**Jeder sichtbare Text ist deutsch**: Überschriften, Beschriftungen, Buttons,
Navigations­einträge, Zustandsanzeigen, Fehlermeldungen, Leerzustände, Tooltips,
`aria-label`s, Datums- und Zahlenformate (`de-DE`, `Intl.NumberFormat('de-DE')`).

Englisch bleibt ausschließlich in Code-Bezeichnern, Maschinen-Schlüsseln und
etablierten Fachbegriffen, die das Produkt bereits führt (z. B. „Evidence Vault",
„Governance Score", „AI Workspace" als Produktnamen). Zustandswerte wie
`ACTIVE`/`AVAILABLE` aus dem Datenmodell werden in der Anzeige übersetzt
(„Aktiv" / „Verfügbar") — der Schlüssel bleibt englisch, die Anzeige nicht.

Etablierte Terminologie des Produkts: „Prüfpfad" statt „Audit Trail",
„Herkunftsnachweis" statt „Provenance". Ein Screen, der englische UI-Texte
enthält, gilt als nicht abgenommen.

## 1. Technischer Rahmen — nicht verhandelbar

| Baustein | Vorgabe |
| --- | --- |
| Build | **Vite 6**, Ausgabe nach `dist/` |
| UI | **React 19** + TypeScript 5.8, `"strict": true` |
| Routing | **react-router-dom 7**, clientseitig, Routen in `src/App.tsx` |
| Styling | **Tailwind 4** über `@tailwindcss/vite`, Tokens aus `tailwind.config.ts` |
| Icons | `lucide-react` |
| Animation | `framer-motion` (sparsam) |
| Daten | `@supabase/supabase-js` über den vorhandenen Client `src/lib/supabase.ts` |

**Ausdrücklich nicht verwenden:** Next.js, App Router, Server Components, `"use client"`,
shadcn/ui, Vercel-Pakete, neue UI-Bibliotheken, neue State-Manager, `zod`.
Es gibt kein `app/`-Verzeichnis. Vorschläge mit diesen Bausteinen sind falsch.

Öffentliche Seiten liegen in `src/pages/` und werden in `src/App.tsx` **eager**
importiert (SEO, Prerendering). Auth-geschützte Module liegen in `src/features/<name>/`
und werden **lazy** geladen, hinter `<ProtectedRoute>`.

## 2. Design-Tokens

Aus `tailwind.config.ts`, nicht neu erfinden:

```
obsidian       #0A0A0B     App-Hintergrund
titanium       #E2E2E2     Text auf dunklem Grund
security-blue  #0052FF     Marken-Akzent (App)
petrol         #0F766E     Akzent (öffentliche Seiten)
```

Utilities vorhanden: `.glass`, `.glass-subtle`, `.glass-strong`, `.glass-petrol`,
`.glass-blue`, `.gradient-petrol-blue`, Radien `rounded-chip|card|panel`.

**App/Dashboard**: Hard-Edge Industrial, keine runden Ecken, Obsidian/Titanium.
**Öffentliche Seiten**: helles „European Enterprise Trust"-Theme, Petrol als Akzent.
**Monospace** durchgängig für Metadaten (IDs, Codes, Scores, Zeitstempel).

Kontrast: **#0052FF auf Obsidian erreicht nur 3,44:1 und verfehlt WCAG AA.**
Für Text auf dunklem Grund `#4C82FF` (5,60:1) verwenden; das Marken-Blau bleibt
Flächen und Rahmen vorbehalten.

## 3. Die Wahrheitsregel — der häufigste Fehler in generierten Dashboards

Jede angezeigte Kennzahl braucht eine benannte Quelle. Es gibt genau drei Zustände:

```
Wert vorhanden        → Zahl anzeigen
gemessene Null        → "0" anzeigen
nicht belegbar/Fehler → "—" anzeigen
```

**Niemals** einen Platzhalter zeigen, der wie ein Messwert aussieht. Kein `87/100`,
kein `1.248 Evidence`, kein `94,2 %` als Blindtext. Eine leere Tabelle und eine
fehlgeschlagene Abfrage sind **nicht** dasselbe wie eine gemessene Null.

Es existiert dafür bereits ein Adapter — benutze ihn, baue keinen zweiten:

```ts
import { loadTenantStatus, formatMetric, EMPTY_TENANT_STATUS,
         loadPlatformHealth, type TenantStatus } from '@/lib/status/statusAdapter';

// MetricValue = number | null      null bedeutet „nicht belegbar", nicht „null Stück"
formatMetric(status.aiSystems)          // "4" | "0" | "—"
formatMetric(status.compliancePercent, '%')
```

Dasselbe gilt für Statusbeschriftungen. Ein Badge „ACTIVE", „LIVE", „MONITORED" oder
„VERIFIED" darf nur erscheinen, wenn der Zustand aus Daten folgt. Sonst: `PENDING`
oder `UNKNOWN`. Beispielhafte Panels werden sichtbar als **BEISPIEL** gekennzeichnet.

## 4. Preise, Pläne, Berechtigungen

`shared/pricing.ts` ist die einzige Quelle. Beträge, Limits, Modul- und
Feature-Listen **niemals** ins UI schreiben.

```ts
import { planById, formatLimit, hasPermission, hasModule, limitOf,
         checkoutHrefForPlan, ONE_TIME_PRICING_TIERS } from '@/shared/pricing';
```

Zugriff wird **nie** über Plan-Namen entschieden:

```ts
if (plan === 'agency') { … }          // ✗ falsch
hasModule(plan, 'evidence_vault')      // ✓ richtig
```

Es gibt sechs Abo-Pläne (`free`, `starter`, `growth`, `agency`, `enterprise`, `partner`)
und Einmalprodukte (`purchaseMode: 'one_time'`). Der Name **„Scale" ist als Plan
untersagt**. Alle Beträge in dieser Spezifikation sind Beispielwerte.

## 5. Vorhandene Routen — hier wird angedockt

Öffentlich (eager, `src/pages/`):

```
/                       Startseite — DESIGN-LOCKED, nicht ändern
/unified-entry/scan     Scan-Einstieg
/unified-entry/preview  Vorschau
/unified-entry/register Registrierung
/unified-entry/onboarding
/audit                  Audit-Landing
/audit/result/:auditId  Audit-Ergebnis
/pricing  /pricing/:slug
/checkout/:planKey      /checkout/success  /checkout/cancelled
/features /features/:slug  /automations  /evidence  /welcome
```

Auth-geschützt (lazy, `src/features/`):

```
/app/dashboard      /app/siteos          /app/governance/*
/app/bots           /app/bots/inbox      /app/bots/:botId
/app/agents         /app/agents/susi     /app/agents/automation
/app/ai-systems     /app/automations     /app/approvals
/app/billing        /app/connectors      /app/alerts
/app/analytics      /app/costs           /app/company
/app/assets/:assetId                     /app/admin/*
```

**Öffentliche Route-Contracts nicht brechen.** Umleitungen sind zulässig,
URL-Änderungen nicht.

## 6. Backend-Anbindung

Auth und Mandant über die vorhandenen Hooks:

```ts
useAuth()    // { id, email, tenantId }
useTenant()  // Workspace, Mitglieder, Plan
```

Ein Nutzer gehört zu genau einem Tenant. Alle Abfragen laufen über RLS und sind
`tenant_id`-gefiltert. **Kein Service-Role-Key im Browser.** Privilegierte Vorgänge
laufen ausschließlich über Edge Functions.

Vorhandene Funktionen, an die angedockt wird (Auswahl):

```
gdpr-audit                        anonymer Scan (verify_jwt=false)
tenant-audit                      authentifizierter Scan → scan_runs, findings
governance-risk-score             Risiko je Asset
governance-analytics-aggregator   KPI-Aggregation
governance-agent                  Governance-Assistent
ai-gateway                        Modellzugriff, Provider-agnostisch
health                            Verbundstatus der Plattform
evidence-export                   Nachweis-Export
bot-chat / bot-voice-webhook      Kanäle
automation-trigger                Skill-Ausführung
```

**Der Assistent kennt keinen Provider.** Die Oberfläche spricht nie direkt mit
Anthropic, Google oder Ollama, sondern immer über `ai-gateway`.

## 7. Die Screens

### 7.1 Landing (neue Route, Startseite bleibt unberührt)

Lege den Neuentwurf unter `/preview/landing` an. Inhalt:

**Hero** — Headline, Subheadline, primärer CTA „Kostenlosen Governance-Scan starten",
sekundär „So funktioniert es". Direkt darunter ein Eingabefeld für die Domain
(`https://ihre-website.de`) mit Button „Website prüfen →" und dem Hinweis
„Keine Kreditkarte erforderlich."

Das Formular führt auf `/unified-entry/scan?domain=…` — der Flow existiert bereits.

**Drei Säulen**: Erkennen (Governance-, Datenschutz-, Sicherheits- und KI-Risiken
finden) · Modernisieren (Frontend erneuern, Backend unverändert lassen) ·
Automatisieren (Agenten und Automatisierungen aus einem Arbeitsbereich).

### 7.2 Scan läuft

Keine unbestimmte Ladeanimation. Zweispaltig:

Links eine Fortschrittsliste mit echten Zuständen — abgeschlossen `✓`, laufend `●`,
ausstehend `○`. **Jeder Schritt entspricht einem echten Teilschritt des Scans.**
Erfinde keine Schritte, um die Liste voller aussehen zu lassen.

Rechts die erkannte Infrastruktur als Baum (Analytics, Formulare, Cookies, externe
APIs, KI-Dienste, Tracking) — gefüllt aus dem laufenden Ergebnis, nicht aus einer
festen Liste. Ist ein Zweig noch unbekannt, bleibt er leer statt beispielhaft gefüllt.

Fehlerfall: Scan nicht möglich → klare Meldung mit Grund und Wiederholung.

### 7.3 Governance-Vorschau

Der Konversionsmoment. Groß: **Governance Score**, darunter die Verteilung
(kritisch / Aufmerksamkeit / konform). Rechts eine Risikomatrix.

Kritische Befunde werden **benannt, aber nicht gelöst** — Titel und eine Zeile
Einordnung, kein vollständiger Behebungsweg.

Zwei CTAs: „Vollständigen Bericht freischalten" und „Website modernisieren".

Wichtig: Score und Zählungen kommen aus dem Scan-Ergebnis. Liegt keines vor,
zeigt der Screen „—" und einen Hinweis, nicht einen Beispiel-Score.

### 7.4 Website Modernizer

Überschrift „Ihre Website. Neu gedacht." Untertitel: Inhalte, Funktionen und
Backend-Anbindungen bleiben erhalten, erneuert wird die Präsentationsschicht.

Vier Varianten als Karten: **Corporate · Modern · Conversion · AI Enhanced**,
jeweils mit einer echten Vorschau der bestehenden Website in dieser Richtung.
Wechseln möglich, Aktion „Dieses Design verwenden".

Vor dem Veröffentlichen greift das Publish Gate (§8).

### 7.5 Registrierung

Erst hier. Nicht „Konto anlegen, um fortzufahren", sondern:

> **Ihre Infrastrukturanalyse ist fertig.**
> Legen Sie ein kostenloses Konto an, um den vollständigen Bericht zu sehen.

Felder: Name, Unternehmen, E-Mail, Passwort. Optional „Mit Google fortfahren".

**Nach der Registrierung darf der Nutzer nicht von vorn anfangen.** Der anonyme
Scan wird jedoch **nicht** in den Mandanten importiert (Zweckänderung bei
`email`/`ip_hash`). Stattdessen: Asset anlegen und einen **neuen
authentifizierten Lauf** starten, dessen Ergebnis dem alten gegenübergestellt
wird — Beschriftung „Baseline erneut verifizieren". Siehe
`docs/architecture/asset-lifecycle-contract.md` §7.

### 7.6 Dashboard

Sidebar: Übersicht · Governance · Websites · KI & Assistenten · Automatisierungen ·
AI Workspace — darunter Funktionen, Abrechnung, Einstellungen. Fußzeile mit
Plattformstatus aus `loadPlatformHealth()` (`ok` / `degraded` / `down` / `unknown`),
niemals fest auf „Online".

Begrüßung mit Firmenname, darunter vier Kennzahlkarten: Governance, Websites,
KI-Systeme, Automatisierungen — alle über `formatMetric`.

Danach „Handlungsbedarf" mit echten offenen Punkten; gibt es keine, ein ehrlicher
Leerzustand statt erfundener Aufgaben.

### 7.7 KI-Empfehlung

Prominent, aber als Empfehlung erkennbar:

> Auf Ihrer Website gehen Terminanfragen ein, es ist jedoch kein automatischer
> Terminassistent aktiv.

Darunter die vorgeschlagene Fähigkeit mit ihren Integrationen und den **aus der
SSoT gelesenen** Kosten. Aktionen: „Aktivieren" und „RealSync AI fragen".

Eine Empfehlung darf nur erscheinen, wenn ihre Grundlage aus Daten stammt. Ohne
Beleg keine Empfehlung.

### 7.8 Governance Center

Unterbereiche: Übersicht, Score, DSGVO, EU AI Act, Sicherheit, Drittanbieter,
KI-Systeme, Dokumentation, Monitoring.

Score groß, daneben die Veränderung im Zeitraum (nur wenn Verlauf vorliegt).
Risikoübersicht nach Schweregrad. Jeder Befund bekommt eine Aktion
(„Mit RealSync AI beheben"), die einen realen Workflow startet — kein toter Button.

**Rechtsnormen korrekt zitieren**: § 5 DDG (nicht TMG), § 25 TDDDG (nicht TTDSG),
Art. 13 DSGVO, EU AI Act mit Artikelnummer.

### 7.9 Websites

Je Website eine Karte: Domain, Governance-Wert, Frontend-Zustand, Anzahl Agenten,
Monitoring-Zustand, Aktion. Dazu **„+ Website hinzufügen"** — Mehrfach-Websites
sind von Anfang an Teil des Modells.

`Monitoring: aktiv` darf nur stehen, wenn ein persistiertes Asset **und** eine
tatsächlich aktive Monitoring-Beziehung existieren. Sonst `PENDING` / `—`.

### 7.10 Website-Detail

Tabs: Übersicht · Governance · Frontend · KI · Monitoring · Aktivität.

Im Tab Frontend: Vorschau, Zustand, Version, Aktionen Vorschau / Neu generieren /
Veröffentlichen / Zurückrollen. „Veröffentlichen" ist nur aktiv, wenn das Gate
bestanden ist (§8).

### 7.11 KI-Belegschaft

Nicht „Bots", sondern arbeitende Agenten mit Zuständigkeit und Zustand
(`ACTIVE` / `AVAILABLE`): Website-Assistent, WhatsApp-Terminassistent,
Telefonassistent, Governance-Agent, Operations-Agent.

`ACTIVE` nur bei tatsächlich aktivem Agenten.

### 7.12 AI Workspace

Kein Chatfenster als Selbstzweck. Oben ein Auftragsfeld („Was möchten Sie
erreichen?") mit Beispielaufträgen darunter. Ergebnis ist immer ein **Plan**,
kein Fließtext.

### 7.13 Agentenausführung

Der Agent arbeitet nie unsichtbar. Er zeigt einen Ablaufplan mit Schritten und
deren Zustand. Vor kostenpflichtigen Schritten ein ausdrücklicher Halt:

> Diese Aktion erhöht Ihre monatlichen Kosten. → **Prüfen und fortfahren**

Der Betrag kommt aus der SSoT, und die Zustimmung erzeugt einen echten
Entitlement- bzw. Checkout-Vorgang. Ein Dialog, der nur zustimmt und nichts
auslöst, ist schlimmer als keiner.

### 7.14 Browser-Arbeitsbereich

Wenn ein Agent eine Website bedient: sichtbares Browserfenster, Aktivitätsprotokoll
mit Zeitstempel, jederzeit **„Agent stoppen"**. Jede Aktion wird protokolliert
(`browser_actions`).

### 7.15 Funktionen

Gruppen: Governance · KI · Kundenkommunikation · Automatisierung. Je Funktion ein
Zustand `ACTIVE` / `AVAILABLE` / `UPGRADE`, abgeleitet aus `hasModule()` /
`hasPermission()` — nicht aus einer Liste im Frontend.

### 7.16 Abrechnung

Aktueller Verbrauch nach Position, darunter die geschätzte nächste Rechnung und
„Abrechnung verwalten" (führt in den vorhandenen Stripe-Portal-Flow). Alle Beträge
aus der SSoT bzw. den Verbrauchsdaten. Liegt kein Verbrauch vor: „—".

### 7.17 Der ständige AI-Zugang

Auf **jeder** Seite unten rechts eine Schaltfläche „✦ RealSync AI", die ein
verschiebbares Seitenpanel öffnet. Das Panel kennt den Kontext der aktuellen Route:

> Sie sehen gerade: Governance → DSGVO

Es beantwortet Fragen kontextbezogen und kann den passenden Workflow starten.
Was es **nicht** kann, sagt es — es täuscht keine Ausführung vor.

## 8. Publish Gate — normativ

Kein Client entscheidet, ob veröffentlicht werden darf. Der Server liefert:

```ts
{
  status: "passed" | "blocked" | "pending",
  evidence_complete: boolean,
  backend_preservation: "preserve_all" | "changed" | "unknown",
  policy_compliant: boolean,
  human_approval_required: boolean,
  publishable: boolean,
  evaluated_at: string,
  evaluation_id: string
}
```

Das Frontend **zeigt** `publishable` und die Begründung an und leitet es niemals
selbst aus den Einzelfeldern ab. Fehlende Antwort, Zeitüberschreitung oder
`backend_preservation: "unknown"` ⇒ nicht veröffentlichbar. Es gibt kein
Überschreiben; eine Ausnahme ist immer eine Freigabe durch einen Menschen.

## 9. Zustände, die jeder Screen können muss

1. **Laden** — Skeleton in der Form des späteren Inhalts, keine Spinner-Seiten.
2. **Leer** — benennt, was fehlt, und den nächsten Schritt. Keine erfundenen Beispieldaten.
3. **Fehler** — sagt, was nicht ging, und bietet Wiederholung. Keine weiße Seite.
4. **Unbekannt** — Daten nicht abfragbar: „—" plus Hinweis. Nicht als Null tarnen.
5. **Ohne Berechtigung** — erklärt, welche Funktion fehlt, und verlinkt sie sauber.

## 10. Mobil und Barrierefreiheit

Mobile First. Sidebar wird zur Schublade, Kennzahlkarten stapeln, Tabellen scrollen
in einem eigenen Container — die Seite selbst scrollt nie horizontal. Der AI-Zugang
wird auf kleinen Geräten zu einem Vollbild-Panel.

WCAG 2.2 AA: sichtbarer Fokus (`:focus-visible` nie `none`), Tastaturbedienung
vollständig, Beschriftungen an allen Formularfeldern, `prefers-reduced-motion`
respektiert, Farbe nie alleiniger Bedeutungsträger.

## 11. Was du lieferst

- React-Komponenten in TypeScript, `strict`-tauglich, ohne `any` ohne Begründung.
- Öffentliche Seiten in `src/pages/`, geschützte Module in `src/features/<name>/`.
- Wiederverwendbare Bausteine in `src/components/`.
- Keine neuen Abhängigkeiten. Keine Backend-Dateien. Keine Migrationen.
- Kommentare erklären **warum**, nicht was — besonders bei Zustands- und
  Berechtigungslogik.

## 12. Abnahmekriterien

Ein Screen gilt als fertig, wenn:

1. `npm run lint` (`tsc --noEmit`) fehlerfrei durchläuft.
2. Jede angezeigte Zahl auf eine benannte Quelle zurückführbar ist — sonst „—".
3. Kein Betrag, Limit oder Plan-Name hartkodiert ist.
4. Alle fünf Zustände aus §9 vorhanden sind.
5. Kein Button ohne Wirkung existiert und kein `href="#"`.
6. Kein Statusabzeichen erscheint, das nicht aus Daten folgt.
7. Die Ansicht auf 360 px Breite ohne horizontales Scrollen benutzbar ist.
8. Das Backend unverändert ist.
9. Kein sichtbarer Text englisch ist (§0.1) — Zahlen- und Datumsformate `de-DE`.

---

Ende des Prompts.

---

## Nach der Generierung

Der Prompt erzeugt eine Oberfläche, keine Wahrheit. Vor dem Übernehmen prüfen:

- **Erfundene Kennzahlen** — die häufigste Abweichung. `grep` nach festen Zahlen in
  neuen Komponenten; alles, was nicht aus dem Status Adapter kommt, ist verdächtig.
- **Hartkodierte Preise** — gegen `shared/pricing.ts` gegenprüfen.
- **Neue Abhängigkeiten** — `git diff package.json` muss leer sein.
- **Next.js-Reste** — nach `use client`, `next/`, `shadcn` suchen.
- **Design-Lock** — `src/pages/MainLanding.tsx` darf unverändert sein.
- **Tote Buttons** — jede Aktion einmal klicken.
- **Englische UI-Texte** — Generatoren fallen mitten im Screen ins Englische zurück
  („Loading…", „No data available", „Submit"). Nach solchen Resten suchen; jeder
  Fund verletzt Abnahmekriterium 9.
