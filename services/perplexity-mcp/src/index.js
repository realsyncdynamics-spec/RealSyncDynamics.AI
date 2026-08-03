#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  TextContent,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import pino from 'pino';
import axios from 'axios';
import 'dotenv/config.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_BASE = 'https://api.perplexity.ai';

if (!PERPLEXITY_API_KEY) {
  logger.error('PERPLEXITY_API_KEY environment variable is required');
  process.exit(1);
}

const client = axios.create({
  baseURL: PERPLEXITY_API_BASE,
  headers: {
    'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

// MCP Server setup
const server = new Server({
  name: 'perplexity-mcp',
  version: '1.0.0',
});

// Tool definitions
const TOOLS = [
  {
    name: 'search_web',
    description: 'Search the web using Perplexity AI for real-time information with sources',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        search_recency_filter: {
          type: 'string',
          enum: ['month', 'week', 'day', 'hour'],
          description: 'Filter results by recency (optional)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_academic',
    description: 'Search academic papers and research articles via Perplexity',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Academic search query',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'summarize_research',
    description: 'Get an AI-powered summary of research findings on a topic',
    inputSchema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The research topic to summarize',
        },
        depth: {
          type: 'string',
          enum: ['basic', 'comprehensive', 'detailed'],
          description: 'Level of detail for the summary (default: comprehensive)',
        },
      },
      required: ['topic'],
    },
  },
];

// Tool handlers
async function searchWeb(query, searchRecencyFilter = null) {
  try {
    logger.info({ query, searchRecencyFilter }, 'Calling Perplexity web search');

    const payload = {
      model: 'sonar-pro',
      messages: [
        {
          role: 'user',
          content: query,
        },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    };

    if (searchRecencyFilter) {
      payload.search_recency_filter = searchRecencyFilter;
    }

    const response = await client.post('/chat/completions', payload);

    const { content } = response.data.choices[0].message;
    const citations = response.data.citations || [];

    return {
      content,
      citations,
      model: response.data.model,
      tokens_used: {
        input: response.data.usage?.prompt_tokens,
        output: response.data.usage?.completion_tokens,
      },
    };
  } catch (error) {
    logger.error({ error: error.message, query }, 'Web search failed');
    throw new McpError(
      ErrorCode.InternalError,
      `Web search failed: ${error.message}`
    );
  }
}

async function searchAcademic(query) {
  try {
    logger.info({ query }, 'Calling Perplexity academic search');

    const systemPrompt = `You are an academic research assistant. Search for and summarize peer-reviewed research papers and academic articles related to the user's query. Include citations and credibility information for all sources.`;

    const payload = {
      model: 'sonar-pro',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Find academic research on: ${query}. Include paper titles, authors, publication years, and citations.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 2500,
      search_recency_filter: 'month',
    };

    const response = await client.post('/chat/completions', payload);

    const { content } = response.data.choices[0].message;
    const citations = response.data.citations || [];

    return {
      research_findings: content,
      sources: citations,
      note: 'Academic search results are focused on peer-reviewed and scholarly sources',
    };
  } catch (error) {
    logger.error({ error: error.message, query }, 'Academic search failed');
    throw new McpError(
      ErrorCode.InternalError,
      `Academic search failed: ${error.message}`
    );
  }
}

async function summarizeResearch(topic, depth = 'comprehensive') {
  try {
    logger.info({ topic, depth }, 'Calling Perplexity research summarization');

    const depthPrompts = {
      basic: 'Provide a brief 2-3 paragraph summary',
      comprehensive: 'Provide a detailed 5-7 paragraph summary covering key aspects',
      detailed: 'Provide an extensive summary covering all major aspects, key findings, debates, and future directions',
    };

    const payload = {
      model: 'sonar-pro',
      messages: [
        {
          role: 'user',
          content: `${depthPrompts[depth]} of current research and developments regarding: ${topic}. Include recent findings, expert perspectives, and key citations.`,
        },
      ],
      temperature: 0.3,
      max_tokens: depth === 'basic' ? 1000 : depth === 'comprehensive' ? 2500 : 4000,
    };

    const response = await client.post('/chat/completions', payload);

    const { content } = response.data.choices[0].message;
    const citations = response.data.citations || [];

    return {
      summary: content,
      depth_level: depth,
      citations,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    logger.error({ error: error.message, topic }, 'Research summarization failed');
    throw new McpError(
      ErrorCode.InternalError,
      `Research summarization failed: ${error.message}`
    );
  }
}

// MCP Protocol: list_tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.debug('Listing tools');
  return { tools: TOOLS };
});

// MCP Protocol: call_tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.info({ tool: name, args }, 'Tool called');

  try {
    let result;

    switch (name) {
      case 'search_web':
        result = await searchWeb(args.query, args.search_recency_filter);
        break;
      case 'search_academic':
        result = await searchAcademic(args.query);
        break;
      case 'summarize_research':
        result = await summarizeResearch(args.topic, args.depth || 'comprehensive');
        break;
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error({ error: error.message, tool: name }, 'Tool execution failed');
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Tool execution failed: ${error.message}`
    );
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Perplexity MCP Server started and connected');
}

main().catch((error) => {
  logger.error({ error }, 'Server startup failed');
  process.exit(1);
});
