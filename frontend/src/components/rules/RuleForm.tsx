'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import {
  TransactionRule,
  CreateRuleDto,
  RuleCondition,
  RuleField,
  RuleOperator,
  RuleMatchMode,
} from '@/types/rule';
import { Category } from '@/types/category';

interface RuleFormProps {
  initialData?: TransactionRule | null;
  categories: Category[];
  onSubmit: (data: CreateRuleDto) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const FIELD_OPTIONS: { value: RuleField; labelKey: string }[] = [
  { value: 'payee', labelKey: 'fields.payee' },
  { value: 'memo', labelKey: 'fields.memo' },
  { value: 'amount', labelKey: 'fields.amount' },
  { value: 'paymentMethod', labelKey: 'fields.paymentMethod' },
  { value: 'type', labelKey: 'fields.type' },
];

const STRING_OPERATORS: { value: RuleOperator; labelKey: string }[] = [
  { value: 'CONTAINS', labelKey: 'operators.contains' },
  { value: 'NOT_CONTAINS', labelKey: 'operators.notContains' },
  { value: 'EQUALS', labelKey: 'operators.equals' },
  { value: 'NOT_EQUALS', labelKey: 'operators.notEquals' },
  { value: 'STARTS_WITH', labelKey: 'operators.startsWith' },
  { value: 'ENDS_WITH', labelKey: 'operators.endsWith' },
  { value: 'REGEX', labelKey: 'operators.regex' },
];

const NUMERIC_OPERATORS: { value: RuleOperator; labelKey: string }[] = [
  { value: 'GREATER_THAN', labelKey: 'operators.greaterThan' },
  { value: 'LESS_THAN', labelKey: 'operators.lessThan' },
  { value: 'EQUALS', labelKey: 'operators.equals' },
];

export function RuleForm({
  initialData,
  categories,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: RuleFormProps) {
  const t = useTranslations('rules');
  const tc = useTranslations('common');

  const [name, setName] = useState(initialData?.name ?? '');
  const [matchMode, setMatchMode] = useState<RuleMatchMode>(initialData?.matchMode ?? 'ALL');
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [conditions, setConditions] = useState<RuleCondition[]>(
    initialData?.conditions ?? [
      {
        field: 'payee',
        operator: 'CONTAINS',
        value: '',
      },
    ],
  );
  const [setCategoryId, setSetCategoryId] = useState<string>(
    initialData?.actions.setCategoryId ?? '',
  );
  const [setPayeeName, setSetPayeeName] = useState<string>(
    initialData?.actions.setPayeeName ?? '',
  );
  const [stopProcessing, setStopProcessing] = useState<boolean>(
    initialData?.actions.stopProcessing ?? true,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      {
        field: 'payee',
        operator: 'CONTAINS',
        value: '',
      },
    ]);
  };

