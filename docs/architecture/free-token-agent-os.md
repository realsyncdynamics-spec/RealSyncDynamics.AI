# Rotierendes Agenten-OS auf freien Kontingenten

**Status**: Konzept + Entscheidungsvorlage — nichts davon ist gebaut.
**Stand**: 2026-09-08, gemessen am Merge-Baum `claude/free-agents-free-tokens-d1z88p`
(Basis `main` @ `9587905`).
**Frage, die dieses Dokument beantwortet**: Wie bekommen wir so viele Agenten wie
möglich auf freie Modell-Kontingente — für die Plattform *und* den App-/Landingpage-Builder
— und wie wird daraus ein System, das rotierend immer das gerade freie Kontingent nimmt?

**Kurzantwort in einem Satz**: Es lohnt sich, aber nicht auf dem Weg, der zuerst
naheliegt — die freien Kontingente sind reichlich vorhanden, dürfen aber aus
Datenschutzgründen genau **die** Arbeit nicht sehen, für die wir bezahlt werden.
Der Wert liegt in der Breite (Klassifikation, Extraktion, Entwürfe, Eigenmarketing),
nicht in der Tiefe.

---

## 0. Was zu entscheiden ist

Fünf Entscheidungen, alle in §9 ausformuliert. Ohne sie ist keine Zeile Code sinnvoll:

| # | Entscheidung | Ohne sie passiert |
|---|---|---|
| E1 | Dürfen Inhalte einer **öffentlichen Kundenwebsite** über freie Lanes laufen? | Der Rotator bleibt auf Eigenbedarf beschränkt — ca. ⅓ des möglichen Nutzens |
| E2 | Ist **OpenRouter** als Aggregator zulässig (ein Schlüssel, viele Modelle)? | Jedes Modell braucht einen eigenen Adapter — der Ansatz skaliert nicht |
| E3 | Wird der **Providerpfad konsolidiert** (7 Functions umbauen)? | Rotation greift nur bei 6 von 14 Functions |
| E4 | Bekommt der VPS mehr RAM für eine größere lokale Lane? | Die einzig unbegrenzte freie Lane bleibt ein 4B-Modell |
| E5 | Darf ein freies Modell **Blueprint-Inhalte** erzeugen? | Empfehlung: **nein** — Begründung in §7, das ist die riskanteste Frage im Dokument |

---

## 1. Der Ausgangspunkt trägt nicht

Anlass war die Modell-Liste aus dem Cursor-Einstellungsdialog: rund 40 Modelle,
alle aktiviert — Claude Opus 5, GPT-5.6, Gemini 3.8, Grok, Kimi, GLM, Composer.

**Diese Liste ist keine Quelle freier Token für die Plattform.** Sie ist die
Modellauswahl **einer IDE**, abgerechnet über ein Cursor-Abo und erreichbar nur aus
dem Editor heraus. Eine Supabase Edge Function in Frankfurt kann keines dieser
Modelle aufrufen — es gibt keinen API-Schlüssel, keinen Endpunkt und keine
Lizenz, die das erlaubt. Was dort „aktiviert" ist, sagt nichts darüber aus, was
`ai-invoke` zur Laufzeit nutzen darf.

Der Denkfehler ist verständlich und teuer: Er verwechselt **Werkzeuge, mit denen
wir bauen** (Cursor, Claude Code) mit **Werkzeugen, die das Produkt betreibt**
(Edge Functions, Provider-Schlüssel im Vault). Für die erste Kategorie ist die
Modellvielfalt bereits gelöst und kostet ein Abo. Für die zweite fängt die Arbeit
bei null an.

Was *tatsächlich* freie Kontingente liefert, steht in §5. Es sind andere Anbieter,
andere Schlüssel und andere Bedingungen — und die Bedingungen sind der eigentliche
Inhalt dieses Dokuments.

---

## 2. Ist-Zustand — gemessen, nicht schätzt

Gezählt am Merge-Baum, jede Datei einzeln geprüft.

### 2.1 Es gibt nicht einen Providerpfad, es gibt drei

