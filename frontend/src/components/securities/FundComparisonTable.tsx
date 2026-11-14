'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  CellLabel,
  TABLE_BODY_CLASS,
  TABLE_CLASS,
  TH_CLASS,
} from '@/components/ui/Table';
import { useDateFormat } from '@/hooks/useDateFormat';
import { useNumberFormat } from '@/hooks/useNumberFormat';
import { useReportData } from '@/hooks/useReportData';
import { investmentsApi } from '@/lib/investments';
import { gainLossColor } from '@/lib/format';
import type {
  FundComparisonMember,
  FundComparisonView,
  RollingPeriodResult,
} from '@/types/investment';

interface FundComparisonTableProps {
  /**
   * The selected security ids, in the order the reader picked them. The API
   * accepts 2..20 and answers 404 for one the caller does not own, so the
   * caller is responsible for staying inside that range.
   */
  securityIds: string[];
  /** Bumped by a manual price refresh so the distributions are re-read. */
  reloadKey?: number;
}

/**
 * The `funds/comparison` read, rendered from the caller's own selection.
 *
 * Nothing here computes a return. Every figure is the server's
 * `computeRollingReturns` output, so the comparison cannot drift from the
 * rolling-return card beside it (INV-FUNDCMP-001). Grouping is the server's
 * too: the AMFI category is provider-owned classification metadata, and a
 * client-side regroup would be a second taxonomy that could disagree with the
 * API (INV-FUNDCAT-001, INV-FUNDCMP-002). Nothing is ranked, scored or
 * recommended -- there is no peer universe, only the funds the reader owns.
 *
 * The response is kept with the selection it was asked for (`dataKey`), so a
 * slow answer for a previous selection is never shown under the next one.
 */
