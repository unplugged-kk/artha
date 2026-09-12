import { describe, it, expect } from 'vitest';
import {
  indianFiscalYearEnd,
  indianFiscalYearLabel,
  indianFiscalYearOf,
  indianFiscalYearRange,
  indianFiscalYearStart,
  isSameIndianFiscalYear,
} from './indian-fiscal-year';

describe('indianFiscalYearOf', () => {
  it('turns over on 1 April, not on 1 January', () => {
    expect(indianFiscalYearOf('2026-03-31')).toBe(2025);
    expect(indianFiscalYearOf('2026-04-01')).toBe(2026);
  });

  it('stays in the same year across a calendar-year boundary', () => {
    expect(indianFiscalYearOf('2026-12-31')).toBe(2026);
    expect(indianFiscalYearOf('2027-01-01')).toBe(2026);
    expect(indianFiscalYearOf('2027-03-31')).toBe(2026);
  });

  it('reads the whole of the year it spans', () => {
    expect(indianFiscalYearOf('2026-04-01')).toBe(2026);
    expect(indianFiscalYearOf('2026-04-30')).toBe(2026);
    expect(indianFiscalYearOf('2026-09-15')).toBe(2026);
    expect(indianFiscalYearOf('2027-03-31')).toBe(2026);
  });

  it('places a leap day inside the year that contains it', () => {
    // 29 February 2028 falls inside FY 2027 (1 Apr 2027 - 31 Mar 2028).
    expect(indianFiscalYearOf('2028-02-29')).toBe(2027);
    expect(indianFiscalYearOf('2027-03-31')).toBe(2026);
  });

  it('reads a Date in UTC, so midnight cannot move it', () => {
    // 23:30 UTC on 31 March is still 31 March; a local-time read west of UTC
    // would call it the 30th and still the old year, but east of UTC it would
    // become 1 April and the new one.
    expect(indianFiscalYearOf(new Date('2026-03-31T23:30:00Z'))).toBe(2025);
    expect(indianFiscalYearOf(new Date('2026-04-01T00:30:00Z'))).toBe(2026);
  });

  it('answers null for a date it cannot read', () => {
    expect(indianFiscalYearOf('')).toBeNull();
    expect(indianFiscalYearOf('not-a-date')).toBeNull();
    expect(indianFiscalYearOf('2026-13-01')).toBeNull();
    expect(indianFiscalYearOf('2026-00-10')).toBeNull();
    expect(indianFiscalYearOf(new Date('nonsense'))).toBeNull();
  });
});

describe('fiscal year boundaries', () => {
  it('starts on 1 April and ends on 31 March', () => {
    expect(indianFiscalYearStart(2026)).toBe('2026-04-01');
    expect(indianFiscalYearEnd(2026)).toBe('2027-03-31');
  });

  it('returns the inclusive range', () => {
    expect(indianFiscalYearRange(2026)).toEqual({
      startDate: '2026-04-01',
      endDate: '2027-03-31',
    });
  });

  it('is contiguous: one year ends the day before the next begins', () => {
    const end = new Date(`${indianFiscalYearEnd(2026)}T00:00:00Z`);
    const nextStart = new Date(`${indianFiscalYearStart(2027)}T00:00:00Z`);
    expect(nextStart.getTime() - end.getTime()).toBe(86_400_000);
  });

  it('pads a single-digit year', () => {
    expect(indianFiscalYearStart(999)).toBe('0999-04-01');
    expect(indianFiscalYearEnd(999)).toBe('1000-03-31');
  });
});

describe('indianFiscalYearLabel', () => {
  it('labels the year by both the years it spans', () => {
    expect(indianFiscalYearLabel(2026)).toBe('2026-27');
    expect(indianFiscalYearLabel(2025)).toBe('2025-26');
  });

  it('rolls a century correctly', () => {
    expect(indianFiscalYearLabel(2099)).toBe('2099-00');
  });
});

describe('isSameIndianFiscalYear', () => {
  it('is true across a calendar year boundary inside one financial year', () => {
    expect(isSameIndianFiscalYear('2026-04-01', '2027-03-31')).toBe(true);
    expect(isSameIndianFiscalYear('2026-12-31', '2027-01-01')).toBe(true);
  });

  it('is false across the April boundary', () => {
    expect(isSameIndianFiscalYear('2026-03-31', '2026-04-01')).toBe(false);
  });

  it('is null, not a guess, when a date cannot be read', () => {
    expect(isSameIndianFiscalYear('2026-04-01', 'nonsense')).toBeNull();
    expect(isSameIndianFiscalYear('', '')).toBeNull();
  });
});
