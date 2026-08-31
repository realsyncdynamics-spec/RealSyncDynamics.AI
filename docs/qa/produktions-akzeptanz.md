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

**Ersatzweise abgedeckt** (2026-08-31): Zwei Ebenen, die vorher als „nur
manuell" abgelegt waren, gehen doch automatisiert — sie enden bloß an der
Login-Grenze statt dahinter.

- **Dashboard** über `/demo-tour/dashboard`. Dieselbe Oberfläche, absichtlich
  öffentlich, und — das ist der Punkt — ausdrücklich als „Demo-Modus —
  Interaktive Vorschau" gekennzeichnet. Geprüft wird beides: dass sie rendert
  **und** dass die Kennzeichnung dasteht.
- **Billing** über den Kauf-Trichter: `/pricing` → Klick auf „14 Tage
  kostenlos testen" → `/checkout/starter?source=pricing&pilot=true` → Login-Gate
  mit dem Versprechen „Nach Anmeldung sind Sie sofort wieder hier". Geprüft
  wird, dass die Schaltfläche überhaupt navigiert (§14: eine Kauf-Schaltfläche,
  die nichts tut, ist schlimmer als keine) und dass das Gate einen Rückweg
  nennt statt in einer Sackgasse zu enden.

Damit sind Dashboard und Abrechnung bis an die Login-Grenze geprüft statt gar
nicht. Beide Pfade waren beim ersten Durchlauf **in Ordnung** — der
Kauf-Trichter ist intakt.

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

Zusätzlich **regelmäßig** und nicht nur bei Verdacht: den Supabase-Advisor
laufen lassen (`get_advisors`, Typ `security`). Er meldet fehlende
RLS-Policies, `SECURITY DEFINER`-Funktionen mit veränderlichem `search_path`
und solche, die `anon` aufrufen darf. Der Befund in §5.7 stammt von dort und
wäre über den Browser nie sichtbar geworden. Entscheidend beim Durchsehen:
Funktionen, die eine `tenant_id` **entgegennehmen**, statt sie aus der
Sitzung abzuleiten.

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

**Das Muster für die Lösung steht bereits im eigenen Code** (gefunden
2026-08-31): `/demo-tour/dashboard` zeigt ebenfalls erfundene Kennzahlen —
Governance Score 87/100, DSGVO-Status „Compliant" — aber mit der Überschrift
„Demo-Modus — Interaktive Vorschau" darüber. Genau diese Kennzeichnung fehlt
unter `/app/*`. Es braucht also keine neue Idee, nur dasselbe Etikett an der
zweiten Stelle. Der Test in der Suite prüft deshalb nicht mehr bloß auf die
Zahlen, sondern auf die Regel: Kennzahlen ohne Anmeldung **und** ohne
Demo-Kennzeichnung sind der Befund.

### 5.6 Vier PostgREST-Builder mit `.catch()` (gefunden 2026-08-31)

Nachdem `gdpr-audit` aufgefallen war, lag die Frage nahe: Was ist mit den
anderen 177? Der Referenz-Wächter fängt nur `ReferenceError`. Also ein
Durchlauf durch die Live-Logs:

```sql
SELECT substring(event_message,1,150) AS fehler, count(*), max(timestamp)
FROM logs WHERE source='function_logs'
  AND (positionCaseInsensitive(event_message,'error')>0
       OR positionCaseInsensitive(event_message,'failed')>0)
GROUP BY fehler ORDER BY 2 DESC
```

Zwei verschiedene Fehler im 24-Stunden-Fenster — einer davon meine eigenen
Testaufrufe gegen `gdpr-audit`. Der andere war neu:

```
[business-metrics-cron] failed: TypeError: admin.rpc(...).catch is not a function
```

`rpc()` liefert einen `PostgrestFilterBuilder`. Der ist `await`-bar
(thenable), besitzt aber **kein** `.catch()`. Der Zugriff wirft — und zwar
bevor der RPC abgeschickt wird. Die Zeile tat damit das genaue Gegenteil
ihres eigenen Kommentars: *„Best-effort retention. Don't fail the run if it
errors."*

