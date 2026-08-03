# Perplexity MCP — Integration mit Hermes/OpenClaw Agent

Anleitung für die Integration des Perplexity MCP Servers in Hermes oder OpenClaw Agenten zur Nutzung von Web Search, Academic Research und Summarization in Governance Workflows.

## Architektur

```
Hermes/OpenClaw Agent
        ↓
    MCP Client
        ↓
Perplexity MCP Server (Docker)
        ↓
Perplexity API
        ↓
Search Results + Citations
```

## Phase 1: MCP Client Setup

### Installation

```bash
npm install @modelcontextprotocol/sdk axios dotenv
```

### MCP Client Factory

Create `services/hermes-agent/src/clients/PerplexityMCPClient.ts`:

```typescript
import { Client as MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import axios from 'axios';
import pino from 'pino';

const logger = pino();

export interface SearchResult {
  content: string;
  citations: Array<{
    url: string;
    title: string;
    snippet: string;
  }>;
  model: string;
  tokens_used: {
    input: number;
    output: number;
  };
}

export interface ResearchFinding {
  research_findings: string;
  sources: Array<{
    title: string;
    authors: string[];
    year: number;
    url?: string;
  }>;
}

export interface ResearchSummary {
  summary: string;
  depth_level: string;
  citations: string[];
  timestamp: string;
}

export class PerplexityMCPClient {
  private client: MCPClient;
  private baseUrl: string;

  constructor(baseUrl: string = 'http://perplexity-mcp:3000') {
    this.baseUrl = baseUrl;
    this.client = new MCPClient({
      name: 'hermes-agent',
      version: '1.0.0',
    });
  }

  /**
   * Search the web with Perplexity
   */
  async searchWeb(
    query: string,
    recencyFilter?: 'day' | 'week' | 'month' | 'hour'
  ): Promise<SearchResult> {
    try {
      logger.info({ query, recencyFilter }, 'Calling Perplexity search_web');

      const response = await this.callTool('search_web', {
        query,
        search_recency_filter: recencyFilter,
      });

      return JSON.parse(response);
    } catch (error) {
      logger.error({ error, query }, 'Web search failed');
      throw error;
    }
  }

  /**
   * Search academic and peer-reviewed sources
   */
  async searchAcademic(query: string): Promise<ResearchFinding> {
    try {
      logger.info({ query }, 'Calling Perplexity search_academic');

      const response = await this.callTool('search_academic', { query });

      return JSON.parse(response);
    } catch (error) {
      logger.error({ error, query }, 'Academic search failed');
      throw error;
    }
  }

  /**
   * Get AI-powered research summary
   */
  async summarizeResearch(
    topic: string,
    depth: 'basic' | 'comprehensive' | 'detailed' = 'comprehensive'
  ): Promise<ResearchSummary> {
    try {
      logger.info({ topic, depth }, 'Calling Perplexity summarize_research');

      const response = await this.callTool('summarize_research', {
        topic,
        depth,
      });

      return JSON.parse(response);
    } catch (error) {
      logger.error({ error, topic }, 'Research summarization failed');
      throw error;
    }
  }

  /**
   * Generic tool call via MCP protocol
   */
  private async callTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/tool/call`, {
        tool: toolName,
        args,
      });

      return response.data.result;
    } catch (error) {
      logger.error(
        { error, toolName, args },
        'MCP tool call failed'
      );
      throw error;
    }
  }
}

export default PerplexityMCPClient;
```

## Phase 2: Integration in Governance Workflows

### Example: Risk Assessment with Web Research

```typescript
// services/hermes-agent/src/workflows/riskAssessmentWithResearch.ts

import PerplexityMCPClient from '../clients/PerplexityMCPClient';
import { logger } from '../utils/logger';

export async function assessRiskWithResearch(
  assetId: string,
  assetType: string,
  existingRisk: number
) {
  const mcp = new PerplexityMCPClient();

  try {
    // Step 1: Search for current threat landscape
    logger.info({ assetType }, 'Searching threat intelligence...');
    const threatResearch = await mcp.searchWeb(
      `${assetType} security vulnerabilities threats 2026`,
      'month'
    );

    // Step 2: Get academic research on mitigation
    logger.info({ assetType }, 'Researching mitigation strategies...');
    const mitigationAcademic = await mcp.searchAcademic(
      `${assetType} security best practices risk mitigation`
    );

    // Step 3: Summarize latest findings
    const summary = await mcp.summarizeResearch(
      `Current threat landscape and mitigation for ${assetType}`,
      'comprehensive'
    );

    // Step 4: Store evidence in audit trail
    return {
      assetId,
      assetType,
      baseRisk: existingRisk,
      threatIntelligence: {
        content: threatResearch.content,
        citations: threatResearch.citations,
        timestamp: new Date().toISOString(),
      },
      academicBasis: {
        findings: mitigationAcademic.research_findings,
        sources: mitigationAcademic.sources,
      },
      executiveSummary: summary.summary,
      evidence: {
        sources: [...threatResearch.citations, ...mitigationAcademic.sources],
        timestamp: summary.timestamp,
      },
    };
  } catch (error) {
    logger.error({ error, assetId }, 'Risk assessment failed');
    throw error;
  }
}
```

## Phase 3: Governance Event Handlers

### Incident Investigation Workflow

```typescript
// services/hermes-agent/src/handlers/governanceIncidentHandler.ts

