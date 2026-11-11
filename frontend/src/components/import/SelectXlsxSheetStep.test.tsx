import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/render';
import { SelectXlsxSheetStep } from './SelectXlsxSheetStep';
import { XlsxSheetSummary } from '@/lib/import-xlsx';

const sheets: XlsxSheetSummary[] = [
  {
    name: 'Transactions',
    rowCount: 41,
    guessedHeaderRow: 4,
    previewRows: [
      ['#', 'Date', 'Amount', 'Category'],
      ['1', '2026-08-25', '500', 'Groceries'],
    ],
  },
  { name: 'Dashboard', rowCount: 0, guessedHeaderRow: 1, previewRows: [] },
];

describe('SelectXlsxSheetStep', () => {
  const defaultProps = {
    fileName: 'Sept -2026.xlsx',
    sheets,
    sheetName: 'Transactions',
    headerRow: 4,
    isLoading: false,
    onSheetChange: vi.fn(),
    onHeaderRowChange: vi.fn(),
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
  };

  it('shows the uploaded file name and both sheet options', () => {
    render(<SelectXlsxSheetStep {...defaultProps} />);

    expect(screen.getByText('Sept -2026.xlsx')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Transactions/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Dashboard/ })).toBeInTheDocument();
  });

  it('previews the selected sheet starting at its header row', () => {
    render(<SelectXlsxSheetStep {...defaultProps} />);

    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.queryByText('TOTAL')).not.toBeInTheDocument();
  });

  it('calls onSheetChange when a different sheet is picked', () => {
    const onSheetChange = vi.fn();
    render(<SelectXlsxSheetStep {...defaultProps} onSheetChange={onSheetChange} />);

    fireEvent.change(screen.getByLabelText('Sheet'), {
      target: { value: 'Dashboard' },
    });

    expect(onSheetChange).toHaveBeenCalledWith('Dashboard');
  });

  it('calls onConfirm when Continue is clicked', () => {
    const onConfirm = vi.fn();
    render(<SelectXlsxSheetStep {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it('disables Continue while loading', () => {
    render(<SelectXlsxSheetStep {...defaultProps} isLoading />);

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('shows a no-preview message for an empty sheet', () => {
    render(
      <SelectXlsxSheetStep
        {...defaultProps}
        sheetName="Dashboard"
        headerRow={1}
      />,
    );

    expect(screen.getByText('No rows to preview.')).toBeInTheDocument();
  });
});