**96 Fehlschläge bei 96 Läufen in 24 Stunden.** Der Cron
(`business-metrics-cron-15min`) läuft alle 15 Minuten; Fehlerquote 100 % seit
dem 2026-06-11. Folge: `prune_business_metric_snapshots` lief **nie** — 7.765
Snapshots, kein einziger ausgedünnt, obwohl die SQL-Funktion genau dafür da
ist.

**Das ist das Spiegelbild von §5.3.** Dort läuft die Aufbewahrung, während die
Aufnahme steht. Hier läuft die Aufnahme, während die Aufbewahrung steht.
Zweimal dieselbe Blindstelle, aus entgegengesetzter Richtung — und beide Male
war der Auslöser eine Messung, nicht eine Vermutung.

**Drei weitere, latent**: `create-trial-subscription` und
`save-company-profile` (zweimal) schreiben ihren Prüfpfad mit
`.insert({...}).catch(...)`. Diese Functions haben wenig Verkehr und tauchen
deshalb in keinem Fehlerlog auf — der Fehler träfe den nächsten echten Nutzer
im Onboarding. Bei `create-trial-subscription` besonders unschön: Das Abo wird
angelegt, dann stirbt der Request, der Kunde sieht einen Fehler und versucht
es erneut.

Alle vier behoben; die Fehlerprüfung läuft jetzt über das Ergebnis
(`const { error } = await client.rpc(...)`), wie es PostgREST vorsieht.

#### Ein Fehlalarm, und was er lehrt

Die erste Fassung der neuen Wächter-Regel verglich den **Quelltext** der
Aufrufkette per Regex — und meldete prompt
`fetch(...).then(async res => { await sb.update(...) }).catch(...)` in
`schedule-data-syncs`. Das ist korrekter Code: `.update(` steht dort nur im
Rumpf eines Callbacks, nicht in der Kette.

Die Regel prüft jetzt **strukturell** über das Gerüst der Aufrufkette, nie
über Argumente; ein `.then()` auf dem Gerüst gilt als echte Promise. Das war
die Probe aufs Exempel für den Kommentar, der im Skript ohnehin schon stand:
Ein Gate mit Fehlalarmen wird abgeschaltet und schützt dann gar nichts mehr.

### 5.7 `get_compliance_timeline` — latenter mandantenübergreifender Lesepfad

Gefunden 2026-08-31 über den Supabase-Sicherheits-Advisor (81 Befunde; die
Prüfung war in den bisherigen Durchläufen nicht enthalten und gehört ab jetzt
in Abschnitt 3).

Von den 81 trägt genau eine Funktion **beide** Warnungen zugleich —
`SECURITY DEFINER` mit veränderlichem `search_path` **und** von `anon`
aufrufbar:

```sql
CREATE OR REPLACE FUNCTION public.get_compliance_timeline(
  p_domain text, p_tenant_id uuid, p_limit integer DEFAULT 30)
 RETURNS TABLE(...) LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT scanned_at, risk_score, risk_level, trackers,
         drift_detected, new_trackers, scan_type
    FROM public.audit_monitor_results
   WHERE tenant_id = p_tenant_id AND domain = p_domain
   ORDER BY scanned_at DESC LIMIT p_limit;
$$;
```

Drei Eigenschaften zusammen ergeben den Befund:

1. `SECURITY DEFINER` umgeht die RLS auf `audit_monitor_results`.
2. Die `tenant_id` kommt **vom Aufrufer**; es gibt keine Prüfung, ob der
   Aufrufer diesem Mandanten angehört.
3. `anon` besitzt EXECUTE (per `has_function_privilege` bestätigt), also ist
   sie ohne Anmeldung über `/rest/v1/rpc/get_compliance_timeline` erreichbar.