**14 Edge Functions rufen ein Sprachmodell. Sie tun es auf drei verschiedene Arten.**

| Pfad | Functions | Was er kann |
|---|---|---|
| `_shared/ai.ts` → `runAiTool()` | **6** — `ai-invoke`, `bot-chat`, `bot-voice-webhook`, `whatsapp-webhook`, `kodee-advise`, `kodee-diagnose` | Entitlement-Gate, Quota-Vorprüfung, Kostendeckel (`reserveLlmBudget`), Residency-Auflösung, `ai_tool_runs`-Prüfpfad. **Der einzige vollständige Pfad.** |
| `_shared/aiGateway/` → `ServerAiGateway` | **1** — `ai-gateway` | Adapter-Muster, Fallback-Kette LM Studio → Anthropic → OpenAI, OpenAI-kompatible Hülle, PDP-Anbindung. **Kein** Kostendeckel, **kein** `ai_tool_runs`. |
| Eigener Providerpfad, an beidem vorbei | **7** — `ai-act-classify`, `governance-agent`, `legal-embed`, `legal-retrieve`, `optimize-analyze`, `website-maintenance-agent`, `website-operations-agent` | `fetch('https://api.anthropic.com/…')` bzw. SDK direkt. Kein Gate, kein Deckel, kein Prüfpfad, keine Residency. |

**Die Hälfte der Modellaufrufe der Plattform läuft an beiden Routern vorbei.**
Das ist der Befund, der alles andere bestimmt: Ein Rotator, der nur an einem der
drei Pfade hängt, rotiert für maximal 6 von 14 Functions. Man kann kein
Kontingent verwalten, das an der Verwaltung vorbeiverbraucht wird.

Nebenbefund, unabhängig vom Thema, aber schwerer: Diese sieben Functions umgehen
auch `reserveLlmBudget` und `ai_tool_runs`. Für ein Produkt, das Prüfpfad und
Kostentransparenz zusagt, sind das sieben Modellaufrufe pro Anfrage, die in keiner
Abrechnung und in keinem Prüfpfad auftauchen.

### 2.2 Ein Werkzeug hat genau ein Modell — per Datenbankspalte

```sql
-- 20260430240000_ai_tools.sql, verschärft in 20260501120000
model_provider TEXT NOT NULL CHECK (model_provider IN ('anthropic','google','openai','ollama')),
model_id       TEXT NOT NULL,
ollama_model_id TEXT      -- die einzige Alternative, und nur für EU-lokal
```

Das Modell ist eine **Eigenschaft des Werkzeugs**, keine Entscheidung zur
Laufzeit. `runAiTool` liest die Zeile und ruft genau das, was dort steht. Rotation
ist in diesem Schema nicht ausdrückbar — nicht weil etwas fehlt, sondern weil die
Zuordnung fest verdrahtet ist.

Das ist die zweite strukturelle Schranke. Sie ist additiv lösbar (§6.1), aber sie
ist nicht klein: `ai_tools` ist eine Live-Tabelle mit Seed-Zeilen aus sechs
Migrationen.

### 2.3 Es gibt keinen Begriff von „freiem Kontingent"

Gesucht nach `free.?tier`, `daily.?quota`, `rpd`, `requests.?per.?day`,
`token.?budget` in `src`, `supabase`, `packages`, `shared`, `docs`:

- **Rate Limits** existieren (`_shared/aiGateway/rateLimit.ts`) — aber pro *Feature*
  und pro *IP*, in einer `Map` im Arbeitsspeicher des Isolates. Sie überleben keinen
  Kaltstart. Für Missbrauchsabwehr richtig, für Kontingentbuchhaltung unbrauchbar.
- **Kostendeckel** existieren (`cost_check_and_reserve`) — monatlich, in USD, pro
  Mandant, transaktionssicher in Postgres. **Das ist das richtige Muster** und die
  Vorlage für alles Folgende (§6.2).
- **Ein Begriff „dieser Schlüssel hat heute noch N Anfragen frei"** existiert
  nirgends. Er müsste neu gebaut werden.

