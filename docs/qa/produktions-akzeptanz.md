# Produktions-Akzeptanztest

Wie der ausgelieferte Stand von `realsyncdynamicsai.de` geprüft wird — im
echten Browser, gegen die echte Domain, mit anschließender technischer
Ursachenanalyse.

Das ist ein **Runbook**, kein Statusbericht. Die unter „Befunde vom
2026-08-30" festgehaltenen Fehler stehen hier, weil sie die Prüfschritte
begründen; erledigte Befunde werden gestrichen, das Vorgehen bleibt.

---

## 1. Warum zwei Ebenen

Beide Ebenen beweisen Unterschiedliches, und keine ersetzt die andere:

| Ebene | Frage | Werkzeug |
|---|---|---|
| **Kundenabnahme** | Funktioniert es für den, der zahlt? | Browser gegen die Live-Domain |
| **Technische Prüfung** | Warum funktioniert es nicht? | Repo, Edge Functions, DB, Logs |

Der Durchlauf vom 2026-08-30 hat gezeigt, warum das nötig ist: **alle fünf
gefundenen Fehler waren im Repository unsichtbar.** `npm run lint`, `npm test`
und die bestehende E2E-Suite waren grün, während der wichtigste CTA der
Startseite in Produktion jeden Aufruf mit HTTP 500 beantwortete. Fehler dieser
Art entstehen erst im Zusammenspiel aus ausgelieferter SPA, CSP,
Edge-Function-Laufzeit und gesetzten Secrets — und genau dort muss man messen.

---

## 2. Die Suite ausführen

```bash
E2E_BASE_URL=https://realsyncdynamicsai.de \
  npx playwright test e2e/production-acceptance.spec.ts
```

Ohne `E2E_BASE_URL` überspringt sich die Suite selbst: Gegen einen lokalen
Dev-Server sind Header, CSP und Secrets andere, die Aussage wäre wertlos.

**Was sie abdeckt**: Erreichbarkeit der elf Seiten des Kundenpfads (kein
Weißbild), den Scan-Trichter von der Startseite bis zur Antwort der Edge
Function, das Auth-Gate, Sicherheitsheader und CSP, Hintergrund-5xx, sowie den
Trichter auf 390 px Breite.

**Was sie nicht abdeckt**: alles hinter dem Login. Der Zugang läuft über
Magic Link oder Google — ohne Postfachzugriff nicht automatisierbar. Dieser
Teil bleibt manuell, siehe Abschnitt 4.

---

## 3. Vom Befund zur Ursache

Jeder Fehlschlag wird einer Schicht zugeordnet, statt ihn zu wiederholen:

| Symptom im Browser | Zuerst prüfen |
|---|---|
| Login schlägt fehl, Redirect-Schleife | Supabase Auth, Session, Redirect-URLs |
| Ansicht leer oder Zahlen falsch | RLS, `tenant_id`-Filter, Funktions-ACLs (`npm run check:function-acls`) |
| Aktion ohne Wirkung | Edge-Function-Logs, `check:edge-refs`, Secrets |
| Report oder Nachweis fehlt | `scan_runs`, `findings`, Storage, Export-Pfad |
| Abrechnung falsch | Stripe-Produkte, Webhooks, `shared/pricing.ts` |

Die Edge-Function-Logs sind dabei die ergiebigste Quelle — sie nennen den
Fehler im Klartext:

```sql
SELECT timestamp, event_message FROM logs
WHERE source = 'function_logs' AND positionCaseInsensitive(event_message, '<function>') > 0
ORDER BY timestamp DESC LIMIT 25
```

### Regel: messen, nicht herleiten

Beim Durchlauf vom 2026-08-30 war eine erste Diagnose falsch — „`/audit`
ignoriert `?domain=`" — weil das Prüfskript das Chat-Eingabefeld erwischt hatte
statt des Domain-Felds. Der Code las den Parameter korrekt aus. Erst der Blick
in `AuditLanding.tsx` zeigte den tatsächlichen, engeren Fehler: Die Vorbelegung
erreicht nur das klassische Formular, nicht die voreingestellte Chat-Ansicht.

Das ist dieselbe Lehre wie in CLAUDE.md §5 zur Function-Lücke: Eine aus einer
Beobachtung *geschlossene* Erklärung ist keine Messung. Vor jedem Befund gegen
die Quelle prüfen — und die Prüfung mit Datum und Methode hinschreiben.

---

## 4. Manueller Teil (eingeloggt)

Nach dem Login mit einem Testkonto in dieser Reihenfolge, jeweils PASS/FAIL mit
Beleg (Screenshot, URL, Netzwerkantwort):

