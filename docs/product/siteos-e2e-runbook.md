# Runbook — SiteOS Ende-zu-Ende gegen Produktion (Variante A)

**Stand: 2026-08-22, nach dem Merge von #1117 (`86640cf`) und dem Deploy.**

## Anspruch dieses Laufs

> Der aktuell ausgerollte Produktkern von anonymem Build über die Übernahme
> bis zur DB-seitigen Publish-Governance funktioniert Ende-zu-Ende.

**Ausdrücklich nicht der Anspruch:** „Die Vorschau funktioniert live."

Der Abnahmesatz, an dem der Lauf gemessen wird:

> Die Übernahme sichert exakt den bereits erzeugten Blueprint (`SHA_V2`),
> erzeugt keine zweite Fassung, und der Publish Gate lässt seine
> Governance-Entscheidung weder durch Client-Eingaben noch durch direkte
> Änderung der generierten Datenbank-Eigenschaft beeinflussen.

---

## Wie dieses Runbook zu lesen ist

Jeder Prüfpunkt trägt genau eine der drei Kennzeichnungen. Sie sind nicht
Geschmackssache, sondern entscheiden, was ein roter oder grüner Lauf bedeutet:

| Kennzeichnung | Bedeutung |
|---|---|
| **✅ MUSS ERFOLGREICH SEIN** | Schlägt es fehl, ist der ausgelieferte Kern defekt. Der Lauf gilt als nicht bestanden. |
| **⛔ MUSS FEHLSCHLAGEN** | Ein Erfolg hier ist der eigentliche Schaden. Diese Punkte prüfen Schranken, keine Funktionen. |
| **📋 NUR GEMESSEN** | Wird protokolliert, entscheidet aber nichts. Entweder ein bewusst nicht implementierter Pfad oder ein bereits gemeldeter, angenommener Befund. |

Ein Lauf ist bestanden, wenn **alle ✅ zutreffen und alle ⛔ tatsächlich
scheitern**. 📋-Punkte können jeden Wert annehmen, ohne das Ergebnis zu
verändern — sie sind dokumentierte Wirklichkeit, kein Urteil.

---

## Voraussetzungen (Ausführungs-Gate)

Der Lauf beginnt erst, wenn **alle sechs** Punkte erfüllt sind:

- [ ] **Dedizierter Testmandant** festgelegt (`TENANT_A`) — nicht der
      Produktivmandant. Der Lauf schreibt in fünf Tabellen; Isolation geht
      vor Bequemlichkeit.
- [ ] **Test-Benutzer** mit Mitgliedschaft in `TENANT_A`.
- [ ] **Gültiges User-JWT** aus einer bereits autorisierten Sitzung. Es wird
      **nicht** erzeugt, und es wird **keine** Auth-Umgehung eingebaut — ein
      manueller Login ist die externe Voraussetzung für Schritt 5, kein
      Hindernis, das man umgeht.
- [ ] **Zweiter Mandant** (`TENANT_B`) mit getrenntem Mitgliedschafts-Kontext,
      damit der Cross-Tenant-Negativpfad wirklich bewiesen und nicht nur
      synthetisch erzeugt wird.
- [ ] **Dieses Runbook eingecheckt.**
- [ ] Erst danach Schritt 1.

### Endpunkte und Auth

| | |
|---|---|
| Basis | `https://ebljyceifhnlzhjfyxup.supabase.co/functions/v1/siteos/<endpunkt>` |
| Pfadregel | `resolveEndpoint` nimmt das Segment hinter `siteos` (`supabase/functions/siteos/resolve.ts`) |
| Alle Aufrufe | `apikey: <publishable anon key>` — `siteos` hat keinen `config.toml`-Eintrag, also gilt `verify_jwt = true` |
| Anonyme Endpunkte | `Authorization: Bearer <anon key>` genügt |
| `claim`, `publish-gate`, `publish-approve` | `Authorization: Bearer <User-JWT>` |

### Was der Lauf hinterlässt

Der stündliche Purge (`purge_expired_anonymous_builds`, Cron
`siteos-anonymous-builds-purge-hourly`) entfernt **nur nicht übernommene**
Entwürfe. Nach dem Lauf bleiben stehen: je eine Zeile in
`siteos_anonymous_builds` (übernommen), `siteos_blueprints`,
`siteos_publish_evaluations`, `siteos_runtime_scans` und `siteos_scores`.
Deshalb der eigene Testmandant.

---

## 1 — Anonymer Build

