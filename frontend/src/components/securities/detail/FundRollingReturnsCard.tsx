'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { CellLabel, TABLE_BODY_CLASS, TABLE_CLASS, TH_CLASS } from '@/components/ui/Table';
import { useDateFormat } from '@/hooks/useDateFormat';
import { useNumberFormat } from '@/hooks/useNumberFormat';
import { useReportData } from '@/hooks/useReportData';
import { investmentsApi } from '@/lib/investments';
import { gainLossColor } from '@/lib/format';
import type {
  FundRollingReturnsView,
  RollingPeriodResult,
  RollingReturnExtreme,
} from '@/types/investment';

interface FundRollingReturnsCardProps {
  securityId: string;
}

/** Gap ranges named inline before the rest are summarised as a count. */
const MAX_LISTED_GAPS = 3;

// Mechanism A (frontend/CLAUDE.md): one tree, a table from `sm` up and a
// two-column grid card per period below it, so a phone never scrolls sideways.
const CELL = 'p-0 text-sm sm:table-cell sm:px-4 sm:py-3';
const FIGURE_CELL = `${CELL} tabular-nums sm:text-right`;

/**
 * The distribution of every 1-, 3- and 5-year holding period in an AMFI fund's
 * NAV history, exactly as the server measured it
 * (`docs/specs/fund-rolling-returns.md`). Nothing here computes a return: a
 * figure the server withheld renders "n/a" with its reason, never 0%.
 *
 * The response is kept with the security it was asked for (`dataKey`), so a
 * slow answer for the previous security is never shown under the next one.
 */