### 2.4 Die lokale Lane läuft, ist aber klein

`deploy/ollama-traefik/docker-compose.yml` betreibt Ollama hinter Traefik auf
`ollama.realsyncdynamicsai.de` (VPS `194.163.130.123`). Das eingesetzte Modell ist
laut Migration `20260503120000` **`qwen3:4b`** — heruntergestuft von 7B, weil der
VPS **3,8 GB RAM** hat und das 4B-Q4-Modell mit ~2,5 GB gerade noch mit
Swap-Reserve passt.

Das ist die einzige Lane mit *unbegrenztem* freiem Kontingent und zugleich
EU-Datenhoheit. Sie ist real und sie läuft. Sie ist aber ein 4B-Modell auf einem
Kleinserver: gut für Klassifikation, Extraktion, Umformulierung; ungeeignet für
mehrstufiges Rechtsreasoning. Die Migration sagt das selbst — `vps_status` bekam
bewusst *kein* lokales Modell, „braucht Opus-Reasoning, lokal zu schwach".

---

## 3. Die Schranke, die den ganzen Ansatz formt

**Die meisten freien Kontingente sind kostenlos, weil der Anbieter die Eingaben
zur Modellverbesserung verwenden darf.** Das ist kein Kleingedrucktes, das ist das
Geschäftsmodell des freien Tarifs. Bezahlte Tarife derselben Anbieter schließen
das regelmäßig aus; die freien Tarife regelmäßig nicht.

Für dieses Produkt ist das keine Randnotiz, sondern ein Zielkonflikt im Kern:

> RealSyncDynamicsAI verkauft EU-Datenhoheit, DSGVO-Konformität, Prüfpfad und
> Evidence-Ketten. Mandantendaten durch einen freien Tarif zu schicken, der auf
> ihnen trainiert, wäre ein Governance-Befund **im eigenen Produkt** — und zwar
> genau der Sorte, die wir bei Kunden aufdecken und berechnen.

Es kommt hinzu: `resolve_ai_residency` existiert bereits und lässt Mandanten
`enforce_eu_local` erzwingen. Ein Rotator, der diesen Schalter umgeht, bricht eine
Zusage, die vertraglich gegeben wurde.

**Daraus folgt nicht „keine freien Kontingente".** Daraus folgt, dass die
Auswahl nicht nach Preis sortiert, sondern **zuerst nach Datenklasse** — und
innerhalb der erlaubten Lanes dann nach Kosten. Das ist der eigentliche Entwurf.

---

## 4. Das Konzept: Datenklassen vor Kosten

Jeder Modellaufruf bekommt eine Klasse. Die Klasse bestimmt die **Menge zulässiger
Lanes**; erst innerhalb dieser Menge rotiert der Rotator nach freiem Kontingent.

### Klasse 0 — Eigenbedarf

Nichts davon gehört einem Kunden. Wenn der Anbieter darauf trainiert, verlieren
wir nichts, was wir nicht ohnehin veröffentlichen.

- Marketing- und Landingpage-Texte für **unsere eigene** Seite, SEO-Cluster,
  Anzeigenvarianten, Betreffzeilen für den E-Mail-Drip
- Erklärung und Review **unseres eigenen** Codes
- Erzeugung synthetischer Testdaten, Fixtures, Beispielinhalte
- Übersetzungen der eigenen Oberfläche
- Zusammenfassung öffentlicher Rechtstexte (AI Act, DSGVO-Erwägungsgründe)

→ **Alle freien Lanes zulässig, ohne Einschränkung.** Hier gehört die Rotation
maximal ausgereizt. Das ist auch die Klasse mit dem größten Volumen im
Marketing-Betrieb.

### Klasse 1 — Kundenbezogen, aber öffentlicher Inhalt

Der *Inhalt* ist öffentlich im Netz erreichbar; die *Zuordnung* zu einem Mandanten
ist es nicht.

- Befunde aus dem Scan einer öffentlich erreichbaren Kundenwebsite
- Vorschläge für Texte auf **deren** Seite
- Wettbewerbsvergleiche aus öffentlichen Quellen

