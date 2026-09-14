'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircleIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { rulesApi } from '@/lib/rules';
import { ApplyRulesResult } from '@/types/rule';

interface ApplyRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ApplyRulesModal({
  isOpen,
  onClose,
  onSuccess,
}: ApplyRulesModalProps) {
  const t = useTranslations('rules');
  const tc = useTranslations('common');

  const [onlyUncategorized, setOnlyUncategorized] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ApplyRulesResult | null>(null);

  const handleRun = async (dryRun: boolean) => {
    setIsRunning(true);
    try {
      const res = await rulesApi.apply({
        onlyUncategorized,
        dryRun,
      });
      setResult(res);
      if (!dryRun && res.updatedCount > 0) {
        onSuccess();
      }
    } catch {
      // Handled
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('applyRulesModal.title')}
      maxWidth="md"
    >
      <div className="space-y-5">
        <p className="text-xs text-muted-foreground">
          {t('applyRulesModal.description')}
        </p>

        {/* Options */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-foreground">
                {t('applyRulesModal.onlyUncategorized')}
              </span>
              <p className="text-xs text-muted-foreground">
                {t('applyRulesModal.onlyUncategorizedHelp')}
              </p>
            </div>
            <ToggleSwitch
              checked={onlyUncategorized}
              onChange={setOnlyUncategorized}
              label={t('applyRulesModal.onlyUncategorized')}
            />
          </div>
        </div>

        {/* Results Preview */}
        {result && (
          <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-semibold text-foreground">
                {result.dryRun
                  ? t('applyRulesModal.dryRunSummary', { count: result.matchedCount })
                  : t('applyRulesModal.applySummary', { count: result.updatedCount })}
              </span>
            </div>

            {result.details && result.details.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1 mt-2 pr-1">
                {result.details.slice(0, 10).map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs p-1.5 rounded bg-card border border-border"
                  >
                    <span className="truncate max-w-[200px] text-foreground font-medium">
                      {d.payee || 'Transaction'}
                    </span>
                    <span className="text-muted-foreground">{d.ruleName}</span>
                  </div>
                ))}
                {result.details.length > 10 && (
                  <p className="text-[11px] text-center text-muted-foreground pt-1">
                    {t('andMoreTransactions', {
                      count: result.details.length - 10,
                    })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            {tc('cancel')}
          </Button>

          <Button
            variant="outline"
            onClick={() => handleRun(true)}
            isLoading={isRunning}
          >
            {t('applyRulesModal.previewMatches')}
          </Button>

          <Button
            variant="primary"
            onClick={() => handleRun(false)}
            isLoading={isRunning}
          >
            <SparklesIcon className="w-4 h-4 mr-1.5" />
            {t('applyRulesModal.applyNow')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
