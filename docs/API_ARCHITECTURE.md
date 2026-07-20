# RealSync Dynamics.AI — REST API Architecture (v1)

**Ziel:** Standardisierte REST-API für externe Integrationen, Developer-Zugang und Marketplace-Integration.

**Status:** Phase 1 — Spezifikation & Design (nicht produktiv)

---

## 1. Übersicht

### Problem (Status Quo)
- 116+ Edge Functions ohne einheitliche Struktur
- Keine OpenAPI-Doku
- Kein SDK für externe Developer
- Kein Marketplace-Layer

### Lösung
```
Client Requests
        ↓
    /api/v1/*  (REST-Layer)
        ↓
API-Gateway (Validation, Rate-Limiting, Auth)
        ↓
Supabase Edge Functions (Bestehende Logik)
        ↓
PostgreSQL + Services
```

---

## 2. API-Struktur

### Versioning
```
/api/v1/           — aktuelle stabile Version
/api/v2/           — future (backward-compatible)
```

### Authentifizierung
```
Header: Authorization: Bearer {api_key}

API-Keys:
- Per-Tenant generiert
- Mit Scopes (read, write, admin)
- Audit-Logging auf alle Requests
- Revocation möglich
```

### Rate-Limiting
```
Global:    100 requests / minute (pro API-Key)
Per-Tenant: 1000 requests / minute
Burst:     50 requests (10-second window)

Header: X-RateLimit-Remaining, X-RateLimit-Reset
```

---

## 3. Ressourcen-Kategorien

### Kategorien & Endpunkte

#### A. Governance
```
GET    /api/v1/governance/policies          — Liste Policies
GET    /api/v1/governance/policies/{id}     — Policy Details
POST   /api/v1/governance/policies           — Create Policy
PUT    /api/v1/governance/policies/{id}     — Update Policy
DELETE /api/v1/governance/policies/{id}     — Delete Policy

GET    /api/v1/governance/approvals          — Pending Approvals
POST   /api/v1/governance/approvals/{id}/approve
POST   /api/v1/governance/approvals/{id}/reject

GET    /api/v1/governance/webhooks           — Webhook Subscriptions
POST   /api/v1/governance/webhooks           — Register Webhook
DELETE /api/v1/governance/webhooks/{id}     — Unregister
```

#### B. Agenten
```
GET    /api/v1/agents                        — Liste alle Agenten
GET    /api/v1/agents/{id}                   — Agent Details
POST   /api/v1/agents/{id}/run                — Start Agent
GET    /api/v1/agents/{id}/runs               — Agent Runs
GET    /api/v1/agents/{id}/runs/{runId}      — Run Details
```

#### C. Workflows
```
GET    /api/v1/workflows                     — Liste Workflows
GET    /api/v1/workflows/{id}                — Workflow Details
POST   /api/v1/workflows                     — Create Workflow
PUT    /api/v1/workflows/{id}                — Update Workflow
DELETE /api/v1/workflows/{id}                — Delete Workflow

POST   /api/v1/workflows/{id}/trigger        — Manual Trigger
GET    /api/v1/workflows/{id}/runs            — Workflow Runs
```

#### D. Audit & Compliance
```
GET    /api/v1/audit/logs                    — Audit Log Entries
GET    /api/v1/audit/reports                 — Compliance Reports
GET    /api/v1/audit/findings                — Scan Findings
```

#### E. Integrations
```
GET    /api/v1/connectors                    — Connector List
GET    /api/v1/connectors/{type}             — Connector Config
POST   /api/v1/connectors/{type}/authorize   — OAuth Flow
DELETE /api/v1/connectors/{type}             — Disconnect

GET    /api/v1/connectors/{type}/sync-status — Sync Status
POST   /api/v1/connectors/{type}/sync        — Manual Sync
```

#### F. Webhooks (Incoming)
```
POST   /api/v1/webhooks/github
POST   /api/v1/webhooks/stripe
POST   /api/v1/webhooks/shopify
POST   /api/v1/webhooks/custom
```

#### G. API Management
```
GET    /api/v1/api-keys                      — My API Keys
POST   /api/v1/api-keys                      — Create Key
DELETE /api/v1/api-keys/{keyId}              — Revoke Key

GET    /api/v1/usage                         — Usage Stats
GET    /api/v1/billing/invoices              — Invoices
```

---

## 4. Fehler-Handling

### Standard-Antwort bei Fehlern
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      {
        "field": "workflow_name",
        "issue": "required"
      }
    ],
    "request_id": "req_abc123xyz"
  }
}
```

### HTTP Status Codes
```
200 OK                 — Success
201 Created            — Resource created
204 No Content         — Success, no body
400 Bad Request        — Validation error
401 Unauthorized       — Missing/invalid API key
403 Forbidden          — Insufficient permissions
404 Not Found          — Resource not found
409 Conflict           — State conflict (e.g., duplicate)
429 Too Many Requests  — Rate limit exceeded
500 Internal Error     — Server error
```

---

## 5. Implementierungs-Roadmap

### Phase 1a: Dokumentation & Schema (Diese Woche)
- [ ] OpenAPI 3.0 Schema schreiben (`docs/openapi.v1.yaml`)
- [ ] Endpoint-Mapping definieren (alte Functions → neue Routes)
- [ ] Error-Handling standardisieren
- [ ] SDK-Generator vorbereiten

### Phase 1b: Express/Hono Gateway (2 Wochen)
- [ ] Express/Hono Server booten
- [ ] API-Gateway Middleware (Auth, Rate-Limit, Validation)
- [ ] Request-Routing zu bestehenden Edge Functions
- [ ] OpenAPI-Validator integrieren
- [ ] Swagger-UI + Redoc
- [ ] Local Testing

### Phase 1c: Deployment (1 Woche)
- [ ] Docker-Image bauen
- [ ] Vercel/Fly.io Deploy-Config
- [ ] Production-Monitoring (Sentry)
- [ ] Load-Testing

### Phase 2: SDK-Generierung (3–4 Wochen)
- [ ] OpenAPI → TypeScript SDK (openapi-generator)
- [ ] NPM Package publishen
- [ ] Documentation + Examples

### Phase 3: Marketplace (4–6 Wochen)
- [ ] Marketplace-UI in Dashboard
- [ ] Plugin-Registry
- [ ] Developer Portal

---

## 6. Datenflow-Beispiel

### Request: Workflow erstellen
```
POST /api/v1/workflows
Authorization: Bearer sk_prod_abc123
Content-Type: application/json

