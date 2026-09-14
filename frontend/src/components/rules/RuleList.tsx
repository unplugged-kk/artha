'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  PencilIcon,
  TrashIcon,
  BeakerIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { EmptyState } from '@/components/ui/EmptyState';
import { TransactionRule } from '@/types/rule';

interface RuleListProps {
  rules: TransactionRule[];
  onEdit: (rule: TransactionRule) => void;
  onDelete: (rule: TransactionRule) => void;
  onTest: (rule: TransactionRule) => void;
  onToggleActive: (rule: TransactionRule) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onCreateNew: () => void;
}

export function RuleList({
  rules,
  onEdit,
  onDelete,
  onTest,
  onToggleActive,
  onMoveUp,
  onMoveDown,
  onCreateNew,
}: RuleListProps) {
  const t = useTranslations('rules');
  const tc = useTranslations('common');

  if (rules.length === 0) {
    return (
      <EmptyState
        icon={<SparklesIcon className="w-12 h-12" />}
        title={t('emptyState.title')}
        description={t('emptyState.description')}
        action={
          <Button variant="primary" onClick={onCreateNew}>
            {t('createNewRule')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {rules.map((rule, index) => (
        <div
          key={rule.id}
          className={`p-4 rounded-xl border transition-all duration-150 ${
            rule.isActive
              ? 'bg-card border-border shadow-xs'
              : 'bg-muted/40 border-dashed border-border/70 opacity-70'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Left: Reorder & Name */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onMoveUp(index)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  aria-label={t('moveUp')}
                >
                  <ChevronUpIcon className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-medium text-muted-foreground">
                  #{index + 1}
                </span>
                <button
                  type="button"
                  disabled={index === rules.length - 1}
                  onClick={() => onMoveDown(index)}
                  className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  aria-label={t('moveDown')}
                >
                  <ChevronDownIcon className="w-4 h-4" />
                </button>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-medium text-foreground text-sm sm:text-base">
                    {rule.name}
                  </h3>
                  <Badge variant={rule.matchMode === 'ALL' ? 'blue' : 'gray'} size="sm">
                    {rule.matchMode === 'ALL' ? t('matchAll') : t('matchAny')}
                  </Badge>
                </div>

                {/* Conditions summary */}
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  {rule.conditions.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground border border-border"
                    >
                      <span className="font-semibold text-foreground/80">{c.field}</span>
                      <span>{c.operator.toLowerCase()}</span>
                      <span className="font-mono text-primary font-medium">
                        "{Array.isArray(c.value) ? c.value.join(' - ') : String(c.value)}"
                      </span>
                    </span>
                  ))}
                </div>

                {/* Actions summary */}
                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/70">{t('actionLabel')}:</span>
                  {rule.actions.setCategoryId && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      {t('assignCategory')}
                    </span>
                  )}
                  {rule.actions.setPayeeName && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
                      {t('setPayee')}: {rule.actions.setPayeeName}
                    </span>
                  )}
                  {rule.actions.stopProcessing && (
                    <span className="text-[11px] italic text-muted-foreground">
                      ({t('stopProcessing')})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              <ToggleSwitch
                checked={rule.isActive}
                onChange={() => onToggleActive(rule)}
                label={rule.isActive ? t('active') : t('inactive')}
              />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onTest(rule)}
                title={t('testRule')}
                aria-label={t('testRule')}
              >
                <BeakerIcon className="w-4 h-4 text-primary" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(rule)}
                title={tc('edit')}
                aria-label={tc('edit')}
              >
                <PencilIcon className="w-4 h-4 text-muted-foreground" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(rule)}
                title={tc('delete')}
                aria-label={tc('delete')}
              >
                <TrashIcon className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
