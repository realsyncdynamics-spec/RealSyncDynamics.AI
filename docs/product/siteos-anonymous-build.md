# SiteOS — Anonymer Build, Live Preview, Project Claim

**Status**: Spezifikation, nicht umgesetzt
**Verhältnis**: definiert die nächste Phase von SiteOS; ergänzt
`docs/product/design-intelligence-and-guided-integration.md` und stützt sich
auf die Messung in `docs/product/reality-matrix.md`.

Der Produktkern, um den es geht:

```
Idee → Build → vollständige Preview → Account → Project Claim → Publish
```

statt

```
Scan → Entscheidung → Account → Builder
```

Der Account ist damit kein Einstiegshindernis mehr. Er wird erst gebraucht,
wenn jemand etwas **besitzen, weiter bearbeiten, speichern oder
veröffentlichen** will.

---

## 1. Was das für den bestehenden Trichter bedeutet — offener Widerspruch

Der heutige Trichter beginnt mit einer Domain und einem Scan. Das ist für
**GOVERN** richtig und bleibt es: Wer wissen will, wie es um seine Website
steht, hat eine Website. Für **TRANSFORM** ist es falsch: Wer eine neue Seite
will, hat keine URL, die man scannen könnte — und soll trotzdem sofort etwas
sehen.

Daraus folgt: **zwei Einstiege, nicht einer.**

| Einstieg | Erste Frage | Erste Ausgabe |
|---|---|---|
| GOVERN | Domain | Governance Score + Findings |
| TRANSFORM | Beschreibung (optional URL, Bilder, Referenz) | gerendertes Frontend |

Die Weiche `/unified-entry/entscheidung` bleibt richtig — aber nur für
Besucher, die über den Scan kommen. Sie ist **nicht** der universelle
Einstieg, und die Einstiegsseite `/unified-entry/scan` ist nicht der einzige
Anfang des Produkts. Wer das verwechselt, zwingt jeden Website-Interessenten
durch einen Scan, den er nicht wollte.

---

## 2. Gemessener Ist-Zustand (2026-08-22)

| Baustein | Zustand | Beleg |
|---|---|---|
| Agentenpipeline | **vorhanden** | `siteos_agent_runs`, Handler `agents.ts`, sieben Agenten |
| Prompt → Blueprint | **vorhanden, aber nur mit Tenant** | `builder.ts` Zeile 52 ff.: `tenant_id required` |
| Anonyme Vorschau | **vorhanden, aber deterministisch** | `DashboardPreviewPage` nutzt `parseBrief` + `synthesizeBlueprint` im Browser — kein Modell, keine echten Inhalte |
| Versionierte Blueprints | **vorhanden** | `siteos_blueprints`, append-only, `prev_hash` |
| Iteratives Nachbessern | **vorhanden, angemeldet** | `PreviewSelectionPage` hält einen `instruction`-Zustand, `buildSite({ prompt })` |
| Anonymes Sicherheits-Gate | **vorhanden und erprobt** | `_shared/anonAudit.ts` + `anon_chat_runs` (85 Zeilen produktiv): Reservierung **muss** gelingen, sonst 503 |
| **Anonyme Build-Session** | **fehlt** | kein `build_session_id`, kein `project_draft_id` |
| **Project Claim** | **fehlt** | kein Übergang anonymer Entwurf → Tenant |
| **Interaktive Preview** | **fehlt** | alle Vorschauen: `srcDoc` mit `sandbox="allow-same-origin"`, **ohne** `allow-scripts` — es läuft kein JavaScript |
| **Publish** | **fehlt** | kein Publish-Handler, kein Publish Gate |
| **Custom Domain** | **teilweise** | `website_domains`, `website-domain-manager`, `cloudflare-deployer` — alle mit 0 Zeilen, nie produktiv gelaufen |

**Die zwei Befunde, die die Phase prägen:**