{
  "name": "Daily Compliance Scan",
  "trigger": {
    "type": "schedule",
    "cron": "0 9 * * *"
  },
  "actions": [
    {
      "type": "governance",
      "action": "run_policy_check",
      "config": {}
    }
  ]
}
```

### Flow
```
1. API-Gateway empfängt Request
2. API-Key validieren (DB-Lookup)
3. Tenant-ID extrahieren
4. Payload-Validation gegen OpenAPI-Schema
5. Weiterleiten zu Edge Function: api-gateway-workflow-create
6. Edge Function ruft bestehende Workflow-Logik auf
7. Response: 201 Created + Workflow-Objekt
```

---

## 7. Bestehende Edge Functions → Neue API-Routes

| Alte Function | Neue Route | Methode | Kategorie |
|--------------|-----------|--------|-----------|
| `ai-invoke` | `/api/v1/agents/{id}/run` | POST | Agenten |
| `governance-events` | `/api/v1/governance/webhooks` | POST | Webhooks |
| `automation-trigger` | `/api/v1/workflows/{id}/trigger` | POST | Workflows |
| `audit-report-email` | `/api/v1/audit/reports` | GET | Audit |
| `stripe-webhook` | `/api/v1/webhooks/stripe` | POST | Webhooks |
| `shopify-webhooks` | `/api/v1/webhooks/shopify` | POST | Webhooks |
| (weitere 110+) | ... | ... | ... |

**Vollständiges Mapping** → siehe `docs/edge-function-mapping.md`

---

## 8. Security-Modell

### API-Key Scopes
```
api:read           — Read-only access (GET, POST webhooks)
api:write          — Create/Update workflows, agents
api:admin          — All operations + key management
webhooks:receive   — Only webhook endpoints
webhooks:send      — Send outbound webhooks
```

### RLS-Integration
```
Alle API-Requests erfolgen über Tenant-Context:
- API-Key → Tenant-ID
- Alle SQL-Queries gefiltert durch RLS (tenant_id = ctx.tenant_id)
- Service-Role-Bypass nur für interne Edge Functions
```

### Audit-Logging
```
Jeder API-Request wird geloggt:
- Endpoint, Method, Status
- API-Key ID (nicht der Key selbst)
- Tenant-ID
- Request-Body (sensitiv: masked)
- Response-Status + Duration
- IP-Address, User-Agent

Tabelle: api_audit_logs
Retention: 90 Tage
```

---

## 9. Testing-Strategie

### Unit-Tests (Vitest)
```
test/api/endpoints/workflows.test.ts
test/api/endpoints/agents.test.ts
test/api/endpoints/audit.test.ts
```

### E2E-Tests (Playwright)
```
e2e/api/workflow-creation-flow.e2e.ts
e2e/api/webhook-integration.e2e.ts
e2e/api/rate-limiting.e2e.ts
```

### Load-Testing
```
npm run qa:load -- --rps 100 --duration 60s
```

---

## 10. SDK-Generierung (Future)

Aus OpenAPI-Schema automatisch generieren:
```bash
npx openapi-generator-cli generate \
  -i docs/openapi.v1.yaml \
  -g typescript \
  -o packages/sdk-typescript

npm publish packages/sdk-typescript
```

**Ergebnis:**
```typescript
import { RealSyncAPI } from '@realsync/api';

const api = new RealSyncAPI({ apiKey: 'sk_prod_...' });

const workflow = await api.workflows.create({
  name: 'Daily Scan',
  trigger: { type: 'schedule', cron: '0 9 * * *' }
});
```

---

## 11. Versionierungs-Policy

### Backward Compatibility
- v1 APIs werden mindestens 12 Monate unterstützt
- Breaking Changes erfordern neue Major Version
- Deprecation-Warnung min. 3 Monate vorher

### Deprecation-Header
```
Deprecation: true
Sunset: Fri, 31 Dec 2025 23:59:59 GMT
Link: <https://docs.realsync.ai/api/v2>; rel="successor-version"
```

---

## Nächste Schritte

1. **Diese Woche:** OpenAPI-Schema finalisieren (`docs/openapi.v1.yaml`)
2. **Nächste Woche:** Express Gateway implementieren
3. **Danach:** SDK + Marketplace

---

**Branch:** `claude/realsync-saas-architecture-1rc9x7`  
**Autoren:** Claude Code (AI)  
**Zuletzt aktualisiert:** 2026-07-14
