export interface WatchlistItemQuote {
  status: 'available' | 'unavailable';
  currentPrice: number | null;
  previousPrice: number | null;
  dailyChange: number | null;
  dailyChangePercent: number | null;
  priceDate: string | null;
}

export interface WatchlistItemSecurity {
  id: string;
  symbol: string;
  name: string;
  currencyCode: string;
  securityType?: string | null;
  exchange?: string | null;
  isin?: string | null;
  amfiSchemeCode?: string | null;
}

export interface WatchlistItem {
  id: string;
  watchlistId: string;
  securityId: string;
  sortOrder: number;
  createdAt: string;
  security: WatchlistItemSecurity;
  quote: WatchlistItemQuote;
}

export interface Watchlist {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  itemCount?: number;
  items?: WatchlistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateWatchlistData {
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateWatchlistData {
  name?: string;
  description?: string;
  sortOrder?: number;
}

export interface AddWatchlistItemData {
  securityId: string;
  sortOrder?: number;
}
