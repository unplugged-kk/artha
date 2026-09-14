import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@/test/render';
import WatchlistsPage from './page';
import { Watchlist } from '@/types/watchlist';
import { Security } from '@/types/investment';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/watchlists',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock ProtectedRoute to render children directly
vi.mock('@/components/auth/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock watchlistsApi & investmentsApi
const mockGetWatchlists = vi.fn();
const mockGetWatchlist = vi.fn();
const mockCreateWatchlist = vi.fn();
const mockUpdateWatchlist = vi.fn();
const mockDeleteWatchlist = vi.fn();
const mockAddWatchlistItem = vi.fn();
const mockRemoveWatchlistItem = vi.fn();
const mockReorderWatchlistItems = vi.fn();
const mockRefreshWatchlistQuotes = vi.fn();

vi.mock('@/lib/watchlists', () => ({
  watchlistsApi: {
    getWatchlists: (...args: any[]) => mockGetWatchlists(...args),
    getWatchlist: (...args: any[]) => mockGetWatchlist(...args),
    createWatchlist: (...args: any[]) => mockCreateWatchlist(...args),
    updateWatchlist: (...args: any[]) => mockUpdateWatchlist(...args),
    deleteWatchlist: (...args: any[]) => mockDeleteWatchlist(...args),
    addWatchlistItem: (...args: any[]) => mockAddWatchlistItem(...args),
    removeWatchlistItem: (...args: any[]) => mockRemoveWatchlistItem(...args),
    reorderWatchlistItems: (...args: any[]) => mockReorderWatchlistItems(...args),
    refreshWatchlistQuotes: (...args: any[]) => mockRefreshWatchlistQuotes(...args),
  },
}));

const mockGetSecurities = vi.fn();
vi.mock('@/lib/investments', () => ({
  investmentsApi: {
    getSecurities: (...args: any[]) => mockGetSecurities(...args),
  },
}));

describe('WatchlistsPage', () => {
  const sampleWatchlists: Watchlist[] = [
    {
      id: 'wl-1',
      userId: 'user-1',
      name: 'Tech Giants',
      description: 'Core tech positions',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'wl-2',
      userId: 'user-1',
      name: 'Banking',
      description: 'Financial sector',
      sortOrder: 1,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  const sampleWatchlistDetail: Watchlist = {
    ...sampleWatchlists[0],
    items: [
      {
        id: 'item-1',
        watchlistId: 'wl-1',
        securityId: 'sec-1',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00Z',
        security: {
          id: 'sec-1',
          symbol: 'INFY',
          name: 'Infosys Ltd',
          exchange: 'NSE',
          securityType: 'equity',
          currencyCode: 'INR',
        },
        quote: {
          currentPrice: 1850.5,
          previousPrice: 1825.0,
          priceDate: '2026-09-12',
          dailyChange: 25.5,
          dailyChangePercent: 1.4,
          status: 'available',
        },
      },
    ],
  };

  const sampleSecurities = [
    {
      id: 'sec-1',
      symbol: 'INFY',
      name: 'Infosys Ltd',
      exchange: 'NSE',
      securityType: 'equity',
      currencyCode: 'INR',
      isActive: true,
      isFavourite: false,
    },
  ] as unknown as Security[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSecurities.mockResolvedValue(sampleSecurities);
  });

  it('renders empty state when there are no watchlists', async () => {
    mockGetWatchlists.mockResolvedValueOnce([]);

    render(<WatchlistsPage />);

    await waitFor(() => {
      expect(screen.getByText('No watchlists yet')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create your first watchlist' })).toBeInTheDocument();
    });
  });

  it('renders watchlists tabs, description, and items table when watchlists exist', async () => {
    mockGetWatchlists.mockResolvedValueOnce(sampleWatchlists);
    mockGetWatchlist.mockResolvedValueOnce(sampleWatchlistDetail);

    render(<WatchlistsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tech Giants' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Banking' })).toBeInTheDocument();
      expect(screen.getByText('Core tech positions')).toBeInTheDocument();
      expect(screen.getByText('INFY')).toBeInTheDocument();
      expect(screen.getByText('Infosys Ltd')).toBeInTheDocument();
    });
  });

  it('switches active watchlist when clicking another tab', async () => {
    mockGetWatchlists.mockResolvedValue(sampleWatchlists);
    mockGetWatchlist
      .mockResolvedValueOnce(sampleWatchlistDetail)
      .mockResolvedValueOnce({
        ...sampleWatchlists[1],
        items: [],
      });

    render(<WatchlistsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Banking' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Banking' }));

    await waitFor(() => {
      expect(mockGetWatchlist).toHaveBeenCalledWith('wl-2');
    });
  });

  it('triggers quote refresh when clicking refresh button', async () => {
    mockGetWatchlists.mockResolvedValueOnce(sampleWatchlists);
    mockGetWatchlist.mockResolvedValueOnce(sampleWatchlistDetail);
    mockRefreshWatchlistQuotes.mockResolvedValueOnce(sampleWatchlistDetail);

    render(<WatchlistsPage />);

    await waitFor(() => {
      expect(screen.getByText('INFY')).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: 'Refresh Quotes' });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockRefreshWatchlistQuotes).toHaveBeenCalledWith('wl-1');
    });
  });

  it('opens confirm dialog and deletes watchlist', async () => {
    mockGetWatchlists.mockResolvedValue(sampleWatchlists);
    mockGetWatchlist.mockResolvedValue(sampleWatchlistDetail);
    mockDeleteWatchlist.mockResolvedValueOnce(undefined);

    render(<WatchlistsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Tech Giants' })).toBeInTheDocument();
    });

    const deleteButton = await screen.findByTitle('Delete Watchlist');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete Watchlist')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteWatchlist).toHaveBeenCalledWith('wl-1');
    });
  });
});
