'use client';

import { useTranslations } from 'next-intl';
import { Card, HOVER_ROW_ON_CARD } from '@/components/ui/Card';
import { BudgetProgressBar } from './BudgetProgressBar';
import { BudgetToleranceIndicator } from './BudgetToleranceIndicator';
import { useNumberFormat } from '@/hooks/useNumberFormat';
import type { BudgetBucketSummaryItem, BudgetBucket } from '@/types/budget';

interface BudgetBucketSummaryProps {
  bucketSummary?: BudgetBucketSummaryItem[];
  formatCurrency: (amount: number, currencyCode?: string) => string;
  selectedBucket?: BudgetBucket | 'UNCLASSIFIED' | null;
  onSelectBucket?: (bucket: BudgetBucket | 'UNCLASSIFIED' | null) => void;
}

const BUCKET_COLORS: Record<string, { badge: string; border: string }> = {
  NEEDS: {
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  WANTS: {
    badge: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
  },
  SAVINGS_INVESTMENTS: {
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  DEBT_SERVICING: {
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
  },
  UNCLASSIFIED: {
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-700',
  },
};

export function BudgetBucketSummary({
  bucketSummary,
  formatCurrency,
  selectedBucket,
  onSelectBucket,
}: BudgetBucketSummaryProps) {
  const t = useTranslations('budgets');
  const { formatPercentTrimmed } = useNumberFormat();

  if (!bucketSummary || bucketSummary.length === 0) {
    return null;
  }

  // Filter out UNCLASSIFIED if it has 0 categories and 0 budgeted/spent
  const visibleBuckets = bucketSummary.filter(
    (b) => b.bucket !== 'UNCLASSIFIED' || b.categoryCount > 0 || b.budgeted > 0 || b.spent > 0,
  );

  return (
    <Card padding="md" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t('bucketSummary.title')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t('bucketSummary.description')}
          </p>
        </div>
        {onSelectBucket && selectedBucket && (
          <button
            type="button"
            onClick={() => onSelectBucket(null)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline self-start sm:self-auto"
          >
            {t('bucketSummary.allBuckets')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {visibleBuckets.map((item) => {
          const isSelected = selectedBucket === item.bucket;
          const colors = BUCKET_COLORS[item.bucket] || BUCKET_COLORS.UNCLASSIFIED;
          const isInteractive = !!onSelectBucket;

          const content = (
            <div
              className={`p-4 rounded-lg border ${
                isSelected
                  ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
                  : HOVER_ROW_ON_CARD
              } ${colors.border}`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${colors.badge} truncate`}>
                    {t(`fourBuckets.${item.bucket}`)}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {t('bucketSummary.categoriesCount', { count: item.categoryCount })}
                  </span>
                </div>
                <BudgetToleranceIndicator
                  status={item.toleranceStatus}
                  varianceRatio={item.varianceRatio}
                  size="sm"
                />
              </div>

              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatCurrency(item.spent)}
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
                    / {formatCurrency(item.budgeted)}
                  </span>
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {formatPercentTrimmed(Math.round(item.percentUsed))}
                </span>
              </div>

              <BudgetProgressBar
                percentUsed={item.percentUsed}
              />

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
                <span>
                  {item.remaining >= 0
                    ? t('bucketSummary.remaining', { amount: formatCurrency(item.remaining) })
                    : t('categoryRow.over', { amount: formatCurrency(Math.abs(item.remaining)) })}
                </span>
                {item.varianceRatio != null && (
                  <span className={item.varianceRatio > 0.05 ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                    {t('bucketSummary.variance', {
                      variance: `${item.varianceRatio > 0 ? '+' : ''}${formatPercentTrimmed(
                        Math.round(item.varianceRatio * 100),
                      )}`,
                    })}
                  </span>
                )}
              </div>
            </div>
          );

          if (isInteractive) {
            return (
              <button
                key={item.bucket}
                type="button"
                className="text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
                onClick={() => onSelectBucket(isSelected ? null : item.bucket)}
              >
                {content}
              </button>
            );
          }

          return <div key={item.bucket}>{content}</div>;
        })}
      </div>
    </Card>
  );
}
