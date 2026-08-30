# RealSync MCP Governance Server

Kontrollierte Zugriffsschicht, über die KI-Agenten (Claude, Hermes, eigene Agenten)
Compliance-Nachweise lesen können — nachvollziehbar, mandantengetrennt, widerrufbar.

Kein generischer API-Wrapper: Jeder Zugriff braucht einen Key mit Scopes, gilt nur
für einen Tenant und landet im Prüfpfad.

> **Stand:** Der Evidence-Teil arbeitet gegen echte Daten. Die Governance-Endpunkte
> sind Platzhalter und antworten mit **501 Not Implemented** — siehe
> [Was noch nicht funktioniert](#was-noch-nicht-funktioniert). Sie liefern bewusst
> keine Null-Werte, weil ein Agent `score: 0` sonst als Befund „nicht konform"
> weiterreichen würde.

---

## Architektur

```
Claude / Hermes / eigener Agent
        │  Authorization: Bearer rsmcp_…
        ▼
   MCP Server (Fastify, Port 3001)
        │
        ├── Auth-Middleware   → mcp_key_is_valid (RPC, service_role)
        ├── Kontingent        → mcp_quota_state  (plan_catalog)
        ├── POST /mcp         → JSON-RPC 2.0 (tools/list · tools/call)
        ├── HTTP-Routen       → Evidence · Governance
        └── onResponse-Hook   → mcp_log_usage    (Prüfpfad)
        │
        ▼
   Supabase / PostgreSQL (RLS)
        ├── evidence_snapshots
        ├── mcp_api_keys
        └── mcp_key_usage
```

Der Browser spricht nie mit diesem Dienst. Der Service-Role-Key liegt
ausschließlich hier im Server, nie im Client.

---

## Schnellstart

```bash
cd apps/mcp-server
npm install
cp .env.example .env      # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY eintragen
npm run dev               # Watch-Modus auf Port 3001
```

```bash
npm run build       # tsc → dist/
npm run typecheck   # ohne Emit
npm test            # node --test
```

Erreichbarkeit prüfen (ohne Key):

```bash
curl http://localhost:3001/health
# {"status":"ok","timestamp":"…"}
```

---

## Einen API-Key ausstellen

Keys werden **nicht** im MCP Server angelegt, sondern über die Edge Function
`mcp-api-key-manager`. Nötig ist ein User-JWT eines Mitglieds des Tenants.

```bash
curl -X POST "$SUPABASE_URL/functions/v1/mcp-api-key-manager" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{
        "op": "generate",
        "tenant_id": "…",
        "name": "Hermes Produktion",
        "scopes": ["evidence.read"],
        "expires_in_days": 90
      }'
```

```json
{ "ok": true, "key": "rsmcp_7f3a…", "key_prefix": "rsmcp_7f3a2b1c", "scopes": ["evidence.read"] }
```

> Das Feld `key` erscheint **genau einmal** — in dieser Antwort. Gespeichert wird
> nur ein mit `MCP_KEY_PEPPER` gebildeter HMAC-SHA-256 davon. Ein verlorener Key
> lässt sich nicht wiederherstellen, nur widerrufen und neu ausstellen.

Weitere Operationen:

| Operation | Wirkung |
|---|---|
| `{"op":"list","tenant_id":"…"}` | Keys des Tenants, ohne Hash |
| `{"op":"revoke","tenant_id":"…","key_id":"…"}` | setzt `active = false`, wirkt sofort |

Gültige Scopes: `evidence.read`, `governance.read`, `runtime.read`. Unbekannte
Scopes werden verworfen. Ohne Angabe gilt `evidence.read` + `governance.read`,
die Laufzeit ist auf maximal 365 Tage begrenzt.

Es gibt bewusst **keine** öffentliche `validate`-Operation: ein erreichbarer
Prüf-Endpunkt wäre ein Orakel, an dem sich gestohlene Hashes gefahrlos
durchprobieren ließen. Der Server prüft Keys über die RPC mit `service_role`.

---

## Endpunkte

Alle bis auf `/health` erwarten `Authorization: Bearer rsmcp_…`.

### MCP-Protokoll

`POST /mcp` — JSON-RPC 2.0. Methoden: `initialize`, `notifications/initialized`,
`ping`, `tools/list`, `tools/call`. Gemeldete Fähigkeit ist ausschließlich
`tools`. Protokollfassungen `2025-06-18` (Standard), `2025-03-26`, `2024-11-05`.

`tools/list` zeigt nur Werkzeuge, für die der Key den Scope hat. Fehler bei der
Ausführung kommen als Ergebnis mit `isError: true` zurück, nicht als
JSON-RPC-Fehler — sonst sähe das Modell die Begründung nicht.

Umgesetzt ohne `@modelcontextprotocol/sdk`: das SDK zieht 17 transitive
Abhängigkeiten mit, darunter zod (laut CLAUDE.md nicht ohne Absprache
einzuführen) und Express 5 neben dem hier verwendeten Fastify.

### Evidence — funktionsfähig

| Methode | Pfad | Zweck |
|---|---|---|
| `GET` | `/evidence` | Snapshots des Tenants (`?subject_ref=`, `?limit=`) |
| `GET` | `/evidence/:id` | einzelner Snapshot |
| `POST` | `/evidence/:id/verify-hash` | verifiziert die gesamte Kette des Subjects |
| `GET` | `/evidence/control/:controlId` | Suche über `subject_ref` |

```bash
curl -H "Authorization: Bearer rsmcp_…" http://localhost:3001/evidence?limit=10
```

`verify-hash` prüft nicht den einzelnen Snapshot, sondern die **gesamte Kette
seines Subjects** — ein Snapshot für sich sagt nichts aus, seine Unversehrtheit
ergibt sich erst aus der lückenlosen Verkettung ab Version 1:

```json
{ "data": { "subjectRef": "iso42001/A.5", "valid": true, "chainLength": 7,
            "cryptoVerified": 5, "legacy": 2, "issues": [] } }
```

`legacy` zählt Snapshots ohne `event_timestamp` (vor Einführung der Spalte
angelegt). Die sind nur strukturell prüfbar und gelten **nicht** als
manipuliert — bei `cryptoVerified: 0` ist `valid: true` daher eine Aussage über
die Struktur, nicht über die Kryptografie.

Die Prüflogik liegt in `packages/evidence-chain` und wird von der SPA
mitbenutzt; die Kanonisierung stimmt zeichengenau mit der Edge Function
überein, die die Hashes erzeugt.

### Governance — antwortet mit 501

| Methode | Pfad |
|---|---|
| `GET` | `/governance/status` |
| `GET` | `/governance/controls` |
| `GET` | `/governance/controls/:controlId/compliance` |

```json
{ "error": "NOT_IMPLEMENTED", "message": "governance.get_status(iso-42001) ist noch nicht implementiert (offen: Auswertung von ai_policies/governance_controls)" }
```

---

## Prüfpfad

Jeder authentifizierte Request wird protokolliert — zentral im
`onResponse`-Hook, nicht in den einzelnen Tools. Nur dort stehen Statuscode und
Latenz zur Verfügung, und nur dort werden auch abgewiesene Requests erfasst; ein
Protokoll, das nur die erfolgreichen Fälle kennt, taugt als Nachweis nichts.

Geschrieben wird nach `mcp_key_usage`:

| Spalte | Inhalt |
|---|---|
| `key_id` | verwendeter Key |
| `action` | `get /evidence?limit=10` |
| `status` | HTTP-Status, auch 401/403/501 |
| `latency_ms`, `ip_address`, `user_agent` | Kontext |

Dieselbe Tabelle führt den Lebenszyklus der Keys (`mcp_api_key.created`,
`…updated`, `…revoked`). Diese Einträge schreibt ein DB-Trigger — sie lassen
sich auch mit `service_role` nicht umgehen.

Ein fehlgeschlagenes Protokoll lässt den Request nicht scheitern, wird aber
geloggt, damit ein stiller Ausfall des Prüfpfads auffällt.

---

## Sicherheitseigenschaften

- **Nur lesend.** Kein Endpunkt verändert Governance-Daten.
- **Scopes werden erzwungen.** Jede Route hängt an einem `requireScope`-
  preHandler; ein Key mit ausschließlich `evidence.read` erhält auf den
  Governance-Pfaden 403. Ohne diese Prüfung wäre die Scope-Angabe eine
  Absichtserklärung statt einer Kontrolle.
- **Gepfefferter Hash statt Klartext.** Gespeichert wird ausschließlich ein
  HMAC-SHA-256 des Keys, gebildet mit dem serverseitigen Geheimnis
  `MCP_KEY_PEPPER`. Wer allein die Datenbank erbeutet, kann geratene Keys nicht
  offline gegen die Hashes prüfen — dazu bräuchte er zusätzlich den Pepper, der
  nur in der Umgebung von Server und Edge Function liegt. Beide Seiten müssen
  denselben Wert verwenden; ein Test rechnet sie gegeneinander, und beide werfen
  bei fehlendem Geheimnis, statt still auf einen ungepfefferten Hash
  zurückzufallen.

  Bewusst **kein** scrypt/argon2: Der Key ist ein Zufallstoken mit 256 Bit
  Entropie, kein menschliches Passwort — Brute-Force ist nicht das Szenario.
  Der Hash läuft bei jedem Request; ein absichtlich teures Verfahren wäre hier
  ein DoS-Verstärker, weil jeder gut geformte Rateversuch Rechenzeit erzwänge.
- **Mandantentrennung.** RLS über `is_tenant_member`; der Widerruf filtert
  zusätzlich auf `tenant_id`, damit eine erratene Key-ID aus einem fremden
  Workspace ins Leere greift.
- **Eingeschränkte RPCs.** `mcp_key_is_valid` und `mcp_log_usage` sind für
  `PUBLIC`, `anon` und `authenticated` gesperrt und nur für `service_role`
  ausführbar.
- **Ablauf und Widerruf** wirken sofort, weil bei jedem Request geprüft wird.
- **Plan-Gate und Kontingent.** MCP-Zugriff setzt die `api`-Berechtigung voraus
  (ab Agency). Pläne ohne sie erhalten 403, ein ausgeschöpftes Monatskontingent
  429 mit `Retry-After`. Die Zahlen stammen aus `plan_catalog` — der aus
  `shared/pricing.ts` erzeugten Projektion, die `npm run check:pricing` gegen
  die Quelle prüft.

---

## Betrieb

```bash
npm run build
npm run docker:build
npm run docker:run
```

| Variable | Zweck |
|---|---|
| `SUPABASE_URL` | Projekt-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | nur hier, nie im Client |
| `MCP_KEY_PEPPER` | Geheimnis des Key-Hashes, min. 32 Zeichen — **identisch** in der Edge Function. Der Server startet ohne es nicht. |
| `PORT` / `HOST` | Standard `3001` / `0.0.0.0` |

Der Server bricht beim Start ab, wenn die Datenbank nicht erreichbar ist —
besser ein sofortiger Fehlstart als ein Dienst, der Anfragen annimmt und
nichts liefern kann.

---

## Was noch nicht funktioniert

| Lücke | Auswirkung |
|---|---|
| Governance-Tools sind Platzhalter | drei Endpunkte antworten mit 501 |
| Keine Key-Rotation | `rotated_from` ist vorbereitet, es gibt keine Operation dafür |
| Keine Oberfläche | Keys nur über die Edge Function |
| Keine semantische Suche | `evidence/control/:id` sucht als Textmuster über `subject_ref` |

---

## Einbindung in Agenten

Siehe [`docs/MCP_GOVERNANCE_SERVER.md`](../../docs/MCP_GOVERNANCE_SERVER.md).
