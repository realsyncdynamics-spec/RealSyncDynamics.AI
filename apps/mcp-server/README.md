# RealSync MCP Governance Server

**MCP (Model Context Protocol) Governance Control Plane** für RealSyncDynamics.AI — sichere, auditierbare AI Agent-Zugriffe.

## Architektur

```
Claude / Hermes / AI Agent
    |
    | MCP Protocol
    |
MCP Server (Fastify)
    |
    +-- Auth (API Key)
    +-- Tools (Evidence, Governance)
    +-- Audit Logger
    |
    v
Supabase (PostgreSQL)
    |
    +-- evidence_snapshots
    +-- audit_events
    +-- ai_policies
    +-- governance_controls
```

## Phasen

### Phase 1: MVP (Aktuell)
- ✅ MCP Server Skeleton
- ✅ API-Key Auth
- ✅ Evidence Tools (`list`, `get`, `verify_hash`, `search`)
- ✅ Governance Tools (`get_status`, `list_controls`, `check_compliance`)
- ✅ Audit Logging
- ✅ Docker Container

### Phase 2: Erweitert
- [ ] API Key Management (DB-backed)
- [ ] Semantic Evidence Search (pgvector)
- [ ] Agent Runtime Status
- [ ] n8n Workflow Integration
- [ ] Claude Desktop Connector

### Phase 3: Production
- [ ] Scopes & RBAC
- [ ] Rate Limiting
- [ ] Metrics & Monitoring
- [ ] Multi-region Deployment

## Entwicklung

```bash
# Install
npm install

# Dev (Watch)
npm run dev

# Build
npm run build

# Test
npm run test

# Type Check
npm run typecheck
```

## API

### Health

```bash
curl http://localhost:3001/health
```

### Evidence (Requires `Bearer rsmcp_...`)

```bash
# List evidence
curl -H "Authorization: Bearer rsmcp_..." \
  http://localhost:3001/evidence

# Get evidence by ID
curl -H "Authorization: Bearer rsmcp_..." \
  http://localhost:3001/evidence/{id}

# Verify hash chain
curl -X POST -H "Authorization: Bearer rsmcp_..." \
  http://localhost:3001/evidence/{id}/verify-hash

# Search evidence by control
curl -H "Authorization: Bearer rsmcp_..." \
  http://localhost:3001/evidence/control/{controlId}
```

### Governance

```bash
# Get compliance status
curl -H "Authorization: Bearer rsmcp_..." \
  http://localhost:3001/governance/status?framework_id=iso-42001

# List controls
curl -H "Authorization: Bearer rsmcp_..." \
  http://localhost:3001/governance/controls

# Check control compliance
curl -H "Authorization: Bearer rsmcp_..." \
  http://localhost:3001/governance/controls/{controlId}/compliance
```

## Deployment

### Docker

```bash
npm run build
npm run docker:build
npm run docker:run
```

### Environment Variables

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
PORT=3001
HOST=0.0.0.0
```

## Sicherheit

- **Read-only by default**: Alle Tools sind readonly, keine Schreibzugriffe auf Governance-Daten
- **API-Key Auth**: Bearer Token mit Scopes (evidence.read, governance.read, runtime.read)
- **Audit Logging**: Jede MCP-Aktion wird auditiert
- **RLS**: Supabase RLS Policies schützen Tenant-Isolation
- **No Service Role**: Service-Role-Key ist nur im Server, niemals im Client

## Architektur-Entscheidungen

1. **Fastify statt Express**: Schneller, TypeScript-nativ, bessere Streaming-Support
2. **No MCP SDK Transport**: Phase 1 nutzt HTTP; MCP Protocol wird später via Websockets/SSE implementiert
3. **Supabase Service Role**: Nur im Server (Edge Functions können direkten Zugriff haben)
4. **Audit Logging überall**: Jede Aktion wird geloggt für Compliance & Debugging

## Next Steps

- [ ] API Key Management UI (Edge Function)
- [ ] Production Scopes & Permissions Table
- [ ] Integration Tests mit echtem Supabase
- [ ] Performance Benchmarks
- [ ] Cloudflare Workers Variante für Latency