  const handleRemoveCondition = (index: number) => {
    if (conditions.length <= 1) return;
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleConditionChange = (
    index: number,
    field: keyof RuleCondition,
    val: any,
  ) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: val };
    // If field changed to amount, adjust default operator
    if (field === 'field') {
      if (val === 'amount') {
        updated[index].operator = 'GREATER_THAN';
        updated[index].value = 0;
      } else if (val === 'type') {
        updated[index].operator = 'EQUALS';
        updated[index].value = 'DEBIT';
      } else {
        updated[index].operator = 'CONTAINS';
        updated[index].value = '';
      }
    }
    setConditions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = t('errors.nameRequired');
    }

    if (conditions.length === 0) {
      newErrors.conditions = t('errors.atLeastOneCondition');
    } else {
      conditions.forEach((c, idx) => {
        if (c.value === '' || c.value === null || c.value === undefined) {
          newErrors[`condition_${idx}`] = t('errors.conditionValueRequired');
        }
      });
    }

    if (!setCategoryId && !setPayeeName.trim()) {
      newErrors.actions = t('errors.atLeastOneAction');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    await onSubmit({
      name: name.trim(),
      matchMode,
      isActive,
      conditions,
      actions: {
        setCategoryId: setCategoryId || null,
        setPayeeName: setPayeeName.trim() || null,
        stopProcessing,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Rule Name & Status */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t('form.ruleName')} *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('form.ruleNamePlaceholder')}
            error={errors.name}
            required
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 p-3 rounded-lg bg-muted/30 border border-border">
          <div>
            <span className="text-sm font-medium text-foreground">
              {t('form.ruleActiveStatus')}
            </span>
            <p className="text-xs text-muted-foreground">
              {t('form.ruleActiveStatusHelp')}
            </p>
          </div>
          <ToggleSwitch
            checked={isActive}
            onChange={setIsActive}
            label={isActive ? t('active') : t('inactive')}
          />
        </div>
      </div>

      {/* Conditions Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-foreground">
            {t('form.conditions')}
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('form.match')}:</span>
            <select
              value={matchMode}
              onChange={(e) => setMatchMode(e.target.value as RuleMatchMode)}
              className="text-xs rounded-md border border-input bg-background px-2 py-1 text-foreground"
            >
              <option value="ALL">{t('form.matchAllConditions')}</option>
              <option value="ANY">{t('form.matchAnyCondition')}</option>
            </select>
          </div>
        </div>

        {errors.conditions && (
          <p className="text-xs text-destructive">{errors.conditions}</p>
        )}

        <div className="space-y-2">
          {conditions.map((cond, idx) => {
            const isNumeric = cond.field === 'amount';
            const isType = cond.field === 'type';
            const operators = isNumeric ? NUMERIC_OPERATORS : STRING_OPERATORS;

            return (
              <div
                key={idx}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-lg bg-card border border-border"
              >
                {/* Field */}
                <select
                  value={cond.field}
                  onChange={(e) =>
                    handleConditionChange(idx, 'field', e.target.value as RuleField)
                  }
                  className="text-sm rounded-md border border-input bg-background px-2.5 py-1.5 text-foreground flex-1 sm:max-w-[140px]"
                >
                  {FIELD_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {t(f.labelKey)}
                    </option>
                  ))}
                </select>

                {/* Operator */}
                {!isType && (
                  <select
                    value={cond.operator}
                    onChange={(e) =>
                      handleConditionChange(idx, 'operator', e.target.value as RuleOperator)
                    }
                    className="text-sm rounded-md border border-input bg-background px-2.5 py-1.5 text-foreground flex-1 sm:max-w-[150px]"
                  >
                    {operators.map((op) => (
                      <option key={op.value} value={op.value}>
                        {t(op.labelKey)}
                      </option>
                    ))}
                  </select>
                )}

                {/* Value */}
                {isType ? (
                  <select
                    value={String(cond.value)}
                    onChange={(e) => handleConditionChange(idx, 'value', e.target.value)}
                    className="text-sm rounded-md border border-input bg-background px-2.5 py-1.5 text-foreground flex-1"
                  >
                    <option value="DEBIT">{t('typeDebitExpense')}</option>
                    <option value="CREDIT">{t('typeCreditIncome')}</option>
                  </select>
                ) : (
                  <input
                    type={isNumeric ? 'number' : 'text'}
                    value={cond.value as string}
                    onChange={(e) =>
                      handleConditionChange(
                        idx,
                        'value',
                        isNumeric ? parseFloat(e.target.value) || 0 : e.target.value,
                      )
                    }
                    placeholder={
                      isNumeric ? '0.00' : t('form.conditionValuePlaceholder')
                    }
                    className={`text-sm rounded-md border bg-background px-2.5 py-1.5 text-foreground flex-1 ${
                      errors[`condition_${idx}`] ? 'border-destructive' : 'border-input'
                    }`}
                  />
                )}

                {/* Remove Condition */}
                <button
                  type="button"
                  disabled={conditions.length <= 1}
                  onClick={() => handleRemoveCondition(idx)}
                  className="p-1.5 rounded text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors self-end sm:self-center"
                  aria-label={t('form.removeCondition')}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddCondition}
          className="w-full mt-2"
        >
          <PlusIcon className="w-4 h-4 mr-1" />
          {t('addCondition')}
        </Button>
      </div>

      {/* Actions Section */}
      <div className="space-y-4 pt-2 border-t border-border">
        <label className="block text-sm font-medium text-foreground">
          {t('form.actionsToApply')}
        </label>

        {errors.actions && (
          <p className="text-xs text-destructive">{errors.actions}</p>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t('form.assignCategory')}
            </label>
            <select
              value={setCategoryId}
              onChange={(e) => setSetCategoryId(e.target.value)}
              className="w-full text-sm rounded-md border border-input bg-background px-3 py-2 text-foreground"
            >
              <option value="">{t('form.selectCategoryPlaceholder')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              {t('form.setPayeeNameOptional')}
            </label>
            <Input
              value={setPayeeName}
              onChange={(e) => setSetPayeeName(e.target.value)}
              placeholder={t('form.setPayeeNamePlaceholder')}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border">
            <div>
              <span className="text-xs font-medium text-foreground">
                {t('form.stopProcessingRules')}
              </span>
              <p className="text-[11px] text-muted-foreground">
                {t('form.stopProcessingRulesHelp')}
              </p>
            </div>
            <ToggleSwitch
              checked={stopProcessing}
              onChange={setStopProcessing}
              label={t('form.stopProcessingRules')}
            />
          </div>
        </div>
      </div>

      {/* Form Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel}>
          {tc('cancel')}
        </Button>
        <Button type="submit" variant="primary" isLoading={isSubmitting}>
          {initialData ? tc('save') : t('createRule')}
        </Button>
      </div>
    </form>
  );
}
