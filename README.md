# Hostodo MCP Server

Hostodo MCP lets AI assistants and MCP-compatible clients manage Hostodo VPS infrastructure through Hostodo's hosted Streamable HTTP MCP endpoint.

- **Hosted endpoint:** `https://api.hostodo.com/mcp`
- **Documentation:** <https://hostodo.com/docs/mcp>
- **Hostodo Console:** <https://console.hostodo.com/settings/developer-access>

## What it can do

Hostodo MCP exposes real VPS management tools for authenticated Hostodo customers:

- List owned VPS instances and capability flags
- Read detailed VM metadata
- List enabled OS templates for reinstall workflows
- Power control: start, shutdown, reboot, stop, and reset
- Rename a VPS with an explicit confirmation phrase
- Reinstall a VPS to an OS template with an explicit confirmation phrase
- Enable or disable MCP/QEMU guest-agent command execution per VM
- Run bounded synchronous commands inside a VM through the QEMU guest agent
- Start, poll, read logs from, and cancel asynchronous VM commands
- Upload artifacts and install files onto owned VMs

## Authentication

Create a Hostodo MCP developer token in the Hostodo Console, then send it as a bearer token:

```http
Authorization: Bearer <hostodo_agent_token>
```

Tokens are scoped. Grant only the scopes your client needs:

- `vms:read` — list VMs, view VM metadata, and list OS templates
- `vms:power` — power actions, rename, and reinstall workflows
- `vms:exec` — command execution and artifact install workflows

Command execution is disabled by default on each VM and must be explicitly enabled per VM before exec/artifact tools can run.

## Run this MCP server locally

This repository contains a small runnable MCP wrapper so registries such as Glama can start and introspect Hostodo MCP even though the production implementation lives in Hostodo's hosted API.

```bash
npm install
HOSTODO_MCP_TOKEN=<hostodo_agent_token> npm start
```

Docker:

```bash
docker build -t hostodo-mcp .
docker run --rm -i -e HOSTODO_MCP_TOKEN=<hostodo_agent_token> hostodo-mcp
```

`tools/list` works without a token for registry evaluation. Real tool calls require `HOSTODO_MCP_TOKEN` and are proxied to `https://api.hostodo.com/mcp`.

## MCP client configuration

Use the hosted Streamable HTTP endpoint directly:

```json
{
  "mcpServers": {
    "hostodo": {
      "url": "https://api.hostodo.com/mcp",
      "headers": {
        "Authorization": "Bearer <hostodo_agent_token>"
      }
    }
  }
}
```

## Safety model

Hostodo MCP verifies token scopes and VM ownership on every request. Destructive workflows such as reinstall and rename require explicit confirmation phrases. Command execution is per-VM opt-in and audited.

## Registry metadata

This repository exists to publish Hostodo's hosted MCP server metadata for MCP registries such as Glama and the official MCP Registry. The server implementation lives in Hostodo's private OdoPanel backend.
