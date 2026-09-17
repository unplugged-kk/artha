'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Account } from '@/types/account';
import { Category } from '@/types/category';
import {
  ParsedSmsResponse,
  SmsImportResult,
} from '@/types/sms-intake';
import { smsIntakeApi } from '@/lib/sms-intake';
import { useNumberFormat } from '@/hooks/useNumberFormat';
import { createLogger } from '@/lib/logger';

const logger = createLogger('SmsIntakeStep');

interface SmsIntakeStepProps {
  accounts: Account[];
  categories?: Category[];
  preselectedAccount?: Account;
}

export function SmsIntakeStep({
  accounts,
  categories = [],
  preselectedAccount,
}: SmsIntakeStepProps) {
  const t = useTranslations('import');
  const { formatCurrency } = useNumberFormat();

  const [message, setMessage] = useState('');
  const [sender, setSender] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ParsedSmsResponse | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<SmsImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // Set default account on load or preselected
  useEffect(() => {
    if (preselectedAccount) {
      setSelectedAccountId(preselectedAccount.id);
    } else if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [preselectedAccount, accounts, selectedAccountId]);

  // Try to match account by mask when parsed
  useEffect(() => {
    if (parseResult?.candidate?.accountMask && accounts.length > 0) {
      const mask = parseResult.candidate.accountMask.replace(/\D/g, '');
      if (mask) {
        const matched = accounts.find((acc) => acc.name.includes(mask));
        if (matched) {
          setSelectedAccountId(matched.id);
        }
      }
    }
  }, [parseResult, accounts]);

  const accountOptions = useMemo(
    () =>
      accounts.map((acc) => ({
        value: acc.id,
        label: `${acc.name} (${acc.currencyCode || 'INR'})`,
      })),
    [accounts],
  );

  const categoryOptions = useMemo(
    () => [
      { value: '', label: t('smsIntake.category') },
      ...categories.map((c) => ({
        value: c.id,
        label: c.name,
      })),
    ],
    [categories, t],
  );

  const handleParse = async () => {
    if (!message.trim()) {
      toast.error(t('smsIntake.messageLabel'));
      return;
    }

    setIsParsing(true);
    setParseError(null);
    setParseResult(null);
    setImportResult(null);

    try {
      const result = await smsIntakeApi.parse({
        message: message.trim(),
        sender: sender.trim() || undefined,
      });
      setParseResult(result);

      if (result.status !== 'parsed') {
        // `ambiguous` has its own copy; everything else the backend reports
        // (`unsupported`, `invalid`) is "we could not read this", and its
        // `reason` says which. A non-transactional or spam message arrives as
        // `unsupported` with the classifier's reason, so both are covered.
        setParseError(
          result.reason ||
            (result.status === 'ambiguous'
              ? t('smsIntake.ambiguous')
              : t('smsIntake.unsupportedFormat')),
        );
      }
    } catch (err: unknown) {
      logger.error('Failed to parse SMS', err);
      const errText = err instanceof Error ? err.message : String(err);
      setParseError(errText);
      toast.error(errText);
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.status !== 'parsed' || !selectedAccountId) {
      return;
    }

    setIsImporting(true);
    try {
      const res = await smsIntakeApi.import({
        message: message.trim(),
        sender: sender.trim() || undefined,
        accountId: selectedAccountId,
        categoryId: selectedCategoryId || undefined,
      });
      setImportResult(res);

      if (res.status === 'imported') {
        const accName = accounts.find((a) => a.id === selectedAccountId)?.name || 'Account';
        toast.success(t('smsIntake.importedSuccess', { account: accName }));
      } else if (res.status === 'skipped') {
        toast(t('smsIntake.skippedDuplicate', { reason: res.reason || '' }), {
          icon: 'ℹ️',
        });
      } else {
        toast.error(res.reason || t('smsIntake.failed', { error: 'Unknown' }));
      }
    } catch (err: unknown) {
      logger.error('Failed to import SMS', err);
      const errText = err instanceof Error ? err.message : String(err);
      toast.error(errText);
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setMessage('');
    setSender('');
    setParseResult(null);
    setImportResult(null);
    setParseError(null);
  };

  const parsed = parseResult?.candidate;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card padding="md" className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {t('smsIntake.heading')}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {t('smsIntake.description')}
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="sms-sender-header"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t('smsIntake.senderHeaderLabel')}
            </label>
            <input
              id="sms-sender-header"
              type="text"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder={t('smsIntake.senderHeaderPlaceholder')}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-750 text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 text-sm p-2 border"
            />
          </div>

          <div>
            <label
              htmlFor="sms-message-text"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t('smsIntake.messageLabel')} <span className="text-red-500">*</span>
            </label>
            <textarea
              id="sms-message-text"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('smsIntake.messagePlaceholder')}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-750 text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 text-sm p-2 border"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            {(parseResult || importResult) && (
              <Button variant="outline" onClick={handleReset}>
                {t('smsIntake.parseAnother')}
              </Button>
            )}
            <Button
              variant="primary"
              onClick={handleParse}
              disabled={isParsing || !message.trim()}
            >
              {isParsing ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                  {t('smsIntake.parsing')}
                </>
              ) : (
                t('smsIntake.parseButton')
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Parse Error / Non-Transactional Banner */}
      {parseError && (
        <Card padding="md" className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {parseResult?.status || 'Error'}
              </h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                {parseError}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Candidate Card */}
      {parsed && !importResult && (
        <Card padding="md" className="space-y-4 border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {t('smsIntake.candidateTitle')}
              </h3>
              {parsed.bankName && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t('smsIntake.detectedBank')}: <span className="font-medium text-gray-800 dark:text-gray-200">{parsed.bankName}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={parsed.type === 'credit' ? 'green' : 'gray'}>
                {parsed.type}
              </Badge>
              {parsed.paymentMethod && (
                <Badge variant="blue">
                  {parsed.paymentMethod}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">{t('smsIntake.amount')}:</span>
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {/* The badge above carries the direction, so the figure is the
                    magnitude: the wire amount is signed. */}
                {formatCurrency(Math.abs(parsed.amount), 'INR')}
              </div>
            </div>

            <div>
              <span className="text-gray-500 dark:text-gray-400">{t('smsIntake.merchant')}:</span>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {parsed.payee || '—'}
              </div>
            </div>

            {parsed.accountMask && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">{t('smsIntake.accountDigits')}:</span>
                <div className="font-mono text-gray-900 dark:text-gray-100">
                  {parsed.accountMask}
                </div>
              </div>
            )}

            {(parsed.upiReference || parsed.referenceNumber) && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">{t('smsIntake.reference')}:</span>
                <div className="font-mono text-gray-900 dark:text-gray-100">
                  {parsed.upiReference || parsed.referenceNumber}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <Select
                id="sms-destination-account"
                label={t('smsIntake.destinationAccount')}
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                options={accountOptions}
              />
            </div>

            <div>
              <Select
                id="sms-category"
                label={t('smsIntake.category')}
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                options={categoryOptions}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={isImporting || !selectedAccountId}
            >
              {isImporting ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                  {t('smsIntake.importing')}
                </>
              ) : (
                t('smsIntake.importButton')
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Result Display */}
      {importResult && (
        <Card
          padding="md"
          className={
            importResult.status === 'imported'
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20'
              : importResult.status === 'skipped'
              ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20'
              : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20'
          }
        >
          <div className="flex items-start gap-3">
            {importResult.status === 'imported' ? (
              <CheckCircleIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            ) : importResult.status === 'skipped' ? (
              <InformationCircleIcon className="w-6 h-6 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            ) : (
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
            )}
            <div className="space-y-2 flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {importResult.status === 'imported'
                  ? t('smsIntake.importedSuccess', {
                      account:
                        accounts.find((a) => a.id === selectedAccountId)?.name || 'Account',
                    })
                  : importResult.status === 'skipped'
                  ? t('smsIntake.skippedDuplicate', {
                      reason: importResult.reason || '',
                    })
                  : importResult.status === 'review_needed'
                  ? t('smsIntake.needsReview', {
                      message: importResult.reason || '',
                    })
                  : t('smsIntake.failed', { error: importResult.reason || '' })}
              </h3>
              {importResult.reason && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {importResult.reason}
                </p>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button variant="outline" onClick={handleReset}>
                  {t('smsIntake.parseAnother')}
                </Button>
                {importResult.status === 'imported' && (
                  <Link href="/transactions">
                    <Button variant="primary">
                      {t('smsIntake.viewInTransactions')}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