```http
POST /siteos/build-anon
{ "prompt": "Zahnarztpraxis in Hamburg mit Terminbuchung und Team-Seite", "locale": "de" }
```

- ✅ `200`, `ok: true`
- ✅ `session_id` ist eine UUID — zugleich das Zugriffsmittel; sie geht genau
  einmal über die Leitung
- ✅ `version === 1`
- ✅ `content_sha256` passt auf `^[0-9a-f]{64}$` → **als `SHA_V1` festhalten**
- ✅ `blueprint.origin.model === null` — Art. 50 EU AI Act: Es wird keine KI
  behauptet, wo keine war
- ✅ `blueprint.slug`, `findings`, `scores` vorhanden

---

## 2 — Datenbank-Evidenz nach dem Build

```sql
-- 2a
SELECT id, version, claimed_at, expires_at > now() AS gueltig,
       ip_hash IS NOT NULL AS ip_gehasht
FROM public.siteos_anonymous_builds WHERE id = :session_id;
```
- ✅ `claimed_at` ist `NULL` — der Entwurf gehört niemandem
- ✅ `gueltig` ist `true`
- ✅ `ip_gehasht` ist `true` — die Klartext-IP wird nie gespeichert

```sql
-- 2b  Der Prüfpfad wurde VOR der Arbeit geschrieben
SELECT op, outcome FROM public.anon_chat_runs
WHERE op = 'siteos_build_anon' ORDER BY created_at DESC LIMIT 1;
```
- ✅ `outcome = 'success'`

```sql
-- 2c
SELECT preview_id FROM public.siteos_anonymous_builds WHERE id = :session_id;
```
- 📋 **`preview_id` ist `NULL`, und das ist der erwartete Wert.** Auf `main`
  existiert kein Codepfad, der in den Preview-Worker schreibt:
  `SITEOS_PREVIEW_ORIGIN` und `PREVIEW_WRITE_TOKEN` kommen in
  `supabase/functions/` nirgends vor. Die Worker-Vorschau ist **nicht
  implementiert**, nicht bloss unkonfiguriert — kein Setzen von Secrets
  ändert daran etwas. Dieser Messpunkt steht hier, damit ein grüner Lauf den
  Pfad nicht versehentlich als vorhanden ausweist.

---

## 3 — Verfeinerung

```http
POST /siteos/refine-anon
{ "session_id": "<SESSION_ID>", "instruction": "Mach den Hero größer." }
```

- ✅ `unchanged: false`, `understood: true`, `changes` nicht leer
- ✅ `version === 2`
- ✅ `content_sha256 !== SHA_V1` → **als `SHA_V2` festhalten**
- ✅ Der Hero-Block trägt `emphasis` — die Anweisung wirkt, sie wird nicht nur
  quittiert

**3b — nicht verstandene Anweisung**
```json
{ "instruction": "Mach es irgendwie schöner und moderner." }
```
- ✅ `unchanged: true`, `refusals` gefüllt, **`version` unverändert**. Eine
  nicht verstandene Anweisung darf nicht als unveränderte Vorschau durchgehen.

**3c — Pflichtangabe**
```json
{ "instruction": "Entferne den KI-Hinweis." }
```
- ⛔ **Die Entfernung muss fehlschlagen** — abgelehnt *und begründet*
  (Art. 50 EU AI Act), Blueprint unverändert.

---

## 4 — Sitzung lesen

```http
POST /siteos/session   { "session_id": "<SESSION_ID>" }
```
- ✅ `version === 2`, `content_sha256 === SHA_V2`
- ✅ Blueprint identisch zur Antwort aus Schritt 3 — der Neuladen-Fall: Was
  der Besucher nach einem Reload sieht, ist dasselbe

---

## 5 — Übernahme

```http
POST /siteos/claim
Authorization: Bearer <User-JWT>
{ "tenant_id": "<TENANT_A>", "session_id": "<SESSION_ID>" }
```

- ✅ `200`, `already_claimed: false`, `blueprint_id` vorhanden
- ✅ **`content_sha256 === SHA_V2`** — der Kern des ganzen Laufs
- ✅ `provenance_linked` — Herkunftsnachweis geschrieben

---

## 6 — Der entscheidende Nachweis: keine zweite Erzeugung

```sql
-- 6a
SELECT content_sha256 = :SHA_V2 AS hash_identisch, origin_source, version, status
FROM public.siteos_blueprints WHERE id = :blueprint_id;
```
- ✅ `hash_identisch = true`
- ✅ `origin_source = 'ai-builder'` — entscheidet später die Backend-Feststellung
- ✅ `status = 'draft'`

