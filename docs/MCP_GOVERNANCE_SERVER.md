# MCP Governance Server — Anbindung von KI-Agenten

Wie Claude, Hermes oder ein eigener Agent Compliance-Nachweise aus
RealSyncDynamicsAI liest, ohne dabei privilegierten Zugriff zu bekommen.

Technische Referenz des Dienstes: [`apps/mcp-server/README.md`](../apps/mcp-server/README.md).

---

## 1. Wofür dieser Dienst gedacht ist

Ein KI-Agent soll Fragen beantworten können wie

- „Welche Evidence-Items liegen zu Control A.5 vor?"
- „Wann wurde der Snapshot zu `dsgvo/vvt-2026` zuletzt erneuert?"
- „Ist die Hash-Kette zu diesem Nachweis unversehrt?"

— ohne dafür einen Datenbankzugang, einen Service-Role-Key oder ein
Benutzerkonto zu erhalten. Der Agent bekommt einen eigenen, widerrufbaren Key,
der auf einen Tenant und auf Lesezugriff begrenzt ist. Jeder Aufruf ist
nachträglich einem Key zuzuordnen.

**Nicht** dafür gedacht: Änderungen an Governance-Daten, Zugriff über mehrere
Tenants hinweg, oder Zugriff aus dem Browser.

---

## 2. Voraussetzungen

| | |
|---|---|
| Erreichbarer MCP Server | lokal `http://localhost:3001`, geplant `mcp.realsyncdynamicsai.de` |
| Angewandte Migrationen | `20260903120000_mcp_api_keys.sql`, `20260903120100_mcp_quota.sql` |
| Deployte Edge Function | `mcp-api-key-manager` |
| API-Key | siehe Abschnitt 3 |
| Plan mit API-Zugriff | ab Agency — darunter antwortet der Server mit 403 |

> **`mcp-api-key-manager` ist derzeit nicht deploybar.** Die Supabase-
> Organisation läuft auf dem Free-Plan und steht bei 100 von 100 Edge
> Functions; neue Functions werden mit `HTTP 402: Max number of functions
> reached` abgewiesen. Bestehende werden weiter aktualisiert, neue nicht
> angelegt. Ohne diese Function lassen sich keine Keys ausstellen, und ohne
> Key ist der MCP Server nicht nutzbar.
>
> Vorgehen: [`docs/runbooks/edge-function-kontingent.md`](./runbooks/edge-function-kontingent.md).
>
> **Generell vor dem Produktivbetrieb prüfen:** Laut `CLAUDE.md` sind zahlreiche
> Edge Functions und Migrationen im Repository nie deployt worden. Ob dieser
> Stand in Produktion vorliegt, mit `supabase functions list` bzw. gegen die
> Live-DB prüfen — nicht gegen den Repo-Stand.

---

## 3. Key ausstellen und aufbewahren

```bash
curl -X POST "$SUPABASE_URL/functions/v1/mcp-api-key-manager" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"op":"generate","tenant_id":"…","name":"Hermes Produktion",
       "scopes":["evidence.read"],"expires_in_days":90}'
```

Der Klartext-Key steht **nur in dieser einen Antwort**. Danach existiert im
System ausschließlich ein HMAC-SHA-256 davon, gebildet mit dem serverseitigen
Geheimnis `MCP_KEY_PEPPER`. Dieses Geheimnis muss in der Edge Function und im
MCP Server **identisch** gesetzt sein — weicht eine Seite ab, validiert kein
Key mehr. Beide werfen, wenn es fehlt, statt still auf einen ungepfefferten
Hash zurückzufallen.

**Aufbewahrung:** in die Secret-Verwaltung der jeweiligen Laufzeitumgebung —
`wrangler secret put` für Workers, Umgebungsvariable des Containers für
Hermes, `.env.local` lokal. Nicht ins Repository, nicht in eine `VITE_*`-Variable
(die ist per Definition öffentlich), nicht in einen Agenten-Prompt.

**Ein Key pro Agent und Umgebung.** Teilen sich zwei Agenten einen Key, lässt
sich im Prüfpfad nicht mehr auseinanderhalten, wer was abgefragt hat — und ein
Widerruf trifft beide.

