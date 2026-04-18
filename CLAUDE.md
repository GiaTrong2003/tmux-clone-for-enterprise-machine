# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Entry point is `src/index.ts`, invoked via `ts-node` (no prior build needed):

- `npm start -- <command> [options]` or `npx ts-node src/index.ts <command> [options]`
- `npm run dev` — shortcut for `ts-node src/index.ts gui` (starts the web dashboard on port 3700)
- `npm run build` — `tsc` to `./dist` (per `tsconfig.json`)

CLI commands (see `src/index.ts`):

- `new "<prompt>" [--name <name>]` — spawn a single background worker
- `run <plan.json> [--no-pane]` — execute a multi-worker plan; `--no-pane` skips opening Windows Terminal panes
- `list` — print worker statuses from `.ldmux/workers/*/status.json`
- `merge` — concatenate every worker's `output.log` into `.ldmux/merged-output.md`
- `gui` — Express dashboard at http://localhost:3700
- `clean` — remove `.ldmux/workers/`

There are no automated tests or linters configured.

## Architecture

ldmux is a TypeScript CLI that spawns parallel AI-agent child processes (default `claude -p "<prompt>"`) and tracks them via a filesystem-based status protocol. Two coordination surfaces — the CLI and the web GUI — both read/write the same `.ldmux/` directory, so they stay consistent without a running daemon.

**File-based IPC (`src/file-comm.ts`).** All state lives under `.ldmux/workers/<name>/`: `task.md` (prompt), `status.json` (`pending | running | done | error`, plus pid/timestamps/error), and `output.log` (stdout+stderr). Every other module operates through these helpers rather than touching paths directly. `listWorkers` scans the directory; there is no in-memory registry that survives across processes.

**Worker lifecycle (`src/worker.ts`).** `spawnWorker` writes task/status files, spawns the agent with `shell: true` and `FORCE_COLOR=0`, pipes both stdout and stderr into `output.log`, then rewrites `status.json` on exit. An in-memory `activeProcesses` map is only meaningful for the process that did the spawning (used by the GUI's stop endpoint) — the CLI `list` command relies purely on the filesystem.

**Orchestrator (`src/orchestrator.ts`).** `loadPlan` validates plan JSON (`name`, `workers[]` with `name` + `prompt`). `executePlan` optionally creates a `git worktree add -b ldmux/<plan>/<worker>` per worker (sibling directory `../ldmux-<plan>-<worker>`), then either (a) opens Windows Terminal panes AND spawns background workers — the panes and background processes run the agent twice — or (b) spawns background only. This double-spawn is intentional: panes give a live view, background workers feed `output.log` for `list`/`merge`/GUI.

**Pane manager (`src/pane-manager.ts`).** Calls `wt -w 0 sp` to split the current Windows Terminal window, running the agent piped through `Tee-Object` so output lands in the pane and in the log file. On non-Windows (`process.platform !== 'win32'`) it falls back to a no-op log, so `run` still works for testing but won't actually show panes.

**GUI (`src/gui/server.ts`).** Minimal Express app serving `src/gui/public/` and REST endpoints over the same file-comm helpers: `GET /api/workers`, `GET /api/workers/:name/output|status`, `POST /api/workers` (spawn), `POST /api/workers/:name/stop`, `POST /api/merge`, `POST /api/clean`. Port 3700 is hardcoded.

**Merge (`src/merge.ts`).** Pure aggregator — reads every worker's status + `output.log` and writes a single Markdown report to `.ldmux/merged-output.md`. Does not modify worker state.

## Conventions specific to this project

- The working directory passed around as `baseDir` is always `process.cwd()` from `index.ts`. Commands must be run from the project/user's chosen base directory because `.ldmux/` is created relative to it.
- Worker `name` is the primary key everywhere — directory name, status key, GUI route param. Names must be filesystem-safe.
- Two agents are recognized by name: `claude` (default) and `codex`; anything else is invoked as `<agent> "<prompt>"`. Adding a new agent means updating both `buildAgentCommand` in `worker.ts` AND `buildPaneCommand` in `orchestrator.ts`.
- Prompt escaping differs between contexts: `worker.ts` escapes `"` for a shell-spawn; `orchestrator.ts` escapes `'` and `"` for a PowerShell `Tee-Object` pipeline. Keep these in sync when changing prompt handling.
