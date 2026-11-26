# Hostodo MCP Server

Hostodo MCP lets AI assistants and MCP-compatible clients manage Hostodo VPS infrastructure through Hostodo's hosted Streamable HTTP MCP endpoint.

- **Hosted endpoint:** `https://api.hostodo.com/mcp`
- **Documentation:** <https://hostodo.com/docs/mcp>
- **Create a token:** <https://console.hostodo.com/settings/developer-access?tab=tokens&client=claude-code>

## What it can do

Hostodo MCP exposes real VPS, account, and support tools for authenticated Hostodo customers. The hosted catalog also lists some tools that are marked "coming soon"; those are called out separately below and do not perform any action yet.

### Available now

**Identity and VPS inspection**

- Identify the authenticated account, session, and granted scopes (`hostodo_whoami`)
- List owned VPS instances and capability flags (`hostodo_list_vms`) and read detailed VM metadata (`hostodo_get_vm`)
- List enabled OS templates for reinstall workflows (`hostodo_list_templates`)

**VPS operations**

- Power control: start, shutdown, reboot, stop, and reset (`hostodo_power_vm`)
- Rename a VPS (`hostodo_rename_vm`) or reinstall it to an OS template (`hostodo_reinstall_vm`), each with an explicit confirmation phrase

**Agent execution, logs, and files** (per-VM opt-in, `vms:exec`)

- Enable or disable MCP/QEMU guest-agent command execution per VM (`hostodo_set_vm_exec_enabled`)
- Run bounded synchronous root commands (`hostodo_exec_vm_command`)
- Start, poll, read logs from, and cancel asynchronous commands (`hostodo_start_vm_command`, `hostodo_get_vm_command_output`, `hostodo_read_vm_command_logs`, `hostodo_cancel_vm_command`)
- Read recent systemd service or `/var/log` file logs (`hostodo_get_service_logs`)
- Upload artifacts and install files with SHA-256 verification (`hostodo_create_artifact_upload`, `hostodo_install_artifact`)

**Deployments and Capacity**

- List deployment options, quote, create, and track billable VPS deployment orders (`hostodo_list_deployment_options`, `hostodo_quote_deployment`, `hostodo_create_deployment`, `hostodo_get_deployment`), where enabled for your account
- List Capacity tiers and pools, purchase or upgrade Capacity, and create quota-checked VMs inside a pool (`hostodo_list_pool_options`, `hostodo_list_resource_pools`, `hostodo_get_resource_pool`, `hostodo_create_resource_pool`, `hostodo_upgrade_resource_pool`, `hostodo_create_pool_vm`)

**Support**

- List, read, create, reply to, and close support tickets (`hostodo_list_tickets`, `hostodo_get_ticket`, `hostodo_create_ticket`, `hostodo_reply_ticket`, `hostodo_close_ticket`)

### Coming soon (listed in the catalog, not functional yet)

These tools return a structured `coming_soon` response and do not perform the requested action. They record demand so Hostodo can prioritize them.

- Monitoring: VM metrics, bandwidth usage, health checks, incidents
- Snapshots: create, list, restore
- DNS: zones and records, reverse DNS
- Access: list, add, and remove SSH keys
- Billing: invoices, pay invoice, account balance, apply credit, payment methods
- Deploy: restart service, rollback deployment
- Helpdesk: ticket attachments

See the [tool reference](https://hostodo.com/docs/mcp#all-tools) for scopes and descriptions.

## Authentication

Create a Hostodo MCP developer token in the Hostodo Console, then send it as a bearer token:

```http
Authorization: Bearer <hostodo_agent_token>
```

Tokens are scoped. Grant only the scopes your client needs:

- `vms:read` — list VMs, view VM metadata, list OS templates, and read VM/account state
- `vms:power` — power actions, rename, and reinstall
- `vms:exec` — command execution, async commands, service logs, and artifact install workflows
- `deployments:read` / `deployments:write` — deployment and Capacity options, quotes, orders, and pool VMs (where enabled for your account)
- `helpdesk:read` / `helpdesk:write` — read, create, reply to, and close support tickets
- `account:read` — account-level metadata such as email and name in `hostodo_whoami`

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