**Bei Verdacht auf Kompromittierung:** widerrufen, neu ausstellen. Der Widerruf
wirkt sofort, weil bei jedem Request geprüft wird.

```bash
curl -X POST "$SUPABASE_URL/functions/v1/mcp-api-key-manager" \
  -H "Authorization: Bearer $USER_JWT" -H "Content-Type: application/json" \
  -d '{"op":"revoke","tenant_id":"…","key_id":"…"}'
```

---

## 4. Anbindung

Es gibt zwei Wege: das **MCP-Protokoll** unter `POST /mcp` (empfohlen, der Agent
entdeckt die Werkzeuge selbst) und die **HTTP-Endpunkte** für alles, was kein
MCP spricht.

### MCP-Protokoll (empfohlen)

JSON-RPC 2.0 über einen einzigen Endpunkt. Der Key wandert wie überall in den
`Authorization`-Header.

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Authorization: Bearer rsmcp_…" -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize",
       "params":{"protocolVersion":"2025-06-18","capabilities":{},
                 "clientInfo":{"name":"hermes","version":"1.0"}}}'
```

```json
{ "jsonrpc": "2.0", "id": 1, "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": { "tools": {} },
    "serverInfo": { "name": "realsync-mcp-governance", "version": "0.1.0" } } }
```

Danach `notifications/initialized` senden (darauf antwortet der Server nicht,
er quittiert mit 202), dann `tools/list` und `tools/call`.

**`tools/list` zeigt nur Werkzeuge, für die der Key den Scope hat.** Ein Modell
soll nichts vorgeschlagen bekommen, was anschließend an der Berechtigung
scheitert. Ein Key mit ausschließlich `evidence.read` sieht vier Werkzeuge, die
`governance_*` gar nicht.

| Werkzeug | Scope |
|---|---|
| `evidence_list` · `evidence_get` · `evidence_verify_chain` · `evidence_search_by_control` | `evidence.read` |
| `governance_status` · `governance_list_controls` · `governance_check_control` | `governance.read` |

Unterstützte Protokollfassungen: `2025-06-18` (Standard), `2025-03-26`,
`2024-11-05`. Nennt der Client eine davon, wird sie bestätigt; sonst antwortet
der Server mit seiner eigenen.

Der Server meldet ausschließlich die Fähigkeit `tools` — keine `resources`,
keine `prompts`, kein `sampling`. Was nicht gemeldet wird, darf ein Client nicht
anfragen.

**Fehler kommen an zwei Stellen zurück, und der Unterschied ist beabsichtigt:**
Protokollfehler (unbekannte Methode, unbekanntes Werkzeug) als JSON-RPC-`error`;
Fehler bei der Ausführung — fehlender Scope, nicht implementiertes Werkzeug,
ungültiges Argument — als Ergebnis mit `isError: true`. Nur so sieht das Modell
die Begründung und kann sie dem Nutzer nennen, statt an einem Transportfehler
zu scheitern.

### Als HTTP-Werkzeug in einem Agenten

```ts
const RSD = process.env.RSD_MCP_URL ?? 'http://localhost:3001';

async function evidenceList(subjectRef?: string, limit = 50) {
  const url = new URL('/evidence', RSD);
  if (subjectRef) url.searchParams.set('subject_ref', subjectRef);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.RSD_MCP_KEY}` },
  });

  // 501 heisst "noch nicht gebaut", nicht "nichts gefunden" — der
  // Unterschied muss beim Agenten ankommen, sonst meldet er eine
  // Fehlfunktion als Ergebnis.
  if (res.status === 501) {
    const { message } = await res.json();
    throw new Error(`Nicht verfügbar: ${message}`);
  }
  if (!res.ok) throw new Error(`MCP ${res.status}`);

  const { data } = await res.json();
  return data;
}
```

Werkzeugbeschreibung für das Modell:

```
evidence_list — Listet Compliance-Nachweise (Evidence-Snapshots) des Tenants.
                Nur lesend. Liefert Version, Hash, Aufbewahrungsklasse und
                Zeitstempel. Sucht NICHT semantisch: subject_ref ist ein
                exakter Bezeichner, kein Suchbegriff.
```

### Statuscodes

