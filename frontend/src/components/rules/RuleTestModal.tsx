'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  CheckCircleIcon,
  XCircleIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { TransactionRule } from '@/types/rule';
import { rulesApi } from '@/lib/rules';

interface RuleTestModalProps {
  rule: TransactionRule | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RuleTestModal({ rule, isOpen, onClose }: RuleTestModalProps) {
  const t = useTranslations('rules');
  const tc = useTranslations('common');

  const [samplePayee, setSamplePayee] = useState('');
  const [sampleMemo, setSampleMemo] = useState('');
  const [sampleAmount, setSampleAmount] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  if (!rule) return null;

  const handleTestCandidate = async () => {
    setIsTesting(true);
    try {
      const res = await rulesApi.test({
        ruleId: rule.id,
        candidate: {
          payee: samplePayee || null,
          memo: sampleMemo || null,
          amount: sampleAmount ? parseFloat(sampleAmount) : null,
        },
      });
      setTestResult(res);
    } catch {
      // Error handled
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestRecent = async () => {
    setIsTesting(true);
    try {
      const res = await rulesApi.test({
        ruleId: rule.id,
        testAgainstRecent: true,
        sampleLimit: 20,
      });
      setTestResult(res);
    } catch {
      // Error handled
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('testRule')}: ${rule.name}`}
      maxWidth="lg"
    >
      <div className="space-y-5">
        <p className="text-xs text-muted-foreground">
          {t('testModalDescription')}
        </p>

        {/* Input Candidate Section */}
        <div className="p-4 rounded-xl bg-card border border-border space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('testSampleTransaction')}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t('fields.payee')}
              </label>
              <Input
                value={samplePayee}
                onChange={(e) => setSamplePayee(e.target.value)}
                placeholder="e.g. Swiggy Bangalore"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t('fields.memo')}
              </label>
              <Input
                value={sampleMemo}
                onChange={(e) => setSampleMemo(e.target.value)}
                placeholder="e.g. Lunch order"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                {t('fields.amount')}
              </label>
              <Input
                inputMode="decimal"
                value={sampleAmount}
                onChange={(e) => setSampleAmount(e.target.value)}
                placeholder="e.g. -450.00"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleTestCandidate}
              isLoading={isTesting}
            >
              <BeakerIcon className="w-4 h-4 mr-1.5" />
              {t('evaluateSample')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestRecent}
              isLoading={isTesting}
            >
              {t('testAgainstRecentTxs')}
            </Button>
          </div>
        </div>

        {/* Test Result Section */}
        {testResult && (
          <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('testResults')}
            </h4>

            {testResult.candidateMatch && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-card border border-border">
                {testResult.candidateMatch.matches ? (
                  <>
                    <CheckCircleIcon className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {t('sampleMatchesRule')}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircleIcon className="w-5 h-5 text-destructive shrink-0" />
                    <span className="text-sm font-medium text-destructive">
                      {t('sampleDoesNotMatch')}
                    </span>
                  </>
                )}
              </div>
            )}

            {testResult.sampleMatches && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">
                    {t('recentMatchesCount', {
                      count: testResult.matchedSampleCount ?? 0,
                    })}
                  </span>
                </div>

                {testResult.sampleMatches.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    {t('noRecentMatchesFound')}
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {testResult.sampleMatches.map((m: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs p-2 rounded bg-card border border-border"
                      >
                        <div>
                          <span className="font-medium text-foreground">
                            {m.payee || t('noPayee')}
                          </span>
                          <span className="text-muted-foreground ml-2">
                            {m.date}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{m.amount}</span>
                          <Badge variant="green" size="sm">
                            {t('matches')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            {tc('close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
