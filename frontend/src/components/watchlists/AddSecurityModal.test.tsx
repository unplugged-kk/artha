import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { AddSecurityModal } from './AddSecurityModal';
import { Security } from '@/types/investment';

describe('AddSecurityModal', () => {
  const mockOnClose = vi.fn();
  const mockOnAdd = vi.fn();

  const mockSecurities = [
    {
      id: 'sec-1',
      symbol: 'INFY',
      name: 'Infosys Ltd',
      isin: 'INE009A01021',
      exchange: 'NSE',
      securityType: 'equity',
      currencyCode: 'INR',
      isActive: true,
      isFavourite: false,
    },
    {
      id: 'sec-2',
      symbol: 'TCS',
      name: 'Tata Consultancy Services',
      isin: 'INE467B01029',
      exchange: 'NSE',
      securityType: 'equity',
      currencyCode: 'INR',
      isActive: true,
      isFavourite: false,
    },
    {
      id: 'sec-3',
      symbol: 'RELIANCE',
      name: 'Reliance Industries',
      isin: 'INE002A01018',
      exchange: 'BSE',
      securityType: 'equity',
      currencyCode: 'INR',
      isActive: true,
      isFavourite: false,
    },
  ] as unknown as Security[];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders available securities excluding existing ones', () => {
    const existing = new Set(['sec-2']);

    render(
      <AddSecurityModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        securities={mockSecurities}
        existingSecurityIds={existing}
      />,
    );

    expect(screen.getByText('Add Security to Watchlist')).toBeInTheDocument();
    expect(screen.getByText('INFY')).toBeInTheDocument();
    expect(screen.getByText('Infosys Ltd')).toBeInTheDocument();
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.queryByText('TCS')).not.toBeInTheDocument();
  });

  it('filters securities based on search input', () => {
    render(
      <AddSecurityModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        securities={mockSecurities}
        existingSecurityIds={new Set()}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      'Search by symbol, name, or ISIN...',
    );
    fireEvent.change(searchInput, { target: { value: 'Tata' } });

    expect(screen.getByText('TCS')).toBeInTheDocument();
    expect(screen.queryByText('INFY')).not.toBeInTheDocument();
    expect(screen.queryByText('RELIANCE')).not.toBeInTheDocument();
  });

  it('shows empty message when all securities are already added', () => {
    const existing = new Set(['sec-1', 'sec-2', 'sec-3']);

    render(
      <AddSecurityModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        securities={mockSecurities}
        existingSecurityIds={existing}
      />,
    );

    expect(
      screen.getByText('All your active securities are already in this watchlist'),
    ).toBeInTheDocument();
  });

  it('shows no securities found when search has no matches', () => {
    render(
      <AddSecurityModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        securities={mockSecurities}
        existingSecurityIds={new Set()}
      />,
    );

    const searchInput = screen.getByPlaceholderText(
      'Search by symbol, name, or ISIN...',
    );
    fireEvent.change(searchInput, { target: { value: 'NONEXISTENT' } });

    expect(screen.getByText('No matching securities found')).toBeInTheDocument();
  });

  it('calls onAdd when Add button is clicked', async () => {
    mockOnAdd.mockResolvedValueOnce(undefined);

    render(
      <AddSecurityModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        securities={mockSecurities}
        existingSecurityIds={new Set(['sec-2', 'sec-3'])}
      />,
    );

    const addButton = screen.getByRole('button', { name: 'Add to Watchlist' });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(mockOnAdd).toHaveBeenCalledWith('sec-1');
    });
  });

  it('calls onClose when Cancel button is clicked', () => {
    render(
      <AddSecurityModal
        isOpen={true}
        onClose={mockOnClose}
        onAdd={mockOnAdd}
        securities={mockSecurities}
        existingSecurityIds={new Set()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
