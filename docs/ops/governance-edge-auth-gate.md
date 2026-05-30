# Security-Fix: governance-incidents / governance-connectors Auth-Gate

> Branch: `claude/governance-edge-auth-gate`. Befund + Fix einer öffentlichen,
> unauthentifizierten Edge-Function-Exposition. Read-only verifiziert gegen die
> Live-DB (`RealSyncDynamicsLive`, eu-central-1) via Supabase-MCP.

## Befund

Die beiden frisch in `main` gelandeten Functions (Commits `c67b54f`,
`55a0375`) waren **öffentlich unauthentifiziert** und nutzten den
**Service-Role-Key** (RLS-Bypass) ohne jeden Auth-/Tenant-Check:

| Aspekt | Vorher |
|---|---|
| `supabase/config.toml` | `verify_jwt = false` → Gateway verlangt nicht mal den Anon-Key |
| In-Handler-Auth | **keiner** — kein `getUser`, kein Bearer-Check |
| Tenant-Scoping | **keins** — Insert ohne `tenant_id` |
| Client | `SUPABASE_SERVICE_ROLE_KEY` auf Modul-Ebene (umgeht RLS) |

→ Jeder im Internet konnte `POST /functions/v1/governance-incidents` aufrufen.

### Severity-Einordnung (entschärfend, aber nicht entwarnend)

Die Ziel-Tabellen `governance_incidents` / `governance_connectors` **existieren
nicht** (keine Migration, nicht auf der Live-DB). Daher:

- **Aktuell kein Daten-Leak / kein erfolgreicher Cross-Tenant-Write** — der
  Insert wäre an der fehlenden Tabelle gescheitert (500).
- **Aber:** offenes, unauthentifiziertes Service-Role-Tor. In dem Moment, in dem
  jemand die Tabelle anlegt („Feature fertigstellen"), wird daraus ein echter
  Cross-Tenant-Write. Zusätzlich: ungeschützter `console.log` beliebiger
  Request-Bodies und eine inkonsistente 401-Oberfläche (s. u.).

### Zusätzlicher Befund: verwaiste, nie funktionierende Stubs

Die Functions passen **nicht** zum Frontend-Contract:

| | Edge-Function (Stub) | Frontend-Caller (real genutzt) |
|---|---|---|
| Body-Key | `action` | `op` |
| Incidents-Tabelle | `governance_incidents` (existiert nicht) | `incidents` (existiert, direkt via RLS gelesen) |
| Connectors-Tabelle | `governance_connectors` (existiert nicht) | `integration_connectors` / `remediation_actions` (RLS) |

`incidentsApi.ts` / `connectorsApi.ts` lesen die echten Tabellen **direkt** über
RLS; die Mutations-Pfade über die Edge-Functions waren also bereits tot.

## Fix (dieser Branch)

Deny-by-default, Muster von `governance-approvals` gespiegelt:

1. **`verify_jwt = true`** in `config.toml` für beide Functions (Gateway-Ebene).
2. **Bearer-Pflicht** → `401`, JWT-Verifikation via Anon-Client + `getUser()`.
3. **`tenant_id` erforderlich** + **Owner/Admin-Membership-Gate** → `403`.
4. Erkannte Ops → ehrliches **`501 NOT_IMPLEMENTED`** statt vorgetäuschter
   Persistenz oder Schreibversuch in eine nicht-existente Tabelle.
5. Body-Key `op` (Frontend) **und** `action` (Legacy) werden toleriert.

Damit ist die öffentliche Exposition geschlossen; die Functions sind jetzt
authentifizierte, tenant-gegatete No-Ops statt öffentliche Service-Role-Endpunkte.

## Offene Folge-Entscheidung (Feature, nicht Security)

Wenn Incidents/Connectors-Mutationen serverseitig laufen sollen, ist eine
bewusste Implementierung nötig — **nicht** Teil dieses Security-Fixes:

- Contract auf `op` + echte Tabellen (`incidents`, `integration_connectors`)
  vereinheitlichen, **oder** die zwei Edge-Functions ganz entfernen, falls die
  direkten RLS-Pfade ausreichen (dann sind sie reiner Ballast).
- Falls behalten: additive Migration mit RLS + `ai_tool_runs`/`workflow_runs`-
  Logging gemäß CLAUDE.md.

## Verifikation

- `getUser`-/Membership-Muster identisch zu `governance-approvals` (Referenz).
- Frontend bleibt funktionsfähig: Lese-Pfade (`fetchTenantIncidents`,
  `fetchTenantConnectors`) gehen direkt gegen RLS-Tabellen, nicht über diese
  Functions — der 501-Mutations-Pfad war ohnehin schon tot.