→ **Freie Lanes nur unter drei Auflagen**: (a) der Prompt trägt keine
Mandantenkennung, keinen Firmennamen des Auftraggebers, keine E-Mail; (b) der
Mandant steht nicht auf `enforce_eu_local`; (c) es ist entschieden, dass wir das
tun (**E1**). Ohne diese Entscheidung fällt Klasse 1 auf Klasse-2-Behandlung
zurück.

Diese Klasse ist der eigentliche Streitpunkt. Sie ist volumenstark — jeder Scan,
jeder Builder-Lauf — und sie ist juristisch nicht offensichtlich. Deshalb ist sie
eine Entscheidung des Eigentümers und keine Voreinstellung.

### Klasse 2 — Mandantendaten

Evidence, DPIA, DSR-Anträge, Vorfälle, Verträge, Bot-Nachrichten von Endkunden,
Logs, alles aus dem Evidence Vault.

→ **Niemals eine freie Lane.** Zulässig sind ausschließlich: die EU-lokale
Ollama-Lane, oder eine bezahlte Lane mit vertraglich zugesichertem
Trainingsausschluss. Das ist exakt das, was `resolve_ai_residency` heute schon
regelt — der Rotator muss diese Funktion respektieren, nicht ersetzen.

**Merksatz für die Umsetzung**: Die Klasse ist eine Eigenschaft des *Werkzeugs*,
nicht des Aufrufs. Sie gehört als Spalte an `ai_tools` und wird nicht vom Aufrufer
mitgegeben — sonst setzt sie irgendwann jemand falsch, und der Fehler ist
unsichtbar, weil ein falsch klassifizierter Aufruf genauso erfolgreich aussieht
wie ein richtiger.

---

## 5. Die Lanes — und warum ihre Grenzen in eine Tabelle gehören

### 5.1 Kandidaten

Alle Angaben sind **zu prüfen, nicht zu glauben**: Freikontingente ändern sich
häufiger als jede Dokumentation. Die Spalte „Datenlage" ist der Grund, warum die
Klasse aus §4 vor dem Preis kommt.

| Lane | Warum interessant | Datenlage | Klasse |
|---|---|---|---|
| **Ollama (eigener VPS)** | Läuft bereits, unbegrenzt, EU-lokal, keine Drittpartei | Verlässt das Haus nicht | **0, 1, 2** |
| **Cloudflare Workers AI** | Wir deployen bereits auf Cloudflare — gleicher Anbieter, gleicher Rand, tägliches Freikontingent | Prüfen; bezahlter Rand mit EU-Optionen | 0, 1 |
| **Mistral (FR)** | EU-Anbieter — passt zur Souveränitätserzählung, nicht nur technisch | Freier Tarif prüfen | 0, 1 |
| **Google Gemini (AI Studio)** | Großzügigstes Tagesfreikontingent am Markt | Freier Tarif wird regelmäßig zum Training verwendet | **nur 0** |
| **Groq / Cerebras** | Sehr schnell, freie Entwicklertarife — ideal für Klassifikation in Serie | Prüfen | 0 |
| **GitHub Models** | Wir haben bereits GitHub-Actions-Infrastruktur | Prüfen | 0 |
| **OpenRouter (`:free`-Modelle)** | **Ein Schlüssel, Dutzende Modelle** — siehe unten | Je Modell verschieden, teils Trainingsvorbehalt | nur 0, modellabhängig |

### 5.2 OpenRouter ist die eigentliche Antwort auf „so viele Modelle wie möglich"

Die ursprüngliche Frage war, wie wir viele Modelle nutzen. Der teure Weg ist, viele
SDKs zu integrieren. Der billige Weg ist ein **OpenAI-kompatibler Aggregator**:

Der Code dafür ist **bereits da**. `_shared/aiGateway/openaiAdapter.ts` und
`openaiCompat.ts` sprechen das OpenAI-Protokoll; OpenRouter, Groq, Cerebras,
Mistral, Ollama und LM Studio sprechen es ebenfalls. Was fehlt, ist im Kern eine
konfigurierbare `baseUrl` pro Lane statt einer festen.