import PerplexityMCPClient from '../clients/PerplexityMCPClient';
import { logAuditEvidence } from '../db/auditLog';

export async function handleGovernanceIncident(incident) {
  const mcp = new PerplexityMCPClient();

  logger.info({ incidentId: incident.id }, 'Investigating governance incident');

  // Search for similar incidents and best practices
  const research = await mcp.searchWeb(
    `${incident.type} incident response best practices governance`,
    'week'
  );

  // Log as evidence
  await logAuditEvidence({
    incident_id: incident.id,
    evidence_type: 'research_context',
    content: research.content,
    sources: research.citations,
    ai_tool_run: {
      tool_name: 'search_web',
      model: research.model,
      tokens_used: research.tokens_used,
    },
  });

  return {
    incident,
    researchContext: research.content,
    sources: research.citations,
  };
}
```

### Policy Validation with Academic Research

```typescript
// services/hermes-agent/src/handlers/policyValidationHandler.ts

import PerplexityMCPClient from '../clients/PerplexityMCPClient';

export async function validatePolicyWithResearch(policy) {
  const mcp = new PerplexityMCPClient();

  logger.info({ policyId: policy.id }, 'Validating policy against research');

  // Search academic sources for policy effectiveness
  const academicResearch = await mcp.searchAcademic(
    `${policy.domain} policy effectiveness compliance research`
  );

  // Get comprehensive summary of current best practices
  const summary = await mcp.summarizeResearch(
    `Best practices for ${policy.domain} policy in 2026`,
    'comprehensive'
  );

  return {
    policy,
    validatedAgainst: {
      academic: academicResearch,
      summary: summary,
    },
    gaps: identifyGaps(policy, summary),
    recommendations: generateRecommendations(summary, academicResearch),
  };
}
```

## Phase 4: Audit Trail & Evidence Integration

### Log Search Results as Evidence

```typescript
// services/hermes-agent/src/db/evidenceVault.ts

export async function storeResearchAsEvidence(
  tenantId: string,
  auditJobId: string,
  searchResult,
  toolName: string
) {
  // Insert into ai_tool_runs
  await db.query(`
    INSERT INTO ai_tool_runs (
      tenant_id,
      ai_system_id,
      tool_name,
      input_params,
      output_summary,
      tokens_used,
      cost_estimate,
      run_status
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, 'success'
    )
  `, [
    tenantId,
    'hermes-agent', // AI system ID
    toolName,
    JSON.stringify({ query: searchResult.query }),
    searchResult.content.substring(0, 500), // Summary
    JSON.stringify(searchResult.tokens_used),
    calculateCost(searchResult.tokens_used),
  ]);

  // Insert citations into audit_evidence
  for (const citation of searchResult.citations) {
    await db.query(`
      INSERT INTO audit_evidence (
        audit_job_id,
        evidence_type,
        content,
        source_url,
        verified_at
      ) VALUES ($1, $2, $3, $4, NOW())
    `, [
      auditJobId,
      'research_citation',
      citation.title || citation.snippet,
      citation.url,
    ]);
  }
}
```

## Phase 5: Governance Reports with Research Context

### Generate Compliance Report with Sources

```typescript
// services/hermes-agent/src/reports/complianceReportGenerator.ts