| Code | Bedeutung | Reaktion |
|---|---|---|
| `200` | Erfolg | — |
| `401` | Key fehlt, ungültig, abgelaufen oder widerrufen | Key prüfen, nicht wiederholen |
| `404` | Nachweis existiert nicht in diesem Tenant | leeres Ergebnis melden |
| `403` | Plan enthält keinen API-Zugriff (unter Agency) | dem Nutzer den Plan nennen, nicht wiederholen |
| `400` | Unbekannter Framework-Schlüssel | gültige Schlüssel stehen in der Meldung; **nicht** als „keine Controls" deuten |
| `413` | JSON-RPC-Stapel zu groß (Standard: über 20 Nachrichten) | Stapel aufteilen |
| `429` | Monatskontingent ausgeschöpft **oder** Ratenbegrenzung | `Retry-After` beachten, nicht sofort erneut anfragen |
| `501` | Endpunkt noch nicht implementiert | als „nicht verfügbar" melden, **nicht** als Befund |
| `500` | Fehler im Dienst | begrenzt wiederholen |

**Zu 429:** Zwei Ursachen teilen sich diesen Code, und der Unterschied ist für
den Agenten wesentlich.

- `error: "QUOTA_EXCEEDED"` — das Monatskontingent des Tenants ist
  aufgebraucht. `Retry-After` zeigt auf den nächsten Monatsanfang; ein erneuter
  Versuch lohnt vorher nicht. Dem Nutzer melden, nicht stillschweigend warten.
- `error: "RATE_LIMITED"` — zu viele Anfragen in kurzer Zeit. `Retry-After`
  liegt im Sekundenbereich; hier ist Abwarten und Wiederholen richtig.

Besonders eng begrenzt ist `evidence_verify_chain` (Standard: 10 Aufrufe je
Tenant und Minute), weil der Aufruf über die gesamte Kette rechnet. Ein Agent,
der viele Subjects prüfen will, sollte das über die Zeit verteilen statt in
einer Schleife.

---

## 5. Was der Agent dem Nutzer sagen darf — und was nicht

Der Dienst gehört zu einem Compliance-Produkt. Eine erfundene Aussage über den
Konformitätsstand ist hier schädlicher als eine fehlende Antwort.

**Zulässig**, weil durch Daten gedeckt:

> „Zu `iso42001/A.5` liegen 3 Evidence-Snapshots vor, der jüngste vom 04.08.2026
> (Version 7, Aufbewahrung 7 Jahre)."

**Unzulässig**, weil nicht gemessen:

> „Ihr ISO-42001-Score liegt bei 0 % — Sie sind nicht konform."

Score und Control-Erfüllung antworten heute mit `501`. Ein Agent, der daraus
einen Score ableitet, erfindet einen Befund. Genau deshalb liefern diese
Endpunkte einen Fehler statt Null-Werten.

**Der Control-Katalog ist die zweite Falle, und die naheliegendere.**
`governance_list_controls` funktioniert und liefert echte Daten — aber es ist
der *Anforderungskatalog* des Frameworks, nicht der Stand des Tenants. Die
Antwort trägt deshalb kein Feld `status`.

> **Zulässig:** „ISO 27001 umfasst in unserem Katalog 98 Controls."
>
> **Unzulässig:** „Sie erfüllen 98 Controls." — oder, ebenso falsch, „Sie
> erfüllen keines davon."

Wie weit ein Tenant den Katalog erfüllt, ist **nicht erfasst**: Die Tabelle
`framework_implementations` ist leer. „Nicht erfasst" und „nicht erfüllt" sind
zwei verschiedene Aussagen, und nur die erste ist gedeckt.

Bei `POST /evidence/:id/verify-hash` kommt es auf einen Unterschied an, den ein
Agent mitsprechen muss. Geprüft wird die gesamte Kette des Subjects: Struktur,
Verkettung und — sofern `event_timestamp` vorliegt — die Nachrechnung des
`event_hash`. Snapshots ohne diesen Zeitstempel stammen aus der Zeit vor
Einführung der Spalte; sie zählen als `legacy` und gelten ausdrücklich **nicht**
als manipuliert.

Daraus folgt:

