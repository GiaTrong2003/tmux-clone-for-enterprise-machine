import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import type { AgentConfig, AgentWithSession, AskResult, Autonomy } from '../types/api';

export const listAgents = () => apiGet<AgentWithSession[]>('/api/agents');
export const getAgent = (name: string) =>
  apiGet<AgentWithSession>(`/api/agents/${encodeURIComponent(name)}`);

export interface AgentPatch {
  soul?: string | null;
  skill?: string | null;
  cwd?: string | null;
  model?: string | null;
  role?: string | null;
  reportsTo?: string | null;
  autonomy?: Autonomy | null;
}

export const patchAgent = (name: string, body: AgentPatch, reset = false) =>
  apiPatch<{ success: boolean; updated: AgentConfig; soulOrSkillChanged: boolean; didReset: boolean }>(
    `/api/agents/${encodeURIComponent(name)}${reset ? '?reset=true' : ''}`,
    body
  );

export const resetAgent = (name: string) =>
  apiPost<{ success: boolean }>(`/api/agents/${encodeURIComponent(name)}/reset`);

export const deleteAgent = (name: string) =>
  apiDelete<{ success: boolean }>(`/api/agents/${encodeURIComponent(name)}`);

export const askAgent = (name: string, question: string) =>
  apiPost<AskResult>(`/api/agents/${encodeURIComponent(name)}/ask`, { question });

export interface CreateAgentBody {
  name: string;
  soul?: string;
  skill?: string;
  cwd?: string;
  model?: string;
  role?: string;
  reportsTo?: string;
  autonomy?: Autonomy;
  overwrite?: boolean;
}

export const createAgent = (body: CreateAgentBody) =>
  apiPost<{ success: boolean; agent: AgentConfig }>('/api/agents', body);