export async function generateComplianceReport(
  assessment,
  includeResearch = true
) {
  const mcp = new PerplexityMCPClient();

  let reportBody = `# Compliance Report\n\n`;

  // Section 1: Executive Summary
  if (includeResearch) {
    const summary = await mcp.summarizeResearch(
      `${assessment.domain} compliance requirements and best practices`,
      'basic'
    );
    reportBody += `## Executive Summary\n\n${summary.summary}\n\n`;
    reportBody += `### Sources\n${summary.citations.join('\n')}\n\n`;
  }

  // Section 2: Current State Analysis
  reportBody += `## Current State\n\n${assessment.findings}\n\n`;

  // Section 3: Benchmarking against Industry Research
  if (includeResearch) {
    const industry = await mcp.searchWeb(
      `${assessment.industry} compliance benchmarks 2026`,
      'month'
    );
    reportBody += `## Industry Benchmarks\n\n${industry.content}\n\n`;
    reportBody += `### Research Sources\n`;
    industry.citations.forEach(c => {
      reportBody += `- [${c.title}](${c.url})\n`;
    });
  }

  return {
    title: `${assessment.domain} Compliance Report`,
    content: reportBody,
    generatedAt: new Date().toISOString(),
    researchBased: includeResearch,
  };
}
```

## Phase 6: Configuration & Environment

### Hermes Configuration

Add to `services/hermes-agent/.env`:

```env
# Perplexity MCP
PERPLEXITY_MCP_URL=http://perplexity-mcp:3000
PERPLEXITY_MCP_ENABLED=true
PERPLEXITY_MCP_TIMEOUT=30000

# Logging
LOG_LEVEL=info

# Governance Integration
GOVERNANCE_API_URL=http://governance_backend:8002
AUDIT_EVIDENCE_TABLE=audit_evidence
```

### Docker Network Configuration

Ensure Hermes und Perplexity MCP sind im gleichen Netzwerk:

```yaml
# docker-compose.yml
services:
  hermes-agent:
    networks:
      - rsd_net
    depends_on:
      - perplexity-mcp

  perplexity-mcp:
    networks:
      - rsd_net

networks:
  rsd_net:
    driver: bridge
```

## Phase 7: Testing & Verification

### Unit Test Example

```typescript
// services/hermes-agent/tests/perplexity.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import PerplexityMCPClient from '../src/clients/PerplexityMCPClient';

describe('PerplexityMCPClient', () => {
  let client: PerplexityMCPClient;

  beforeAll(() => {
    client = new PerplexityMCPClient('http://localhost:3000');
  });

  it('should perform web search', async () => {
    const result = await client.searchWeb('AI security');
    expect(result.content).toBeDefined();
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it('should search academic sources', async () => {
    const result = await client.searchAcademic('machine learning interpretability');
    expect(result.research_findings).toBeDefined();
  });

  it('should summarize research', async () => {
    const result = await client.summarizeResearch('cloud security');
    expect(result.summary).toBeDefined();
    expect(result.depth_level).toBe('comprehensive');
  });
});
```

### Integration Test

```typescript
// e2e/workflows/riskAssessment.spec.ts

import { test, expect } from '@playwright/test';

test('Risk assessment includes web research', async ({ page }) => {
  // Trigger risk assessment
  const assessment = await page.evaluate(async () => {
    const response = await fetch('/api/governance/risk-assess', {
      method: 'POST',
      body: JSON.stringify({ assetId: 'test-asset' }),
    });
    return response.json();
  });

  // Verify research was included
  expect(assessment.threatIntelligence).toBeDefined();
  expect(assessment.threatIntelligence.citations.length).toBeGreaterThan(0);
  expect(assessment.academicBasis).toBeDefined();
});
```

## Phase 8: Monitoring & Logging

### MCP Usage Metrics

```sql
-- Query MCP tool usage
SELECT
  tool_name,
  COUNT(*) as calls,
  AVG(tokens_used->>'input') as avg_input_tokens,
  AVG(tokens_used->>'output') as avg_output_tokens,
  SUM(CAST(cost_estimate AS NUMERIC)) as total_cost
FROM ai_tool_runs
WHERE tool_name LIKE 'search_%' OR tool_name = 'summarize_research'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY tool_name
ORDER BY calls DESC;
```

### Health Check

```bash
# Verify Perplexity MCP is accessible from Hermes
docker exec hermes-agent curl -f http://perplexity-mcp:3000/health || echo "MCP unavailable"
```

## Troubleshooting

### MCP Service Not Reachable

```bash
# Check if container is running
docker ps | grep perplexity-mcp

# Check network connectivity
docker exec hermes-agent ping -c 1 perplexity-mcp

# Check logs
docker logs perplexity-mcp
```

### API Key Invalid

```bash
# Verify PERPLEXITY_API_KEY in .env
grep PERPLEXITY_API_KEY .env

# Restart Perplexity MCP
docker restart perplexity-mcp
```

### High Latency

```bash
# Check MCP container resources
docker stats perplexity-mcp

# Check Perplexity API status
curl https://api.perplexity.ai/health
```

## References

- **MCP SDK:** https://github.com/modelcontextprotocol/typescript-sdk
- **Perplexity API:** https://docs.perplexity.ai/
- **Governance Integration:** `/docs/governance/`
- **Evidence Vault:** `/docs/integrations/evidence-vault.md`
