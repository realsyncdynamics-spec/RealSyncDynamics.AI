# RealSync MCP Governance Server

Kontrollierte Zugriffsschicht, über die KI-Agenten (Claude, Hermes, eigene Agenten)
Compliance-Nachweise lesen können — nachvollziehbar, mandantengetrennt, widerrufbar.

Kein generischer API-Wrapper: Jeder Zugriff braucht einen Key mit Scopes, gilt nur
für einen Tenant und landet im Prüfpfad.

> **Stand:** Der Evidence-Teil arbeitet gegen echte Daten. Bei Governance ist
> der **Control-Katalog funktionsfähig** (219 Controls über acht Frameworks);
> **Score und Control-Erfüllung antworten mit 501**, weil die zugrunde
> liegenden Tabellen leer sind — siehe
> [Was noch nicht funktioniert](#was-noch-nicht-funktioniert). Sie liefern
> bewusst keine Null-Werte, weil ein Agent `score: 0` sonst als Befund „nicht
> konform" weiterreichen würde.

---

## Architektur

```
Claude / Hermes / eigener Agent
        │  Authorization: Bearer rsmcp_…
        ▼
   MCP Server (Fastify, Port 3001)
        │
        ├── Auth-Middleware   → mcp_key_candidates (RPC) + PBKDF2-Vergleich
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
> nur eine mit `MCP_KEY_PEPPER` und key-eigenem Salt gebildete
> PBKDF2-SHA512-Ableitung davon. Ein verlorener Key
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

### Governance — Control-Katalog funktionsfähig

| Methode | Pfad | Stand |
|---|---|---|
| `GET` | `/governance/controls?framework_id=iso42001` | **funktionsfähig** |
| `GET` | `/governance/status` | 501 |
| `GET` | `/governance/controls/:controlId/compliance` | 501 |

`/governance/controls` liefert den **globalen Anforderungskatalog** eines
Frameworks. Bekannt sind acht Schlüssel; die Schreibweise ist unerheblich
(`ISO_27001`, `iso-27001` und `iso27001` gelten gleich):

| Schlüssel | Controls | Schlüssel | Controls |
|---|---|---|---|
| `iso27001` | 98 | `ai_act` | 20 |
| `gdpr` | 26 | `nis2` | 16 |
| `iso42001` | 21 | `soc2` | 10 |
| `dora` | 20 | `tisax` | 8 |

> **Der Katalog sagt nichts über den Tenant aus.** Er beschreibt, was ein
> Framework fordert — nicht, wie weit jemand es erfüllt. Deshalb hat die
> Antwort kein Feld `status`, und jede Antwort trägt einen `note`-Hinweis.
> Aus dieser Liste darf weder Konformität noch Nichtkonformität abgeleitet
> werden.

**Zwei Kataloge in einer Tabelle.** `framework_controls` führt zwei unabhängig
gewachsene Bestände: 27 Zeilen hängen per `framework_id` an
`compliance_frameworks`, 192 tragen stattdessen einen Text in `framework`. Sie
überschneiden sich und widersprechen sich in der Menge — ISO 27001 hat 1
Control über den Fremdschlüssel und 97 über die Textspalte. Der Endpunkt liest
**beide** und führt sie zusammen; jede Zeile trägt in `source`, woher sie
stammt. Nur einen Weg abzufragen lieferte je nach Framework zwischen 4 % und
100 % des Katalogs, ohne dass es auffiele. Das ist eine Brücke, keine Lösung:
Die Bestände gehören zusammengeführt, und das ist eine Datenentscheidung.

Ein unbekannter Schlüssel ergibt **400** mit Aufzählung der gültigen Werte —
nicht eine leere Liste, die sich wie „keine Controls" läse.

Die beiden übrigen Endpunkte antworten weiterhin mit 501, und zwar aus einem
Datengrund: `framework_implementations` und `asset_control_mappings` sind leer
(gemessen 2026-08-31, über alle Tenants null Zeilen). Ein Score daraus wäre
„0 von 219" und läse sich als „nicht konform", obwohl schlicht niemand etwas
erfasst hat.

```json
{ "error": "NOT_IMPLEMENTED", "message": "governance.get_status(iso42001) ist noch nicht implementiert (offen: framework_implementations ist leer — kein Tenant hat einen Control-Status erfasst)" }
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
- **PBKDF2-SHA512 mit Salt und Pepper statt Klartext.** Gespeichert wird
  `pbkdf2-sha512$<iterationen>$<salt>$<ableitung>` — 210 000 Runden nach
  OWASP-Empfehlung, key-eigenes Salt, dazu der serverseitige Pepper
  `MCP_KEY_PEPPER` im Passwortmaterial. Salt und Pepper ersetzen einander
  nicht: Das Salt verhindert, dass eine Vorberechnung mehrere Keys zugleich
  trifft; der Pepper verhindert den Offline-Angriff überhaupt, weil er nur in
  der Umgebung von Server und Edge Function liegt, nie in der Datenbank. Beide
  Seiten müssen zeichengleich rechnen; ein Test rechnet sie gegeneinander, und
  beide werfen bei fehlendem Geheimnis, statt still zurückzufallen.

  **Warum PBKDF2 und nicht scrypt.** scrypt wäre kryptografisch die bessere
  Wahl — speicherhart und bei gleicher Wartezeit teurer für den Angreifer
  (gemessen 47 ms bei N=16384 gegenüber 137 ms für PBKDF2 mit 210 000 Runden).
  Den Ausschlag gab, dass dieselbe Ableitung in zwei Laufzeiten bitgleich
  laufen muss: Node im Server, Deno in der Edge Function. PBKDF2 gibt es in
  beiden über dieselbe W3C-WebCrypto-Schnittstelle, scrypt nur über Denos
  Node-Kompatibilitätsschicht — deren Übereinstimmung lässt sich hier nicht
  testen. Ein Verfahren zu wählen, dessen Gleichheit man nicht prüfen kann,
  wäre das größere Risiko: Weicht eine Seite ab, validiert kein einziger Key.

  **Zweistufige Prüfung, damit die Kosten den Richtigen treffen.** Ein teures
  Verfahren an einem unauthentifizierten Endpunkt wäre ein DoS-Verstärker,
  wenn jeder Rateversuch Rechenzeit erzwingt. Deshalb wird zuerst über das
  nicht geheime `key_prefix` vorausgewählt (indiziert, kostenlos); die
  Ableitung läuft nur für die gefundenen Kandidaten. Wer kein gültiges Präfix
  trifft — 32 Bit —, erhält null Zeilen und erzeugt keine einzige Runde.
  Legitime Aufrufe zahlen dafür rund 137 ms je Anmeldung.
- **Mandantentrennung.** RLS über `is_tenant_member`; der Widerruf filtert
  zusätzlich auf `tenant_id`, damit eine erratene Key-ID aus einem fremden
  Workspace ins Leere greift.
- **Eingeschränkte RPCs.** `mcp_key_candidates` und `mcp_log_usage` sind für
  `PUBLIC`, `anon` und `authenticated` gesperrt und nur für `service_role`
  ausführbar.
- **Ablauf und Widerruf** wirken sofort, weil bei jedem Request geprüft wird.
- **Plan-Gate und Kontingent.** MCP-Zugriff setzt die `api`-Berechtigung voraus
  (ab Agency). Pläne ohne sie erhalten 403, ein ausgeschöpftes Monatskontingent
  429 mit `Retry-After`. Die Zahlen stammen aus `plan_catalog` — der aus
  `shared/pricing.ts` erzeugten Projektion, die `npm run check:pricing` gegen
  die Quelle prüft.
- **Ratenbegrenzung auf zwei Ebenen.** Das Monatskontingent allein genügt
  nicht: Es greift erst *nach* der Authentifizierung und kann den Verkehr
  davor nicht abfangen.

  1. **Je IP, vor der Authentifizierung** (`MCP_RATE_LIMIT_PER_MINUTE`,
     Standard 120). Schützt den Auth-Pfad selbst — `validateApiKey` kostet
     eine Datenbank-Rundreise, und wer keinen gültigen Key hat, kommt bis
     dorthin.
  2. **Je Tenant, für die Kettenprüfung** (`MCP_VERIFY_LIMIT_PER_MINUTE`,
     Standard 10). `verifyHashChain` lädt die gesamte Kette und rechnet je
     Snapshot einen SHA-256 nach; die Arbeit wächst mit der Kettenlänge,
     während eine gewöhnliche Leseanfrage konstant bleibt.

  Die zweite Schranke sitzt in `verifyHashChain` selbst, nicht an der Route:
  Dieselbe Prüfung ist auch über das Werkzeug `evidence_verify_chain` auf
  `/mcp` erreichbar, und eine an die Route gehängte Schranke ließe diesen Weg
  offen. Beide antworten mit 429 und `Retry-After`; ein so abgewiesener
  Aufruf wird protokolliert, zählt aber nicht gegen das Monatskontingent.

  **Stapelgrenze** (`MCP_MAX_BATCH_SIZE`, Standard 20): Ohne sie liefe jede
  Ratenbegrenzung ins Leere, weil sie HTTP-Anfragen zählt, ein JSON-RPC-Stapel
  aber beliebig viele Werkzeugaufrufe in einer einzigen tragen kann.

  Gezählt wird im Prozessspeicher, also je Instanz. Bei mehreren Instanzen
  vervielfacht sich die effektive Schranke; dafür bräuchte es einen
  gemeinsamen Speicher (Redis). Der Ein-Instanz-Betrieb ist die derzeitige
  Annahme.

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
| `TRUST_PROXY` | `true` setzen, **wenn der Dienst hinter Traefik läuft**. Sonst trägt jede Anfrage die IP des Proxys, und die Ratenbegrenzung drosselt alle Clients gemeinsam. Standard `false`, weil X-Forwarded-For nur dort zu trauen ist, wo der Dienst ausschließlich über den Proxy erreichbar ist. |
| `MCP_RATE_LIMIT_PER_MINUTE` | Anfragen je IP und Minute, Standard `120` |
| `MCP_VERIFY_LIMIT_PER_MINUTE` | Kettenprüfungen je Tenant und Minute, Standard `10` |
| `MCP_MAX_BATCH_SIZE` | JSON-RPC-Nachrichten je Stapel, Standard `20` |

Der Server bricht beim Start ab, wenn die Datenbank nicht erreichbar ist —
besser ein sofortiger Fehlstart als ein Dienst, der Anfragen annimmt und
nichts liefern kann.

---

## Was noch nicht funktioniert

| Lücke | Auswirkung |
|---|---|
| Kein Control-Erfüllungsstand | `framework_implementations` und `asset_control_mappings` sind leer — Score und Control-Prüfung antworten mit 501 |
| Zwei getrennte Control-Kataloge | `framework_controls` mischt FK- und Text-Zuordnung mit widersprüchlichen Mengen; der Endpunkt führt sie zusammen, bereinigt sind sie damit nicht |
| Evidence Vault in Produktion leer | `evidence_snapshots` hat null Zeilen — die Evidence-Endpunkte antworten korrekt, aber ohne Inhalt |
| Keine Key-Rotation | `rotated_from` ist vorbereitet, es gibt keine Operation dafür |
| Keine Oberfläche | Keys nur über die Edge Function |
| Keine semantische Suche | `evidence/control/:id` sucht als Textmuster über `subject_ref` |

---

## Einbindung in Agenten

Siehe [`docs/MCP_GOVERNANCE_SERVER.md`](../../docs/MCP_GOVERNANCE_SERVER.md).
