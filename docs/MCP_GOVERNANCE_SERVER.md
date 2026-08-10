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
| Angewandte Migrationen | `20260820000000_mcp_api_keys.sql`, `20260821000000_mcp_quota.sql` |
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
System ausschließlich sein SHA-256-Hash.

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

Der Dienst spricht derzeit **HTTP, nicht das MCP-Protokoll**. Der native
MCP-Transport steht noch aus (siehe Abschnitt 7). Bis dahin läuft die Anbindung
über gewöhnliche Werkzeugdefinitionen.

### Als Werkzeug in einem Agenten

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
| `429` | Monatskontingent ausgeschöpft | `Retry-After` beachten, nicht sofort erneut anfragen |
| `501` | Endpunkt noch nicht implementiert | als „nicht verfügbar" melden, **nicht** als Befund |
| `500` | Fehler im Dienst | begrenzt wiederholen |

---

## 5. Was der Agent dem Nutzer sagen darf — und was nicht

Der Dienst gehört zu einem Compliance-Produkt. Eine erfundene Aussage über den
Konformitätsstand ist hier schädlicher als eine fehlende Antwort.

**Zulässig**, weil durch Daten gedeckt:

> „Zu `iso42001/A.5` liegen 3 Evidence-Snapshots vor, der jüngste vom 04.08.2026
> (Version 7, Aufbewahrung 7 Jahre)."

**Unzulässig**, weil nicht gemessen:

> „Ihr ISO-42001-Score liegt bei 0 % — Sie sind nicht konform."

Die Governance-Endpunkte antworten heute mit `501`. Ein Agent, der daraus einen
Score ableitet, erfindet einen Befund. Genau deshalb liefern diese Endpunkte
einen Fehler statt Null-Werten.

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
| Kein MCP-Transport | Anbindung über HTTP-Werkzeuge, keine automatische Werkzeug-Erkennung |
| Governance-Tools nicht implementiert | drei Endpunkte antworten mit 501 |
| Keine semantische Suche | `evidence/control/:id` ist ein Textmuster über `subject_ref`, keine Bedeutungssuche |
| Keine Key-Rotation | Ersatz nur durch Widerruf und Neuausstellung |
| Legacy-Snapshots nicht nachrechenbar | Ketten aus der Zeit vor `event_timestamp` sind nur strukturell prüfbar |

Am ehesten fällt der fehlende native MCP-Transport ins Gewicht: Werkzeuge
müssen von Hand definiert werden, statt dass der Agent sie selbst entdeckt.

---

## Verwandte Dokumente

- [`apps/mcp-server/README.md`](../apps/mcp-server/README.md) — Betrieb und Endpunkte
- [`supabase/migrations/20260820000000_mcp_api_keys.sql`](../supabase/migrations/20260820000000_mcp_api_keys.sql) — Schema, RLS, Prüfpfad
- [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — Gesamtarchitektur
