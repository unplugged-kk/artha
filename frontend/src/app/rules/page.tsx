'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  SparklesIcon,
  CheckCircleIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { PageLayout } from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { SummaryCard } from '@/components/ui/SummaryCard';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { RuleList } from '@/components/rules/RuleList';
import { RuleForm } from '@/components/rules/RuleForm';
import { RuleTestModal } from '@/components/rules/RuleTestModal';
import { ApplyRulesModal } from '@/components/rules/ApplyRulesModal';
import { rulesApi } from '@/lib/rules';
import { categoriesApi } from '@/lib/categories';
import { TransactionRule, CreateRuleDto } from '@/types/rule';
import { Category } from '@/types/category';

export default function RulesPage() {
  return (
    <ProtectedRoute>
      <RulesContent />
    </ProtectedRoute>
  );
}

function RulesContent() {
  const t = useTranslations('rules');
  const tc = useTranslations('common');

  const [rules, setRules] = useState<TransactionRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TransactionRule | null>(null);
  const [testingRule, setTestingRule] = useState<TransactionRule | null>(null);
  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [deletingRule, setDeletingRule] = useState<TransactionRule | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rulesData, categoriesData] = await Promise.all([
        rulesApi.getAll(),
        categoriesApi.getAll(),
      ]);
      setRules(rulesData);
      setCategories(categoriesData);
    } catch {
      toast.error(t('errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreate = () => {
    setEditingRule(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (rule: TransactionRule) => {
    setEditingRule(rule);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (data: CreateRuleDto) => {
    setIsSubmitting(true);
    try {
      if (editingRule) {
        await rulesApi.update(editingRule.id, data);
        toast.success(t('messages.ruleUpdated'));
      } else {
        await rulesApi.create(data);
        toast.success(t('messages.ruleCreated'));
      }
      setIsFormOpen(false);
      setEditingRule(null);
      await loadData();
    } catch {
      toast.error(t('errors.saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRule) return;
    try {
      await rulesApi.delete(deletingRule.id);
      toast.success(t('messages.ruleDeleted'));
      setDeletingRule(null);
      await loadData();
    } catch {
      toast.error(t('errors.deleteFailed'));
    }
  };

  const handleToggleActive = async (rule: TransactionRule) => {
    try {
      const updated = await rulesApi.update(rule.id, {
        isActive: !rule.isActive,
      });
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success(
        updated.isActive
          ? t('messages.ruleActivated')
          : t('messages.ruleDeactivated'),
      );
    } catch {
      toast.error(t('errors.toggleFailed'));
    }
  };

  const handleMove = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= rules.length) return;
    const reordered = [...rules];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    // Optimistic local update
    setRules(reordered);

    try {
      const ruleIds = reordered.map((r) => r.id);
      await rulesApi.reorder({ ruleIds });
    } catch {
      toast.error(t('errors.reorderFailed'));
      await loadData();
    }
  };

  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <PageLayout>
      <PageHeader
        title={t('pageTitle')}
        subtitle={t('pageDescription')}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsApplyOpen(true)}
              disabled={activeCount === 0}
            >
              <SparklesIcon className="w-4 h-4 mr-1.5 text-primary" />
              {t('applyRulesButton')}
            </Button>

            <Button variant="primary" size="sm" onClick={handleOpenCreate}>
              <PlusIcon className="w-4 h-4 mr-1.5" />
              {t('createNewRule')}
            </Button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard
          label={t('totalRules')}
          value={rules.length}
          hint={t('totalRulesSubtitle')}
          icon={<AdjustmentsHorizontalIcon className="h-6 w-6 text-gray-400 dark:text-gray-500" />}
        />
        <SummaryCard
          label={t('activeRules')}
          value={activeCount}
          hint={t('activeRulesSubtitle')}
          icon={<CheckCircleIcon className="h-6 w-6 text-green-400" />}
        />
        <SummaryCard
          label={t('executionOrder')}
          value={t('priorityAscending')}
          hint={t('executionOrderSubtitle')}
          icon={<SparklesIcon className="h-6 w-6 text-blue-400" />}
        />
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <RuleList
          rules={rules}
          onEdit={handleOpenEdit}
          onDelete={setDeletingRule}
          onTest={setTestingRule}
          onToggleActive={handleToggleActive}
          onMoveUp={(idx) => handleMove(idx, idx - 1)}
          onMoveDown={(idx) => handleMove(idx, idx + 1)}
          onCreateNew={handleOpenCreate}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          if (!isSubmitting) {
            setIsFormOpen(false);
            setEditingRule(null);
          }
        }}
        title={editingRule ? t('editRule') : t('createNewRule')}
        maxWidth="lg"
      >
        <RuleForm
          initialData={editingRule}
          categories={categories}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingRule(null);
          }}
          isSubmitting={isSubmitting}
        />
      </Modal>

      {/* Test Rule Modal */}
      <RuleTestModal
        rule={testingRule}
        isOpen={!!testingRule}
        onClose={() => setTestingRule(null)}
      />

      {/* Apply Rules Modal */}
      <ApplyRulesModal
        isOpen={isApplyOpen}
        onClose={() => setIsApplyOpen(false)}
        onSuccess={() => {
          setIsApplyOpen(false);
          toast.success(t('messages.rulesAppliedSuccess'));
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingRule}
        onCancel={() => setDeletingRule(null)}
        onConfirm={handleDelete}
        title={t('deleteRuleTitle')}
        message={t('deleteRuleConfirm', {
          name: deletingRule?.name ?? '',
        })}
        confirmLabel={tc('delete')}
        cancelLabel={tc('cancel')}
        variant="danger"
      />
    </PageLayout>
  );
}
