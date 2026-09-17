'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Goal, GoalType, GoalStatus, GoalTargetMode } from '@/types/goal';
import { Modal } from '@/components/ui/Modal';
import { NumericInput } from '@/components/ui/NumericInput';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DateInput } from '@/components/ui/DateInput';
import { Button } from '@/components/ui/Button';

interface GoalFormProps {
  isOpen: boolean;
  goal?: Goal | null;
  accounts: Array<{
    id: string;
    name: string;
    currencyCode: string;
    currentBalance: number;
  }>;
  defaultCurrency?: string;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export function GoalForm({
  isOpen,
  goal,
  accounts,
  defaultCurrency = 'USD',
  onClose,
  onSave,
}: GoalFormProps) {
  const t = useTranslations('goals');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<GoalType>('REGULAR');
  const [status, setStatus] = useState<GoalStatus>('ACTIVE');
  const [targetMode, setTargetMode] = useState<GoalTargetMode>('FIXED_AMOUNT');
  const [targetAmount, setTargetAmount] = useState<string>('');
  const [targetMonths, setTargetMonths] = useState<string>('6');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [targetDate, setTargetDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (goal) {
      setName(goal.name);
      setDescription(goal.description || '');
      setType(goal.type);
      setStatus(goal.status);
      setTargetMode(goal.targetMode);
      setTargetAmount(goal.targetAmount ? String(goal.targetAmount) : '');
      setTargetMonths(goal.targetMonths ? String(goal.targetMonths) : '6');
      setCurrency(goal.currency);
      setTargetDate(goal.targetDate || '');
      setAccountId(goal.accountId || '');
    } else {
      setName('');
      setDescription('');
      setType('REGULAR');
      setStatus('ACTIVE');
      setTargetMode('FIXED_AMOUNT');
      setTargetAmount('');
      setTargetMonths('6');
      setCurrency(defaultCurrency);
      setTargetDate('');
      setAccountId('');
    }
    setError(null);
  }, [goal, defaultCurrency, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a goal name');
      return;
    }

    const payload: any = {
      name: name.trim(),
      description: description.trim() || null,
      type,
      currency: currency.trim().toUpperCase(),
      targetDate: targetDate || null,
      accountId: accountId || null,
    };

    if (type === 'EMERGENCY_FUND') {
      payload.targetMode = targetMode;
      if (targetMode === 'MONTHS_OF_EXPENSES') {
        const months = parseFloat(targetMonths);
        if (isNaN(months) || months <= 0) {
          setError('Please specify valid target months (> 0)');
          return;
        }
        payload.targetMonths = months;
        payload.targetAmount = null;
      } else {
        const amount = parseFloat(targetAmount);
        if (isNaN(amount) || amount <= 0) {
          setError('Please specify a valid target amount (> 0)');
          return;
        }
        payload.targetAmount = amount;
        payload.targetMonths = null;
      }
    } else {
      payload.targetMode = 'FIXED_AMOUNT';
      const amount = parseFloat(targetAmount);
      if (isNaN(amount) || amount <= 0) {
        setError('Please specify a valid target amount (> 0)');
        return;
      }
      payload.targetAmount = amount;
      payload.targetMonths = null;
    }

    if (goal) {
      payload.status = status;
    }

    try {
      setLoading(true);
      setError(null);
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to save goal');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (newType: GoalType) => {
    setType(newType);
    if (newType === 'EMERGENCY_FUND') {
      setTargetMode('MONTHS_OF_EXPENSES');
    } else {
      setTargetMode('FIXED_AMOUNT');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={goal ? t('editGoal') : t('newGoal')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300 rounded-md">
            {error}
          </div>
        )}

        {/* Goal Name */}
        <div>
          <label htmlFor="goal-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('fields.name')} *
          </label>
          <input
            id="goal-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('fields.namePlaceholder')}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none dark:text-white"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="goal-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('fields.description')}
          </label>
          <textarea
            id="goal-description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('fields.descriptionPlaceholder')}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none dark:text-white"
          />
        </div>

        {/* Goal Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="goal-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('fields.type')}
            </label>
            <select
              id="goal-type"
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as GoalType)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none dark:text-white"
            >
              <option value="REGULAR">{t('fields.typeRegular')}</option>
              <option value="EMERGENCY_FUND">{t('fields.typeEmergency')}</option>
            </select>
          </div>

          <div>
            <label htmlFor="goal-currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('fields.currency')} *
            </label>
            <input
              id="goal-currency"
              type="text"
              required
              maxLength={3}
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none dark:text-white"
            />
          </div>
        </div>

        {/* Emergency Fund Target Mode */}
        {type === 'EMERGENCY_FUND' && (
          <div>
            <label htmlFor="goal-target-mode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('fields.targetMode')}
            </label>
            <select
              id="goal-target-mode"
              value={targetMode}
              onChange={(e) => setTargetMode(e.target.value as GoalTargetMode)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none dark:text-white"
            >
              <option value="MONTHS_OF_EXPENSES">{t('fields.modeMonths')}</option>
              <option value="FIXED_AMOUNT">{t('fields.modeFixed')}</option>
            </select>
          </div>
        )}

        {/* Target Amount / Target Months */}
        {type === 'EMERGENCY_FUND' && targetMode === 'MONTHS_OF_EXPENSES' ? (
          <div>
            <label htmlFor="goal-target-months" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('fields.targetMonths')} *
            </label>
            <NumericInput
              id="goal-target-months"
              min={1}
              decimalPlaces={0}
              value={targetMonths ? parseFloat(targetMonths) : undefined}
              onChange={(val) => setTargetMonths(val !== undefined ? String(val) : '')}
              placeholder={t('fields.targetMonthsPlaceholder')}
            />
          </div>
        ) : (
          <div>
            <label htmlFor="goal-target-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('fields.targetAmount')} *
            </label>
            <CurrencyInput
              id="goal-target-amount"
              prefix={currency}
              allowNegative={false}
              value={targetAmount ? parseFloat(targetAmount) : undefined}
              onChange={(val) => setTargetAmount(val !== undefined ? String(val) : '')}
            />
          </div>
        )}

        {/* Target Date */}
        <div>
          <label htmlFor="goal-target-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('fields.targetDate')}
          </label>
          <DateInput
            id="goal-target-date"
            value={targetDate}
            onDateChange={(val) => setTargetDate(val)}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>

        {/* Dedicated Account */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('fields.linkedAccount')}
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none dark:text-white"
          >
            <option value="">{t('fields.noLinkedAccount')}</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.currencyCode})
              </option>
            ))}
          </select>
        </div>

        {/* Status (when editing) */}
        {goal && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('fields.status')}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as GoalStatus)}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none dark:text-white"
            >
              <option value="ACTIVE">{t('fields.statusActive')}</option>
              <option value="COMPLETED">{t('fields.statusCompleted')}</option>
              <option value="ARCHIVED">{t('fields.statusArchived')}</option>
            </select>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            {t('actions.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={loading}
          >
            {loading ? t('actions.saving') : t('actions.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
