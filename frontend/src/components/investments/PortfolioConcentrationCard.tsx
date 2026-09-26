'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import type { ConcentrationMeasure, ConcentrationResult } from '@/types/investment';
import { useNumberFormat } from '@/hooks/useNumberFormat';
import { Card } from '@/components/ui/Card';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { TABLE_CLASS, TABLE_BODY_CLASS, TH_CLASS, TD_CLASS } from '@/components/ui/Table';

interface PortfolioConcentrationCardProps {
  concentration: ConcentrationResult | undefined;
  isLoading: boolean;
  titleSuffix?: string;
}

/**
 * How concentrated the portfolio is, as the server measured it.
 *
 * Every figure here is read from `PortfolioSummary.concentration`, which the
 * server derives from the same allocation slices the allocation chart draws, so
 * this card and the chart beside it cannot disagree. Nothing is recomputed on
 * the client. Both bases are shown side by side -- `holdings` (securities only)
 * and `portfolio` (cash included) -- because each has its own denominator and
 * neither may be read as the other.
 */
export function PortfolioConcentrationCard({
  concentration,
  isLoading,
  titleSuffix,
}: PortfolioConcentrationCardProps) {
  const t = useTranslations('investments');
  const { formatCurrency, formatNumber, formatPercent } = useNumberFormat();
  const headingId = useId();

  // An older backend sends no concentration block: no information, so no card,
  // rather than a card implying the portfolio could not be measured.
  if (!isLoading && !concentration) return null;

  const title = `${t('concentration.title')}${titleSuffix ? ` (${titleSuffix})` : ''}`;

  if (isLoading || !concentration) {
    return (
      <Card as="section" padding="md" aria-labelledby={headingId}>
        <h3 id={headingId} className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {title}
        </h3>
        <div className="space-y-3" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          ))}
        </div>
      </Card>
    );
  }

  const { holdings, portfolio } = concentration;
  const measured = concentration.status !== 'unavailable' && (holdings || portfolio);

  const reasons: string[] = [];
  if (concentration.status === 'partial') {
    if (concentration.unpricedPositions > 0) {
      reasons.push(
        t('concentration.partialUnpriced', { count: concentration.unpricedPositions }),
      );
    }
    if (concentration.missingRatePairs.length > 0) {
      reasons.push(
        t('concentration.partialFx', { pairs: concentration.missingRatePairs.join(', ') }),
      );
    }
  }

  const notAvailable = t('concentration.notAvailable');
  const cell = (
    measure: ConcentrationMeasure | null,
    render: (m: ConcentrationMeasure) => string,
  ) => (measure ? render(measure) : notAvailable);

  const rows: {
    key: string;
    label: string;
    tooltip?: string;
    render: (m: ConcentrationMeasure) => string;
  }[] = [
    {
      key: 'effective',
      label: t('concentration.effectiveHoldings'),
      tooltip: t('concentration.effectiveHoldingsTooltip'),
      render: (m) =>
        t('concentration.effectiveHoldingsValue', {
          effective: formatNumber(m.effectiveHoldings, 1),
          positions: formatNumber(m.positions, 0),
        }),
    },
    {
      key: 'top1',
      label: t('concentration.largestPosition'),
      render: (m) => formatPercent(m.top1Percent, 1),
    },
    {
      key: 'top5',
      label: t('concentration.topFive'),
      render: (m) => formatPercent(m.top5Percent, 1),
    },
    {
      key: 'hhi',
      label: t('concentration.herfindahl'),
      tooltip: t('concentration.herfindahlTooltip'),
      render: (m) => formatNumber(m.herfindahl, 3),
    },
  ];

  // The list names positions, so it reads the securities-only basis; cash is a
  // slice of the portfolio basis, not a position a reader could reduce.
  const largest = holdings?.largest ?? [];

  return (
    <Card as="section" padding="md" aria-labelledby={headingId}>
      <h3 id={headingId} className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {title}
      </h3>

      {!measured ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('concentration.unavailable')}
        </p>
      ) : (
        <>
          {reasons.length > 0 && (
            <div
              role="status"
              className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
            >
              <div className="font-medium">{t('concentration.partialHeading')}</div>
              <ul className="mt-1 list-disc pl-5 space-y-0.5">
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <table className={TABLE_CLASS}>
              <thead>
                <tr>
                  <th scope="col" className={`${TH_CLASS} text-left`}>
                    {t('concentration.measure')}
                  </th>
                  <th scope="col" className={`${TH_CLASS} text-right`}>
                    {t('concentration.holdingsBasis')}
                  </th>
                  <th scope="col" className={`${TH_CLASS} text-right`}>
                    {t('concentration.portfolioBasis')}
                  </th>
                </tr>
              </thead>
              <tbody className={TABLE_BODY_CLASS}>
                {rows.map((row) => (
                  <tr key={row.key} data-testid={`concentration-${row.key}`}>
                    <th scope="row" className={`${TD_CLASS} text-left font-normal`}>
                      <span className="inline-flex items-center">
                        {row.label}
                        {row.tooltip && <InfoTooltip placement="top" text={row.tooltip} />}
                      </span>
                    </th>
                    <td className={`${TD_CLASS} text-right tabular-nums`}>
                      {cell(holdings, row.render)}
                    </td>
                    <td className={`${TD_CLASS} text-right tabular-nums`}>
                      {cell(portfolio, row.render)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {largest.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                  {t('concentration.largestPositions')}
                </div>
                <ol className="space-y-2">
                  {largest.map((position) => (
                    <li
                      key={position.name}
                      data-testid="concentration-position"
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate text-gray-900 dark:text-gray-100">
                        {position.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
                        {formatCurrency(position.value, concentration.currencyCode)}
                        <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                          {formatPercent(position.percent, 1)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
