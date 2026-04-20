import { apiGet, apiPost } from './client';
import type { CompanyResponse, TailResponse, Autonomy } from '../types/api';

export const getCompany = () => apiGet<CompanyResponse>('/api/company');

export const setAutonomyOverride = (override: Autonomy | null) =>
  apiPost<{ success: boolean; autonomyOverride: Autonomy | null }>('/api/company/autonomy', { override });

export const tailConversations = (since: number) =>
  apiGet<TailResponse>(`/api/conversations?since=${since}`);