1. `siteos/builder` verlangt einen Tenant. Ein anonymer Build ist heute nicht
   nur „nicht eingebaut", er ist am Endpunkt ausgeschlossen. Was der anonyme
   Besucher heute sieht, entsteht deterministisch im Browser aus der Domain —
   eine echte Seite, aber ohne seine Inhalte und ohne Modell.
2. Für den anonymen Zugang gibt es bereits ein erprobtes Muster
   (`reserveAnonAudit()`: kein Prüfpfad-Eintrag, keine Arbeit). Das wird
   wiederverwendet, nicht neu erfunden.

---

## 3. Die Sandbox — harte Grenze, nicht Feinschliff

Die neue Preview soll echte Komponenten, Formulare und Animationen zeigen.
Das heisst: **JavaScript muss laufen.** Genau hier liegt die Gefahr.

Heute steht überall `srcDoc` plus `sandbox="allow-same-origin"`. Wird dort
schlicht `allow-scripts` ergänzt, entsteht die gefährlichste aller
Kombinationen: `allow-scripts allow-same-origin` bei einem Dokument, das die
**Elternherkunft erbt**. Der erzeugte Code läuft dann in der Herkunft der
Anwendung und erreicht deren `localStorage` — dort liegt die
Supabase-Sitzung. Ein generiertes Skript könnte fremde Sitzungen auslesen.

Verbindlich für die neue Preview:

1. Ausgeliefert wird von einer **eigenen Herkunft** (eigene Domain oder
   Subdomain je Vorschau), nie über `srcDoc` aus der Anwendung heraus.
2. `allow-scripts` und `allow-same-origin` stehen **nie gemeinsam** an einem
   Rahmen, dessen Inhalt aus der Anwendungsherkunft stammt.
3. Kein Zugriff des erzeugten Codes auf Produktionsumgebung, Geheimnisse,
   Service-Role-Schlüssel oder andere Mandanten. Serverseitiger Code aus dem
   Build läuft, wenn überhaupt, in einer isolierten Ausführungsumgebung mit
   eigenem Kontingent.
4. Eine strenge Content-Security-Policy je Vorschau; ausgehende Aufrufe nur
   auf ausdrücklich erlaubte Ziele.
5. Erst nach **Claim, Governance-Prüfung und Freigabe** darf ein Projekt in
   die echte Runtime. Preview ist niemals Produktion.

Diese fünf Punkte sind Vorbedingung für alles Weitere in dieser Phase. Eine
interaktive Preview ohne sie ist eine Schwachstelle mit Vorschaufunktion.

---

## 4. Anonymer Entwurf und Übernahme

```
Besucher  ──►  build_session_id  (anonym, befristet, rate-limitiert)
                     │
                     ▼
              project_draft   ──► Blueprint-Versionen (append-only)
                     │
              „Website übernehmen"
                     │
                     ▼
                Auth / Registrierung
                     │
                     ▼
              PROJECT CLAIM  ──► tenant_id gesetzt, Entwurf wird Projekt
```

Regeln:

- Der anonyme Entwurf trägt **keinen** `tenant_id`, bis er übernommen wird.
  Er ist über den unrateba­ren `build_session_id` erreichbar und nicht
  auflistbar.
- Jeder anonyme Build durchläuft das Gate aus `anonAudit.ts`: Reservierung
  zuerst, Arbeit danach. Ohne Prüfpfad-Eintrag keine Erzeugung.
- Entwürfe haben eine **Verfallszeit**. Ohne Übernahme werden sie gelöscht;
  das ist zugleich die Antwort auf DSGVO Art. 5 Abs. 1 lit. e
  (Speicherbegrenzung) für Inhalte, die jemand ohne Konto hochgeladen hat.
- Beim Claim wandert der Entwurf **unverändert** in den Mandanten: dieselben
  Blueprint-Versionen, dieselbe Kette. Es wird nichts neu erzeugt — sonst
  sähe der Kunde nach dem Anmelden eine andere Seite als vor dem Anmelden.
