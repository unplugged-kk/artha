'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useNumberFormat } from '@/hooks/useNumberFormat';
import { useFinancialToday } from '@/hooks/useFinancialToday';
import { CARD_CLASS } from '@/components/ui/Card';
import { TABLE_BODY_CLASS } from '@/components/ui/Table';
import { anomaliesApi, AnomalyReport } from '@/lib/anomalies';

type State =
  | { status: 'loading'; day: string }
  | { status: 'failed'; day: string }
  | { status: 'ready'; day: string; report: AnomalyReport };

export function AttentionList() {
  const t = useTranslations('dashboard.attention');
  const { formatCurrency, formatPercent } = useNumberFormat();
  const today = useFinancialToday();
  const [state, setState] = useState<State>({ status: 'loading', day: today });

  useEffect(() => {
    let cancelled = false;
    anomaliesApi
      .get(today)
      .then((report) => {
        if (!cancelled) setState({ status: 'ready', day: today, report });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'failed', day: today });
      });
    return () => {
      cancelled = true;
    };
  }, [today]);

  // A failed lookup is neither a clean bill of health nor an empty list.
  if (state.status === 'loading' || state.day !== today) return null;
  if (state.status === 'failed') {
    return (
      <section aria-label={t('title')} className={`${CARD_CLASS} p-4 sm:p-5 mb-6`}>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('title')}</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('unavailable')}</p>
      </section>
    );
  }

  const { spendingSpikes, subscriptionIncreases } = state.report;
  const empty = spendingSpikes.length === 0 && subscriptionIncreases.length === 0;

  return (
    <section aria-label={t('title')} className={`${CARD_CLASS} p-4 sm:p-5 mb-6`}>
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('title')}</h2>
      {empty ? (
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{t('none')}</p>
      ) : (
        <ul className={`mt-2 ${TABLE_BODY_CLASS}`}>
          {spendingSpikes.map((s) => (
            <li
              key={`spike-${s.categoryId ?? 'none'}-${s.currencyCode}`}
              className="py-2 text-sm text-gray-800 dark:text-gray-200"
            >
              {t('spike', {
                category: s.categoryName ?? t('uncategorized'),
                current: formatCurrency(s.current, s.currencyCode),
                usual: formatCurrency(s.mean, s.currencyCode),
              })}
            </li>
          ))}
          {subscriptionIncreases.map((s) => (
            <li
              key={`sub-${s.payeeId ?? s.payeeName}`}
              className="py-2 text-sm text-gray-800 dark:text-gray-200"
            >
              {t('subscription', {
                payee: s.payeeName,
                percent: formatPercent(s.increasePct, 0),
              })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