Dashboard lädt mit echten Daten · Audit starten und Statuswechsel beobachten ·
Report/PDF-Export abrufen · Evidence Vault mit *eigenen* Zahlen ·
Bots und Workflows · Einstellungen speichern · Billing und Upgrade-Pfad ·
Logout und erneuter Login · dieselbe Runde auf dem Telefon.

Bei jedem FAIL die Zuordnung aus Abschnitt 3 anwenden, statt im Browser zu
wiederholen.

---

## 5. Befunde vom 2026-08-30

Gemessen im echten Browser (Chromium) gegen `realsyncdynamicsai.de`, technisch
gegengeprüft gegen das Live-Projekt `ebljyceifhnlzhjfyxup`. Ergebnis der Suite:
15 Prüfungen bestanden, 5 gefallen.

### 5.1 Der kostenlose Audit ist tot — kritisch

`gdpr-audit` beantwortet **jeden** Aufruf mit HTTP 500:

```
ReferenceError: runChecks is not defined
  at gdpr-audit/index.ts:128:18
```

Sechs Hilfsfunktionen werden aufgerufen, existieren aber nirgends im
Repository: `fetchWithTimeout`, `concat`, `runChecks`, `scanSubpages`,
`extractFacts`, `scoreReport`. Vier Importe liegen ungenutzt herum
(`detectAIDisclosure`, `isLikelyGermanJurisdiction`, `stripPolicyDeclarations`,
`effectiveCspValue`) — die Signatur einer Datei, aus der ein großer Block
Hilfscode verlorenging.

