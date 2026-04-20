import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import path from 'path';
import fs from 'fs';
import {
  WorkerStatus,
  AgentSession,
  writeStatus,
  readStatus,
  readSession,
  writeSession,
  appendHistory,
  appendConversation,
  getOutputPath,
} from './file-comm';
import { AgentConfig, readAgentConfig, buildSystemPrompt } from './agent-config';

export interface AskResult {
  sessionId: string;
  answer: string;
  durationMs: number;
  costUsd: number;
  isError: boolean;
}

export interface AskOptions {
  from?: string;  // caller agent name (for inter-agent ask) or "user"
}

export function resetAgent(baseDir: string, name: string): void {
  const cfg = readAgentConfig(baseDir, name);
  if (!cfg) throw new Error(`Agent "${name}" not found.`);

  const dir = path.join(baseDir, '.ldmux', 'workers', name);
  for (const f of ['session.json', 'history.jsonl', 'output.log']) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  // Reset status back to sleep but keep the original createdAt
  writeStatus(baseDir, name, {
    name,
    status: 'sleep',
    startedAt: cfg.createdAt,
  });
}

export async function askAgent(
  baseDir: string,
  name: string,
  question: string,
  opts: AskOptions = {}
): Promise<AskResult> {
  const cfg = readAgentConfig(baseDir, name);
  if (!cfg) throw new Error(`Agent "${name}" not found. Create it first with: ldmux create`);

  const from = opts.from || 'user';
  const startedAt = Date.now();
  const existing = readSession(baseDir, name);
  const sessionId = existing?.sessionId ?? randomUUID();
  const isFirst = !existing;

  // Build claude args
  const args = ['-p', question, '--output-format', 'json'];

  if (isFirst) {
    args.push('--session-id', sessionId);
    const sys = buildSystemPrompt(cfg, baseDir);
    if (sys) {
      args.push('--system-prompt', sys);
    }
  } else {
    args.push('--resume', sessionId);
  }

  if (cfg.model) args.push('--model', cfg.model);

  // Mark state: running
  markStatus(baseDir, name, 'running');
  appendHistory(baseDir, name, {
    role: 'user',
    content: question,
    timestamp: new Date().toISOString(),
    from,
  });

  const workDir = cfg.cwd ? path.resolve(cfg.cwd) : baseDir;
  const cmd = cfg.agent || 'claude';

  const stdout = await runProcess(cmd, args, workDir, { LDMUX_AGENT_NAME: name, LDMUX_BASE_DIR: baseDir });

  // Append raw output to log
  const logPath = getOutputPath(baseDir, name);
  fs.appendFileSync(
    logPath,
    `\n---\n[${new Date().toISOString()}] Q: ${question}\n${stdout}\n`
  );

  // Parse JSON result
  let parsed: any;
  try {
    parsed = JSON.parse(stdout.trim().split('\n').filter(Boolean).pop() || '{}');
  } catch (err: any) {
    markStatus(baseDir, name, 'error', `Failed to parse claude JSON output: ${err.message}`);
    throw new Error(`claude did not return valid JSON. Check output log: ${logPath}`);
  }

  if (parsed.is_error || parsed.type !== 'result') {
    const msg = parsed.result || parsed.error || 'Unknown error from claude';
    markStatus(baseDir, name, 'error', msg);
    throw new Error(msg);
  }

  const answer: string = parsed.result ?? '';
  const returnedSessionId: string = parsed.session_id ?? sessionId;
  const durationMs: number = parsed.duration_ms ?? 0;
  const costUsd: number = parsed.total_cost_usd ?? 0;

  // Persist session
  const newSession: AgentSession = {
    sessionId: returnedSessionId,
    turns: (existing?.turns ?? 0) + 1,
    totalCostUsd: (existing?.totalCostUsd ?? 0) + costUsd,
    lastActiveAt: new Date().toISOString(),
  };
  writeSession(baseDir, name, newSession);

  // Record assistant turn
  appendHistory(baseDir, name, {
    role: 'assistant',
    content: answer,
    timestamp: new Date().toISOString(),
    durationMs,
    costUsd,
  });

  // Log cross-agent conversation (flat log across the whole company)
  appendConversation(baseDir, {
    from,
    to: name,
    question,
    answer,
    timestamp: new Date().toISOString(),
    durationMs: durationMs || (Date.now() - startedAt),
    costUsd,
  });

  markStatus(baseDir, name, 'waiting');

  return {
    sessionId: returnedSessionId,
    answer,
    durationMs,
    costUsd,
    isError: false,
  };
}

function markStatus(baseDir: string, name: string, status: WorkerStatus['status'], error?: string): void {
  const prev = readStatus(baseDir, name);
  const now = new Date().toISOString();
  const next: WorkerStatus = {
    name,
    status,
    startedAt: prev?.startedAt ?? now,
    lastActiveAt: now,
    error,
  };
  if (status === 'waiting' || status === 'done' || status === 'error') {
    next.finishedAt = now;
  }
  writeStatus(baseDir, name, next);
}

function runProcess(
  cmd: string,
  args: string[],
  cwd: string,
  extraEnv: Record<string, string> = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0', ...extraEnv },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b: Buffer) => { stdout += b.toString(); });
    child.stderr.on('data', (b: Buffer) => { stderr += b.toString(); });

    child.on('error', (err) => reject(err));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${cmd} exited with code ${code}. stderr: ${stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
}