**Ein Adapter, N Modelle.** Aus „40 Modelle integrieren" wird „eine Tabellenzeile
pro Modell". Das ist der Unterschied zwischen einem Projekt von Monaten und einem
von Tagen — und der Grund, warum **E2** die folgenreichste der fünf Entscheidungen
ist.

### 5.3 Grenzen sind Daten, kein Code

Kein Freikontingent gehört in eine TypeScript-Konstante. Sie ändern sich ohne
Ankündigung, und eine falsche Konstante führt entweder zu 429-Fehlern oder — teurer
— zum stillen Überlauf in die bezahlte Abrechnung desselben Schlüssels.

```
ai_provider_lanes
  lane_key            TEXT PRIMARY KEY    -- 'gemini_free', 'ollama_local', …
  base_url            TEXT                -- OpenAI-kompatibler Endpunkt
  vault_secret_name   TEXT                -- Schlüssel NIE in der Tabelle (§4 Security)
  max_data_class      SMALLINT            -- 0 | 1 | 2
  free_requests_per_day    INTEGER        -- NULL = unbegrenzt (Ollama)
  free_tokens_per_day      BIGINT
  requests_per_minute      INTEGER
  quality_tier        TEXT                -- 'small' | 'mid' | 'frontier'
  supports            TEXT[]              -- 'chat','json','embed'
  enabled             BOOLEAN
  cooldown_until      TIMESTAMPTZ         -- gesetzt nach 429/5xx
```

Der Betreiber trägt die Werte aus dem Anbieter-Dashboard ein. Die Schlüssel selbst
liegen im Vault, nicht in der Tabelle — dieselbe Trennung wie bei
`get_app_secret()`.

---

## 6. Der Rotator

### 6.1 Auswahl in fünf Schritten

```
runAiTool(tool, tenant, user, input)
  │
  ├─ 1. KLASSE       tool.data_class  (0 | 1 | 2)          ← Eigenschaft des Werkzeugs
  ├─ 2. RESIDENCY    resolve_ai_residency(tenant, user)     ← bestehende Funktion, hat Vorrang
  │                   eu_local  →  nur Lanes mit max_data_class = 2 und lokal
  ├─ 3. FILTER       Lanes mit  max_data_class >= tool.data_class
  │                            ∧ enabled ∧ cooldown_until < now()
  │                            ∧ supports ∋ task_type
  │                            ∧ quality_tier >= tool.min_quality
  ├─ 4. SORTIERUNG   frei-und-Kontingent-übrig  vor  frei-aber-knapp  vor  bezahlt
  │                   innerhalb gleicher Stufe: geringste Auslastung zuerst
  └─ 5. RESERVIERUNG lane_check_and_reserve(...)  →  Aufruf  →  lane_settle(...)
                      bei 429/5xx: cooldown setzen, nächste Lane, höchstens N Versuche
```

Schritt 2 ist nicht verhandelbar und steht **vor** jeder Kostenüberlegung. Ein
Mandant auf `enforce_eu_local` sieht nie eine freie Cloud-Lane, egal wie viel
Kontingent dort offen wäre.

### 6.2 Die Buchhaltung gehört in Postgres, nicht in den Arbeitsspeicher

Das ist der Punkt, an dem naive Umsetzungen scheitern. Edge-Function-Isolate sind
kurzlebig und parallel: Ein Zähler in einer `Map` — so wie ihn `rateLimit.ts` heute
für Missbrauchsabwehr führt — zählt pro Isolat und beginnt bei jedem Kaltstart neu.
Bei zwanzig gleichzeitigen Isolaten und einem Kontingent von 1000 Anfragen/Tag
überschreitet man es zuverlässig, ohne dass irgendein Zähler das je sieht.

