'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { PlusIcon, FlagIcon } from '@heroicons/react/24/outline';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PageLayout } from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { GoalSummaryHeader } from '@/components/goals/GoalSummaryHeader';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalForm } from '@/components/goals/GoalForm';
import { GoalLinkTransactionModal } from '@/components/goals/GoalLinkTransactionModal';
import { goalsApi } from '@/lib/goals';
import { accountsApi } from '@/lib/accounts';
import { Goal, GoalsSummary, GoalStatus, GoalType } from '@/types/goal';
import { useNumberFormat } from '@/hooks/useNumberFormat';

export default function GoalsPage() {
  return (
    <ProtectedRoute>
      <GoalsContent />
    </ProtectedRoute>
  );
}

function GoalsContent() {
  const t = useTranslations('goals');
  const { formatCurrency } = useNumberFormat();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<GoalsSummary | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | GoalStatus>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | GoalType>('ALL');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);
  const [managingGoal, setManagingGoal] = useState<Goal | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [goalsData, summaryData, accountsData] = await Promise.all([
        goalsApi.getAll(),
        goalsApi.getSummary(),
        accountsApi.getAll(),
      ]);
      setGoals(goalsData);
      setSummary(summaryData);
      setAccounts(accountsData);
    } catch (err) {
      console.error('Failed to load goals data:', err);
      toast.error('Failed to load goals');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveGoal = async (data: any) => {
    if (editingGoal) {
      await goalsApi.update(editingGoal.id, data);
      toast.success('Goal updated successfully');
    } else {
      await goalsApi.create(data);
      toast.success('Goal created successfully');
    }
    await loadData();
  };

  const handleDeleteGoal = async () => {
    if (!deletingGoal) return;
    try {
      await goalsApi.delete(deletingGoal.id);
      toast.success('Goal deleted successfully');
      setDeletingGoal(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete goal:', err);
      toast.error('Failed to delete goal');
    }
  };

  const handleGoalUpdated = (updated: Goal) => {
    setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    goalsApi.getSummary().then(setSummary).catch(console.error);
  };

  const filteredGoals = goals.filter((g) => {
    if (statusFilter !== 'ALL' && g.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && g.type !== typeFilter) return false;
    return true;
  });

  return (
    <PageLayout>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button
            onClick={() => {
              setEditingGoal(null);
              setIsFormOpen(true);
            }}
          >
            <PlusIcon className="w-4 h-4 mr-2 inline" />
            {t('newGoal')}
          </Button>
        }
      />

      {isLoading ? (
        <div className="py-24 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          {summary && (
            <GoalSummaryHeader
              summary={summary}
              formatCurrency={(val) => formatCurrency(val)}
            />
          )}

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-gray-200 dark:border-gray-800">
            {/* Status Filter */}
            <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg text-sm">
              {(['ALL', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    statusFilter === s
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {s === 'ALL'
                    ? t('filterAll')
                    : s === 'ACTIVE'
                    ? t('filterActive')
                    : s === 'COMPLETED'
                    ? t('filterCompleted')
                    : t('filterArchived')}
                </button>
              ))}
            </div>

            {/* Type Filter */}
            <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg text-sm">
              {(['ALL', 'REGULAR', 'EMERGENCY_FUND'] as const).map((tp) => (
                <button
                  key={tp}
                  onClick={() => setTypeFilter(tp)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                    typeFilter === tp
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {tp === 'ALL'
                    ? t('filterAll')
                    : tp === 'REGULAR'
                    ? t('filterRegular')
                    : t('filterEmergency')}
                </button>
              ))}
            </div>
          </div>

          {/* Goals Grid */}
          {filteredGoals.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8">
              <FlagIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {t('noGoals')}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                {t('noGoalsDescription')}
              </p>
              <div className="mt-6">
                <Button
                  onClick={() => {
                    setEditingGoal(null);
                    setIsFormOpen(true);
                  }}
                >
                  <PlusIcon className="w-4 h-4 mr-2 inline" />
                  {t('newGoal')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  formatCurrency={(amt, cur) => formatCurrency(amt, cur)}
                  onEdit={(g) => {
                    setEditingGoal(g);
                    setIsFormOpen(true);
                  }}
                  onDelete={(g) => setDeletingGoal(g)}
                  onManageTransactions={(g) => setManagingGoal(g)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Goal Form Modal */}
      <GoalForm
        isOpen={isFormOpen}
        goal={editingGoal}
        accounts={accounts}
        onClose={() => {
          setIsFormOpen(false);
          setEditingGoal(null);
        }}
        onSave={handleSaveGoal}
      />

      {/* Link Transaction Modal */}
      <GoalLinkTransactionModal
        isOpen={!!managingGoal}
        goal={managingGoal}
        formatCurrency={(amt, cur) => formatCurrency(amt, cur)}
        onClose={() => setManagingGoal(null)}
        onUpdated={handleGoalUpdated}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingGoal}
        title={t('deleteGoal')}
        message={t('deleteConfirm')}
        confirmLabel={t('actions.delete')}
        cancelLabel={t('actions.cancel')}
        onConfirm={handleDeleteGoal}
        onCancel={() => setDeletingGoal(null)}
        variant="danger"
      />
    </PageLayout>
  );
}
