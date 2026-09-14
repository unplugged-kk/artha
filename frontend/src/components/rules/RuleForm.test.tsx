import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/render';
import { RuleForm } from './RuleForm';

const mockCategories = [
  { id: 'cat-1', name: 'Transportation' },
  { id: 'cat-2', name: 'Groceries' },
];

describe('RuleForm', () => {
  it('renders form and allows adding conditions and saving', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    render(
      <RuleForm
        categories={mockCategories as any}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    // Rule name
    const nameInput = screen.getByPlaceholderText(/swiggy & zomato/i);
    fireEvent.change(nameInput, { target: { value: 'Coffee Shops' } });

    // Condition value input
    const conditionValueInput = screen.getByPlaceholderText(/value to match/i);
    fireEvent.change(conditionValueInput, { target: { value: 'Starbucks' } });

    // Action: select category
    const categorySelect = screen.getByDisplayValue(/select a category/i);
    fireEvent.change(categorySelect, { target: { value: 'cat-1' } });

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: /create rule/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Coffee Shops',
        matchMode: 'ALL',
        conditions: [
          expect.objectContaining({
            field: 'payee',
            operator: 'CONTAINS',
            value: 'Starbucks',
          }),
        ],
        actions: expect.objectContaining({
          setCategoryId: 'cat-1',
          stopProcessing: true,
        }),
      })
    );
  });

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn();

    render(
      <RuleForm
        categories={mockCategories as any}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