**Es gibt bereits das richtige Muster im Haus**: `cost_check_and_reserve` /
`cost_writer_settle` aus `20260604000000_economic_intelligence.sql` — atomar
reservieren, ausführen, abrechnen, hängengebliebene Reservierungen per Sweep
freigeben. `lane_check_and_reserve` / `lane_settle` sollten dieses Muster
**kopieren, nicht neu erfinden**. Gleiche Semantik, gleiche Fehlerbehandlung,
gleiche Sweep-Logik — nur mit Anfragen und Token statt USD als Einheit.

Ein Detail mit Geldfolge: Bei den meisten Anbietern ist derselbe Schlüssel frei
*und* bezahlt — nach Erschöpfung des Freikontingents läuft die Abrechnung
weiter. Die Reservierung muss deshalb **hart sperren**, nicht warnen. Ein
Rotator, der bei erschöpftem Kontingent nur eine Warnung loggt, ist ein
Rotator, der eine Rechnung erzeugt.

### 6.3 Was der Prüfpfad zusätzlich führen muss

`ai_tool_runs` bekommt `lane_key` und `data_class`. Ohne beides lässt sich
hinterher nicht beantworten, welches Modell welche Daten gesehen hat — und genau
diese Frage stellt ein Auditor bei einem Produkt mit unseren Zusagen als erste. Das
ist kein Zusatzaufwand, das ist der Grund, warum wir das Konstrukt überhaupt
verantworten können.

---

## 7. Der Builder — hier ist die größte Gefahr, nicht die größte Chance

Zur ausdrücklichen Frage nach App- und Landingpage-Builder. Der Befund ist
unerwartet:

**`packages/siteos-core` ruft kein einziges Sprachmodell auf.** Gesucht nach
`gateway`, `anthropic`, `openai`, `llm`, `ai-invoke` — kein Treffer. Der „AI
Builder (Prompt → geprüfter Blueprint)" ist **deterministisch**: `synthesize.ts`
bildet einen Brief regelbasiert auf einen Blueprint ab.

Das ist kein Versäumnis, das ist eine tragende Eigenschaft. CLAUDE.md hält sie
zweifach fest:

> „gleicher Brief ⇒ gleicher Blueprint ⇒ gleicher Hash"

und die Regel vom 2026-09-01, dass ein Vorschau-Block, der etwas über ein fremdes
Unternehmen behauptet, eine **Quelle** braucht — sonst bleibt er leer und trägt
`requiresRealContent: true`.

**Ein rotierendes Sprachmodell in den Blueprint-Pfad zu setzen, zerstört beides
gleichzeitig.** Der Hash wird nichtdeterministisch (schon derselbe Prompt auf
derselben Lane liefert nicht zweimal dasselbe, geschweige denn auf rotierenden
Lanes). Und ein freies Modell, das eine Landingpage füllt, erzeugt genau den
Fehler, der am 2026-09-01 gemeldet wurde: „Persönliche Betreuung — Feste
Ansprechpartner statt Warteschleife", ausgeliefert an jeden Kunden jeder Branche,
belegt durch nichts. Der Screenshot dieses Vorfalls war der Anlass für die
strengste Inhaltsregel im Repo. Ein billigeres Modell macht diesen Fehler nicht
seltener, sondern öfter und schlechter.

**Deshalb: freie Agenten gehören neben den deterministischen Kern, nie hinein.**

| Sinnvoll (Klasse 0/1, freie Lanes) | Verboten (§10, Determinismus) |
|---|---|
| Vorschläge für Texte **zur Freigabe** — außerhalb des Blueprints, mit Herkunftsvermerk | Blueprint-Inhalte direkt erzeugen |
| Klassifikation von Scan-Befunden nach Dringlichkeit | Befund-Codes oder Scoring-Gewichte bestimmen |
| Extraktion von Branche/Ort/Leistungen aus dem Scan → `brief.highlights` (der Kanal existiert bereits!) | `defaultServices` erfinden — bis heute nicht freigegeben |
| Entwürfe für **unsere eigenen** Branchen-Landingpages (Klasse 0) | Inhalte für Kundenseiten ohne Quelle |
| Verständliche Erklärung eines Befundes für den Kunden | Den Befund selbst bestimmen |

