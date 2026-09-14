import apiClient from './api';
import {
  TransactionRule,
  CreateRuleDto,
  UpdateRuleDto,
  ReorderRulesDto,
  TestRuleDto,
  ApplyRulesDto,
  ApplyRulesResult,
} from '@/types/rule';
import { dedupe, invalidateCache } from './apiCache';

export const rulesApi = {
  getAll: async (): Promise<TransactionRule[]> => {
    return dedupe(
      'rules:all',
      async () => {
        const response = await apiClient.get<TransactionRule[]>('/rules');
        return response.data;
      },
      60_000, // 1 min cache
    );
  },

  getById: async (id: string): Promise<TransactionRule> => {
    const response = await apiClient.get<TransactionRule>(`/rules/${id}`);
    return response.data;
  },

  create: async (data: CreateRuleDto): Promise<TransactionRule> => {
    const response = await apiClient.post<TransactionRule>('/rules', data);
    invalidateCache('rules:');
    return response.data;
  },

  update: async (id: string, data: UpdateRuleDto): Promise<TransactionRule> => {
    const response = await apiClient.put<TransactionRule>(`/rules/${id}`, data);
    invalidateCache('rules:');
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/rules/${id}`);
    invalidateCache('rules:');
  },

  reorder: async (data: ReorderRulesDto): Promise<TransactionRule[]> => {
    const response = await apiClient.put<TransactionRule[]>('/rules/reorder', data);
    invalidateCache('rules:');
    return response.data;
  },

  test: async (data: TestRuleDto): Promise<any> => {
    const response = await apiClient.post<any>('/rules/test', data);
    return response.data;
  },

  apply: async (data: ApplyRulesDto): Promise<ApplyRulesResult> => {
    const response = await apiClient.post<ApplyRulesResult>('/rules/apply', data);
    invalidateCache('transactions:');
    invalidateCache('categories:');
    return response.data;
  },
};
