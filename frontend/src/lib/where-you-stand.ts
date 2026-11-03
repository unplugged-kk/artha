import { MonthlyNetWorth } from '@/types/net-worth';

export interface Standing {
  netWorth: number;
  assets: number;
  liabilities: number;
  /** Change since the previous month's point, or null when there is no earlier point. */
  change: number | null;
}

/** Latest month's position and its change from the month before. Empty data is unknown, not zero. */
export function summarizeStanding(points: MonthlyNetWorth[]): Standing | null {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.month.localeCompare(b.month));
  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return {
    netWorth: Number(latest.netWorth),
    assets: Number(latest.assets),
    liabilities: Math.abs(Number(latest.liabilities)),
    change: previous ? round(Number(latest.netWorth) - Number(previous.netWorth)) : null,
  };
}

/** Add whole days to a YYYY-MM-DD day without involving the machine's timezone. */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
