# Befund: enterprise-ai-os-* Endpoints — Cross-Tenant-Exposition

> Folge-Audit zu `governance-edge-auth-gate`. **Architektonisch signifikant —
> bewusst NICHT eigenmächtig gefixt** (würde live Dashboard-Seiten brechen und
> setzt eine Design-Entscheidung über das Zugriffsmodell voraus).
> Tabellen-Status read-only via Supabase-MCP gegen `RealSyncDynamicsLive`.

## Muster (alle sechs Functions)

```ts
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const sb = createClient(url, serviceKey);          // RLS-Bypass
// kein getUser, kein Membership-Gate
await sb.from('enterprise_*').select('*'|insert)
```

Dazu in `config.toml`: `verify_jwt = false`. → Öffentlich erreichbar **und**
Service-Role (umgeht die auf den Tabellen aktivierte RLS).

Anti-Pattern in mehreren Varianten: der Authorization-Header wird teils an den
**service-role**-Client durchgereicht — das setzt die Rechte NICHT herab, der
Client bleibt service-role. Der Header ist dekorativ.

## Einzelbefunde

| Function | Op | Tabelle | Caller (SPA) | Bewertung |
|---|---|---|---|---|
| `enterprise-ai-os-agent-runs-list` | read `*` | `enterprise_agent_runs` | `/dashboard/enterprise-ai-os` (anonym, ohne Token) | 🔴 Cross-Tenant-Read öffentlich |
| `enterprise-ai-os-discovery-pending` | read `*` | `enterprise_ai_system_registry` | `/dashboard/enterprise-ai-os/discovery` (anonym) | 🔴 Cross-Tenant-Read (PII-Flags: `contains_personal_data`, `risk_level`, `department`) |
| `enterprise-ai-os-agents-run` | insert | `enterprise_agent_runs` (+audit) | nur Doku-Snippet, kein echter Call | 🟠 öffentlicher Write |
| `enterprise-ai-os-discovery-intake` | insert | `enterprise_ai_system_registry` | `DiscoveryIntakeForm` (public) | 🟡 Intake bewusst public — aber service-role |
| `enterprise-ai-os-feedback` | insert | `enterprise_feedback_reports` | `FeedbackWidget` (public) | 🟡 bewusst public — aber service-role |
| `enterprise-ai-os-founding-access` | insert/read | `enterprise_founders_access` | `FoundingAccessForm` (public) | 🟡 bewusst public — aber service-role |

## Severity-Einordnung

Alle fünf Tabellen existieren mit **RLS aktiv**, aber **~0 Zeilen**. Aktuell also
**kein aktiver Leak** — die RLS-Bypass-Reads geben heute leere Mengen zurück.
**Aber:** Sobald Tenants das AI-System-Register / Agent-Runs befüllen, liefern
`agent-runs-list` und `discovery-pending` **tenant-übergreifend** Daten an eine
**anonyme, öffentliche URL** (`/dashboard/enterprise-ai-os*`). Das ist eine
Design-Schuld, kein akuter Vorfall — aber vor erster Nutzung zu schließen.

## Warum kein Sofort-Fix

Die Read-Endpoints hängen an **anonymen** Dashboard-Seiten (SPA ruft sie per
`fetch` ohne `Authorization` auf). Würde man Bearer/Auth erzwingen, brechen die
Seiten sofort. Korrekt ist eine bewusste Entscheidung über das Zugriffsmodell:

**Option A — Internes/Tenant-Dashboard (empfohlen):**
`/dashboard/enterprise-ai-os*` hinter `AuthGate`, SPA schickt den Session-JWT
mit, Edge-Functions auf **Anon-Key + weitergereichter JWT** umstellen (RLS greift
automatisch, tenant-korrekt). Service-Role entfällt. Frontend + Backend Änderung.

**Option B — Endpoints sperren:**
`verify_jwt=true` + Bearer/getUser-Gate (wie governance-incidents), Dashboard-
Seiten vorerst deaktivieren/ausblenden, bis Option A umgesetzt ist.

**Public-Forms (intake/feedback/founding-access):** bleiben öffentlich, aber
Service-Role → Anon-Key + dedizierte RLS-INSERT-Policy + Rate-Limit. Verhalten
für echte Nutzer unverändert.

## Empfehlung

Vor dem ersten produktiven Befüllen der `enterprise_*`-Tabellen: **Option A**
für die zwei Read-Pfade umsetzen (eigene, fokussierte Session — Frontend-AuthGate
+ JWT-Weitergabe + Edge-Anon-Key). Bis dahin reicht **Option B** als Stopgap.
Verwaiste config-Stanza `governance-vendors` (ohne Funktion) mit aufräumen.
