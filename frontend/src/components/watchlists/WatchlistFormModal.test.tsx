import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { WatchlistFormModal } from './WatchlistFormModal';
import { Watchlist } from '@/types/watchlist';

describe('WatchlistFormModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly for create mode', () => {
    render(
      <WatchlistFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    expect(screen.getByText('New Watchlist')).toBeInTheDocument();
    expect(screen.getByLabelText('Watchlist Name')).toHaveValue('');
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Create Watchlist' })).toBeDisabled();
  });

  it('renders correctly for edit mode', () => {
    const existing: Watchlist = {
      id: 'wl-1',
      userId: 'user-1',
      name: 'Tech Growth',
      description: 'Tech stocks to watch',
      sortOrder: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    render(
      <WatchlistFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        watchlist={existing}
      />,
    );

    expect(screen.getByText('Edit Watchlist')).toBeInTheDocument();
    expect(screen.getByLabelText('Watchlist Name')).toHaveValue('Tech Growth');
    expect(screen.getByLabelText('Description (optional)')).toHaveValue('Tech stocks to watch');
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('submits valid form and calls onClose on success', async () => {
    mockOnSave.mockResolvedValueOnce(undefined);

    render(
      <WatchlistFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    fireEvent.change(screen.getByLabelText('Watchlist Name'), {
      target: { value: 'Bluechips' },
    });
    fireEvent.change(screen.getByLabelText('Description (optional)'), {
      target: { value: 'Nifty 50 picks' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create Watchlist' }));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'Bluechips',
        description: 'Nifty 50 picks',
      });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('displays error message when onSave fails', async () => {
    mockOnSave.mockRejectedValueOnce(new Error('Duplicate watchlist name'));

    render(
      <WatchlistFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    fireEvent.change(screen.getByLabelText('Watchlist Name'), {
      target: { value: 'Duplicate' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Watchlist' }));

    await waitFor(() => {
      expect(screen.getByText('Duplicate watchlist name')).toBeInTheDocument();
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  it('calls onClose when cancel button is clicked', () => {
    render(
      <WatchlistFormModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
