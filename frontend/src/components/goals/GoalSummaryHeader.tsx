'use client';

import { useTranslations } from 'next-intl';
import { SummaryCard, SummaryIcons } from '@/components/ui/SummaryCard';
import { GoalsSummary } from '@/types/goal';

interface GoalSummaryHeaderProps {
  summary: GoalsSummary;
  formatCurrency: (amount: number) => string;
}

export function GoalSummaryHeader({
  summary,
  formatCurrency,
}: GoalSummaryHeaderProps) {
  const t = useTranslations('goals');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <SummaryCard
        label={t('summary.totalGoals')}
        value={summary.totalGoals}
        icon={SummaryIcons.clipboard}
        valueColor="default"
      />
      <SummaryCard
        label={t('summary.activeGoals')}
        value={summary.activeGoals}
        icon={SummaryIcons.checkmark}
        valueColor="blue"
      />
      <SummaryCard
        label={t('summary.completedGoals')}
        value={summary.completedGoals}
        icon={SummaryIcons.checkCircle}
        valueColor="green"
      />
      <SummaryCard
        label={t('summary.totalTarget')}
        value={formatCurrency(summary.totalTargetAmount)}
        icon={SummaryIcons.money}
        valueColor="default"
      />
      <SummaryCard
        label={t('summary.totalSaved')}
        value={formatCurrency(summary.totalCurrentAmount)}
        icon={SummaryIcons.plusCircle}
        valueColor="green"
      />
    </div>
  );
}