- Iteratives Nachbessern erzeugt **neue Versionen** desselben Projekts, nie
  ein neues Projekt. `siteos_blueprints` ist dafür bereits gebaut.

---

## 5. Was kostenlos ist und was nicht

| Stufe | Umfang |
|---|---|
| ohne Konto | Beschreiben, Erzeugen, Vorschau, Ändern, erneut Vorschau |
| mit Konto | Projekt übernehmen, dauerhaft speichern, weiter bearbeiten |
| kostenpflichtig | eigene Domain, Veröffentlichung, Governance, Monitoring, Integrationen, Team, Verbrauch |

Die kostenlose Vorschau ist damit der Vertriebsweg. Sie braucht dennoch harte
Grenzen: Anzahl Builds je Sitzung und je IP-Ableitung, Kostendeckel je
Sitzung, Verfallszeit. Ein anonymer Endpunkt, der Modellaufrufe auslöst, ist
sonst ein offener Kostenhahn — `tenant_cost_caps` und `tenant_cost_ledger`
existieren bereits, brauchen aber ein Gegenstück für Sitzungen ohne Mandant.

---

## 6. Reihenfolge dieser Phase

| # | Schritt | Vorbedingung |
|---|---|---|
| S1 | Vorschau-Isolierung: Sandbox + CSP (§3) | **umgesetzt** — siehe unten |
| S2 | Anonyme Build-Session mit Gate, Kontingent und Verfall | S1 |
| S3 | `siteos/builder` für Sitzungen ohne Tenant öffnen | S2 |
| S4 | Interaktive Preview (Skripte laufen, aber isoliert) | S1 |
| S5 | Iteratives Nachbessern auf versionierten Blueprints | S3 |
| S6 | Project Claim: Entwurf → Tenant, verlustfrei | S3 |
| S7 | Governance-Lauf auf dem übernommenen Projekt | S6 |
| S8 | **Publish Gate** | S7 |
| S9 | Publish + eigene Domain | S8 |
| S10 | Entitlements und Verbrauchsabrechnung | S9 |

### S1 — umgesetzt (Stand 2026-08-22)

`src/lib/preview-sandbox.ts` und `src/components/preview/SandboxedPreviewFrame.tsx`.
Alle drei Vorschauen (`DashboardPreviewPage`, `PreviewSelectionPage`,
`WebsiteTransformationFlow`) laufen darüber.

| | vorher | jetzt |
|---|---|---|
| `sandbox` | `allow-same-origin` | `""` (alles gesperrt) |
| CSP | keine | `default-src 'none'`, eingebettet je Dokument |
| Referrer | Standard | `no-referrer` |
| Geräte-Zugriff | Standard | `allow=""` |

Der entscheidende Punkt ist die **Bauform**, nicht der heutige Wert:
`sandboxTokens()` hat keinen Parameter, mit dem sich `allow-same-origin`
zuschalten liesse. Wer später `allow-scripts` für eine interaktive Vorschau
braucht, bekommt zwangsläufig eine **opake Herkunft** — die gefährliche
Kombination ist nicht abgeraten, sondern unerreichbar.

`test/security/preview-sandbox.test.ts` liest zusätzlich den gesamten
Quellbaum unter `src/` und `packages/` und schlägt fehl, sobald irgendein
Rahmen beide Marken trägt — auch einer, der `preview-sandbox.ts` gar nicht
kennt.

Im ausgelieferten Build nachgewiesen: die drei Rahmen tragen `sandbox=""`,
die CSP ist eingebettet, Inhalt und Gestaltung rendern unverändert.

**Offen bleibt** die eigene Herkunft je Vorschau (eigene Subdomain). Sie wird
gebraucht, sobald Vorschauen über eine URL teilbar werden; die opake Herkunft
schützt die Anwendung, aber die Vorschau liegt weiterhin im selben
Dokumentbaum.

