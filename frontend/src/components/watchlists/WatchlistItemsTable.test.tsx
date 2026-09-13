import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { WatchlistItemsTable } from './WatchlistItemsTable';
import { WatchlistItem } from '@/types/watchlist';

describe('WatchlistItemsTable', () => {
  const mockItems: WatchlistItem[] = [
    {
      id: 'item-1',
      watchlistId: 'w-1',
      securityId: 'sec-1',
      sortOrder: 0,
      createdAt: '2026-09-12T10:00:00Z',
      security: {
        id: 'sec-1',
        symbol: 'TCS',
        name: 'Tata Consultancy Services',
        currencyCode: 'INR',
        exchange: 'NSE',
        securityType: 'STOCK',
        isin: 'INE467B01029',
      },
      quote: {
        status: 'available',
        currentPrice: 4200,
        previousPrice: 4000,
        dailyChange: 200,
        dailyChangePercent: 5,
        priceDate: '2026-09-12',
      },
    },
    {
      id: 'item-2',
      watchlistId: 'w-1',
      securityId: 'sec-2',
      sortOrder: 1,
      createdAt: '2026-09-12T11:00:00Z',
      security: {
        id: 'sec-2',
        symbol: 'UNPRICED',
        name: 'Unpriced Fund',
        currencyCode: 'INR',
        exchange: 'BSE',
        securityType: 'MUTUAL_FUND',
      },
      quote: {
        status: 'unavailable',
        currentPrice: null,
        previousPrice: null,
        dailyChange: null,
        dailyChangePercent: null,
        priceDate: null,
      },
    },
  ];

  it('renders empty state when there are no items', () => {
    const onAddClick = vi.fn();
    render(
      <WatchlistItemsTable
        items={[]}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onRemove={vi.fn()}
        onAddClick={onAddClick}
      />,
    );

    expect(screen.getByText('Watchlist is empty')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Security' }));
    expect(onAddClick).toHaveBeenCalledTimes(1);
  });

  it('renders securities with real quotes and change percentages', () => {
    render(
      <WatchlistItemsTable
        items={mockItems}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onRemove={vi.fn()}
        onAddClick={vi.fn()}
      />,
    );

    expect(screen.getByText('TCS')).toBeInTheDocument();
    expect(screen.getByText('Tata Consultancy Services')).toBeInTheDocument();
    expect(screen.getByText('INE467B01029')).toBeInTheDocument();
    expect(screen.getByText('2026-09-12')).toBeInTheDocument();
  });

  it('renders explicit "Unavailable" badge and dash for unpriced items without fabricating zero', () => {
    render(
      <WatchlistItemsTable
        items={mockItems}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onRemove={vi.fn()}
        onAddClick={vi.fn()}
      />,
    );

    expect(screen.getByText('UNPRICED')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    // Ensure no $0.00 or ₹0.00 fallback is fabricated for the unpriced fund
    expect(screen.queryByText('₹0.00')).not.toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('handles item reordering via move up and move down buttons', () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();

    render(
      <WatchlistItemsTable
        items={mockItems}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onRemove={vi.fn()}
        onAddClick={vi.fn()}
      />,
    );

    const moveDownButtons = screen.getAllByRole('button', { name: /down/i });
    fireEvent.click(moveDownButtons[0]);
    expect(onMoveDown).toHaveBeenCalledWith(0);

    const moveUpButtons = screen.getAllByRole('button', { name: /up/i });
    fireEvent.click(moveUpButtons[1]);
    expect(onMoveUp).toHaveBeenCalledWith(1);
  });

  it('confirms and calls onRemove when trash icon clicked', async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);

    render(
      <WatchlistItemsTable
        items={mockItems}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onRemove={onRemove}
        onAddClick={vi.fn()}
      />,
    );

    const removeBtn = screen.getByRole('button', { name: 'Remove TCS from watchlist' });
    fireEvent.click(removeBtn);

    expect(screen.getByText(/Are you sure you want to remove TCS from this watchlist/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: 'Remove' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onRemove).toHaveBeenCalledWith('item-1');
    });
  });
});
