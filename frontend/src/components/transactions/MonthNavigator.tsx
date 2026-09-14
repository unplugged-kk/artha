'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useDateFormat } from '@/hooks/useDateFormat';
import { HOVER_ROW_ON_PAGE } from '@/components/ui/Card';

/**
 * Month-browsing for the register.
 *
 * The bounds are computed with UTC arithmetic on the `YYYY-MM` key rather than
 * through a Date in local time, so the first and last day of a month cannot
 * shift by a day for a user whose timezone is behind or ahead of the browser's
 * default -- the dates here are compared as strings against stored transaction
 * dates, and an off-by-one would silently drop a day from the month.
 */
export function monthBounds(
  monthKey: string,
): { startDate: string; endDate: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  // Day 0 of the following month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${match[1]}-${match[2]}-01`,
    endDate: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`,
  };
}

/** Moves a `YYYY-MM` key by whole months, in either direction. */
export function shiftMonth(monthKey: string, delta: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const total = Number(match[1]) * 12 + (Number(match[2]) - 1) + delta;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}`;
}

/** The user's own current month, `YYYY-MM`, read in local time. */
export function currentMonthKey(now: Date = new Date()): string {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(
    now.getMonth() + 1,
  ).padStart(2, '0')}`;
}

interface MonthNavigatorProps {
  /** The month on screen, `YYYY-MM`. */
  month: string;
  /** The user's own current month, `YYYY-MM`. */
  currentMonth: string;
  onSelectMonth: (monthKey: string) => void;
}

export function MonthNavigator({
  month,
  currentMonth,
  onSelectMonth,
}: MonthNavigatorProps) {
  const t = useTranslations('transactions');
  const { formatMonth } = useDateFormat();
  const isCurrentMonth = month === currentMonth;

  const arrowClass =
    `p-1.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 ${HOVER_ROW_ON_PAGE} focus-visible:outline-2 focus-visible:outline-blue-500`;

  return (
    <div className="flex items-center gap-2" data-testid="month-navigator">
      <button
        type="button"
        onClick={() => onSelectMonth(shiftMonth(month, -1))}
        className={arrowClass}
        aria-label={t('list.monthNav.previous')}
        title={t('list.monthNav.previous')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <span
        className="text-sm font-medium text-gray-900 dark:text-gray-100 tabular-nums"
        aria-live="polite"
      >
        {formatMonth(month)}
      </span>

      <button
        type="button"
        onClick={() => onSelectMonth(shiftMonth(month, 1))}
        className={arrowClass}
        aria-label={t('list.monthNav.next')}
        title={t('list.monthNav.next')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Offered only when it would do something: a "this month" button that is
          already showing this month is a control that cannot act. */}
      {!isCurrentMonth && (
        <button
          type="button"
          onClick={() => onSelectMonth(currentMonth)}
          className="ml-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded focus-visible:outline-2 focus-visible:outline-blue-500"
        >
          {t('list.monthNav.thisMonth')}
        </button>
      )}
    </div>
  );
}