S1 steht bewusst vorn. Jede andere Reihenfolge baut die Vorschau, bevor sie
sicher ist — und eine unsichere Vorschau lässt sich später nicht nachträglich
absichern, ohne sie neu zu bauen.

Der Publish Gate bleibt vor dem ersten Publish-Pfad (`CLAUDE.md` §14).

---

## 6a. Preview-Persistenz — die teilbare Adresse

Bis hierher lebte die Vorschau nur im Rahmen auf `/build`: gerendert im
Browser, aus dem Blueprint, ohne Adresse. Damit fehlte dem Trichter sein
kürzester Weg — „Sieh dir an, was aus deiner Seite geworden ist" lässt sich
nicht schicken, wenn es nichts zu schicken gibt.

Der Weg ist jetzt geschlossen:

```
build-anon  → Blueprint in siteos_anonymous_builds
            → renderSite(showcase) → PUT /p/<preview_id> (KV)
            → preview_id in der Sitzung, url in der Antwort
refine-anon → dieselbe Kennung, neuer Inhalt
claim       → DELETE /p/<preview_id>, preview_id = NULL
```

### Vier Festlegungen, und warum sie so sind

**1. Die Vorschau ist zweitrangig, die Sitzung ist die Wahrheit.** Schlägt
die Ablage fehl, ist der Entwurf trotzdem gebaut, gespeichert und
übernehmbar. Der Schreibpfad wirft deshalb nie; jeder Ausgang ist ein
Zustand in der Antwort (`preview.status`). Eine fehlende Vorschau ist ein
fehlendes Fenster, kein verlorenes Haus.

**2. Die Vorschau überlebt den Entwurf nicht.** Ihre Lebensdauer ist die
**Restzeit der Sitzung** bis `expires_at`, nicht sieben feste Tage. Eine
Verfeinerung am sechsten Tag verlängert sie nicht auf sieben weitere — sonst
stünde nach dem Verfall der Sitzung ein Dokument im Netz, zu dem es keinen
Entwurf mehr gibt. Die Zusage aus Art. 5 Abs. 1 lit. e DSGVO gilt für beide
Ablagen oder für keine.

**3. Die Kennung bleibt über Verfeinerungen bestehen.** Wer den Link geteilt
hat, sieht den neuen Stand, statt ins Leere zu laufen — und es entsteht
nicht bei jeder Anweisung eine weitere Kopie des Entwurfs im Netz.

**4. Der Claim nimmt sie zurück.** Ab der Übernahme gehört der Entwurf einem
Mandanten und folgt dessen Aufbewahrung; der Zweck der anonymen Ablage endet
damit (Art. 5 Abs. 1 lit. b DSGVO). Eine daneben weiterlaufende, ohne Konto
abrufbare Kopie wäre eine zweite Auslieferung desselben Inhalts. Best
effort: Der Claim ist bereits vollzogen und wird an einer Ablage, die nicht
antwortet, nicht rückgängig gemacht — welche Kennung es war und ob der
Widerruf gelang, steht im Prüfpfad (`siteos.build.claim`).

### Das Kontingent

Der Zähler aus `_shared/anonRateLimit.ts` liegt im Isolate-Speicher: Er
bremst einen Ansturm innerhalb einer Minute, überlebt aber kein Recycling und
kennt keine zweite Instanz. Als Kontingent taugt er nicht — genau das war der
gemeldete Befund.

Daneben steht jetzt ein Kontingent, das in der Datenbank zählt: **10 neue
Entwürfe je `ip_hash` und 24 Stunden**, über den Index
`siteos_anonymous_builds_ip_idx`, der seit Migration `20260822180000` genau
dafür liegt und von keiner Abfrage benutzt wurde. Es gilt über alle
Instanzen und überlebt Kaltstarts.

Verfeinerungen zählen nicht mit: Sie sind je Sitzung durch `MAX_VERSION`
begrenzt und legen keine weitere Zeile an. Ein zweites Kontingent darauf
bestrafte das Arbeiten am eigenen Entwurf.

