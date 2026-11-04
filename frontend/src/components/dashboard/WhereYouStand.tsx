'use client';

import { useTranslations } from 'next-intl';
import { useNumberFormat } from '@/hooks/useNumberFormat';
import { useFinancialToday } from '@/hooks/useFinancialToday';
import { CARD_CLASS } from '@/components/ui/Card';
import { gainLossColor } from '@/lib/format';
import { nextOccurrenceDueDate } from '@/lib/scheduled-effective-amount';
import { addDaysYmd, summarizeStanding } from '@/lib/where-you-stand';
import { MonthlyNetWorth } from '@/types/net-worth';
import { ScheduledTransaction } from '@/types/scheduled-transaction';

interface Props {
  netWorthData: MonthlyNetWorth[];
  scheduledTransactions: ScheduledTransaction[];
  isLoading: boolean;
}

const FIGURE = 'text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-100';
const LABEL = 'text-sm text-gray-600 dark:text-gray-300';

export function WhereYouStand({ netWorthData, scheduledTransactions, isLoading }: Props) {
  const t = useTranslations('dashboard.standing');
  const { formatCurrency } = useNumberFormat();
  const today = useFinancialToday();

  if (isLoading) return null;

  const standing = summarizeStanding(netWorthData);
  const horizon = addDaysYmd(today, 7);
  const dueSoon = scheduledTransactions.filter((st) => {
    if (!st.isActive || st.isTransfer) return false;
    const due = nextOccurrenceDueDate(st);
    return due >= today && due <= horizon;
  }).length;

  return (
    <section aria-label={t('title')} className={`${CARD_CLASS} p-4 sm:p-5 mb-6`}>
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <dt className={LABEL}>{t('netWorth')}</dt>
          <dd className={FIGURE}>
            {standing ? formatCurrency(standing.netWorth) : t('unavailable')}
          </dd>
          {standing?.change !== null && standing?.change !== undefined && (
            <dd className={`text-sm tabular-nums ${gainLossColor(standing.change)}`}>
              {standing.change >= 0
                ? t('changeUp', { amount: formatCurrency(Math.abs(standing.change)) })
                : t('changeDown', { amount: formatCurrency(Math.abs(standing.change)) })}
            </dd>
          )}
        </div>
        <div>
          <dt className={LABEL}>{t('assetsAndDebts')}</dt>
          <dd className={FIGURE}>
            {standing ? formatCurrency(standing.assets) : t('unavailable')}
          </dd>
          {standing && (
            <dd className={LABEL}>
              {t('liabilities', { amount: formatCurrency(standing.liabilities) })}
            </dd>
          )}
        </div>
        <div>
          <dt className={LABEL}>{t('dueSoon')}</dt>
          <dd className={FIGURE}>{dueSoon}</dd>
          <dd className={LABEL}>{t('dueSoonHint', { count: dueSoon })}</dd>
        </div>
      </dl>
    </section>
  );
}