Der Kanal `brief.highlights` ist dabei die konkreteste Gelegenheit im ganzen
Dokument: Er wurde am 2026-09-01 angelegt und ist seither **leer**, weil der Scan
keine zweite unabhängige Quelle für „Warum wir" liefert. Ein Extraktions-Agent auf
einer freien Lane, der *belegte* Vorzüge aus dem gescannten Text zieht — mit
Fundstelle, nicht erfunden — füllt genau diese Lücke, ohne eine einzige Regel zu
brechen. Das ist der beste erste Anwendungsfall, den der Builder zu bieten hat.

---

## 8. Umsetzung in Stufen

Jede Stufe ist für sich nützlich und für sich abbrechbar. Keine setzt eine spätere
voraus.

**P0 — Messen, was wir verbrauchen** *(klein, keine Entscheidung nötig)*
`ai_tool_runs` um `lane_key` und `data_class` erweitern; die sieben Functions aus
§2.1 mit eigenem Providerpfad zumindest **protokollieren** lassen. Ergebnis: Zum
ersten Mal eine belastbare Zahl, wie viele Aufrufe pro Tag überhaupt anfallen und
in welcher Klasse. Ohne diese Zahl ist jede Aussage über eingespartes Geld geraten.

**P1 — Datenklasse einführen** *(Voraussetzung für alles Weitere)*
Spalte `data_class` an `ai_tools`, Vorgabe **2** (strengste) für alle Bestandszeilen
— fail-closed, wie bei den PDP-Schaltern. Danach zeilenweise herabstufen, wo es
belegbar ist. Noch keine Rotation, nur die Klassifikation.

**P2 — Lane-Registry + lokale Lane als erste Rotation** *(erster echter Nutzen)*
`ai_provider_lanes` anlegen; als erste zwei Lanes `ollama_local` und die
bestehende bezahlte Anthropic-Lane. Rotation zwischen genau diesen beiden nach
Klasse. Kein neuer Anbieter, kein neuer Vertrag — aber der komplette Mechanismus
ist gebaut und im Betrieb erprobt, bevor Fremdanbieter dazukommen.

**P3 — Freie Lanes im Beobachtungsbetrieb** *(braucht E1, E2)*
Ein OpenAI-kompatibler Adapter mit konfigurierbarer `baseUrl`. Erste freie Lane
für **Klasse 0 ausschließlich**. Betrieb im Schattenmodus nach dem Muster der
PDP-Schalter: Der Rotator *berechnet* seine Wahl und protokolliert sie, führt aber
weiter die alte Lane aus. Ausgewertet wird wie bei `pdp_shadow_readiness()` — und
zwar wirklich ausgewertet, mit derselben Lehre im Rücken: Ein leeres
Schattenprotokoll heißt zuerst „nachsehen, ob überhaupt geschrieben wird".

**P4 — Enforcement + Klasse 1** *(braucht E1, und die Auswertung aus P3)*
Umschalten von `shadow` auf `enforce`, Lane für Lane, Klasse für Klasse. Ein
Schalter `LANE_ROTATION_MODE` in derselben Reihe wie die sechs bestehenden
Enforcement-Schalter, mit denselben Regeln: nie still einschalten,
fail-closed, vorher das Protokoll auswerten.

**Konsolidierung (E3) läuft quer dazu** und ist unabhängig vom Rotator
gerechtfertigt: Die sieben Functions ohne Kostendeckel und ohne Prüfpfad sind
heute schon ein Befund. Der Rotator ist nur der Anlass, ihn endlich zu beheben.

---

## 9. Die fünf Entscheidungen

**E1 — Klasse 1 über freie Lanes?**
Dürfen Inhalte einer *öffentlich erreichbaren* Kundenwebsite über einen freien
Tarif laufen, wenn der Prompt keine Mandantenkennung trägt? Ja verdreifacht etwa
das nutzbare Volumen. Nein hält den Rotator auf Eigenbedarf und ist die
konservative, mit unserer Außendarstellung bruchlos vereinbare Antwort.
*Empfehlung: erst nein, nach P3-Auswertung neu bewerten.*

