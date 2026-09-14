'use client';

import { useTranslations } from 'next-intl';
import {
  PencilSquareIcon,
  TrashIcon,
  LinkIcon,
  BuildingLibraryIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { Goal } from '@/types/goal';
import { CARD_CLASS } from '@/components/ui/Card';

interface GoalCardProps {
  goal: Goal;
  formatCurrency: (amount: number, currency?: string) => string;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onManageTransactions: (goal: Goal) => void;
}

export function GoalCard({
  goal,
  formatCurrency,
  onEdit,
  onDelete,
  onManageTransactions,
}: GoalCardProps) {
  const t = useTranslations('goals');
  const { progress } = goal;

  const getStatusBadge = () => {
    switch (progress.contributionStatus) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">
            {t('progress.statusCompleted')}
          </span>
        );
      case 'DUE_NOW':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
            {t('progress.statusDueNow')}
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
            {t('progress.statusExpired')}
          </span>
        );
      case 'UNAVAILABLE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">
            {t('progress.statusUnavailable')}
          </span>
        );
      case 'ON_TRACK':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
            {t('progress.statusOnTrack')}
          </span>
        );
    }
  };

  const percentage = progress.percentage ?? 0;
  const clampedPercent = Math.min(100, Math.max(0, percentage));

  return (
    <div className={`${CARD_CLASS} p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow`}>
      {/* Header */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {goal.name}
              </h3>
              {goal.type === 'EMERGENCY_FUND' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                  <ShieldCheckIcon className="w-3.5 h-3.5" />
                  {t('fields.typeEmergency')}
                </span>
              )}
            </div>
            {goal.description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                {goal.description}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {getStatusBadge()}
          </div>
        </div>

        {/* Notices */}
        {progress.isFxUnavailable && (
          <div className="mt-3 flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-300">
            <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
            <span>{t('progress.fxUnavailableNotice')}</span>
          </div>
        )}

        {goal.targetMode === 'MONTHS_OF_EXPENSES' && (
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {progress.baselineMonthlyExpense !== null && progress.baselineMonthlyExpense !== undefined ? (
              <span>
                {t('progress.baselineNotice', {
                  months: String(goal.targetMonths),
                  amount: formatCurrency(progress.baselineMonthlyExpense, goal.currency),
                })}
              </span>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded-md bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300">
                <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 text-amber-500" />
                <span>{t('progress.noBudgetNotice')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress metrics */}
      <div className="space-y-3">
        {/* Progress Bar */}
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {progress.currentAmount !== null
                ? formatCurrency(progress.currentAmount, goal.currency)
                : '—'}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {progress.targetAmount !== null
                ? `${t('progress.target')}: ${formatCurrency(progress.targetAmount, goal.currency)}`
                : '—'}
            </span>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                clampedPercent >= 100
                  ? 'bg-green-600 dark:bg-green-500'
                  : 'bg-blue-600 dark:bg-blue-500'
              }`}
              style={{ width: `${clampedPercent}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>
              {progress.percentage !== null
                ? `${progress.percentage.toFixed(1)}%`
                : '—'}
            </span>
            {progress.remainingAmount !== null && progress.remainingAmount > 0 && (
              <span>
                {t('progress.remaining')}: {formatCurrency(progress.remainingAmount, goal.currency)}
              </span>
            )}
          </div>
        </div>

        {/* Contribution Pace */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-sm">
          <div>
            <span className="text-xs text-gray-500 dark:text-gray-400 block">
              {t('progress.requiredMonthly')}
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {progress.requiredMonthlyContribution !== null
                ? `${formatCurrency(progress.requiredMonthlyContribution, goal.currency)}${t('progress.perMonth')}`
                : '—'}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-500 dark:text-gray-400 block">
              {goal.targetDate ? goal.targetDate : t('fields.targetDate')}
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {progress.monthsRemaining !== null
                ? t('progress.monthsLeft', { count: progress.monthsRemaining })
                : '—'}
            </span>
          </div>
        </div>

        {/* Account or Transaction link information */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          {progress.linkedAccount ? (
            <div className="flex items-center gap-1.5 truncate">
              <BuildingLibraryIcon className="w-4 h-4 flex-shrink-0 text-blue-500" />
              <span className="truncate">
                {t('progress.linkedToAccount', {
                  accountName: progress.linkedAccount.name,
                })}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <LinkIcon className="w-4 h-4 flex-shrink-0 text-indigo-500" />
              <span>
                {t('progress.linkedTransactions', {
                  count: progress.linkedTransactionCount ?? 0,
                })}
              </span>
            </div>
          )}

          {!progress.linkedAccount && (
            <button
              onClick={() => onManageTransactions(goal)}
              className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 ml-2 font-medium"
            >
              {t('actions.manageTransactions')}
            </button>
          )}
        </div>
      </div>

      {/* Card Actions */}
      <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end space-x-2">
        <button
          onClick={() => onEdit(goal)}
          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={t('actions.save')}
        >
          <PencilSquareIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(goal)}
          className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title={t('actions.delete')}
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
