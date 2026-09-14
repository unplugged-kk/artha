import apiClient from './api';
import {
  Watchlist,
  WatchlistItem,
  CreateWatchlistData,
  UpdateWatchlistData,
  AddWatchlistItemData,
} from '@/types/watchlist';

export const watchlistsApi = {
  getWatchlists: async (): Promise<Watchlist[]> => {
    const response = await apiClient.get<Watchlist[]>('/watchlists');
    return response.data;
  },

  getWatchlist: async (id: string): Promise<Watchlist> => {
    const response = await apiClient.get<Watchlist>(`/watchlists/${id}`);
    return response.data;
  },

  createWatchlist: async (data: CreateWatchlistData): Promise<Watchlist> => {
    const response = await apiClient.post<Watchlist>('/watchlists', data);
    return response.data;
  },

  updateWatchlist: async (
    id: string,
    data: UpdateWatchlistData,
  ): Promise<Watchlist> => {
    const response = await apiClient.patch<Watchlist>(`/watchlists/${id}`, data);
    return response.data;
  },

  deleteWatchlist: async (id: string): Promise<void> => {
    await apiClient.delete(`/watchlists/${id}`);
  },

  addWatchlistItem: async (
    watchlistId: string,
    data: AddWatchlistItemData,
  ): Promise<WatchlistItem> => {
    const response = await apiClient.post<WatchlistItem>(
      `/watchlists/${watchlistId}/items`,
      data,
    );
    return response.data;
  },

  removeWatchlistItem: async (
    watchlistId: string,
    itemId: string,
  ): Promise<void> => {
    await apiClient.delete(`/watchlists/${watchlistId}/items/${itemId}`);
  },

  reorderWatchlistItems: async (
    watchlistId: string,
    itemIds: string[],
  ): Promise<void> => {
    await apiClient.put(`/watchlists/${watchlistId}/items/reorder`, { itemIds });
  },

  reorderWatchlists: async (watchlistIds: string[]): Promise<void> => {
    await apiClient.put('/watchlists/reorder', { watchlistIds });
  },

  refreshWatchlistQuotes: async (watchlistId: string): Promise<Watchlist> => {
    const response = await apiClient.post<Watchlist>(
      `/watchlists/${watchlistId}/refresh-quotes`,
    );
    return response.data;
  },
};
