# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Backend entry point is `src/index.ts`, invoked via `ts-node` (no prior build needed):

- `npm start -- <command> [options]` or `npx ts-node src/index.ts <command> [options]`
- `npm run dev` — shortcut for `ts-node src/index.ts gui` (starts the Express dashboard on port 3700)
- `npm run build` — `tsc` to `./dist` and copies `src/gui/public/` (built FE) into dist.

Frontend lives in its own sibling repo (<https://github.com/GiaTrong2003/ldmux-fe>). Check it out as `../web` relative to this BE repo — expected layout:

```
ldmux/
  be/   ← this repo
  web/  ← ldmux-fe
```

The FE build writes into this repo's `src/gui/public/`, which Express serves directly. BE scripts cd into `../web` to drive it:

- `npm run web:install` — install FE deps in `../web` (run once after clone)
- `npm run web:dev` — start Vite dev server on port 5173 with `/api/*` proxied to the Express backend on :3700. In dev, run `npm run dev` and `npm run web:dev` in separate terminals.
- `npm run web:build` — Vite builds into `src/gui/public/` (wipes the dir first). Express serves that directly.
- `npm run build:all` — FE build + backend build for release.
- `npm run build:bundle` — FE build + single-file bundle of the backend into `release/` (via `@vercel/ncc`), zero runtime deps.

CLI commands (see `src/index.ts`):

- `new "<prompt>" [--name <name>]` — spawn a single background worker
- `run <plan.json> [--no-pane]` — execute a multi-worker plan
- `list` — print worker statuses from `.ldmux/workers/*/status.json`
- `merge` — concatenate every worker's `output.log` into `.ldmux/merged-output.md`
- `gui` — Express dashboard at http://localhost:3700
- `clean` — remove `.ldmux/workers/`
- `create` / `edit` / `ask` / `chat` / `agents` / `reset` — persistent agent commands
- `mcp` — stdio MCP server (spawned by parent Claude Code)
- `company init [--no-qa|--no-be|--no-fe] [--with-engineers]` — seed CEO + manager agents

There are no automated tests or linters configured.

## Architecture

ldmux is a TypeScript CLI that spawns parallel AI-agent child processes (default `claude -p "<prompt>"`) and tracks them via a filesystem-based status protocol. Two coordination surfaces — the CLI and the web GUI — both read/write the same `.ldmux/` directory, so they stay consistent without a running daemon.

**File-based IPC (`src/file-comm.ts`).** All state lives under `.ldmux/workers/<name>/`: `task.md` (prompt), `status.json` (`pending | running | done | error`, plus pid/timestamps/error), and `output.log` (stdout+stderr). Every other module operates through these helpers rather than touching paths directly. `listWorkers` scans the directory; there is no in-memory registry that survives across processes.

**Worker lifecycle (`src/worker.ts`).** `spawnWorker` writes task/status files, spawns the agent with `shell: true` and `FORCE_COLOR=0`, pipes both stdout and stderr into `output.log`, then rewrites `status.json` on exit. An in-memory `activeProcesses` map is only meaningful for the process that did the spawning (used by the GUI's stop endpoint) — the CLI `list` command relies purely on the filesystem.

**Orchestrator (`src/orchestrator.ts`).** `loadPlan` validates plan JSON (`name`, `workers[]` with `name` + `prompt`). `executePlan` optionally creates a `git worktree add -b ldmux/<plan>/<worker>` per worker (sibling directory `../ldmux-<plan>-<worker>`), then either (a) opens Windows Terminal panes AND spawns background workers — the panes and background processes run the agent twice — or (b) spawns background only. This double-spawn is intentional: panes give a live view, background workers feed `output.log` for `list`/`merge`/GUI.

**Pane manager (`src/pane-manager.ts`).** Calls `wt -w 0 sp` to split the current Windows Terminal window, running the agent piped through `Tee-Object` so output lands in the pane and in the log file. On non-Windows (`process.platform !== 'win32'`) it falls back to a no-op log, so `run` still works for testing but won't actually show panes.

**GUI backend (`src/gui/server.ts`).** Minimal Express app on port 3700 that serves static assets from `src/gui/public/` (Vite build output) plus REST endpoints for workers, agents, and the company hierarchy. Endpoints cover: workers CRUD + tail + retry, agents CRUD + ask + reset, `/api/company` (agents with effective autonomy + conversations), `/api/conversations?since=` (incremental tail), `/api/company/autonomy` (global override), `/api/merge`, `/api/clean`.

**GUI frontend (`web/`).** Standalone Vite + React 18 + TypeScript project. Uses `@xyflow/react` (React Flow v12) for the Company org-chart. Folder layout: `src/api/` typed fetch wrappers, `src/components/{workers,live,agents,company,common}/` one component tree per tab, `src/hooks/usePolling|useTail` for polling primitives, `src/types/api.ts` mirrors backend interfaces (`AgentConfig`/`WorkerStatus`/`ConversationEntry` etc. are duplicated intentionally — JSON is the contract). Design tokens in `src/styles/tokens.css`; Inter + JetBrains Mono fonts; GitHub-dark palette.

**Merge (`src/merge.ts`).** Pure aggregator — reads every worker's status + `output.log` and writes a single Markdown report to `.ldmux/merged-output.md`. Does not modify worker state.

## Conventions specific to this project

- The working directory passed around as `baseDir` is always `process.cwd()` from `index.ts`. Commands must be run from the project/user's chosen base directory because `.ldmux/` is created relative to it.
- Worker `name` is the primary key everywhere — directory name, status key, GUI route param. Names must be filesystem-safe.
- Two agents are recognized by name: `claude` (default) and `codex`; anything else is invoked as `<agent> "<prompt>"`. Adding a new agent means updating both `buildAgentCommand` in `worker.ts` AND `buildPaneCommand` in `orchestrator.ts`.
- Prompt escaping differs between contexts: `worker.ts` escapes `"` for a shell-spawn; `orchestrator.ts` escapes `'` and `"` for a PowerShell `Tee-Object` pipeline. Keep these in sync when changing prompt handling.
