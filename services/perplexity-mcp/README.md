# Perplexity MCP Server

This is a Model Context Protocol (MCP) server that integrates Perplexity AI's web search and research capabilities into Claude and other MCP-compatible clients.

## Features

- **Web Search** (`search_web`) — Real-time web search with recency filtering
- **Academic Search** (`search_academic`) — Focused search on peer-reviewed research and academic sources
- **Research Summarization** (`summarize_research`) — AI-powered summaries at different depth levels (basic, comprehensive, detailed)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Key

Create a `.env` file with your Perplexity API key:

```bash
cp .env.example .env
# Edit .env and add your PERPLEXITY_API_KEY
```

Get your API key from [Perplexity AI](https://www.perplexity.ai/).

### 3. Test Locally

```bash
npm run dev
```

## Integration with RealSyncDynamicsAI

The server is registered in `.mcp.json`:

```json
{
  "perplexity-mcp": {
    "command": "node",
    "args": ["services/perplexity-mcp/src/index.js"],
    "env": { "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}" }
  }
}
```

### Available Tools

#### 1. `search_web`

Perform a real-time web search with optional recency filtering.

**Parameters:**
- `query` (string, required) — The search query
- `search_recency_filter` (string, optional) — Filter by: `month`, `week`, `day`, `hour`

**Returns:**
- `content` — The search result summary
- `citations` — Array of sources with URLs
- `model` — Model used (sonar-pro)
- `tokens_used` — Token usage info

**Example:**
```javascript
{
  "query": "latest developments in quantum computing 2025",
  "search_recency_filter": "month"
}
```

#### 2. `search_academic`

Search academic and peer-reviewed sources.

**Parameters:**
- `query` (string, required) — Academic research query

**Returns:**
- `research_findings` — Detailed research summary
- `sources` — Array of academic sources with citations
- `note` — Information about the search scope

**Example:**
```javascript
{
  "query": "climate change mitigation strategies"
}
```

#### 3. `summarize_research`

Get an AI-powered summary of research on a topic with configurable depth.

**Parameters:**
- `topic` (string, required) — The research topic
- `depth` (string, optional) — Summary depth: `basic`, `comprehensive` (default), `detailed`

**Returns:**
- `summary` — The research summary
- `depth_level` — The depth used
- `citations` — Source citations
- `timestamp` — When the summary was generated

**Example:**
```javascript
{
  "topic": "machine learning in healthcare",
  "depth": "comprehensive"
}
```

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `PERPLEXITY_API_KEY` | Your Perplexity API key | Yes |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | No (default: info) |

## Deployment

### Docker

```bash
docker build -t perplexity-mcp .
docker run -e PERPLEXITY_API_KEY=your-key perplexity-mcp
```

### Cloudflare Workers (Future)

See `DEPLOY_CLOUDFLARE.md` for deployment instructions.

## Architecture

```
┌─────────────────────┐
│  Claude/MCP Client  │
└──────────┬──────────┘
           │
           │ MCP Protocol (stdio)
           │
┌──────────▼──────────┐
│ Perplexity MCP      │
│   Server (Node)     │
└──────────┬──────────┘
           │
           │ HTTPS API
           │
┌──────────▼──────────┐
│  Perplexity API     │
│  (sonar-pro model)  │
└─────────────────────┘
```

## API Model

Uses Perplexity's `sonar-pro` model with:
- Temperature: 0.2-0.3 (deterministic results)
- Max tokens: 1000-4000 (based on depth/query type)
- Built-in web search capabilities

## Error Handling

All errors are returned as MCP errors with appropriate error codes:
- `InternalError` — API call failed or service error
- `MethodNotFound` — Unknown tool requested
- `InvalidRequest` — Invalid parameters

Errors are logged to the console with context for debugging.

## Development

### Local Testing

```bash
# Terminal 1: Start the MCP server
npm run dev

# Terminal 2: Test with Claude CLI or other MCP client
# The server listens on stdio
```

### Logging

Set `LOG_LEVEL=debug` to see detailed request/response logs.

## Security

- API keys are only loaded from environment variables
- No secrets are logged
- All requests to Perplexity API use HTTPS
- Follows ISO-27001-oriented security principles (per CLAUDE.md)

## Future Enhancements

- [ ] Caching of search results
- [ ] Rate limiting and quota management
- [ ] Support for multiple Perplexity models
- [ ] Citation formatting customization
- [ ] Integration with evidence vault for audit trail

## References

- [Perplexity API Documentation](https://docs.perplexity.ai/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [MCP SDK for Node.js](https://github.com/modelcontextprotocol/typescript-sdk)
