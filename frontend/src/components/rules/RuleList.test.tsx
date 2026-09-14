import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/render';
import { RuleList } from './RuleList';
import { TransactionRule } from '@/types/rule';

const mockRules: TransactionRule[] = [
  {
    id: 'rule-1',
    userId: 'u1',
    name: 'Uber to Transport',
    priority: 1,
    isActive: true,
    matchMode: 'ALL',
    conditions: [
      { field: 'payee', operator: 'CONTAINS', value: 'Uber' },
    ],
    actions: {
      setCategoryId: 'cat-1',
      stopProcessing: true,
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rule-2',
    userId: 'u1',
    name: 'Salary Rule',
    priority: 2,
    isActive: false,
    matchMode: 'ANY',
    conditions: [
      { field: 'memo', operator: 'CONTAINS', value: 'Payroll' },
    ],
    actions: {
      setPayeeName: 'Employer Inc',
    },
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
];

describe('RuleList', () => {
  it('renders list of rules and handles actions', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const onTest = vi.fn();
    const onToggleActive = vi.fn();
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    const onCreateNew = vi.fn();

    render(
      <RuleList
        rules={mockRules}
        onEdit={onEdit}
        onDelete={onDelete}
        onTest={onTest}
        onToggleActive={onToggleActive}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onCreateNew={onCreateNew}
      />
    );

    expect(screen.getByText('Uber to Transport')).toBeInTheDocument();
    expect(screen.getByText('Salary Rule')).toBeInTheDocument();

    // Edit
    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    fireEvent.click(editButtons[0]);
    expect(onEdit).toHaveBeenCalledWith(mockRules[0]);

    // Test
    const testButtons = screen.getAllByRole('button', { name: /test rule/i });
    fireEvent.click(testButtons[0]);
    expect(onTest).toHaveBeenCalledWith(mockRules[0]);

    // Delete
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    fireEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalledWith(mockRules[0]);

    // Toggle active
    const toggleButtons = screen.getAllByRole('switch');
    fireEvent.click(toggleButtons[0]);
    expect(onToggleActive).toHaveBeenCalledWith(mockRules[0]);

    // Move down on first rule
    const moveDownButtons = screen.getAllByRole('button', { name: /move down/i });
    fireEvent.click(moveDownButtons[0]);
    expect(onMoveDown).toHaveBeenCalledWith(0);
  });

  it('renders empty state when rules list is empty', () => {
    const onCreateNew = vi.fn();
    render(
      <RuleList
        rules={[]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onTest={vi.fn()}
        onToggleActive={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onCreateNew={onCreateNew}
      />
    );

    expect(screen.getByText(/no transaction rules yet/i)).toBeInTheDocument();
    const createBtn = screen.getByRole('button', { name: /new rule/i });
    fireEvent.click(createBtn);
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });
});
