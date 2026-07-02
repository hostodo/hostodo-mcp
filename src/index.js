#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import tools from './tools.json' with { type: 'json' };

const HOSTODO_MCP_URL = process.env.HOSTODO_MCP_URL || 'https://api.hostodo.com/mcp';
const HOSTODO_MCP_TOKEN = process.env.HOSTODO_MCP_TOKEN || process.env.HOSTODO_API_TOKEN || '';

const server = new Server(
  {
    name: 'hostodo-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  if (!tools.some((tool) => tool.name === name)) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Unknown Hostodo MCP tool: ${name}`,
        },
      ],
    };
  }

  if (!HOSTODO_MCP_TOKEN) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text:
            'HOSTODO_MCP_TOKEN is required to call Hostodo tools. Create an MCP developer token in Hostodo Console under Settings → MCP, then run this server with HOSTODO_MCP_TOKEN set. Tool introspection does not require a token.',
        },
      ],
    };
  }

  return proxyToolCall(name, args);
});

async function proxyToolCall(name, args) {
  const payload = {
    jsonrpc: '2.0',
    id: crypto.randomUUID(),
    method: 'tools/call',
    params: {
      name,
      arguments: args,
    },
  };

  let response;
  try {
    response = await fetch(HOSTODO_MCP_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${HOSTODO_MCP_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Failed to reach Hostodo MCP endpoint ${HOSTODO_MCP_URL}: ${error.message}`,
        },
      ],
    };
  }

  const bodyText = await response.text();
  const data = parseMcpHttpBody(bodyText, response.headers.get('content-type') || '');

  if (!response.ok) {
    const message = data?.error?.message || data?.message || bodyText || `HTTP ${response.status}`;
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Hostodo MCP returned HTTP ${response.status}: ${message}`,
        },
      ],
    };
  }

  if (data?.error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(data.error, null, 2),
        },
      ],
    };
  }

  if (data?.result) {
    return data.result;
  }

  return {
    content: [
      {
        type: 'text',
        text: bodyText || 'Hostodo MCP returned an empty response.',
      },
    ],
  };
}

function parseMcpHttpBody(bodyText, contentType) {
  const trimmed = bodyText.trim();
  if (!trimmed) return null;

  if (contentType.includes('text/event-stream') || trimmed.startsWith('event:') || trimmed.startsWith('data:')) {
    const dataLines = trimmed
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    for (const line of dataLines.reverse()) {
      try {
        return JSON.parse(line);
      } catch {
        // Continue looking for a JSON event payload.
      }
    }
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