Wer eine `tenant_id` und eine Domain kennt, könnte damit die Scan-Historie
eines fremden Mandanten lesen — Risiko-Scores, erkannte Tracker, Drift.
Das widerspricht dem, was CLAUDE.md §3 zusagt und die Startseite bewirbt.

**Einordnung — und die gehört dazu:** Aktuell wird nichts preisgegeben.

- `audit_monitor_results` ist **leer** (0 Zeilen, 0 Mandanten). Die Lücke
  führt heute ins Nichts.
- Der einzige Aufrufer ist `/app/risk` (`RiskDashboard.tsx:142`), und die
  Route ist doppelt abgesichert (`AppGate` + `ProtectedRoute`). Es gibt also
  keinen anonymen Aufrufer, den eine Absicherung brechen würde.
- Eine `tenant_id` ist eine UUID und nicht zu erraten. „Nicht erratbar" ist
  aber nicht „nicht bekannt": UUIDs stehen in URLs, Share-Links,
  API-Antworten und Support-Tickets.

Es ist also kein Vorfall, sondern eine scharf gestellte Falle, die auf Daten
wartet. Sobald das Monitoring Zeilen schreibt, ist sie wirksam.

**Nebenbefund im Aufrufer**: `RiskDashboard.tsx:142` übergibt

```ts
p_tenant_id: (await supabase.auth.getUser()).data.user?.id ?? ''
```

— also die **User-ID** dort, wo eine **Tenant-ID** erwartet wird. Selbst der
legitime Aufruf liefert damit nichts. Die richtige Quelle ist
`useTenant().activeTenantId`.

**Vorgeschlagene Behebung** (bewusst nicht angewendet, Begründung unten):

```sql
CREATE OR REPLACE FUNCTION public.get_compliance_timeline(
  p_domain text, p_tenant_id uuid, p_limit integer DEFAULT 30)
 RETURNS TABLE(scanned_at timestamptz, risk_score integer, risk_level text,
               trackers text[], drift boolean, new_t text[], scan_type text)
 LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path = public, pg_temp        -- gegen search_path-Manipulation
AS $$
  SELECT scanned_at, risk_score, risk_level, trackers,
         drift_detected, new_trackers, scan_type
    FROM public.audit_monitor_results
   WHERE tenant_id = p_tenant_id AND domain = p_domain
     AND public.is_tenant_member(p_tenant_id)   -- der fehlende Riegel
   ORDER BY scanned_at DESC LIMIT p_limit;
$$;
REVOKE EXECUTE ON FUNCTION public.get_compliance_timeline(text, uuid, integer) FROM anon;
```

**Warum sie hier nicht angewendet wird**, obwohl sie klein und sicher wäre:

- Eine Sicherheitsmigration an einer `SECURITY DEFINER`-Funktion gehört eigen
  geprüft und nicht in einen Test-PR mit sechs Commits eingebettet.
- `main` trägt bereits `20260831030000`, dieser Branch nur bis
  `20260831020000`. Eine Migration hier hineinzulegen läuft genau in das
  Muster, aus dem am 2026-08-24 die Versionskollision entstand (CLAUDE.md §5).
- Es brennt nicht: leere Tabelle, kein anonymer Aufrufer.

**Die übrigen 80 Befunde** sind überwiegend harmlos oder gewollt: 27-mal
`rls_enabled_no_policy` (RLS an, keine Policy — verweigert alles, also die
sichere Richtung), und die meisten der 51 `SECURITY DEFINER`-Warnungen
betreffen Funktionen wie `is_tenant_member` oder `is_tenant_admin`, deren
Grants am 2026-08-23 bewusst wiederhergestellt wurden, damit RLS überhaupt
funktioniert (CLAUDE.md §5). Sie geben für `anon` nur `false` zurück. Zu
prüfen bleiben die wenigen, die — wie diese hier — eine ID **entgegennehmen**
statt sie aus der Sitzung abzuleiten. Das ist die Form, auf die es ankommt.

### 5.8 Die strukturelle Ursache

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
