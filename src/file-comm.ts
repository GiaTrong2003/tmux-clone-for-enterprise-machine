import fs from 'fs';
import path from 'path';

export interface WorkerStatus {
  name: string;
  status: 'pending' | 'running' | 'done' | 'error';
  pid?: number;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

const LDMUX_DIR = '.ldmux';
const WORKERS_DIR = path.join(LDMUX_DIR, 'workers');

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
