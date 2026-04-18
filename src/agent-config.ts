import fs from 'fs';
import path from 'path';
import { ensureWorkerDir, getWorkerDir } from './file-comm';

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

export function buildSystemPrompt(cfg: AgentConfig): string | undefined {
  const parts: string[] = [];
  if (cfg.soul) parts.push(cfg.soul);
  if (cfg.skill) parts.push(`Your expertise: ${cfg.skill}`);
  if (parts.length === 0) return undefined;
  return parts.join('\n\n');
}