> „Die Kette zu `iso42001/A.5` ist unversehrt: 7 Snapshots, 5 kryptografisch
> nachgerechnet, 2 ältere nur strukturell prüfbar."

Nicht zulässig ist, `legacy` zu verschweigen. Bei `cryptoVerified: 0` ist ein
`valid: true` eine Aussage über die Struktur, nicht über die Kryptografie — wer
das als „kryptografisch bestätigt" formuliert, überschreibt den Vorbehalt, den
die Daten ausdrücklich mitliefern.

---

## 6. Was protokolliert wird

Jeder authentifizierte Request landet in `mcp_key_usage` — mit Key, Aktion,
Statuscode, Latenz, IP und User-Agent. Der Lebenszyklus der Keys (angelegt,
geändert, widerrufen) wird von einem DB-Trigger geschrieben und lässt sich auch
mit `service_role` nicht umgehen.

Auswertung, etwa für einen Nachweis nach EU AI Act Art. 12 (Aufzeichnungen):

```sql
-- Zugriffe eines Keys der letzten 30 Tage
SELECT action, status, latency_ms, timestamp
  FROM public.mcp_key_usage
 WHERE key_id = '…' AND timestamp > now() - interval '30 days'
 ORDER BY timestamp DESC;

-- Ungenutzte Keys aufspüren (Kandidaten für den Widerruf)
SELECT id, name, key_prefix, created_at, last_used_at
  FROM public.mcp_api_keys
 WHERE active AND (last_used_at IS NULL OR last_used_at < now() - interval '90 days');
```

Der zweite Query gehört in die regelmäßige Durchsicht: ein Key, der 90 Tage
nicht benutzt wurde, ist meist vergessen — und ein vergessener Key mit
Lesezugriff auf Compliance-Nachweise ist ein offenes Risiko.

---

## 7. Grenzen des aktuellen Stands

| Grenze | Bedeutung für die Anbindung |
|---|---|
| Kein Control-Erfüllungsstand | `framework_implementations` ist leer; Score und Control-Prüfung antworten mit 501. Der Control-**Katalog** funktioniert. |
| Zwei getrennte Control-Kataloge | `framework_controls` mischt Fremdschlüssel- und Text-Zuordnung mit widersprüchlichen Mengen (ISO 27001: 1 gegenüber 97). Der Endpunkt führt beide zusammen und weist die Herkunft je Zeile in `source` aus. |
| Evidence Vault in Produktion leer | `evidence_snapshots` hat null Zeilen — `evidence_list` und `evidence_search_by_control` antworten korrekt, aber leer. Das ist **kein** Beleg für fehlende Nachweise. |
| Keine semantische Suche | `evidence/control/:id` ist ein Textmuster über `subject_ref`, keine Bedeutungssuche |
| Keine Key-Rotation | Ersatz nur durch Widerruf und Neuausstellung |
| Legacy-Snapshots nicht nachrechenbar | Ketten aus der Zeit vor `event_timestamp` sind nur strukturell prüfbar |
| Ratenbegrenzung nur je Instanz | Gezählt wird im Prozessspeicher. Bei mehreren Instanzen vervielfacht sich die effektive Schranke — für eine gemeinsame bräuchte es Redis. Derzeit läuft eine Instanz. |

Am ehesten fällt die fehlende semantische Suche ins Gewicht: `evidence_search_by_control`
gleicht Text ab, kein leeres Ergebnis belegt daher die Abwesenheit von Nachweisen.
Der Werkzeug-Beschreibungstext sagt das ausdrücklich, damit ein Modell nicht
das Gegenteil schlussfolgert.

Zum MCP-Transport: umgesetzt ist die Anfrage/Antwort-Hälfte über HTTP POST.
Server-initiierte Nachrichten (SSE-Stream, Fortschritts-Benachrichtigungen,
Sampling) fehlen — ein rein lesender Server hat nichts von sich aus zu senden.

---

## Verwandte Dokumente

- [`apps/mcp-server/README.md`](../apps/mcp-server/README.md) — Betrieb und Endpunkte
- [`supabase/migrations/20260903120000_mcp_api_keys.sql`](../supabase/migrations/20260903120000_mcp_api_keys.sql) — Schema, RLS, Prüfpfad
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — Gesamtarchitektur