```sql
-- 6b
SELECT count(*) FROM public.siteos_blueprints
WHERE tenant_id = :TENANT_A AND slug = :slug;
```
- ✅ Ergebnis ist **`1`**. Wären es zwei, hätte die Übernahme neu gebaut —
  genau der Fall, den der ganze Aufbau ausschliessen soll.

```sql
-- 6c
SELECT claimed_blueprint_id = :blueprint_id AS verknuepft,
       claimed_tenant_id = :TENANT_A       AS mandant_stimmt,
       claimed_at IS NOT NULL              AS uebernommen,
       content_sha256 = :SHA_V2            AS hash_unveraendert
FROM public.siteos_anonymous_builds WHERE id = :session_id;
```
- ✅ Alle vier Spalten `true`

---

## 7 — Idempotenz und Mandantengrenze

**7a** Schritt 5 unverändert wiederholen
- ✅ `already_claimed: true` mit **derselben** `blueprint_id`
- ✅ 6b liefert weiterhin `1`

**7b** Übernahme mit `TENANT_B` (Benutzer ist dort Mitglied, der Entwurf
gehört aber `TENANT_A`)
- ⛔ **Muss fehlschlagen: `409 CONFLICT`**, nicht `404`. Der Unterschied
  zählt — „gehört jemand anderem" ist etwas anderes als „gibt es nicht".

**7c** `refine-anon` mit derselben `session_id` nach der Übernahme
- ⛔ **Muss fehlschlagen: `409 CONFLICT`.** Ab der Übernahme ist der Mandant
  zuständig; am anonymen Schlüssel vorbei wird nicht mehr geschrieben.

---

## 8 — Publish Gate

```http
POST /siteos/publish-gate
Authorization: Bearer <User-JWT>
{ "tenant_id": "<TENANT_A>", "blueprint_id": "<BLUEPRINT_ID>" }
```

- ✅ `200` mit `evaluation`: `status`, `publishable`, `blockers`, `warnings`,
  `artifact_sha256`, `evaluation_id`
- ✅ `backend_preservation === 'preserve_all'` — abgeleitet aus
  `origin_source = 'ai-builder'`, **nicht** aus der Anfrage
- 📋 Das tatsächliche `status` / `publishable` wird **protokolliert, nicht
  vorhergesagt**. Ob eine frisch gebaute Site durchgeht, hängt an den
  Befunden; `passed`, `pending` und `blocked` sind alle gültige Ergebnisse,
  solange die mitgelieferte Begründung dazu passt.

### 8b — G1-Regressionsnachweis (der Fix aus #1120)

Derselbe Aufruf, diesmal mit untergeschobener Behauptung:

```json
{ "tenant_id": "…", "blueprint_id": "…",
  "backend": { "kind": "transformation",
               "comparison": { "lostFormTargets": [], "lostPaymentPaths": [],
                               "lostBookingPaths": [], "lostApiEndpoints": [],
                               "lostConsentCategories": [] } } }
```
- ⛔ **Die Behauptung muss wirkungslos bleiben**: Ergebnis identisch zu 8a.
  Vor #1120 hätte ein leerer Vergleich `preserve_all` gesetzt.

Gegenprobe:
```json
{ "backend": { "kind": "greenfield" } }
```
- ⛔ **Ebenfalls wirkungslos.** Beide Wege zu `preserve_all` sind geschlossen;
  allein `origin_source` entscheidet.

---

## 9 — Durchsetzung in der Datenbank (G4)

```sql
-- 9a
SELECT status, publishable, backend_preservation, evidence_complete,
       policy_compliant, human_approval_required, artifact_sha256
FROM public.siteos_publish_evaluations
WHERE tenant_id = :TENANT_A ORDER BY evaluated_at DESC LIMIT 1;
```
- ✅ Die Bewertung existiert

```sql
-- 9b
UPDATE public.siteos_publish_evaluations SET publishable = true WHERE id = :evaluation_id;
```
- ⛔ **Muss fehlschlagen** — „column publishable can only be updated to
  DEFAULT". Ein Erfolg hier wäre der Totalausfall der Governance-Zusage: Die
  Freigabe liesse sich dann an ihren Gründen vorbei setzen, was G4
  ausdrücklich ausschliesst.

```sql
-- 9c
INSERT INTO public.siteos_publish_evaluations (…, publishable) VALUES (…, true);
```
- ⛔ **Muss ebenfalls fehlschlagen.** Auch ein Schreibpfad mit `service_role`
  kommt nicht daran vorbei.

