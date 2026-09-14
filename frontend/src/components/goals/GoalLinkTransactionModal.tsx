'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { HOVER_ROW_ON_CARD } from '@/components/ui/Card';
import { Goal } from '@/types/goal';
import { goalsApi } from '@/lib/goals';
import apiClient from '@/lib/api';
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

interface GoalLinkTransactionModalProps {
  isOpen: boolean;
  goal: Goal | null;
  formatCurrency: (amount: number, currency?: string) => string;
  onClose: () => void;
  onUpdated: (updatedGoal: Goal) => void;
}

export function GoalLinkTransactionModal({
  isOpen,
  goal,
  formatCurrency,
  onClose,
  onUpdated,
}: GoalLinkTransactionModalProps) {
  const t = useTranslations('goals');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [linkedTxs, setLinkedTxs] = useState<any[]>([]);
  const [availableTxs, setAvailableTxs] = useState<any[]>([]);
  const [selectedTxId, setSelectedTxId] = useState('');

  const loadData = useCallback(async () => {
    if (!goal) return;
    setLoading(true);
    try {
      const [txsRes, unlinkedRes] = await Promise.all([
        goalsApi.getTransactions(goal.id),
        apiClient.get('/transactions', { params: { limit: 50, type: 'INCOME' } }),
      ]);
      setLinkedTxs(txsRes);
      const currentLinkedIds = new Set(txsRes.map((tx: any) => tx.id));
      const candidates = (unlinkedRes.data?.data || unlinkedRes.data || []).filter(
        (tx: any) => !currentLinkedIds.has(tx.id),
      );
      setAvailableTxs(candidates);
    } catch (err) {
      console.error('Failed to load transactions for goal:', err);
    } finally {
      setLoading(false);
    }
  }, [goal]);

  useEffect(() => {
    if (isOpen && goal) {
      loadData();
      setSelectedTxId('');
    }
  }, [isOpen, goal, loadData]);

  const handleLink = async () => {
    if (!goal || !selectedTxId) return;
    setActionLoading(true);
    try {
      const updated = await goalsApi.linkTransaction(goal.id, selectedTxId);
      onUpdated(updated);
      setSelectedTxId('');
      await loadData();
    } catch (err) {
      console.error('Failed to link transaction:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlink = async (transactionId: string) => {
    if (!goal) return;
    setActionLoading(true);
    try {
      const updated = await goalsApi.unlinkTransaction(goal.id, transactionId);
      onUpdated(updated);
      await loadData();
    } catch (err) {
      console.error('Failed to unlink transaction:', err);
    } finally {
      setActionLoading(false);
    }
  };

  if (!goal) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('actions.manageTransactions')} — ${goal.name}`}
    >
      <div className="space-y-4">
        {/* Link New Transaction */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
            {t('actions.linkTransaction')}
          </label>
          <div className="flex gap-2">
            <select
              value={selectedTxId}
              onChange={(e) => setSelectedTxId(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-1.5 px-3 text-sm focus:border-blue-500 focus:outline-none dark:text-white"
            >
              <option value="">Select a transaction to link...</option>
              {availableTxs.map((tx) => (
                <option key={tx.id} value={tx.id}>
                  {tx.transactionDate} - {tx.payeeName || tx.description || 'Deposit'} ({formatCurrency(tx.amount, tx.currencyCode)})
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              size="sm"
              onClick={handleLink}
              disabled={!selectedTxId || actionLoading}
              isLoading={actionLoading}
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              {t('actions.linkTransaction')}
            </Button>
          </div>
        </div>

        {/* Linked Transactions List */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            {t('progress.linkedTransactions', { count: linkedTxs.length })}
          </h4>

          {loading ? (
            <div className="py-6 text-center text-sm text-gray-500">Loading...</div>
          ) : linkedTxs.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No transactions currently linked.
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-md">
              {linkedTxs.map((tx) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-2.5 text-sm ${HOVER_ROW_ON_CARD}`}
                >
                  <div>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {tx.payeeName || tx.description || 'Deposit'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      {tx.transactionDate}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(tx.amount, tx.currencyCode)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnlink(tx.id)}
                      disabled={actionLoading}
                      className="p-1 h-auto text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      title={t('actions.unlink')}
                      aria-label={t('actions.unlink')}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={onClose}
          >
            {t('actions.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
