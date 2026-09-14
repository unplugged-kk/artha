import apiClient from './api';
import {
  Goal,
  CreateGoalInput,
  UpdateGoalInput,
  GoalsSummary,
  GoalStatus,
  GoalType,
} from '@/types/goal';
import { dedupe, invalidateCache } from './apiCache';

export const goalsApi = {
  getAll: async (params?: { status?: GoalStatus; type?: GoalType }): Promise<Goal[]> => {
    const key = `goals:all:${params?.status || 'all'}:${params?.type || 'all'}`;
    return dedupe(
      key,
      async () => {
        const response = await apiClient.get<Goal[]>('/goals', { params });
        return response.data;
      },
      30_000,
    );
  },

  getSummary: async (): Promise<GoalsSummary> => {
    return dedupe(
      'goals:summary',
      async () => {
        const response = await apiClient.get<GoalsSummary>('/goals/summary');
        return response.data;
      },
      30_000,
    );
  },

  getById: async (id: string): Promise<Goal> => {
    const response = await apiClient.get<Goal>(`/goals/${id}`);
    return response.data;
  },

  create: async (data: CreateGoalInput): Promise<Goal> => {
    const response = await apiClient.post<Goal>('/goals', data);
    invalidateCache('goals:');
    return response.data;
  },

  update: async (id: string, data: UpdateGoalInput): Promise<Goal> => {
    const response = await apiClient.patch<Goal>(`/goals/${id}`, data);
    invalidateCache('goals:');
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/goals/${id}`);
    invalidateCache('goals:');
  },

  linkTransaction: async (id: string, transactionId: string): Promise<Goal> => {
    const response = await apiClient.post<Goal>(`/goals/${id}/transactions`, {
      transactionId,
    });
    invalidateCache('goals:');
    return response.data;
  },

  unlinkTransaction: async (id: string, transactionId: string): Promise<Goal> => {
    const response = await apiClient.delete<Goal>(
      `/goals/${id}/transactions/${transactionId}`,
    );
    invalidateCache('goals:');
    return response.data;
  },

  getTransactions: async (id: string): Promise<any[]> => {
    const response = await apiClient.get<any[]>(`/goals/${id}/transactions`);
    return response.data;
  },
};
