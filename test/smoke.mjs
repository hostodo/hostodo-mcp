import { spawn } from 'node:child_process';
import { once } from 'node:events';

const child = spawn(process.execPath, ['src/index.js'], {
  cwd: new URL('..', import.meta.url),
  stdio: ['pipe', 'pipe', 'pipe'],
});

let buffer = '';
const responses = new Map();

child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  for (;;) {
    const index = buffer.indexOf('\n');
    if (index === -1) break;
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    if (message.id !== undefined) responses.set(message.id, message);
  }
});

child.stderr.setEncoding('utf8');
child.stderr.on('data', (chunk) => process.stderr.write(chunk));

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

async function waitFor(id, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (responses.has(id)) return responses.get(id);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for response ${id}`);
}

send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'hostodo-mcp-smoke-test', version: '1.0.0' },
  },
});

const init = await waitFor(1);
if (init.error) throw new Error(`initialize failed: ${JSON.stringify(init.error)}`);

send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
const list = await waitFor(2);
if (list.error) throw new Error(`tools/list failed: ${JSON.stringify(list.error)}`);

const tools = list.result?.tools || [];
if (tools.length !== 14) throw new Error(`Expected 14 tools, got ${tools.length}`);
for (const name of ['hostodo_list_vms', 'hostodo_list_templates', 'hostodo_start_vm_command', 'hostodo_install_artifact']) {
  if (!tools.some((tool) => tool.name === name)) throw new Error(`Missing tool ${name}`);
}

send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'hostodo_list_vms', arguments: {} } });
const call = await waitFor(3);
if (!call.result?.isError) throw new Error('tools/call without HOSTODO_MCP_TOKEN should return an MCP error result');
if (!call.result.content?.[0]?.text?.includes('HOSTODO_MCP_TOKEN is required')) {
  throw new Error(`Unexpected missing-token response: ${JSON.stringify(call.result)}`);
}

child.kill('SIGTERM');
await once(child, 'exit');
console.log('Smoke test passed: initialize, tools/list, and missing-token tools/call behavior work.');
