import fs from 'fs';
import path from 'path';

export interface WorkerStatus {
  name: string;
  status: 'pending' | 'running' | 'waiting' | 'sleep' | 'done' | 'error';
  pid?: number;
  startedAt?: string;
  finishedAt?: string;
  lastActiveAt?: string;
  error?: string;
}

export interface AgentSession {
  sessionId: string;
  turns: number;
  totalCostUsd: number;
  lastActiveAt: string;
}

const LDMUX_DIR = '.ldmux';
const WORKERS_DIR = path.join(LDMUX_DIR, 'workers');

/**
 * Persistent agents (create/edit/ask/chat/reset + MCP) live in
 * <ldmux-install-root>/.ldmux/workers/ — a folder inside the ldmux project
 * itself. The location is resolved from this file's __dirname so it works
 * the same whether the code runs from dist/ (built) or src/ (ts-node).
 *
 * Why here instead of $HOME? Users explicitly want agents tied to the
 * ldmux install: they survive `npm run build` (which only touches dist/),
 * they're gitignored (.ldmux/ is in .gitignore), and they are only wiped
 * when the user deletes the folder by hand.
 *
 * Batch workers (new/run/list/merge/gui/clean) continue to use cwd.
 */
export function getAgentBaseDir(): string {
  const ldmuxRoot = path.resolve(__dirname, '..');
  const dir = path.join(ldmuxRoot, LDMUX_DIR, 'workers');
  fs.mkdirSync(dir, { recursive: true });
  return ldmuxRoot;
}

export function getLdmuxDir(baseDir: string): string {
  return path.join(baseDir, LDMUX_DIR);
}

export function getWorkersDir(baseDir: string): string {
  return path.join(baseDir, WORKERS_DIR);
}

export function getWorkerDir(baseDir: string, workerName: string): string {
  return path.join(baseDir, WORKERS_DIR, workerName);
}