**E2 — OpenRouter oder Einzelanbieter?**
Ein Aggregator bringt Dutzende Modelle über einen Adapter, verlagert aber die
Datenfrage in dessen Bedingungen und pro Modell. Einzelanbieter sind sauberer
zuzuordnen und teurer in der Pflege.
*Empfehlung: ja für Klasse 0, mit ausdrücklicher Modell-Positivliste statt
Platzhalter.*

**E3 — Die sieben Functions konsolidieren?**
Aufwand real, Nutzen doppelt (Rotation greift überall; Kostendeckel und Prüfpfad
werden vollständig).
*Empfehlung: ja, unabhängig vom Rotator — es ist heute schon ein offener Befund.*

**E4 — VPS aufrüsten?**
3,8 GB RAM begrenzen die einzige unbegrenzte freie Lane auf ein 4B-Modell. Ein
Sprung auf 16 GB (Größenordnung 20–30 €/Monat) macht ein 14B-Modell möglich und
verschiebt spürbar Arbeit aus Klasse 2 von bezahlt nach frei.
*Empfehlung: ja — vermutlich das beste Verhältnis von Kosten zu Wirkung im ganzen
Dokument, und es berührt keine einzige Datenschutzfrage.*

**E5 — Freie Modelle im Builder-Inhaltspfad?**
*Empfehlung: nein für den Blueprint (Determinismus, Hash, §10-Inhaltsregel),
ja für Extraktion und Klassifikation daneben — beginnend mit `brief.highlights`.*

---

## 10. Was ausdrücklich nicht gebaut werden sollte

- **Kein Rotator ohne Datenklassen.** Nach Preis zu sortieren ist einfacher und
  wäre der erste ernsthafte Selbstwiderspruch des Produkts.
- **Keine Kontingentzählung im Arbeitsspeicher.** Isolate sind kurzlebig; der
  Zähler zählt falsch und der Überlauf wird berechnet.
- **Keine Freikontingente als Konstanten im Code.** Sie ändern sich ohne
  Ankündigung; sie gehören in die Tabelle, gepflegt vom Betreiber.
- **Kein Sprachmodell in `synthesize.ts`.** Zerstört den Blueprint-Hash und die
  Inhaltsehrlichkeitsregel in einem Zug.
- **Kein stilles Einschalten.** Derselbe Weg wie bei den sechs PDP-Schaltern:
  `off` → `shadow` → auswerten → `enforce`.
- **Keine Zusage nach außen, dass wir freie Modelle nutzen**, solange E1 nicht
  entschieden ist. Es ist ein Kostenmechanismus, kein Verkaufsargument — und als
  Verkaufsargument wäre es angreifbar.

---

## Anhang: Messmethode

Alle Zahlen dieses Dokuments stammen aus dem Merge-Baum vom 2026-09-08, nicht aus
der Produktion und nicht aus Erinnerung.

```bash
# 14 LLM-aufrufende Functions, aufgeteilt nach Pfad
grep -rln "runAiTool" supabase/functions/ | grep -v _shared          # → 6
grep -rln "ServerAiGateway" supabase/functions/ | grep -v _shared    # → 1
# Rest: eigener Providerpfad                                          # → 7

# Kein Begriff von freiem Kontingent
grep -rniE "free.?tier|daily.?quota|rpd|requests.?per.?day|token.?budget" \
     src supabase packages shared docs        # nur Plan-Tarife, keine Provider-Kontingente

# Builder ruft kein Modell
grep -rn "gateway\|anthropic\|openai\|llm\|ai-invoke" packages/siteos-core/src/ --include=*.ts
                                              # → leer
```

Was **nicht** gemessen wurde und vor P2 gemessen gehört: der tatsächliche
Tagesverbrauch an Modellaufrufen in Produktion (`ai_tool_runs` ist dafür nur zu
6/14 aussagekräftig — siehe P0), und ob die Ollama-Lane unter Last hält.