export function FundComparisonTable({
  securityIds,
  reloadKey = 0,
}: FundComparisonTableProps) {
  const t = useTranslations('reports');
  const { formatSignedPercent, formatNumber } = useNumberFormat();
  const { formatDate } = useDateFormat();
  const headingId = useId();

  const requestKey = `${securityIds.join(',')}|${reloadKey}`;
  const { data, dataKey, isLoading, error, reload } =
    useReportData<FundComparisonView>(
      () => investmentsApi.getFundComparison(securityIds),
      [requestKey],
      { requestKey },
    );

  const current = !isLoading && !error && dataKey === requestKey ? data : null;

  const header = (
    <>
      <h3
        id={headingId}
        className="text-lg font-semibold text-gray-900 dark:text-gray-100"
      >
        {t('securityPerformance.fundComparison.title')}
      </h3>
      <p className="mb-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {t('securityPerformance.fundComparison.subject')}
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
              {t('securityPerformance.fundComparison.loadFailed')}
            </span>
            <Button variant="outline" size="sm" onClick={reload}>
              {t('securityPerformance.fundComparison.retry')}
            </Button>
          </div>
        ) : (
          <div
            className="space-y-3"
            aria-hidden="true"
            data-testid="fund-comparison-loading"
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-6 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
              />
            ))}
          </div>
        )}
      </Card>
    );
  }

  const { members, groups, periods } = current;
  const byId = new Map(members.map((member) => [member.securityId, member]));
  const deduplicated = members.some((member) => member.deduplicated);
  const uncontested = members.filter(
    (member) => member.eligibility === 'NOT_AN_AMFI_FUND',
  );

  if (members.length === 0) {
    return (
      <Card as="section" padding="md" aria-labelledby={headingId}>
        {header}
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('securityPerformance.fundComparison.noData')}
        </p>
      </Card>
    );
  }

  const periodLabel = (period: RollingPeriodResult['period']) =>
    t(`securityPerformance.fundComparison.periods.${period}`);

  const statusReason = (period: RollingPeriodResult) => {
    switch (period.status) {
      case 'INSUFFICIENT_HISTORY':
        return t('securityPerformance.fundComparison.status.INSUFFICIENT_HISTORY');
      case 'ALL_WINDOWS_MISSING':
        return t('securityPerformance.fundComparison.status.ALL_WINDOWS_MISSING');
      default:
        return t('securityPerformance.fundComparison.status.NO_PRICE_HISTORY');
    }
  };

  const count = (n: number) => ({ count: n, shown: formatNumber(n, 0) });

  const fundIdentity = (member: FundComparisonMember) => (
    <>
      <span className="block font-medium text-gray-900 dark:text-gray-100">
        {member.symbol}
      </span>
      <span className="block text-sm text-gray-700 dark:text-gray-300">
        {member.name}
      </span>
      {(member.fundHouse || member.fundSchemeType) && (
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {[member.fundHouse, member.fundSchemeType].filter(Boolean).join(' · ')}
        </span>
      )}
      {member.eligibility === 'ELIGIBLE' ? (
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {member.history.lastDate === null ? (
            t('securityPerformance.fundComparison.noPriceHistory')
          ) : member.history.lastIsStale ? (
            <span className="text-amber-700 dark:text-amber-400">
              {t('securityPerformance.fundComparison.stale', {
                date: formatDate(member.history.lastDate),
              })}
            </span>
          ) : (
            t('securityPerformance.fundComparison.asOf', {
              date: formatDate(member.history.lastDate),
            })
          )}
          {member.history.excludedObservationCount > 0 && (
            <>
              {' '}
              {t('securityPerformance.fundComparison.excludedObservations', {
                ...count(member.history.excludedObservationCount),
              })}
            </>
          )}
        </span>
      ) : (
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {t('securityPerformance.fundComparison.reason.NOT_AN_AMFI_FUND')}
        </span>
      )}
    </>
  );

  const periodCell = (member: FundComparisonMember, period: RollingPeriodResult['period']) => {
    if (member.eligibility === 'NOT_AN_AMFI_FUND') return null;
    const result = member.periods.find((p) => p.period === period);
    if (!result) return null;
    if (
      result.status !== 'OK' ||
      result.median === null ||
      result.min === null ||
      result.max === null
    ) {
      return (
        <>
          <CellLabel className="sm:hidden">{periodLabel(period)}</CellLabel>
          <span className="block font-medium text-gray-400 dark:text-gray-500">
            {t('securityPerformance.fundComparison.notAvailable')}
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            {statusReason(result)}
          </span>
        </>
      );
    }
    return (
      <>
        <CellLabel className="sm:hidden">{periodLabel(period)}</CellLabel>
        <span className={`block font-medium ${gainLossColor(result.median)}`}>
          {formatSignedPercent(result.median)}
        </span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {t('securityPerformance.fundComparison.range', {
            worst: formatSignedPercent(result.min.returnPct),
            best: formatSignedPercent(result.max.returnPct),
          })}
        </span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {t('securityPerformance.fundComparison.windows', count(result.windowCount))}
          {result.missingWindowCount > 0 && (
            <span className="block text-amber-700 dark:text-amber-400">
              {t(
                'securityPerformance.fundComparison.missingWindows',
                count(result.missingWindowCount),
              )}
            </span>
          )}
        </span>
      </>
    );
  };

  return (
    <Card
      as="section"
      padding="md"
      aria-labelledby={headingId}
      data-testid="fund-comparison"
    >
      {header}

      {current.status === 'incomplete' && (
        <div
          role="status"
          className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
        >
          {t('securityPerformance.fundComparison.incomplete')}
        </div>
      )}

      {deduplicated && (
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {t('securityPerformance.fundComparison.deduplicated')}
        </p>
      )}

      {uncontested.length > 0 && (
        <ul className="mb-4 list-disc space-y-1 pl-5 text-xs text-gray-500 dark:text-gray-400">
          {uncontested.map((member) => (
            <li key={member.securityId}>
              {t('securityPerformance.fundComparison.excludedMember', {
                fund: member.symbol,
              })}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-6">
        {groups.map((group) => {
          const groupMembers = group.securityIds
            .map((id) => byId.get(id))
            .filter((member): member is FundComparisonMember => member !== undefined);
          if (groupMembers.length === 0) return null;
          const label =
            group.category ??
            t('securityPerformance.fundComparison.uncategorised');
          return (
            <section
              key={group.category ?? '__uncategorised__'}
              aria-label={label}
              data-testid={`fund-group-${group.category ?? 'uncategorised'}`}
            >
              <h4 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {label}
              </h4>
              {group.category === null && (
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  {t('securityPerformance.fundComparison.uncategorisedReason')}
                </p>
              )}
              <table
                role="table"
                aria-label={label}
                className={`block sm:table ${TABLE_CLASS}`}
              >
                <thead role="rowgroup" className="hidden sm:table-header-group">
                  <tr role="row">
                    <th scope="col" className={`${TH_CLASS} text-left`}>
                      {t('securityPerformance.fundComparison.columns.fund')}
                    </th>
                    {periods.map((period) => (
                      <th
                        key={period}
                        scope="col"
                        className={`${TH_CLASS} text-right`}
                      >
                        {periodLabel(period)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody
                  role="rowgroup"
                  className={`block sm:table-row-group ${TABLE_BODY_CLASS}`}
                >
                  {groupMembers.map((member) => (
                    <tr
                      key={member.securityId}
                      role="row"
                      data-testid={`fund-comparison-${member.securityId}`}
                      className="grid grid-cols-3 items-start gap-x-4 gap-y-2 py-3 sm:table-row sm:py-0"
                    >
                      <th
                        scope="row"
                        role="rowheader"
                        className="col-span-3 p-0 text-left text-sm sm:table-cell sm:px-4 sm:py-3"
                      >
                        {fundIdentity(member)}
                      </th>
                      {member.eligibility === 'NOT_AN_AMFI_FUND' ? (
                        <td
                          role="cell"
                          colSpan={periods.length}
                          className="col-span-3 p-0 text-xs text-gray-500 dark:text-gray-400 sm:table-cell sm:px-4 sm:py-3 sm:text-right"
                        >
                          {t(
                            'securityPerformance.fundComparison.reason.NOT_AN_AMFI_FUND',
                          )}
                        </td>
                      ) : (
                        periods.map((period) => (
                          <td
                            key={period}
                            role="cell"
                            className="p-0 text-sm tabular-nums sm:table-cell sm:px-4 sm:py-3 sm:text-right"
                          >
                            {periodCell(member, period)}
                          </td>
                        ))
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>

      <div className="mt-4 space-y-1 text-xs text-gray-500 dark:text-gray-400">
        <p>{t('securityPerformance.fundComparison.basisNote')}</p>
        <p>{t('securityPerformance.fundComparison.idcwNote')}</p>
        <p>{t('securityPerformance.fundComparison.classificationNote')}</p>
        <p>{t('securityPerformance.fundComparison.ownFundsNote')}</p>
      </div>
    </Card>
  );
}