export function ensureWorkerDir(baseDir: string, workerName: string): string {
  const dir = getWorkerDir(baseDir, workerName);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeTask(baseDir: string, workerName: string, prompt: string): void {
  const dir = ensureWorkerDir(baseDir, workerName);
  fs.writeFileSync(path.join(dir, 'task.md'), `# Task: ${workerName}\n\n${prompt}\n`);
}

export function readTask(baseDir: string, workerName: string): string | null {
  const taskPath = path.join(getWorkerDir(baseDir, workerName), 'task.md');
  if (!fs.existsSync(taskPath)) return null;
  const raw = fs.readFileSync(taskPath, 'utf-8');
  // Strip the "# Task: <name>\n\n" header; rest is the original prompt
  return raw.replace(/^#\s*Task:.*\n+/, '').trimEnd();
}

export function clearOutput(baseDir: string, workerName: string): void {
  const outputPath = path.join(getWorkerDir(baseDir, workerName), 'output.log');
  if (fs.existsSync(outputPath)) fs.writeFileSync(outputPath, '');
}

export function readSession(baseDir: string, workerName: string): AgentSession | null {
  const p = path.join(getWorkerDir(baseDir, workerName), 'session.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function writeSession(baseDir: string, workerName: string, session: AgentSession): void {
  const dir = ensureWorkerDir(baseDir, workerName);
  fs.writeFileSync(path.join(dir, 'session.json'), JSON.stringify(session, null, 2));
}

export function appendHistory(
  baseDir: string,
  workerName: string,
  entry: { role: 'user' | 'assistant'; content: string; timestamp: string; durationMs?: number; costUsd?: number }
): void {
  const dir = ensureWorkerDir(baseDir, workerName);
  fs.appendFileSync(path.join(dir, 'history.jsonl'), JSON.stringify(entry) + '\n');
}

export function readHistory(baseDir: string, workerName: string): any[] {
  const p = path.join(getWorkerDir(baseDir, workerName), 'history.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf-8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
}

export function writeStatus(baseDir: string, workerName: string, status: WorkerStatus): void {
  const dir = ensureWorkerDir(baseDir, workerName);
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify(status, null, 2));
}

export function readStatus(baseDir: string, workerName: string): WorkerStatus | null {
  const statusPath = path.join(getWorkerDir(baseDir, workerName), 'status.json');
  if (!fs.existsSync(statusPath)) return null;
  return JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
}

export function readOutput(baseDir: string, workerName: string): string {
  const outputPath = path.join(getWorkerDir(baseDir, workerName), 'output.log');
  if (!fs.existsSync(outputPath)) return '';
  return fs.readFileSync(outputPath, 'utf-8');
}

export function getOutputPath(baseDir: string, workerName: string): string {
  ensureWorkerDir(baseDir, workerName);
  return path.join(getWorkerDir(baseDir, workerName), 'output.log');
}

export function listWorkers(baseDir: string): WorkerStatus[] {
  const workersDir = getWorkersDir(baseDir);
  if (!fs.existsSync(workersDir)) return [];

  return fs.readdirSync(workersDir)
    .filter(name => {
      const statusPath = path.join(workersDir, name, 'status.json');
      return fs.existsSync(statusPath);
    })
    .map(name => readStatus(baseDir, name)!)
    .filter(Boolean);
}

export function cleanWorkers(baseDir: string): void {
  const workersDir = getWorkersDir(baseDir);
  if (fs.existsSync(workersDir)) {
    fs.rmSync(workersDir, { recursive: true, force: true });
  }
}

// --- Liveness ---

export interface WorkerLiveness {
  alive: boolean | null;
  lastOutputAt: string | null;
  outputBytes: number;
  idleMs: number | null;
  uptimeMs: number | null;
  isZombie: boolean;
  isStale: boolean;
}

const STALE_THRESHOLD_MS = 5 * 60 * 1000;
const ACTIVE_STATUSES = new Set(['pending', 'running', 'waiting', 'sleep']);

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    // ESRCH = no such process (dead). EPERM = exists but not ours (alive).
    return err.code === 'EPERM';
  }
}

export function getWorkerLiveness(baseDir: string, status: WorkerStatus): WorkerLiveness {
  const outputPath = path.join(getWorkerDir(baseDir, status.name), 'output.log');
  const now = Date.now();

  let lastOutputAt: string | null = null;
  let outputBytes = 0;
  let idleMs: number | null = null;
  if (fs.existsSync(outputPath)) {
    const st = fs.statSync(outputPath);
    lastOutputAt = st.mtime.toISOString();
    outputBytes = st.size;
    idleMs = now - st.mtimeMs;
  }

  const uptimeMs = status.startedAt ? now - new Date(status.startedAt).getTime() : null;

  let alive: boolean | null = null;
  if (status.pid) alive = isPidAlive(status.pid);

  const active = ACTIVE_STATUSES.has(status.status);
  const isZombie = active && alive === false;
  const isStale = active && alive !== false && idleMs !== null && idleMs > STALE_THRESHOLD_MS;

  return { alive, lastOutputAt, outputBytes, idleMs, uptimeMs, isZombie, isStale };
}

export function listWorkersLive(baseDir: string): (WorkerStatus & WorkerLiveness)[] {
  return listWorkers(baseDir).map(s => ({ ...s, ...getWorkerLiveness(baseDir, s) }));
}

export function readOutputTail(
  baseDir: string,
  workerName: string,
  since: number
): { chunk: string; size: number } {
  const outputPath = path.join(getWorkerDir(baseDir, workerName), 'output.log');
  if (!fs.existsSync(outputPath)) return { chunk: '', size: 0 };
  const size = fs.statSync(outputPath).size;
  // File was truncated (e.g., retry cleared it) — send whole thing.
  const start = since > size ? 0 : since;
  if (start >= size) return { chunk: '', size };
  const fd = fs.openSync(outputPath, 'r');
  try {
    const len = size - start;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    return { chunk: buf.toString('utf-8'), size };
  } finally {
    fs.closeSync(fd);
  }
}