Ist die Zählabfrage nicht lesbar, **schliesst** der Pfad (`503
QUOTA_UNAVAILABLE`) — dieselbe Regel wie beim Prüfpfad. Ein Kontingent, das
bei jedem Fehler alles durchlässt, ist keines.

### ⚠️ Offenes Gate: ohne diese Infrastruktur nicht in Betrieb

Das ist keine Konfigurationskleinigkeit, die man nebenbei nachträgt, sondern
die Bedingung dafür, dass Schritt 2 überhaupt etwas tut:

| Nötig | Wo | Stand |
|---|---|---|
| KV-Namespace `siteos_previews` | `workers/siteos-preview/wrangler.jsonc` | **vorhanden** |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | GitHub-Repo-Secrets | **offen** — `deploy-siteos-preview.yml` überspringt sich selbst |
| `PREVIEW_WRITE_TOKEN` | `npx wrangler secret put` (Worker) | **offen** |
| `SITEOS_PREVIEW_ORIGIN` | Supabase-Function-Secret | **offen** |
| `SITEOS_PREVIEW_WRITE_TOKEN` | Supabase-Function-Secret, **derselbe Wert** wie oben | **offen** |

Solange eines fehlt, antwortet der Bau `preview.status = "not_configured"`,
der Entwurf entsteht trotzdem, und `/build` zeigt keinen Teilen-Link statt
einer toten Adresse. Der Zustand ist benannt, nicht kaschiert — deshalb ist
er von einem echten Ausfall (`failed`) getrennt.

Geprüft ist der Schreibpfad unabhängig davon: `test/siteos/anon-preview.test.ts`
gegen ein `fetch`-Double, `test/security/siteos-preview-worker.test.ts` gegen
ein KV-Double. Was dadurch **nicht** geprüft ist: dass sich beide Seiten in
Produktion tatsächlich erreichen. Das kann nur ein Lauf gegen den deployten
Worker, und der ist bis zum Schliessen der Tabelle oben offen.

### Was `verify_jwt` damit zu tun hat — nichts

`supabase/config.toml` führt keinen Eintrag für `siteos`; damit gilt
`verify_jwt = true`. Das ist **richtig so** und kein Hindernis für den
anonymen Pfad: Der Browser schickt den Anon-Key, der selbst ein gültiges JWT
ist. Wer ohne Schlüssel anfragt, wird abgewiesen — und `claim` prüft
zusätzlich einen echten Nutzer, weil ein Anon-Key kein `auth.uid()` trägt.
Ein Eintrag mit `verify_jwt = false` würde die Funktion für Aufrufer ganz
ohne Schlüssel öffnen und nichts gewinnen.

---

## 6b. Nachweis gegen Produktion

Der Ablauf, mit dem der ausgelieferte Stand Ende-zu-Ende geprüft wird, steht
in **`docs/product/siteos-e2e-runbook.md`**. Er unterscheidet durchgängig
zwischen Prüfpunkten, die erfolgreich sein müssen, solchen, die fehlschlagen
müssen, und Messwerten, die nichts entscheiden — darunter das oben benannte
Infrastruktur-Gate der Worker-Vorschau.

---

## 7. Was diese Phase **nicht** ist

Kein weiterer Website-Builder. Der Unterschied zu einem generischen
Prompt-zu-App-Werkzeug ist nicht die Erzeugung, sondern was danach kommt:

```
Prompt → Build → Preview → Claim → Governance → Publish Gate → Deployment → Domain → Evidence
```

Erzeugen können viele. Belegen, dass ein bestimmtes Frontend aus einer
bestimmten Inhaltsversion entstanden, geprüft und danach freigegeben
veröffentlicht wurde, ist der Teil, den RealSync bereits im Unterbau hat —
`siteos_blueprints` mit `prev_hash`, `evidence_snapshots`,
`provenance_custody_events`.

Das ist eine **governed Design-to-Frontend-Pipeline**, kein Baukasten.
