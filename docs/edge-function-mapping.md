# Edge Function → REST API Mapping

**Zweck:** Dokumentiert, wie bestehende Edge Functions auf neue REST-API-Endpunkte gemappt werden.

---

## Governance Functions

| Edge Function | REST Endpoint | Method | Kategorie |
|---------------|---------------|--------|-----------|
| `governance-policies` | `/api/v1/governance/policies` | GET/POST | Read/Write |
| `governance-policy-get` | `/api/v1/governance/policies/{id}` | GET | Read |
| `governance-policy-update` | `/api/v1/governance/policies/{id}` | PUT | Write |
| `governance-policy-delete` | `/api/v1/governance/policies/{id}` | DELETE | Write |
| `governance-events` | `/api/v1/governance/webhooks` | POST | Events |
| `governance-webhooks` | `/api/v1/governance/webhooks` | GET/POST/DELETE | Config |
| `governance-approvals` | `/api/v1/governance/approvals` | GET | Read |
| `governance-approval-approve` | `/api/v1/governance/approvals/{id}/approve` | POST | Action |
| `governance-approval-reject` | `/api/v1/governance/approvals/{id}/reject` | POST | Action |
| `governance-admin-log` | `/api/v1/audit/logs` | GET | Read |

---

## AI & Agents Functions

| Edge Function | REST Endpoint | Method | Kategorie |
|---------------|---------------|--------|-----------|
| `ai-invoke` | `/api/v1/agents/{id}/run` | POST | Execute |
| `ai-act-classify` | `/api/v1/agents/classifier/run` | POST | Execute |
| `ai-act-auto-classify` | `/api/v1/agents/auto-classifier/run` | POST | Execute |
| `agent-os-runner` | `/api/v1/agents/{id}/run` | POST | Execute |
| `agent-list` | `/api/v1/agents` | GET | Read |
| `agent-get` | `/api/v1/agents/{id}` | GET | Read |
| `agent-runs` | `/api/v1/agents/{id}/runs` | GET | Read |
| `agent-run-details` | `/api/v1/agents/{id}/runs/{runId}` | GET | Read |
| `enterprise-ai-os-agents-list` | `/api/v1/enterprise/agents` | GET | Read |
| `enterprise-ai-os-agents-run` | `/api/v1/enterprise/agents/{id}/run` | POST | Execute |

---

## Workflow & Automation Functions

| Edge Function | REST Endpoint | Method | Kategorie |
|---------------|---------------|--------|-----------|
| `automation-trigger` | `/api/v1/workflows/{id}/trigger` | POST | Execute |
| `automation-callback` | `/api/v1/workflows/{id}/callback` | POST | Internal |
| `workflow-create` | `/api/v1/workflows` | POST | Write |
| `workflow-get` | `/api/v1/workflows/{id}` | GET | Read |
| `workflow-update` | `/api/v1/workflows/{id}` | PUT | Write |
| `workflow-delete` | `/api/v1/workflows/{id}` | DELETE | Write |
| `workflow-list` | `/api/v1/workflows` | GET | Read |
| `workflow-runs` | `/api/v1/workflows/{id}/runs` | GET | Read |
| `automation-runs` | `/api/v1/workflows/{id}/runs` | GET | Read |
| `automation-run-events` | `/api/v1/workflows/{id}/runs/{runId}/events` | GET | Read |

---

## Audit & Compliance Functions

| Edge Function | REST Endpoint | Method | Kategorie |
|---------------|---------------|--------|-----------|
| `api-audit` | `/api/v1/audit/logs` | GET | Read |
| `audit-report-email` | `/api/v1/audit/reports/{id}/email` | POST | Action |
| `audit-report-pdf` | `/api/v1/audit/reports/{id}/pdf` | GET | Download |
| `audit-reports` | `/api/v1/audit/reports` | GET | Read |
| `audit-findings` | `/api/v1/audit/findings` | GET | Read |
| `audit-monitor-cron` | `/api/v1/audit/monitor` | POST | Internal |
| `audit-recheck-weekly` | `/api/v1/audit/recheck` | POST | Internal |

---

## Integration & Connector Functions