export function FundRollingReturnsCard({ securityId }: FundRollingReturnsCardProps) {
  const t = useTranslations('securityDetail');
  const { formatSignedPercent, formatPercent, formatNumber } = useNumberFormat();
  const { formatDate } = useDateFormat();
  const headingId = useId();

  const { data, dataKey, isLoading, error, reload } = useReportData<FundRollingReturnsView>(
    () => investmentsApi.getFundRollingReturns(securityId),
    [securityId],
    { requestKey: securityId },
  );

  const current = !isLoading && !error && dataKey === securityId ? data : null;

  // Only an AMFI fund has rolling returns; the page already gates on the scheme
  // code, and the server's own answer is the final word.
  if (current?.eligibility === 'NOT_AN_AMFI_FUND') return null;

  const count = (n: number) => ({ count: n, shown: formatNumber(n, 0) });

  const header = (
    <>
      <h3 id={headingId} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {t('rollingReturns.title')}
      </h3>
      <p className="mb-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {t('rollingReturns.subject')}
      </p>
    </>
  );

  if (!current) {
    return (
      <Card as="section" padding="md" aria-labelledby={headingId} aria-busy={!error}>
        {header}
        {error && !isLoading ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-red-600 dark:text-red-400">
              {t('rollingReturns.loadFailed')}
            </span>
            <Button variant="outline" size="sm" onClick={reload}>
              {t('rollingReturns.retry')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3" aria-hidden="true" data-testid="rolling-returns-loading">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-5 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            ))}
          </div>
        )}
      </Card>
    );
  }

  const { history, periods } = current;
  const periodLabel = (p: RollingPeriodResult) => t(`rollingReturns.periods.${p.period}`);

  const extreme = (label: string, value: RollingReturnExtreme) => (
    <>
      <CellLabel className="sm:hidden">{label}</CellLabel>
      <span className={`font-medium ${gainLossColor(value.returnPct)}`}>
        {formatSignedPercent(value.returnPct)}
      </span>
      <span className="block text-xs text-gray-500 dark:text-gray-400">
        {t('rollingReturns.windowRange', {
          start: formatDate(value.startDate),
          end: formatDate(value.endDate),
        })}
      </span>
    </>
  );

  const statusReason = (p: RollingPeriodResult) => {
    switch (p.status) {
      case 'ALL_WINDOWS_MISSING':
        return t('rollingReturns.status.ALL_WINDOWS_MISSING', count(p.missingWindowCount));
      case 'INSUFFICIENT_HISTORY':
        return t('rollingReturns.status.INSUFFICIENT_HISTORY');
      default:
        return t('rollingReturns.status.NO_PRICE_HISTORY');
    }
  };

  const gapRanges = (p: RollingPeriodResult) => {
    const listed = p.gaps.slice(0, MAX_LISTED_GAPS).map((gap) =>
      t('rollingReturns.gapRange', { from: formatDate(gap.from), to: formatDate(gap.to) }),
    );
    const rest = p.gaps.length - listed.length;
    return rest > 0
      ? [...listed, t('rollingReturns.gapMore', count(rest))].join('; ')
      : listed.join('; ');
  };

  const incomplete = periods.filter((p) => p.status === 'OK' && p.missingWindowCount > 0);
  const notAvailable = t('rollingReturns.notAvailable');

  return (
    <Card as="section" padding="md" aria-labelledby={headingId}>
      {header}

      {incomplete.length > 0 && (
        <div
          role="status"
          className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
        >
          <div className="font-medium">{t('rollingReturns.incompleteHeading')}</div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {incomplete.map((p) => (
              <li key={p.period}>
                {t('rollingReturns.incomplete', {
                  period: periodLabel(p),
                  ...count(p.missingWindowCount),
                  ranges: gapRanges(p),
                })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <table
        role="table"
        aria-labelledby={headingId}
        className={`block sm:table ${TABLE_CLASS}`}
      >
        <thead role="rowgroup" className="hidden sm:table-header-group">
          <tr role="row">
            <th scope="col" className={`${TH_CLASS} text-left`}>
              {t('rollingReturns.columns.period')}
            </th>
            <th scope="col" className={`${TH_CLASS} text-right`}>
              {t('rollingReturns.columns.worst')}
            </th>
            <th scope="col" className={`${TH_CLASS} text-right`}>
              {t('rollingReturns.columns.median')}
            </th>
            <th scope="col" className={`${TH_CLASS} text-right`}>
              {t('rollingReturns.columns.best')}
            </th>
            <th scope="col" className={`${TH_CLASS} text-right`}>
              {t('rollingReturns.columns.positive')}
            </th>
            <th scope="col" className={`${TH_CLASS} text-right`}>
              {t('rollingReturns.columns.windows')}
            </th>
          </tr>
        </thead>
        <tbody
          role="rowgroup"
          className={`block sm:table-row-group ${TABLE_BODY_CLASS}`}
        >
          {periods.map((p) => (
            <tr
              key={p.period}
              role="row"
              data-testid={`rolling-${p.period}`}
              className="grid grid-cols-2 items-start gap-x-4 gap-y-2 py-3 sm:table-row sm:py-0"
            >
              <th
                scope="row"
                role="rowheader"
                className={`${CELL} col-span-2 col-start-1 row-start-1 text-left font-medium text-gray-900 dark:text-gray-100`}
              >
                {periodLabel(p)}{' '}
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  {p.annualized ? t('rollingReturns.perAnnum') : t('rollingReturns.absolute')}
                </span>
              </th>
              {p.status === 'OK' && p.min && p.max && p.median !== null && p.positiveShare !== null ? (
                <>
                  <td role="cell" className={`${FIGURE_CELL} col-start-1 row-start-2`}>
                    {extreme(t('rollingReturns.columns.worst'), p.min)}
                  </td>
                  <td role="cell" className={`${FIGURE_CELL} col-start-1 row-start-3`}>
                    <CellLabel className="sm:hidden">{t('rollingReturns.columns.median')}</CellLabel>
                    <span className={`font-medium ${gainLossColor(p.median)}`}>
                      {formatSignedPercent(p.median)}
                    </span>
                  </td>
                  <td role="cell" className={`${FIGURE_CELL} col-start-2 row-start-2`}>
                    {extreme(t('rollingReturns.columns.best'), p.max)}
                  </td>
                  <td
                    role="cell"
                    className={`${FIGURE_CELL} col-start-2 row-start-3 text-gray-900 dark:text-gray-100`}
                  >
                    <CellLabel className="sm:hidden">{t('rollingReturns.columns.positive')}</CellLabel>
                    {formatPercent(p.positiveShare)}
                  </td>
                  <td
                    role="cell"
                    className={`${FIGURE_CELL} col-span-2 col-start-1 row-start-4 text-gray-900 dark:text-gray-100`}
                  >
                    <CellLabel className="sm:hidden">{t('rollingReturns.columns.windows')}</CellLabel>
                    {formatNumber(p.windowCount, 0)}
                    {p.missingWindowCount > 0 && (
                      <span className="block text-xs text-amber-700 dark:text-amber-400">
                        {t('rollingReturns.missingCount', count(p.missingWindowCount))}
                      </span>
                    )}
                  </td>
                </>
              ) : (
                <td
                  role="cell"
                  colSpan={5}
                  className={`${CELL} col-span-2 col-start-1 row-start-2 text-gray-500 dark:text-gray-400`}
                >
                  <span className="font-medium text-gray-400 dark:text-gray-500">
                    {notAvailable}
                  </span>
                  <span className="ml-2">{statusReason(p)}</span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 text-xs text-gray-500 dark:text-gray-400">
        {history.lastDate &&
          (history.lastIsStale ? (
            <p role="status" className="text-amber-700 dark:text-amber-400">
              {t('rollingReturns.stale', { date: formatDate(history.lastDate) })}
            </p>
          ) : (
            <p>{t('rollingReturns.asOf', { date: formatDate(history.lastDate) })}</p>
          ))}
        {history.excludedObservationCount > 0 && (
          <p>{t('rollingReturns.excluded', count(history.excludedObservationCount))}</p>
        )}
        <p>{t('rollingReturns.basisNote')}</p>
        <p>{t('rollingReturns.idcwNote')}</p>
      </div>
    </Card>
  );
}
