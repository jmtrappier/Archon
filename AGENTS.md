# AGENTS.md — Delegation for Codex

**Single source of truth:** [`codex.md`](./codex.md).  
This file exists only to help Codex/BMAD discover the project rules, then **hand off** to Archon MCP.

## Activation Rules (Codex/BMAD)
- Load `codex.md` immediately and **apply it verbatim**.
- **ARCHON-FIRST:** All planning/state (stories, tasks, docs lifecycle) must go through **MCP Archon**.
- Do **not** create/maintain local planning files (stories, tasks) outside Archon.
- Use **MCP Serena** for codebase/memory queries; **MCP Playwright** for visual checks.
- **Docker-only runtime:** never run services bound to host directly; do not rely on `localhost`/`127.0.0.1`.

See `codex.md` for endpoints, env vars, workflows, and tool call examples.