| Edge Function | REST Endpoint | Method | Kategorie |
|---------------|---------------|--------|-----------|
| `shopify-install` | `/api/v1/connectors/shopify/authorize` | POST | OAuth |
| `shopify-callback` | `/api/v1/connectors/shopify/callback` | POST | Callback |
| `shopify-webhooks` | `/api/v1/webhooks/shopify` | POST | Webhook |
| `shopify-scan` | `/api/v1/connectors/shopify/scan` | POST | Action |
| `stripe-webhook` | `/api/v1/webhooks/stripe` | POST | Webhook |
| `stripe-checkout` | `/api/v1/billing/checkout` | POST | Billing |
| `stripe-portal` | `/api/v1/billing/portal` | POST | Billing |
| `stripe-meter-sync` | `/api/v1/billing/meter-sync` | POST | Internal |
| `connector-list` | `/api/v1/connectors` | GET | Read |
| `connector-authorize` | `/api/v1/connectors/{type}/authorize` | POST | OAuth |
| `connector-disconnect` | `/api/v1/connectors/{type}` | DELETE | Action |
| `connector-sync-status` | `/api/v1/connectors/{type}/sync-status` | GET | Read |

---

## Webhook Functions

| Edge Function | REST Endpoint | Method | Kategorie |
|---------------|---------------|--------|-----------|
| `api-webhook-deliver` | `/api/v1/webhooks/outgoing/{id}/deliver` | POST | Internal |
| `webhook-dispatcher` | `/api/v1/webhooks/dispatch` | POST | Internal |
| `telegram-webhook` | `/api/v1/webhooks/telegram` | POST | Webhook |
| `bot-voice-webhook` | `/api/v1/webhooks/voice` | POST | Webhook |

---

## Email & Notification Functions

| Edge Function | REST Endpoint | Method | Kategorie |
|---------------|---------------|--------|-----------|
| `email-notify-send` | `/api/v1/notifications/email` | POST | Internal |
| `daily-digest` | `/api/v1/notifications/digest` | POST | Internal |

---

## Admin & Management Functions

| Edge Function | REST Endpoint | Method | Kategorie |
|---------------|---------------|--------|-----------|
| `usage-increment` | `/api/v1/usage/increment` | POST | Internal |
| `token-tracking` | `/api/v1/usage/tokens` | POST | Internal |
| `check:edge-functions` | `/api/v1/admin/edge-functions/check` | POST | Admin |

---

## Implementation Strategy

### Phase 1: API-Gateway booten
```bash
npm install express cors dotenv
```

### Phase 2: Middleware stapeln
```typescript
// middleware/auth.ts
// middleware/rateLimit.ts
// middleware/validation.ts
// middleware/errorHandler.ts
```

### Phase 3: Routes erstellen
```typescript
// routes/governance.ts
// routes/agents.ts
// routes/workflows.ts
// routes/audit.ts
// routes/webhooks.ts
// routes/management.ts
```

### Phase 4: Proxy zu Edge Functions
```typescript
// Jede REST-Route proxied zu entsprechender Edge Function
// Beispiel: POST /api/v1/agents/{id}/run → ai-invoke
```

---

## Beispiel: Workflow erstellen

### Alte Edge Function
```typescript
// supabase/functions/automation-trigger/index.ts
supabase.functions.invoke('automation-trigger', {
  body: { workflow_id: '...', context: {} }
})
```

### Neue REST-API
```bash
POST /api/v1/workflows/123/trigger
Authorization: Bearer sk_prod_abc123
Content-Type: application/json

{
  "context": {}
}
```

### API-Gateway macht dann:
```typescript
// 1. Request validieren gegen OpenAPI-Schema
// 2. API-Key prüfen
// 3. Tenant-ID extrahieren
// 4. Rate-Limit checken
// 5. An Edge Function weiterleiten:
await supabase.functions.invoke('automation-trigger', {
  body: {
    workflow_id: params.workflowId,
    context: request.body.context,
    tenant_id: auth.tenant_id,
    api_key_id: auth.key_id
  }
})
// 6. Response zurückgeben
```

---

## Testing-Checklist

- [ ] Jeder Endpunkt hat Unit-Test
- [ ] Jeder Endpunkt hat E2E-Test
- [ ] Rate-Limiting wird getestet
- [ ] Error-Cases werden abgedeckt
- [ ] OpenAPI-Validator bestätigt Schema-Konformität
- [ ] Load-Test: 100 RPS durchhalten

---

## Deployment

### Local Development
```bash
npm run dev
# http://localhost:3000/api/v1
# Swagger UI: http://localhost:3000/api/docs
```

### Staging
```bash
npm run build
docker build -t realsync-api:latest .
docker run -p 3000:3000 realsync-api:latest
```

### Production
```bash
# Deploy zu Vercel/Fly.io/Cloud Run
# Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.
```

---

**Status:** Phase 1 Spezifikation ✅  
**Nächster Schritt:** Express-Gateway implementieren
