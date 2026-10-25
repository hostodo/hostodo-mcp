import assert from 'node:assert/strict';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

let responseBody;
let status = 200;
let sse = false;
const requests = [];
const upstream = http.createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  requests.push(JSON.parse(body));
  assert.equal(req.headers.authorization, 'Bearer test-token');
  res.writeHead(status, { 'Content-Type': sse ? 'text/event-stream' : 'application/json' });
  res.end(sse ? `event: message\ndata: ${JSON.stringify(responseBody)}\n\n` : JSON.stringify(responseBody));
});
await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['src/index.js'],
  env: { ...process.env, HOSTODO_MCP_TOKEN: 'test-token', HOSTODO_MCP_URL: `http://127.0.0.1:${upstream.address().port}/mcp` },
});
const client = new Client({ name: 'protection-test', version: '1' });
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === 'hostodo_set_vm_protection');
  assert.deepEqual(tool.inputSchema.required, ['vm_id', 'enabled']);
  assert.equal(tool.inputSchema.properties.enabled.type, 'boolean');
  assert.match(tool.description, /Never automatically unlock/);
  assert.match(tool.description, /vms:protection/);

  for (const enabled of [true, false]) {
    const args = { vm_id: 'ins::abc', enabled, ...(!enabled ? { confirmation: 'UNPROTECT ins::abc' } : {}) };
    const expected = { content: [{ type: 'text', text: 'updated' }], structuredContent: { instance: { protection_enabled: enabled } } };
    responseBody = { jsonrpc: '2.0', id: 1, result: expected };
    const result = await client.callTool({ name: tool.name, arguments: args });
    assert.deepEqual(result, expected);
    assert.deepEqual(requests.at(-1).params, { name: tool.name, arguments: args });
  }
  for (const [httpStatus, code] of [[423, 'protected'], [409, 'busy'], [403, 'forbidden_scope']]) {
    const detail = { code, detail: 'Denied', instance_id: 'ins::abc', operation: 'rename', protection_enabled: true };
    for (const rpc of [false, true]) {
      status = rpc ? 200 : httpStatus;
      sse = rpc;
      responseBody = rpc ? { jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'Denied', data: detail } } : detail;
      const count = requests.length;
      const result = await client.callTool({ name: 'hostodo_rename_vm', arguments: { vm_id: 'ins::abc', hostname: 'new', confirmation: 'RENAME ins::abc TO new' } });
      assert.equal(result.isError, true);
      assert.deepEqual(result.structuredContent, rpc ? responseBody.error : detail);
      assert.match(result.content[0].text, new RegExp(code));
      assert.equal(requests.length, count + 1, 'must not unlock, retry, or reauthorize');
    }
  }
  status = 200;
  sse = false;
  const expected = { isError: true, content: [{ type: 'text', text: 'protected' }], structuredContent: { code: 'protected' } };
  responseBody = { result: expected };
  assert.deepEqual(await client.callTool({ name: tool.name, arguments: { vm_id: 'ins::abc', enabled: true } }), expected);
  console.log('Protection tests passed: catalog, request forwarding, structured HTTP/JSON-RPC/SSE errors, no automatic unlock/retry.');
} finally {
  await client.close();
  await new Promise((resolve) => upstream.close(resolve));
}
