'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
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
  const [linkedTxs, setLinkedTxs] = useState<any[]>([]);
  const [availableTxs, setAvailableTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTxId, setSelectedTxId] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!goal) return;
    setLoading(true);
    try {
      const [linked, allTxsResponse] = await Promise.all([
        goalsApi.getTransactions(goal.id),
        apiClient.get('/transactions', { params: { limit: 50 } }),
      ]);
      setLinkedTxs(linked || []);

      const linkedIds = new Set((linked || []).map((t: any) => t.id));
      const candidates = (allTxsResponse.data?.data || allTxsResponse.data || [])
        .filter((tx: any) => !linkedIds.has(tx.id) && tx.amount > 0);
      setAvailableTxs(candidates);
    } catch (err) {
      console.error('Failed to load goal transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [goal]);

  useEffect(() => {
    if (isOpen && goal) {
      loadData();
    }
  }, [isOpen, goal, loadData]);

  const handleLink = async () => {
    if (!goal || !selectedTxId) return;
    setActionLoading(true);
    try {
      const updated = await goalsApi.linkTransaction(goal.id, selectedTxId);
      setSelectedTxId('');
      onUpdated(updated);
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
            <button
              onClick={handleLink}
              disabled={!selectedTxId || actionLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              {t('actions.linkTransaction')}
            </button>
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
                  className="flex items-center justify-between p-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/40"
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
                    <button
                      onClick={() => handleUnlink(tx.id)}
                      disabled={actionLoading}
                      className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                      title={t('actions.unlink')}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
          >
            {t('actions.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
