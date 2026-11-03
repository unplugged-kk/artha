import apiClient from './api';

export interface SpendingSpike {
  categoryId: string | null;
  categoryName: string | null;
  currencyCode: string;
  current: number;
  mean: number;
  threshold: number;
}

export interface SubscriptionIncrease {
  payeeName: string;
  payeeId: string | null;
  previous: number;
  latest: number;
  increasePct: number;
}

export interface AnomalyReport {
  asOf: string;
  spendingSpikes: SpendingSpike[];
  subscriptionIncreases: SubscriptionIncrease[];
}

export const anomaliesApi = {
  get: async (asOf: string): Promise<AnomalyReport> => {
    const response = await apiClient.get<AnomalyReport>('/anomalies', { params: { asOf } });
    return response.data;
  },
};
