# Perplexity MCP Integration

**Status:** Production-Ready (Phase 2)  
**Last Updated:** 2026-08-03

## Overview

The Perplexity MCP server provides real-time web search, academic research, and AI-powered summarization capabilities to RealSyncDynamicsAI's governance runtime. It enables agents and the compliance system to retrieve current information and research findings with transparent source attribution.

## Architecture

```
┌──────────────────────────────────────┐
│  RealSyncDynamicsAI Dashboard        │
│  / Edge Functions / Services         │
└──────────────┬───────────────────────┘
               │
         MCP Protocol
               │
┌──────────────▼───────────────────────┐
│  Perplexity MCP Server                │
│  (services/perplexity-mcp)            │
│                                       │
│  • search_web                         │
│  • search_academic                    │
│  • summarize_research                 │
└──────────────┬───────────────────────┘
               │
         HTTPS (Bearer Auth)
               │
┌──────────────▼───────────────────────┐
│  Perplexity API                       │
│  (sonar-pro model)                    │
└───────────────────────────────────────┘
```

## Configuration

### Setup Steps

1. **Install Dependencies:**
   ```bash
   cd services/perplexity-mcp
   npm install
   ```

2. **Get API Key:**
   - Visit [Perplexity AI](https://www.perplexity.ai/)
   - Create an account and generate an API key
   - Set `PERPLEXITY_API_KEY` in your environment

3. **Configure .mcp.json:**
   Already registered in `/.mcp.json`:
   ```json
   {
     "perplexity-mcp": {
       "command": "node",
       "args": ["services/perplexity-mcp/src/index.js"],
       "env": { "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}" }
     }
   }
   ```

4. **Set Environment Variable:**
   ```bash
   export PERPLEXITY_API_KEY=your-api-key-here
   ```

### Environment Variables

| Variable | Purpose | Required | Example |
|---|---|---|---|
| `PERPLEXITY_API_KEY` | Authentication with Perplexity API | Yes | `pplx_...` |
| `LOG_LEVEL` | Logging verbosity | No | `info` \| `debug` |

## Tools

### 1. Web Search (`search_web`)

**Purpose:** Retrieve real-time information from the web with source attribution.

**Use Cases:**
- Current news and developments
- Market research
- Technology trends
- Recent regulatory changes
- DSGVO and compliance updates

**Parameters:**
```typescript
{
  query: string,                    // Required: Search query
  search_recency_filter?: 'month'   // Optional: Time filter
    | 'week'
    | 'day'
    | 'hour'
}
```

**Response:**
```typescript
{
  content: string,                  // AI-generated summary
  citations: Array<{                // Source citations
    url: string,
    title: string,
    snippet: string
  }>,
  model: string,                    // "sonar-pro"
  tokens_used: {
    input: number,
    output: number
  }
}
```

**Example:**
```json
{
  "query": "EU AI Act latest updates 2026",
  "search_recency_filter": "month"
}
```

### 2. Academic Search (`search_academic`)

**Purpose:** Find peer-reviewed research and academic sources.

**Use Cases:**
- Security research
- AI safety and ethics papers
- Compliance methodology research
- Technical deepdives

**Parameters:**
```typescript
{
  query: string  // Required: Research query
}
```

**Response:**
```typescript
{
  research_findings: string,
  sources: Array<{
    title: string,
    authors: string[],
    year: number,
    url?: string
  }>,
  note: string
}
```

**Example:**
```json
{
  "query": "machine learning model interpretability"
}
```

### 3. Research Summarization (`summarize_research`)

**Purpose:** Get AI-powered summary of research at configurable depth.

**Use Cases:**
- Risk assessment research
- Governance framework analysis
- Emerging threat analysis
- Competitive research

**Parameters:**
```typescript
{
  topic: string,                          // Required: Topic to summarize
  depth?: 'basic'                         // Optional: Summary depth
    | 'comprehensive' (default)
    | 'detailed'
}
```

**Response:**
```typescript
{
  summary: string,
  depth_level: string,
  citations: Array<string>,
  timestamp: ISO8601
}
```

**Example:**
```json
{
  "topic": "Zero-trust security architecture for AI systems",
  "depth": "comprehensive"
}
```

## Integration Points

### Edge Functions

Use Perplexity MCP in Edge Functions for:
- Real-time compliance checks
- Incident response research
- Policy validation against current standards

```typescript
// supabase/functions/governance-incident-response/index.ts
import { searchWeb } from 'perplexity-mcp-client'

export async function handleIncident(incident) {
  const research = await searchWeb(
    `${incident.type} governance best practices 2026`,
    'month'
  )
  return {
    incident,
    research_context: research.content,
    sources: research.citations
  }
}
```

### Dashboard Features

**Governance Runtime Intelligence:**
- Display research context when enforcing policies
- Show sources for compliance decisions
- Link to full research papers

**Risk Assessment:**
- Real-time threat intelligence
- Emerging vulnerability research
- Industry-specific compliance updates

**Audit Trail:**
- Log all research queries
- Store citations in `audit_evidence` table
- Associate research with governance decisions in `governance_approvals`

### Monitoring & Observability

Log all Perplexity API calls:
- Tool name and parameters
- Response time
- Tokens used (for cost tracking)
- Citations count
- Any errors or timeouts

```sql
INSERT INTO ai_tool_runs (
  tenant_id,
  ai_system_id,
  tool_name,
  input_params,
  output_summary,
  tokens_used,
  cost_estimate,
  run_status
) VALUES (...)
```

## Governance & Compliance

### Compliance Aspects

- **EU AI Act (Article 52):** AI tools must be disclosed to users
  - ✅ Perplexity MCP is marked as a tool used
  - ✅ Sources are attributed and traceable

- **DSGVO Compliance:**
  - ✅ No personal data sent to Perplexity (queries are about topics/research, not individuals)
  - ✅ API calls logged in RealSync audit trail
  - ✅ Users can request audit trail of research used in decisions

- **Transparency:**
  - ✅ All results include source attribution
  - ✅ Model used (sonar-pro) is visible
  - ✅ Token usage tracked for audit

### Risk Mitigations

| Risk | Mitigation |
|---|---|
| Hallucinations | Use Perplexity's sonar-pro model with low temperature (0.2-0.3) |
| Outdated info | Time-filter searches (day/week/month) based on criticality |
| Source unreliability | Manual verification required for compliance-critical decisions |
| Cost overruns | Monitor tokens, rate-limit per tenant, implement quotas |

### Security

- ✅ API key stored in environment variables only
- ✅ HTTPS-only communication
- ✅ No secrets logged
- ✅ RLS ensures tenant isolation for query logs
- ✅ Follows ISO-27001 principles per CLAUDE.md

## Operations

### Local Development

```bash
cd services/perplexity-mcp

# Install & test
npm install
npm run dev

# In another terminal, test the server
# (The MCP server listens on stdio)
```

### Deployment

**Production Deployment:**

1. **Docker (VPS):**
   ```bash
   docker build -t perplexity-mcp .
   docker run \
     -e PERPLEXITY_API_KEY=$PERPLEXITY_API_KEY \
     perplexity-mcp
   ```

2. **Cloudflare Workers (Phase 3):**
   See services/perplexity-mcp/DEPLOY_CLOUDFLARE.md

3. **Kubernetes (if applicable):**
   ```bash
   kubectl create secret generic perplexity-api-key \
     --from-literal=PERPLEXITY_API_KEY=$PERPLEXITY_API_KEY
   kubectl apply -f perplexity-mcp-deployment.yaml
   ```

### Monitoring

**Log Level Control:**
```bash
LOG_LEVEL=debug node src/index.js  # See all requests
LOG_LEVEL=info node src/index.js   # Production logging
```

**Key Metrics to Monitor:**
- Latency (ms per query)
- Error rate
- Token usage per day
- API call volume
- Cost per tenant

### Troubleshooting

| Issue | Solution |
|---|---|
| `PERPLEXITY_API_KEY` not set | Check environment: `echo $PERPLEXITY_API_KEY` |
| Connection timeout | Check Perplexity API status, network connectivity |
| Rate limit errors | Implement backoff, add queue, contact Perplexity support |
| High latency | Use shorter queries, consider caching frequent searches |

## Performance & Quotas

### Recommended Limits (per Tenant/Day)

| Tier | Searches | Academic | Summarizations | Max Tokens |
|---|---|---|---|---|
| Free | 10 | 2 | 2 | 5K |
| Starter | 50 | 10 | 10 | 25K |
| Growth | 200 | 50 | 50 | 100K |
| Agency | 1000 | 500 | 500 | 500K |
| Enterprise | Unlimited | Unlimited | Unlimited | Unlimited |

## Cost Tracking

Perplexity API is usage-based. Track costs:

```sql
-- Cost calculation (example rates, check Perplexity pricing)
SELECT
  tenant_id,
  SUM((tokens_used->>'input')::int * 0.0001 +
      (tokens_used->>'output')::int * 0.0002) as daily_cost_estimate
FROM ai_tool_runs
WHERE tool_name LIKE 'search_%'
  AND created_at > NOW() - INTERVAL '1 day'
GROUP BY tenant_id
ORDER BY daily_cost_estimate DESC;
```

## Future Enhancements

- [ ] **Caching Layer:** Cache frequent research queries for 24h
- [ ] **Multi-Model Support:** Add o1, gpt-4o for specific use cases
- [ ] **Citation Format Variants:** BibTeX, APA, MLA export
- [ ] **Batch Research:** Parallel searches for topics
- [ ] **Source Verification:** Cross-verify critical sources
- [ ] **Custom Prompts:** Tenant-specific research instructions
- [ ] **Evidence Vault Integration:** Auto-store research in immutable audit log

## References

- [Perplexity API Docs](https://docs.perplexity.ai/)
- [MCP Spec](https://modelcontextprotocol.io/)
- [EU AI Act Compliance](../compliance/eu-ai-act.md)
- [DSGVO Compliance](../compliance/dsgvo.md)
