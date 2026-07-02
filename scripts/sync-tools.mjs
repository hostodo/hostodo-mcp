#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';

const HOSTODO_MCP_URL = process.env.HOSTODO_MCP_URL || 'https://api.hostodo.com/mcp';
const HOSTODO_MCP_TOKEN = process.env.HOSTODO_MCP_TOKEN || process.env.HOSTODO_API_TOKEN || '';

if (!HOSTODO_MCP_TOKEN) {
  console.error('HOSTODO_MCP_TOKEN is required to sync live Hostodo MCP tool metadata.');
  process.exit(1);
}

async function rpc(id, method, params = {}) {
  const response = await fetch(HOSTODO_MCP_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${HOSTODO_MCP_TOKEN}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });

  const text = await response.text();
  const data = parseMcpHttpBody(text, response.headers.get('content-type') || '');

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${data?.error?.message || data?.message || text}`);
  }
  if (data?.error) {
    throw new Error(JSON.stringify(data.error));
  }
  return data?.result;
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

  return JSON.parse(trimmed);
}

await rpc(1, 'initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'hostodo-mcp-sync-tools', version: '1.0.0' },
});

const result = await rpc(2, 'tools/list');
const tools = result?.tools || [];
if (!tools.length) {
  throw new Error('Live Hostodo MCP returned no tools. Refusing to overwrite src/tools.json.');
}

await writeFile(new URL('../src/tools.json', import.meta.url), `${JSON.stringify(tools, null, 2)}\n`);
console.log(`Synced ${tools.length} Hostodo MCP tools from ${HOSTODO_MCP_URL}`);
