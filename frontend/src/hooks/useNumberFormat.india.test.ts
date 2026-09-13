import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@/test/render';
import { useNumberFormat } from './useNumberFormat';
import { usePreferencesStore } from '@/store/preferencesStore';

vi.mock('@/store/preferencesStore', () => ({
  usePreferencesStore: vi.fn((selector: any) =>
    selector({ preferences: { numberFormat: 'en-IN', defaultCurrency: 'INR' } }),
  ),
}));

function withPreferences(
  numberFormat: string,
  defaultCurrency = 'INR',
  language?: string,
) {
  vi.mocked(usePreferencesStore).mockImplementation((selector: any) =>
    selector({ preferences: { numberFormat, defaultCurrency, language } }),
  );
}

/**
 * India-first number formatting.
 *
 * The point of these is that nothing here does Indian arithmetic: the grouping
 * and the lakh/crore units both come from `Intl` for the reader's locale, so
 * the same code is right for a Western reader too -- which the en-US cases
 * below hold it to.
 */
describe('number formatting in an Indian locale', () => {
  it('groups by lakh and crore, not by thousands alone', () => {
    withPreferences('en-IN');
    const { result } = renderHook(() => useNumberFormat());

    expect(result.current.formatNumber(1234567, 0)).toBe('12,34,567');
    expect(result.current.formatNumber(98765432, 0)).toBe('9,87,65,432');
    // Four digits or fewer group the same way everywhere.
    expect(result.current.formatNumber(1234, 0)).toBe('1,234');
  });

  it('groups currency the same way', () => {
    withPreferences('en-IN', 'INR');
    const { result } = renderHook(() => useNumberFormat());

    expect(result.current.formatCurrency(1500000)).toContain('15,00,000');
  });

  it('uses lakh and crore for compact labels', () => {
    withPreferences('en-IN', 'INR');
    const { result } = renderHook(() => useNumberFormat());

    expect(result.current.formatCurrencyLabel(1500)).toContain('K');
    expect(result.current.formatCurrencyLabel(150000)).toContain('L');
    expect(result.current.formatCurrencyLabel(15000000)).toContain('Cr');
  });

  it('keeps the amount whole under the smallest unit', () => {
    withPreferences('en-IN', 'INR');
    const { result } = renderHook(() => useNumberFormat());

    // No unit applies, so no suffix and no decimals -- "₹500", not "₹500L".
    const label = result.current.formatCurrencyLabel(500);
    expect(label).not.toMatch(/[KLCrM]/);
    expect(label).toContain('500');
  });

  it('keeps the sign on a negative amount', () => {
    withPreferences('en-IN', 'INR');
    const { result } = renderHook(() => useNumberFormat());

    expect(result.current.formatNumber(-1234567, 0)).toBe('-12,34,567');
    expect(result.current.formatCurrency(-15000000)).toContain('-');
  });

  it('renders zero as an amount, not an empty string', () => {
    withPreferences('en-IN', 'INR');
    const { result } = renderHook(() => useNumberFormat());

    expect(result.current.formatCurrency(0)).toContain('0');
    expect(result.current.formatCurrencyLabel(0)).not.toMatch(/[KLCrM]/);
  });

  it('keeps the currency’s own decimal precision', () => {
    withPreferences('en-IN', 'INR');
    const { result } = renderHook(() => useNumberFormat());

    expect(result.current.formatCurrency(1234.567)).toContain('1,234.57');
    expect(result.current.formatCurrency(1234)).toContain('1,234.00');
  });
});

describe('number formatting in a Western locale is unchanged', () => {
  it('groups by thousands', () => {
    withPreferences('en-US', 'USD');
    const { result } = renderHook(() => useNumberFormat());

    expect(result.current.formatNumber(1234567, 0)).toBe('1,234,567');
    expect(result.current.formatNumber(98765432, 0)).toBe('98,765,432');
  });

  it('keeps the K/M/B/T compact labels and their precision', () => {
    withPreferences('en-US', 'USD');
    const { result } = renderHook(() => useNumberFormat());

    expect(result.current.formatCurrencyLabel(1500)).toContain('K');
    expect(result.current.formatCurrencyLabel(2500000)).toContain('M');
    expect(result.current.formatCurrencyLabel(3000000000)).toContain('B');
    expect(result.current.formatCurrencyLabel(2000000000000)).toContain('T');
    // The digit policy is unchanged: one decimal on the smallest unit, two above.
    expect(result.current.formatCurrencyLabel(1500)).toMatch(/1\.5K/);
    expect(result.current.formatCurrencyLabel(2500000)).toMatch(/2\.50M/);
  });

  it('is the locale, not the value, that decides the units', () => {
    withPreferences('en-US', 'USD');
    const us = renderHook(() => useNumberFormat());
    const usLabel = us.result.current.formatCurrencyLabel(150000);

    withPreferences('en-IN', 'INR');
    const india = renderHook(() => useNumberFormat());
    const indiaLabel = india.result.current.formatCurrencyLabel(150000);

    // Same magnitude, two vocabularies: "150.0K" against "1.5L".
    expect(usLabel).toContain('K');
    expect(indiaLabel).toContain('L');
    expect(indiaLabel).not.toContain('K');
  });

  it('follows the UI language when the number format is set to the browser', () => {
    withPreferences('browser', 'INR', 'en-IN');
    const { result } = renderHook(() => useNumberFormat());

    expect(result.current.formatNumber(1234567, 0)).toBe('12,34,567');
    expect(result.current.formatCurrencyLabel(15000000)).toContain('Cr');
  });
});
