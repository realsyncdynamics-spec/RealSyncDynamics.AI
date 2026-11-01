# P0 Residency und Bot-Persistenz — Sicherheitsabnahme (Draft)

Stand: 21.10.2026. Kein Live-Release, keine Änderung bestehender Mandanten-Policies.

## Sicherheitsentscheidung: fail-closed statt unbemerkte Cloud-Verarbeitung

Das DB-Verfahren `resolve_ai_residency(tenant,user)` liefert `cloud` oder `eu_local`. Diese Ausgabe ist nur vertrauenswürdig, wenn die Abfrage **ohne Fehler** genau einen dieser beiden Werte zurückgibt. Fehlender Tenant, Netzwerk-/RPC-Fehler, Null und unbekannter Wert sperren den Modellaufruf mit `RESIDENCY_UNAVAILABLE` (HTTP 503).

- `supabase/functions/_shared/ai.ts` — gilt zentral für `ai-invoke`, `bot-chat`, `bot-voice-webhook`, `whatsapp-webhook`, `kodee-advise`, `kodee-diagnose`, `browser-execute` und weitere `runAiTool`-Aufrufer. Kein Anbieter wird in diesem Fehlerfall kontaktiert.
- `supabase/functions/governance-router/index.ts` — Modellliste, Status und Textinferenz geben bei ungeklärter Residency 503 zurück. Der Cloud-Fallback des Routers darf kein RPC-Ausfall-Fallback sein.
- `supabase/functions/_shared/residencyGuard.ts` — gemeinsame Typ- und Fehlerprüfung mit Unit-Tests.

**Bewusst unverändert:** Bei gültiger Antwort `cloud` bleibt das bestehende `user_choice`-Verhalten zunächst bestehen. Das ist eine *Betriebs-/Datenschutzentscheidung*, keine automatische DSGVO-Garantie. `enforce_cloud` ist ebenfalls keine pauschale Freigabe aller Anbieter. `ai-gateway` und andere KI-Einstiege haben eigene Routings und werden nicht durch diesen Patch vollständig harmonisiert.

## Bot-Chat: personenbezogene Inhalte nicht vor Ablehnung speichern

`bot-chat` ruft den gemeinsamen `enforceBotMessage`-PEP **vor** Quota, Chat-/Kontaktanlage und Nachrichteninsert auf. Ein vorhandener Gesprächsverlauf wird über `findExistingConversationId` rein lesend mit `tenant_id`- und `bot_id`-Bindung geholt. Im Ablehnungsfall erfolgt keine Anlage und kein Insert; zurückgegeben wird die neutrale `safe_reply` und die bestehende `conversation_id`, falls vorhanden, ansonsten `null`.

Bei erlaubter Verarbeitung: Quota → Konversation anlegen/holen → Nutzernachricht speichern → Orchestrierung bzw. KI → Bot-Antwort speichern.

**Wichtig:** `BOT_PDP_ENFORCEMENT` ist standardmäßig `shadow`; eine berechnete Ablehnung wird daher nicht durchgesetzt, solange `enforce` nicht gesondert aktiviert ist. Diese Änderung garantiert nur, dass *tatsächlich abgelehnte* Inhalte vor dem Chat-Insert gestoppt werden. Sie ersetzt keine Rechtsgrundlage, Datenschutzklassifikation, sichere Aufbewahrungs-/Löschregeln oder ein tenantweites Provider-PDP.

Die externe Bot-API kann beim abgelehnten erstmaligen Chat `conversation_id: null` liefern. Vor einer Veröffentlichung Clients und Embeds auf diese Antwort prüfen.

## Betriebs-/QA-Gates

1. CI einschließlich `unit`, `gates`, `spa`, `build`, Migration validation und Playwright E2E gegen unveränderten QA-Commit abschließen. Draft-PRs auf Feature-Branches lösen diese Runs nicht aus.
2. `RESIDENCY_UNAVAILABLE` bei DB-RPC-Fehler, SQL-Fehler, leerer Antwort, unbekannter Ausgabe und Verbindungsausfall bestätigen; nachweisen, dass vor Sperre kein Provider-Egress stattfindet.
3. Alle bekannten `runAiTool`-Aufrufer auf Ausfallbehandlung (HTTP 503 und sichere Nutzeranzeige) prüfen.
4. `bot-chat` mit tatsächlichem `BOT_PDP_ENFORCEMENT=enforce` in isolierter Testumgebung prüfen: keine `bot_messages`-/`bot_conversations`-Writes bei Denial, kein Quota-Inkrement, keine Cloud-Anfrage.
5. Bestehende Chat-Widgets auf optionales `conversation_id` und nicht persistierte abgelehnte Nachrichten prüfen.
6. Unabhängig prüfen: EU-Inferenzserver-Standort, Betreiber/AVV, Infrastruktur, Egress/Logs, alle anderen KI-Routen (besonders `governance-agent`, `ai-gateway`, `governance-router` mit User-Choice), zentrale Tenant- und Nutzerdatenklassenpolicy.
7. Keine automatische Policy-Umschaltung der 8 bisherigen `user_choice`-Mandanten; keine Produktionsfreigabe ohne explizite gesonderte Freigabe.

## Unverändert offene P0-Arbeiten