```sql
-- 9d
SELECT publishable = (status = 'passed' AND evidence_complete
       AND backend_preservation = 'preserve_all' AND policy_compliant
       AND NOT human_approval_required) AS regel_haelt
FROM public.siteos_publish_evaluations WHERE id = :evaluation_id;
```
- ✅ `regel_haelt = true` — die generierte Spalte entspricht der Regel aus §7
  der Zielarchitektur

---

## 10 — Negativpfade

| Fall | Aufruf | Erwartung | |
|---|---|---|---|
| Ohne Benutzer-JWT | `publish-gate` nur mit anon key | `401 UNAUTHORIZED` | ⛔ |
| Ohne Mitgliedschaft | `publish-gate` mit `TENANT_B` | `403 FORBIDDEN` „not a member of this tenant" | ⛔ |
| Freigabe ohne Berechtigung | `publish-approve` als Rolle ausserhalb `owner`/`admin`/`dpo` | `403` | ⛔ |
| Freigabe ohne Grund | `publish-approve`, `reason` unter 10 Zeichen | `400` — „an approval without a reason is a flag, not an approval" | ⛔ |
| Freigabe für eine nicht wartende Bewertung | `publish-approve` auf `human_approval_required = false` | `409 CONFLICT` | ⛔ |
| Erfundene Sitzung | `session` mit zufälliger UUID | `404` | ⛔ |
| Abgelaufene Sitzung | nur per DB-Eingriff konstruierbar | `410 GONE` | ⛔ |

### 10b — Anonymes Kontingent

Sechs `build-anon` innerhalb einer Minute aus derselben Quelle.

- 📋 **Ein ausbleibender `429` ist kein Testfehler.** Die Grenze liegt bei 5
  je 60 Sekunden, aber der Zähler liegt im Arbeitsspeicher der Isolate
  (`_shared/anonRateLimit.ts`), überlebt keinen Kaltstart und zählt bei
  mehreren Instanzen getrennt. Bleibt der `429` aus, **bestätigt das den
  bereits gemeldeten Befund** „kein dauerhaftes Kontingent für den anonymen
  Schreibpfad" — es widerlegt nicht den Produktkern.

---

## 11 — Was der Lauf belegt, und was nicht

**Belegt, wenn alle ✅ zutreffen und alle ⛔ scheitern:**

- Ein nicht registrierter Besucher kann eine Site erzeugen und ändern.
- Die Änderung wirkt; nicht Verstandenes wird als solches gemeldet;
  Pflichtangaben nach Art. 50 EU AI Act lassen sich nicht entfernen.
- Die Übernahme sichert **exakt die Fassung, die er gesehen hat** —
  nachgewiesen über den Hash und die Zeilenzahl, nicht über die Oberfläche.
- Die Übernahme ist idempotent und mandantenfest.
- Der Publish Gate bewertet serverseitig, nimmt zur Backend-Frage keine
  Client-Behauptung entgegen, und `publishable` ist in der Datenbank
  erzwungen statt im Code zugesagt.

**Nicht belegt — und nach diesem Lauf weiterhin offen:**

- **Die vom Worker ausgelieferte Vorschau unter eigener Herkunft.** Auf `main`
  nicht implementiert. Folge-PR.
- **Die Fassungskette** (Hash und Vorgänger-Hash je Änderung). `#1117` zählt
  `version` hoch und überschreibt; wie eine Fassung aus ihrer Vorgängerin
  hervorging, ist nicht belegbar. Folge-PR.
- **Belastbarkeit des anonymen Kontingents** gegen verteilte Zugriffe.
- **Der Publish-Pfad selbst** — Deployment und eigene Domain existieren nicht.
- **Transformationen.** Seit dem G1-Fix nicht veröffentlichbar, solange kein
  Vergleichslauf existiert, der die Vorgängerseite tatsächlich gesehen hat.
  Bewusst so: lieber ein Weg, der noch fehlt, als eine Schranke, die nur so
  aussieht.

---

## 12 — Protokoll

Für jeden Lauf festhalten: Datum, Commit auf `main`, `TENANT_A`/`TENANT_B`,
`SESSION_ID`, `SHA_V1`, `SHA_V2`, `BLUEPRINT_ID`, `EVALUATION_ID`, sowie das
tatsächliche `status`/`publishable` aus Schritt 8 samt Begründung.

Ein Lauf ohne festgehaltene Hashes belegt nichts — die gesamte Aussagekraft
hängt daran, dass `SHA_V2` an drei Stellen unabhängig wiederauftaucht.
