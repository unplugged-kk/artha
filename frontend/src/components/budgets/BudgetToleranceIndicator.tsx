'use client';

import { useTranslations } from 'next-intl';
import type { BudgetToleranceStatus } from '@/types/budget';
import { useNumberFormat } from '@/hooks/useNumberFormat';

interface BudgetToleranceIndicatorProps {
  status?: BudgetToleranceStatus;
  varianceRatio?: number | null;
  size?: 'sm' | 'md';
  className?: string;
}

export function BudgetToleranceIndicator({
  status = 'NOT_APPLICABLE',
  varianceRatio,
  size = 'sm',
  className = '',
}: BudgetToleranceIndicatorProps) {
  const t = useTranslations('budgets');
  const { formatPercentTrimmed } = useNumberFormat();

  const formattedVariance =
    varianceRatio != null && Number.isFinite(varianceRatio)
      ? `${varianceRatio > 0 ? '+' : ''}${formatPercentTrimmed(Math.round(varianceRatio * 100))}`
      : null;

  switch (status) {
    case 'UNDER_BUDGET':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full ${
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
          } bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 ${className}`}
          role="status"
          aria-label={t('tolerance.underBudget')}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-600 dark:bg-green-400" aria-hidden="true" />
          <span>{t('tolerance.onTarget')}</span>
        </span>
      );

    case 'WITHIN_TOLERANCE':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full ${
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
          } bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 ${className}`}
          role="status"
          aria-label={t('tolerance.withinTolerance')}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400" aria-hidden="true" />
          <span>{t('tolerance.withinTolerance')}</span>
          {formattedVariance && (
            <span className="text-amber-700 dark:text-amber-300 ml-0.5">
              ({formattedVariance})
            </span>
          )}
        </span>
      );

    case 'OVER_TOLERANCE':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full ${
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
          } bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 ${className}`}
          role="status"
          aria-label={t('tolerance.overTolerance')}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 dark:bg-red-400" aria-hidden="true" />
          <span>{t('tolerance.overTolerance')}</span>
          {formattedVariance && (
            <span className="text-red-700 dark:text-red-300 ml-0.5">
              ({formattedVariance})
            </span>
          )}
        </span>
      );

    case 'NOT_APPLICABLE':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-full ${
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
          } bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 ${className}`}
          role="status"
          aria-label={t('tolerance.notApplicable')}
        >
          <span>{t('tolerance.notApplicable')}</span>
        </span>
      );
  }
}
