import fs from 'fs';
import path from 'path';
import { ensureWorkerDir, getWorkerDir, getWorkersDir } from './file-comm';

export interface AgentConfig {
  name: string;
  soul?: string;
  skill?: string;
  cwd?: string;
  model?: string;
  agent?: string;
  createdAt: string;
}

export function writeAgentConfig(baseDir: string, cfg: AgentConfig): void {
  const dir = ensureWorkerDir(baseDir, cfg.name);
  fs.writeFileSync(path.join(dir, 'agent.json'), JSON.stringify(cfg, null, 2));
}

export function readAgentConfig(baseDir: string, name: string): AgentConfig | null {
  const p = path.join(getWorkerDir(baseDir, name), 'agent.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function agentExists(baseDir: string, name: string): boolean {
  return readAgentConfig(baseDir, name) !== null;
}

export function createAgent(
  baseDir: string,
  params: { name: string; soul?: string; skill?: string; cwd?: string; model?: string; overwrite?: boolean }
): AgentConfig {
  if (!params.name) throw new Error('name is required');
  if (!/^[a-zA-Z0-9._-]+$/.test(params.name)) {
    throw new Error('name must be alphanumeric, dot, dash or underscore only');
  }
  if (!params.overwrite && agentExists(baseDir, params.name)) {
    throw new Error(`Agent "${params.name}" already exists. Use overwrite: true or pick a different name.`);
  }
  const cfg: AgentConfig = {
    name: params.name,
    soul: params.soul || undefined,
    skill: params.skill || undefined,
    cwd: params.cwd || undefined,
    model: params.model || undefined,
    createdAt: new Date().toISOString(),
  };
  writeAgentConfig(baseDir, cfg);
  return cfg;
}

export function listAgents(baseDir: string): AgentConfig[] {
  const workersDir = getWorkersDir(baseDir);
  if (!fs.existsSync(workersDir)) return [];
  return fs.readdirSync(workersDir)
    .map(name => readAgentConfig(baseDir, name))
    .filter((cfg): cfg is AgentConfig => cfg !== null);
}

export interface AgentUpdate {
  soul?: string | null;
  skill?: string | null;
  cwd?: string | null;
  model?: string | null;
}

// Returns { updated, soulOrSkillChanged } — caller decides whether to reset session.
// Pass `null` on a field to clear it; omit to leave unchanged.
export function updateAgentConfig(
  baseDir: string,
  name: string,
  patch: AgentUpdate
): { updated: AgentConfig; soulOrSkillChanged: boolean } {
  const existing = readAgentConfig(baseDir, name);
  if (!existing) throw new Error(`Agent "${name}" not found`);

  const apply = (cur: string | undefined, next: string | null | undefined): string | undefined => {
    if (next === undefined) return cur;
    if (next === null || next === '') return undefined;
    return next;
  };

  const updated: AgentConfig = {
    ...existing,
    soul: apply(existing.soul, patch.soul),
    skill: apply(existing.skill, patch.skill),
    cwd: apply(existing.cwd, patch.cwd),
    model: apply(existing.model, patch.model),
  };

  const soulOrSkillChanged =
    (updated.soul ?? '') !== (existing.soul ?? '') ||
    (updated.skill ?? '') !== (existing.skill ?? '');

  writeAgentConfig(baseDir, updated);
  return { updated, soulOrSkillChanged };
}

export function deleteAgent(baseDir: string, name: string): void {
  const dir = getWorkerDir(baseDir, name);
  if (!fs.existsSync(dir)) throw new Error(`Agent "${name}" not found`);
  if (!agentExists(baseDir, name)) {
    throw new Error(`"${name}" is a batch worker, not a persistent agent. Use cleanWorkers for that.`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}

export function buildSystemPrompt(cfg: AgentConfig): string | undefined {
  const parts: string[] = [];
  if (cfg.soul) parts.push(cfg.soul);
  if (cfg.skill) parts.push(`Your expertise: ${cfg.skill}`);
  if (parts.length === 0) return undefined;
  return parts.join('\n\n');
}