- `governance-agent`-Legacy-US-Pfad bleibt bei `user_choice` und früher Opt-in-Freigabe möglich; der Draft #1959 sperrt nur `enforce_eu_local`.
- PDP `shadow` im `ai-gateway` und `governance-router` ersetzt kein verpflichtendes providerbezogenes Enforcement.
- `resolve_ai_residency` liefert bei API-Key-/anonymen Calls ohne Nutzer unter `user_choice` derzeit `cloud`; die künftige Semantik ist vor der Freigabe als Produktpolicy festzulegen.
- WhatsApp- und Voice-Kanäle haben noch eigene Persistenz vor PEP; in diesem PR wurde nur `bot-chat` umgestellt. Diese Kanäle gesondert vor Release prüfen.


## Durable Objects — verbindliche Architekturgrenze (ADR, 01.11.2026)

**Durable Object = tenantgebundene Koordination nach Autorisierung. Nie Quelle der Tenant-Identität, nie Policy Authority, nie Secret Store, nie Evidence Vault.**

Ein Durable Object ist hier nur ein Koordinations-Primitive zwischen stateless Worker und autoritativen Speichern. Es schafft keine zweite Sicherheitsgrenze.

### Cloudflare-Semantik, die für RealSync gilt

- **Concurrency:** Eine ID ist single-threaded, aber nicht request-weit serialisiert. Über `await fetch()`, R2 oder anderes Nicht-Storage-I/O können Requests derselben ID interleaven. `blockConcurrencyWhile()` ist für Init/Migration, nicht als allgemeiner Request-Mutex.
- **SQLite/Data Studio:** Worker-Editoren können SQLite-backed DO-Daten lesen und schreiben; es gibt kein separates DO-IAM. Deshalb keine Secrets und keinen Policy-Klartext dort speichern.
- **Location:** `locationHint: "eeur"` ist nur Best-Effort. `jurisdiction("eu")` begrenzt Compute und persistente DO-Daten auf die EU, macht den DO aber nicht zu RealSync `eu_private`. IDs können weiterhin in Billing-/Debug-Metadaten außerhalb dieser Grenze auftauchen.
- **Konfiguration:** `new_sqlite_classes` ist Legacy. Neue Klassen nutzen deklarative `[exports.ClassName]` mit `type = "durable-object"` und `storage = "sqlite"`. Beide Modelle dürfen nicht gemischt werden. Jede erstmalige Provisionierung ist ein Worker-Deploy und bleibt während des Freeze verboten.
- **Kosten/Lifecycle:** Eine heiße ID kann aktiv bleiben. Hibernation erzeugt im Idle keine Duration-Kosten; Storage bleibt. Beim WebSocket-Wake ist In-Memory-State weg und der Constructor läuft erneut.

### Erlaubte Autoritätskette

`verifyJwt -> resolveMembership(auth.uid) -> membership.tenantId -> optional TenantRateLimit -> policy/execution/evidence`

Die DO-ID darf ausschließlich aus `membership.tenantId` kommen. Verboten sind URL-/Path-Tenant, JWT-Custom-Claim, `body.tenant_id`, Tenant-Header oder andere nutzerkontrollierte Schlüssel. Das Limit kommt serverseitig aus Plan/Entitlement, nie aus dem Request.

Konzeptionelle Call-Site — **nicht verdrahten, solange der Freeze gilt**:

```ts
const auth = await verifyJwt(request);
const membership = await resolveMembership(auth.userId);
if (!membership) return new Response("Forbidden", { status: 403 });

const tenantId = membership.tenantId;
const entitlement = await resolveEntitlement(tenantId);

// Hypothetisches Binding; nicht in wrangler-workers.toml eintragen.
const limiter = env.RATE.getByName(tenantId);
const result = await limiter.consume({
  limit: entitlement.requestsPerMinute,
  windowMs: 60_000,
});

if (!result.allowed) {
  return new Response("Too Many Requests", {
    status: 429,
    headers: { "Retry-After": String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))) },
  });
}
```

Der DO speichert nur Zähler, keine Dokumente:

```ts
import { DurableObject } from "cloudflare:workers";

export class TenantRateLimit extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS rate_buckets (
        window_start INTEGER PRIMARY KEY,
        count INTEGER NOT NULL
      )
    `);
  }

  consume(input: { limit: number; windowMs: number }) {
    const limit = Math.trunc(input.limit);
    const windowMs = Math.trunc(input.windowMs);
    if (limit < 1 || windowMs < 1_000) throw new Error("invalid rate limit");

    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const resetAt = windowStart + windowMs;
    const rows = this.ctx.storage.sql.exec(
      `INSERT INTO rate_buckets (window_start, count)
       VALUES (?, 1)
       ON CONFLICT(window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
      windowStart,
    ).toArray();

    const count = Number(rows[0]?.count ?? 1);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt };
  }
}
```

### Freeze / Scope

Diese Entscheidung ist Dokumentation, kein Unfreeze:

- kein Durable-Object-Binding in `wrangler-workers.toml`
- kein `[exports.*]`, keine DO-Migration
- kein Call-Site-/Import-Wiring in `src/workers`
- kein Policy-, Session- oder Evidence-DO
- kein Produktions-Deploy

Jede spätere Implementierung braucht eine separate Unfreeze-Entscheidung und muss die membership-abgeleitete Tenant-Autorität beibehalten.