Die Datei wurde in genau **einem** Commit angelegt (`a67ae2c`, 2026-08-19,
PR #1095) und war von Beginn an unvollständig. Sie hat nie funktioniert.

**Belegte Folge**: `scan_runs`, `audit_jobs` und `findings` sind leer — null
Zeilen, jemals. Kein einziger kostenloser Audit hat je ein Ergebnis erzeugt.

Der zweite Weg auf `/audit` ist ebenfalls kein Scan: Die voreingestellte
Chat-Ansicht ruft `governance-agent` auf, das antwortet
`{"status":"queued","audit_id":"mock-…","hint":"Demo-Response — kein echter
Scan ausgelöst. Wechsel auf /audit für den vollen Scan."}` — während der
Besucher bereits auf `/audit` steht.

**Behoben** (2026-08-30): Die sechs Funktionen sind rekonstruiert. Die
Prüf- und Bewertungslogik liegt jetzt in `supabase/functions/gdpr-audit/checks.ts`
— bewusst frei von Deno-Globals und Netzwerkzugriff, damit sie aus Vitest
heraus testbar ist (`test/edge/gdpr-audit-checks.test.ts`, 25 Prüfungen).
Genau das hat vorher gefehlt: Eine Edge Function, die niemand je aufruft,
kann beliebig kaputt sein.

Das meiste war Ableitung, keine Erfindung:

| Baustein | Woraus abgeleitet |
|---|---|
| `extractFacts` | Die Faktennamen stehen als Bedingungen in `_shared/rules/gdpr.json` — sie sind der Vertrag mit der Rule Engine |
| Tracker-Erkennung | Needles aus `_shared/rules/tracker-registry.json` (18 Einträge) |
| `stripPolicyDeclarations` | War bereits importiert, nur nicht mehr benutzt — verhindert, dass eine CSP-Allowlist als Einbindung zählt |
| Impressum-Schwere | `isLikelyGermanJurisdiction()` — § 5 DDG greift nicht weltweit |
| Clickjacking header-basiert | `effectiveCspValue()` dokumentiert, dass `frame-ancestors` per `<meta>` nicht durchgesetzt wird |

**Freigabe ausstehend — Scoring-Gewichte.** Der Punktabzug je Befund ist der
einzige Teil, der sich aus nichts ableiten ließ. Er bestimmt den Score, den
der Kunde sieht, und ist damit versionsrelevant:

| Schwere | Abzug | Begründung |
|---|---|---|
| `critical` | 30 | Ein einzelner Befund (Tracking ohne Einwilligung, kein HTTPS) drückt von 100 auf 70 und damit unter jede grüne Schwelle — beides ist für sich genommen abmahnfähig |
| `high` | 15 | Zwei davon ergeben denselben Abzug wie ein kritischer |
| `medium` | 8 | |
| `low` | 3 | Härtungshinweise (HSTS, CSP) sollen den Score nicht dominieren |
| `info` | 0 | Hinweis, kein Mangel — auch „nicht erreichbar" drückt nie |

Die Gesamteinstufung folgt dem **schwersten Einzelbefund**, nicht dem Score:
Ein kritischer Verstoß bleibt kritisch, auch wenn sonst alles sauber ist.

### 5.2 Trichterbruch: die Domain geht verloren

Die Startseite übergibt die getippte Adresse korrekt als
`/audit?domain=example.com`, und `AuditLanding.tsx:76` liest sie aus. Der Wert
landet aber nur im **klassischen Formular**, das hinter dem Umschalter „Lieber
das klassische Formular?" liegt. Sichtbar ist per Voreinstellung
`AuditChatHero`, und diese Komponente nimmt keine Vorbelegung entgegen
(`AuditChatHero.tsx:66-68`, `useState('')`).

Der Besucher tippt seine Domain also zweimal — an der engsten Stelle des
Trichters. Der Codekommentar in `AuditLanding.tsx` warnt wörtlich vor genau
diesem Fall.

**Behoben** (2026-08-30): `AuditChatHero` nimmt eine optionale
`initialDomain` entgegen und setzt sie als Startwert ins Eingabefeld —
sichtbar, aber **nicht** abgeschickt. Der Besucher sieht, was gescannt wird,
und kann es korrigieren, bevor es losgeht. Im Browser gegen den gebauten
Stand geprüft: mit `?domain=` vorbelegt, ohne Parameter leer.

### 5.3 Kein Pageview-Tracking seit dem 3. August

`track-pageview` antwortet auf **jedem** Seitenaufruf mit HTTP 500:

```json
{"ok":false,"error":{"code":"CONFIG","message":"PAGEVIEW_HASH_SALT is not configured"}}
```

Die Function verhält sich richtig — sie verweigert ungesalzene, praktisch
umkehrbare Besucher-Hashes. Der Fehler ist die fehlende Konfiguration.

`page_views` hat 136.138 Zeilen, die letzte vom **2026-08-03**. Seither: nichts.

**Behebung**: `supabase secrets set PAGEVIEW_HASH_SALT=<zufälliger Wert>`.
Der Wert darf nach dem Setzen nicht mehr geändert werden — sonst zerfällt die
Besucher-Identität an der Änderungsgrenze in zwei Hälften.

#### Die Sache hat eine Frist (gemessen 2026-08-31)

Der Ausfall ist nicht bloß ein Stillstand — der Bestand schrumpft. Der pg_cron-Job
`page-views-cleanup-daily` läuft weiter, täglich um 03:00 UTC:

```sql
DELETE FROM public.page_views WHERE created_at < now() - interval '90 days'
```

Aufnahme steht seit dem 2026-08-03, die Aufbewahrung räumt trotzdem weiter ab.
Die Historie wird also von vorn aufgezehrt, während hinten nichts nachkommt:
zwischen dem 2026-08-30 und dem 2026-08-31 sind 83 Zeilen verschwunden
(136.138 → 136.055), der älteste Datensatz ist auf den 2026-06-02 gewandert.

Gerechnet gegen die Live-DB am 2026-08-31: Der jüngste Datensatz stammt vom
**2026-08-03**, seine 90 Tage laufen am **2026-11-01** ab. Bleibt das Secret
bis dahin ungesetzt, ist `page_views` an diesem Tag **leer** — zwei Monate
Besucherhistorie sind dann nicht bloß lückenhaft, sondern fort. In den
nächsten 24 Stunden fallen 746 Zeilen.

Der Job ist dabei nicht der Fehler: Eine 90-Tage-Aufbewahrung ist genau das,
was eine DSGVO-konforme Analytik tun soll. Der Fehler ist die stehende
Aufnahme daneben. Wer das Secret setzt, hält beides wieder im Gleichgewicht.

**Lehre fürs Runbook**: Ein Ausfall in einem System mit Aufbewahrungsfrist hat
immer eine Verfallsfrist. Bei jedem stehenden Datenpfad deshalb mitprüfen, ob
ein Aufräum-Job weiterläuft — sonst wird aus einer Lücke stillschweigend ein
Verlust.

### 5.4 CSP blockiert das eigene Analytics-Beacon

Cloudflare Pages injiziert das Web-Analytics-Beacon von
`static.cloudflareinsights.com`; `script-src` in `public/_headers` führt die
Domain nicht. Ergebnis auf jeder Seite:

```
Refused to load the script 'https://static.cloudflareinsights.com/beacon.min.js/…'
```

Damit sind beide Analytics-Wege gleichzeitig stumm.

**Behoben** (2026-08-30): `static.cloudflareinsights.com` in `script-src`
und `cloudflareinsights.com` in `connect-src` (das Beacon sendet seine
Messwerte per POST) aufgenommen.

Die Erweiterung ist nach dem **eigenen** Maßstab zulässig: Die Tracker-Registry
(`_shared/rules/tracker-registry.json`, `id: cloudflare_web_analytics`) führt
den Dienst als cookieless, `consent_required: false`, Rechtsgrundlage
Art. 6 Abs. 1 lit. f DSGVO.

**Offen — zwei Pflichten, die dieselbe Registry verlangt:**

1. `documentation_required: ["Datenschutzerklaerung: Cloudflare Web Analytics"]`
   — `src/features/legal/PrivacyPolicy.tsx` nennt Cloudflare **überhaupt
   nicht**, obwohl die gesamte Seite auf Cloudflare Pages läuft und Cloudflare
   damit ohnehin Auftragsverarbeiter für alle Besucher-IPs ist. Diese Lücke
   bestand schon vor der CSP-Änderung.
2. `third_country_transfer: true` (US) → AVV mit Cloudflare erforderlich.

Beides ist Text in bestehenden Rechtsdokumenten und unterliegt damit der
Fragepflicht nach §10.3.

Nebenbefund: `COMPLIANCE_AUDIT_2026-07.md` führt „Cloudflare Web Analytics |
Nicht eingebunden — 0 Treffer für `cloudflareinsights.com`". Das stimmt für
den Repository-Inhalt, aber nicht für die ausgelieferte Seite — Cloudflare
Pages injiziert das Beacon serverseitig. Ein Beleg dafür, dass eine
Compliance-Aussage, die nur den Quelltext prüft, den Auslieferungsstand
verfehlen kann.

### 5.5 Vorgetäuschte Kennzahlen ohne Anmeldung

115 der 130 `/app/*`-Routen tragen kein Auth-Gate (`AppGate`, `ProtectedRoute`
oder `RequireAal2`). `/app/evidence` zeigt einem **nicht angemeldeten**
Besucher „1.247 Nachweise · 1.198 C2PA-signiert · 23 diese Woche · letzter
Export 12.06.2026" — hart kodiert in `EvidenceVaultView.tsx:635`, während der
Statuschip daneben „NICHT ANGEMELDET" meldet.

**Kein Datenleck.** Gegen die Live-DB geprüft: RLS ist auf allen betroffenen
Tabellen aktiv, und die Policies hängen an `is_tenant_member(tenant_id)`, das
ohne Session falsch liefert. Es fließen keine fremden Mandantendaten.

Es bleibt ein Vertrauensschaden: Ein Kunde ohne eigene Nachweise sieht fremde
Zahlen, als wären es seine. CLAUDE.md §14 verbietet das ausdrücklich („Kein
Element vortäuschen, das nichts tut"). **Offen**: Entfernen oder Ersetzen greift
in Bestehendes ein und unterliegt damit der Fragepflicht nach §10.3.

### 5.6 Die strukturelle Ursache

Keiner dieser Fehler konnte auffallen, weil **keine der 178 Edge Functions je
typgeprüft oder aufgerufen wird**. `npm run lint` ist `tsc --noEmit` und deckt
nur `src/` ab; `check:edge-syntax` ist ein reiner Parse-Check und sieht einen
nicht existierenden Namen nicht.

Geschlossen durch `npm run check:edge-refs`
(`scripts/check-edge-function-refs.mjs`, in `ci.yml` verdrahtet): Der Check
sammelt je Datei alle deklarierten und importierten Namen ein und meldet jeden
aufgerufenen Bezeichner, der sich darauf nicht zurückführen lässt.

Gemessen über alle 178 Entrypoints: **6 Treffer, alle in `gdpr-audit`, keine
Fehlalarme.**

---

## 6. Betriebshinweis: Browser hinter einem MITM-Proxy

Läuft der Test in einer Umgebung mit abfangendem HTTPS-Proxy (etwa einer
Agent-Sandbox), bricht Chromiums TLS-Handshake mit `ERR_CONNECTION_RESET` ab —
der Post-Quantum-Key-Share bläht das ClientHello auf ~1795 Byte, woran viele
Proxys scheitern. `curl` ist davon nicht betroffen, was die Ursache gut
versteckt.

Abhilfe über `launchOptions`, ohne die Zertifikatsprüfung abzuschalten:

```ts
launchOptions: { args: ['--ssl-version-max=tls1.2'], proxy: { server: process.env.HTTPS_PROXY! } }
```
