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
| S2 | Anonyme Build-Session mit Gate, Kontingent und Verfall | **umgesetzt** — `siteos-anon` |
| S3 | Erzeugung für Sitzungen ohne Tenant | **umgesetzt** — eigene Function statt Router-Öffnung |
| S4 | Interaktive Preview (Skripte laufen, aber isoliert) | S1 |
| S5 | Iteratives Nachbessern auf versionierten Blueprints | **umgesetzt** — siehe unten |
| S6 | Project Claim: Entwurf → Tenant, verlustfrei | **umgesetzt** — `siteos/claim` |
| S7 | Governance-Lauf auf dem übernommenen Projekt | S6 |
| S8 | **Publish Gate** | **umgesetzt** — vor dem ersten Publish-Pfad |
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

### S5 — Iteration umgesetzt (Stand 2026-08-22)

`POST /functions/v1/siteos-anon/iterate` mit `{ draft_key, instruction }`.

Der Kern liegt in `packages/siteos-core/src/blueprint/edit.ts` (Anwenden) und
`edit-intent.ts` (Freitext deuten). Beides ist rein: kein Modellaufruf, keine
Uhr, kein Zufall — gleicher Blueprint plus gleiche Anweisung ergibt denselben
Hash.

**Die Regel, an der alles hängt:** Es wird nicht neu gebaut. `iterate.ts`
importiert `parseBrief` und `synthesizeBlueprint` nicht — dieselbe Trennung
wie im Claim-Handler. Was nicht importiert ist, kann nicht versehentlich
aufgerufen werden. `test/siteos/iteration-claim-chain.test.ts` prüft
zusätzlich, dass eine Neuerzeugung aus demselben Prompt einen **anderen** Hash
ergäbe; der Test schlägt fehl, sobald jemand die Iteration umstellt.

#### Was die Runtime ausführen kann — und nur das

| Anweisung | Wirkung im Blueprint | sichtbar durch |
|---|---|---|
| „Mach den Hero grösser" | `hero.content.emphasis` | `data-emphasis` + zwei CSS-Regeln |
| „Überschrift: …" / „Untertitel: …" | `hero.content.headline` / `.subline` | Text |
| „Name: …" | `name`, `seo`, Navigation — **nicht** `slug` | Text |
| „Mach die Akzentfarbe grün" | `theme.accent` | `--accent` |
| „Mach die Seite heller" | `theme.mode` **und** `surface`/`foreground` | `--surface` |
| „Mach die Ecken runder" | `theme.radiusPx` | `--radius` |
| „Entferne die Team-Sektion" | Block entfernt, Compliance neu berechnet | Markup |
| „Füge das Team wieder hinzu" | Block aus der Synthese zurückgeholt | Markup |

Alles andere wird **abgelehnt und benannt** (`422 INTENT_UNSUPPORTED`), mit
`EDIT_CAPABILITIES` als Antwort. Es wird nicht genähert: Eine geratene
Änderung landet sonst in einer Fassung, die der Besucher anschliessend
übernimmt.

Zwei Entscheidungen, die dahinter stehen:

- **`theme.mode` allein wäre eine Attrappe.** Das Stylesheet liest Flächen-
  und Textfarbe, nicht den Modus. „Heller" führt deshalb beide mit — sonst
  gäbe es einen neuen Hash bei unveränderter Ansicht.
- **Der Hero brauchte Renderer-Unterstützung.** „Grösser" liess sich vorher
  nicht ausführen; das Attribut und die beiden CSS-Regeln sind dafür
  hinzugekommen. Ohne `emphasis` erscheint kein Attribut, das Markup
  bestehender Blueprints ändert sich also nicht. Die zwei CSS-Regeln stehen
  dagegen ab jetzt in jedem Stylesheet — ein neu gerendertes Artefakt hat
  deshalb einen anderen Hash als vor dieser Änderung. Gespeicherte Artefakte
  und ihre Bewertungen bleiben gültig; eine alte Bewertung deckt ein neues
  Artefakt schlicht nicht ab, was `evaluationCoversArtifact` bereits abfängt.

#### Was nicht entfernt werden kann

`PROTECTED_BLOCK_KINDS` = `navigation`, `footer`, `legal-text`,
`ai-disclosure`. Der KI-Hinweis nach Art. 50 EU AI Act und die
Pflichtverlinkung auf Impressum und Datenschutzerklärung stehen im Blueprint,
damit sie niemand wegklickt — für die Erzeugung sagt das der Kommentar in
`synthesize.ts`, für die Änderung gilt es hier.

Ein zu schwacher Farbkontrast wird dagegen **zugelassen**. Er ist kein
ungültiger Wert, sondern ein Befund: Die Barrierefreiheits-Analyse erhebt ihn,
der Publish Gate wertet ihn. Ihn hier abzulehnen hiesse, ihn zu verstecken.

#### Fassungskette

Migration `20260827000000_siteos_draft_revisions.sql`:
`siteos_anonymous_draft_revisions` hält je Fassung Hash, Vorgänger-Hash und
Operation. Append-only, Deny-by-default-RLS wie die Elterntabelle,
`ON DELETE CASCADE` — verfällt der Entwurf, verfällt die Kette mit ihm.

Gespeichert wird der **Hash** der Anweisung, nie ihr Wortlaut. Dieselbe Regel
wie beim ursprünglichen Prompt: Wer kein Konto hat, hat in keine Speicherung
seiner Formulierungen eingewilligt (DSGVO Art. 5 Abs. 1 lit. c).

`UNIQUE (draft_id, revision)` ist zugleich die **Sperre** gegen gleichzeitige
Änderungen — bewusst der Eintrag im Prüfpfad und nicht die Aktualisierung des
Entwurfs: Wer die Kette nicht schreiben konnte, hat die Fassung nicht erzeugt
und darf sie deshalb auch nicht ablegen. Gegen echtes PostgreSQL geprüft:
Von zwei gleichzeitigen Änderungen gewinnt genau eine, der Verlierer bekommt
`23505`; das bedingte `UPDATE` des Verlierers trifft 0 Zeilen; ein
übernommener Entwurf lässt sich gar nicht mehr ändern.

#### Grenzen, die bewusst so stehen

- Die Vorschau behält **dieselbe Kennung** über alle Fassungen. Eine neue
  Adresse je Änderung bräche jeden geteilten Link.
- Die Verfallszeit wird durch eine Änderung **nicht verlängert**. Sonst hielte
  sich ein Entwurf durch Betrieb beliebig lange am Leben.
- Höchstens `ANON_DRAFT_MAX_REVISIONS` (60) Fassungen je Entwurf. Die Grenze
  hängt am Entwurf, nicht an der Herkunft, und ist damit nicht durch einen
  Adresswechsel zu umgehen.
- `block.add` holt praktisch nur zurück, was vorher entfernt wurde: Die
  Branchen-Presets bringen ihre Abschnitte vollständig mit. Die Beschriftung
  in `EDIT_CAPABILITIES` sagt das auch so.

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
