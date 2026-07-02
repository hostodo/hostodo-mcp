# Hostodo MCP Server

Hostodo MCP lets AI assistants and MCP-compatible clients manage Hostodo VPS infrastructure through Hostodo's hosted Streamable HTTP MCP endpoint.

- **Hosted endpoint:** `https://api.hostodo.com/mcp`
- **Documentation:** <https://hostodo.com/docs/mcp>
- **Create a token:** <https://console.hostodo.com/settings/developer-access?tab=tokens&client=claude-code>

## What it can do

Hostodo MCP exposes real VPS, account, support, and DNS management tools for authenticated Hostodo customers:

### VPS operations

- List owned VPS instances and capability flags
- Read detailed VM metadata
- List enabled OS templates for reinstall workflows
- Power control: start, shutdown, reboot, stop, and reset
- Rename a VPS with an explicit confirmation phrase
- Reinstall a VPS to an OS template with an explicit confirmation phrase
- View VM metrics, bandwidth usage, health checks, and incidents
- Manage snapshots where supported

### Agent execution and deployments

- Enable or disable MCP/QEMU guest-agent command execution per VM
- Run bounded synchronous commands inside a VM through the QEMU guest agent
- Start, poll, read logs from, and cancel asynchronous VM commands
- Upload artifacts and install files onto owned VMs with SHA-256 verification
- Inspect deployments, service logs, rollback deployments, and restart services where available

### Account and support workflows

- List invoices, inspect invoice details, and pay invoices
- List payment methods and account balance
- Apply account credit where supported
- List, create, reply to, and close support tickets
- Upload ticket attachments

### DNS and access management

- List DNS zones and manage DNS records
- List and set rDNS records
- List, add, and remove SSH keys

## Authentication

Create a Hostodo MCP developer token in the Hostodo Console, then send it as a bearer token:

```http
Authorization: Bearer <hostodo_agent_token>
```

Tokens are scoped. Grant only the scopes your client needs:

- `vms:read` — list VMs, view VM metadata, list OS templates, and read VM/account state
- `vms:power` — power actions, rename, reinstall, and other state-changing VM workflows
- `vms:exec` — command execution, async commands, service operations, and artifact install workflows

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
      "type": "http",
      "url": "https://api.hostodo.com/mcp",
      "headers": {
        "Authorization": "Bearer <hostodo_agent_token>"
      }
    }
  }
}
```

Claude Code example:

```bash
claude mcp add \
  --scope user \
  --transport http \
  --header "Authorization: Bearer <hostodo_agent_token>" \
  hostodo \
  https://api.hostodo.com/mcp
```

## Safety model

Hostodo MCP verifies token scopes and VM ownership on every request. Destructive workflows such as reinstall, rename, exec enable/disable, and power actions require explicit user intent and/or exact confirmation phrases. Command execution is per-VM opt-in.

MCP actions are audited. Audit logs are encrypted and privacy-protected: operational detail stays in Hostodo audit logs, while product analytics receive only safe metadata.

## Registry metadata

This repository exists to publish Hostodo's hosted MCP server metadata for MCP registries such as Glama and the official MCP Registry. The server implementation lives in Hostodo's private OdoPanel backend.

Tool metadata is stored in `src/tools.json`. To refresh it from the live hosted MCP endpoint:

```bash
HOSTODO_MCP_TOKEN=<hostodo_agent_token> npm run sync-tools
```
