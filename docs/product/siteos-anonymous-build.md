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
| S1 | Isolierte Vorschau-Herkunft + CSP (§3) | — |
| S2 | Anonyme Build-Session mit Gate, Kontingent und Verfall | S1 |
| S3 | `siteos/builder` für Sitzungen ohne Tenant öffnen | S2 |
| S4 | Interaktive Preview (Skripte laufen, aber isoliert) | S1 |
| S5 | Iteratives Nachbessern auf versionierten Blueprints | S3 |
| S6 | Project Claim: Entwurf → Tenant, verlustfrei | S3 |
| S7 | Governance-Lauf auf dem übernommenen Projekt | S6 |
| S8 | **Publish Gate** | S7 |
| S9 | Publish + eigene Domain | S8 |
| S10 | Entitlements und Verbrauchsabrechnung | S9 |

S1 steht bewusst vorn. Jede andere Reihenfolge baut die Vorschau, bevor sie
sicher ist — und eine unsichere Vorschau lässt sich später nicht nachträglich
absichern, ohne sie neu zu bauen.

Der Publish Gate bleibt vor dem ersten Publish-Pfad (`CLAUDE.md` §14).

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
