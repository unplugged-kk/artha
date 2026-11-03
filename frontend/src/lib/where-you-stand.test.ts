import { describe, it, expect } from 'vitest';
import { summarizeStanding, addDaysYmd } from './where-you-stand';

const p = (month: string, netWorth: number) => ({ month, assets: netWorth + 10, liabilities: -10, netWorth });

describe('summarizeStanding', () => {
  it('treats no data as unknown, not zero', () => {
    expect(summarizeStanding([])).toBeNull();
  });
  it('has no change from a single point', () => {
    expect(summarizeStanding([p('2026-10-01', 100)])?.change).toBeNull();
  });
  it('orders by month, whatever order the server answered in', () => {
    const s = summarizeStanding([p('2026-10-01', 150), p('2026-09-01', 100), p('2026-08-01', 90)]);
    expect(s?.netWorth).toBe(150);
    expect(s?.change).toBe(50);
  });
  it('reports a fall as negative and debts as a positive magnitude', () => {
    const s = summarizeStanding([p('2026-09-01', 100), p('2026-10-01', 70)]);
    expect(s?.change).toBe(-30);
    expect(s?.liabilities).toBe(10);
  });
  it('reads decimal strings the API sends', () => {
    const s = summarizeStanding([
      { month: '2026-09-01', assets: '0.1' as unknown as number, liabilities: 0, netWorth: '0.1' as unknown as number },
      { month: '2026-10-01', assets: '0.3' as unknown as number, liabilities: 0, netWorth: '0.3' as unknown as number },
    ]);
    expect(s?.change).toBe(0.2);
  });
});

describe('addDaysYmd', () => {
  it('crosses month and year ends', () => {
    expect(addDaysYmd('2026-12-28', 7)).toBe('2027-01-04');
    expect(addDaysYmd('2028-02-25', 7)).toBe('2028-03-03');
  });
});
