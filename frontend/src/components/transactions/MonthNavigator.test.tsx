import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@/test/render';
import { MonthNavigator, currentMonthKey, monthBounds, shiftMonth } from './MonthNavigator';

vi.mock('@/hooks/useDateFormat', () => ({
  useDateFormat: () => ({
    formatMonth: (month: string) => month,
  }),
}));

describe('monthBounds', () => {
  it('spans the whole month', () => {
    expect(monthBounds('2026-09')).toEqual({
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
    expect(monthBounds('2026-12')).toEqual({
      startDate: '2026-12-01',
      endDate: '2026-12-31',
    });
  });

  it('knows the length of February in a common and a leap year', () => {
    expect(monthBounds('2026-02')?.endDate).toBe('2026-02-28');
    expect(monthBounds('2028-02')?.endDate).toBe('2028-02-29');
  });

  it('refuses a malformed or impossible key rather than guessing', () => {
    expect(monthBounds('2026-13')).toBeNull();
    expect(monthBounds('2026-1')).toBeNull();
    expect(monthBounds('')).toBeNull();
  });
});

describe('shiftMonth', () => {
  it('moves by whole months in both directions', () => {
    expect(shiftMonth('2026-09', 1)).toBe('2026-10');
    expect(shiftMonth('2026-09', -1)).toBe('2026-08');
  });

  it('crosses a year boundary', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-01', -13)).toBe('2024-12');
  });

  it('returns the key unchanged when it cannot be read', () => {
    expect(shiftMonth('nonsense', 1)).toBe('nonsense');
  });
});

describe('currentMonthKey', () => {
  it('reads the month in local time, zero-padded', () => {
    expect(currentMonthKey(new Date(2026, 8, 11))).toBe('2026-09');
    expect(currentMonthKey(new Date(2026, 11, 31))).toBe('2026-12');
    expect(currentMonthKey(new Date(2027, 0, 1))).toBe('2027-01');
  });
});

describe('MonthNavigator', () => {
  const onSelectMonth = vi.fn();

  beforeEach(() => {
    onSelectMonth.mockClear();
  });

  it('shows the month on screen and steps to the previous and next one', () => {
    render(
      <MonthNavigator
        month="2026-09"
        currentMonth="2026-09"
        onSelectMonth={onSelectMonth}
      />,
    );

    expect(screen.getByText('2026-09')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Previous month'));
    expect(onSelectMonth).toHaveBeenCalledWith('2026-08');

    fireEvent.click(screen.getByLabelText('Next month'));
    expect(onSelectMonth).toHaveBeenCalledWith('2026-10');
    cleanup();
  });

  it('offers a way back to the current month only when elsewhere', () => {
    render(
      <MonthNavigator
        month="2026-09"
        currentMonth="2026-09"
        onSelectMonth={onSelectMonth}
      />,
    );
    expect(screen.queryByText('This month')).toBeNull();
    cleanup();

    render(
      <MonthNavigator
        month="2026-07"
        currentMonth="2026-09"
        onSelectMonth={onSelectMonth}
      />,
    );
    fireEvent.click(screen.getByText('This month'));
    expect(onSelectMonth).toHaveBeenCalledWith('2026-09');
    cleanup();
  });
});
