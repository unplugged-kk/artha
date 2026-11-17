'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TABLE_BODY_CLASS, TABLE_CLASS, Td, Th } from '@/components/ui/Table';
import { Select } from '@/components/ui/Select';
import { useNumberFormat } from '@/hooks/useNumberFormat';
import { useDateFormat } from '@/hooks/useDateFormat';
import {
  AccountMapping,
  ParsedSourceRow,
  SourceAccountMapping,
  SourceRowOverride,
} from '@/lib/import';
import { Account } from '@/types/account';
import {
  SKIP_SOURCE,
  sourceAccountOptions,
  sourceChoiceValue,
} from './MapSourceAccountsStep';

/** The account (or skip) one row resolves to: its override, else its label's mapping. */
export function resolveSourceRow(
  row: ParsedSourceRow,
  mappings: SourceAccountMapping[],
  overrides: Record<number, SourceRowOverride>,
): { accountId?: string; skip?: boolean } {
  return overrides[row.rowNumber] ?? mappings.find((m) => m.originalName === row.sourceAccount) ?? {};
}

/**
 * Net change each account will see, in exact 4dp integer units. A transfer
 * row moves its amount out of the source account and the opposite into the
 * account its counterparty name is mapped to, so a card payment nets to zero
 * across the pair and adds nothing to spending.
 */
export function plannedAccountChanges(
  rows: ParsedSourceRow[],
  mappings: SourceAccountMapping[],
  overrides: Record<number, SourceRowOverride>,
  accountMappings: AccountMapping[],
): Map<string, number> {
  const units = new Map<string, number>();
  const add = (accountId: string, amount: number) =>
    units.set(accountId, (units.get(accountId) ?? 0) + Math.round(amount * 10000));
  for (const row of rows) {
    const { accountId, skip } = resolveSourceRow(row, mappings, overrides);
    if (skip || !accountId) continue;
    add(accountId, row.amount);
    if (row.isTransfer) {
      const counterparty = accountMappings.find((m) => m.originalName === row.transferAccount)?.accountId;
      if (counterparty) add(counterparty, -row.amount);
    }
  }
  return new Map([...units].map(([id, u]) => [id, u / 10000]));
}

interface SourceReviewStepProps {
  fileName: string;
  rows: ParsedSourceRow[];
  rejectedRows: Array<{ rowNumber: number; reason: string }>;
  accounts: Account[];
  mappings: SourceAccountMapping[];
  overrides: Record<number, SourceRowOverride>;
  accountMappings: AccountMapping[];
  skipRejectedRows: boolean;
  onOverride: (row: ParsedSourceRow, value: string) => void;
  onSkipRejectedRowsChange: (skip: boolean) => void;
  isLoading: boolean;
  onBack: () => void;
  onImport: () => void;
}

export function SourceReviewStep({
  fileName,
  rows,
  rejectedRows,
  accounts,
  mappings,
  overrides,
  accountMappings,
  skipRejectedRows,
  onOverride,
  onSkipRejectedRowsChange,
  isLoading,
  onBack,
  onImport,
}: SourceReviewStepProps) {
  const t = useTranslations('import');
  const { formatCurrency } = useNumberFormat();
  const { formatDate } = useDateFormat();
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const options = [
    { value: '', label: t('mapSourceAccounts.choose') },
    ...sourceAccountOptions(accounts),
    { value: SKIP_SOURCE, label: t('mapSourceAccounts.skip') },
  ];
  const resolved = rows.map((row) => ({ row, choice: resolveSourceRow(row, mappings, overrides) }));
  const unresolved = resolved.filter(({ choice }) => !choice.accountId && !choice.skip).length;
  const skipped = resolved.filter(({ choice }) => choice.skip).length;
  const changes = plannedAccountChanges(rows, mappings, overrides, accountMappings);
  const blocked = unresolved > 0 || (rejectedRows.length > 0 && !skipRejectedRows);

  return (
    <div className="max-w-5xl mx-auto">
      <Card padding="md">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {t('review.heading')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 break-words">
          {t('sourceReview.summary', { fileName, rows: rows.length, skipped })}
        </p>

        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('sourceReview.changesHeading')}
        </h3>
        <ul className={`mb-6 border border-gray-200 dark:border-gray-700 rounded-lg ${TABLE_BODY_CLASS}`}>
          {[...changes].map(([accountId, change]) => {
            const account = accountById.get(accountId);
            return (
              <li key={accountId} className="flex justify-between gap-4 px-3 py-2 text-sm">
                <span className="text-gray-900 dark:text-gray-100 break-words">{account?.name ?? accountId}</span>
                <span className="tabular-nums text-gray-900 dark:text-gray-100">
                  {formatCurrency(change, account?.currencyCode)}
                </span>
              </li>
            );
          })}
        </ul>

        {rejectedRows.length > 0 && (
          <div className="mb-6 rounded-lg border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {t('sourceReview.rejectedHeading', { count: rejectedRows.length })}
            </p>
            <ul className="ml-4 mt-1 list-disc text-gray-700 dark:text-gray-300">
              {rejectedRows.map((r) => (
                <li key={r.rowNumber}>{t('sourceReview.rejectedRow', { row: r.rowNumber, reason: r.reason })}</li>
              ))}
            </ul>
            <label className="mt-2 flex items-center gap-2 text-gray-900 dark:text-gray-100">
              <input
                type="checkbox"
                checked={skipRejectedRows}
                onChange={(e) => onSkipRejectedRowsChange(e.target.checked)}
              />
              {t('sourceReview.skipRejected', { count: rejectedRows.length })}
            </label>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className={TABLE_CLASS}>
            <thead>
              <tr>
                <Th>{t('sourceReview.colRow')}</Th>
                <Th>{t('sourceReview.colDate')}</Th>
                <Th>{t('sourceReview.colPayee')}</Th>
                <Th align="right">{t('sourceReview.colAmount')}</Th>
                <Th>{t('sourceReview.colSource')}</Th>
                <Th>{t('sourceReview.colPostTo')}</Th>
              </tr>
            </thead>
            <tbody className={TABLE_BODY_CLASS}>
              {resolved.map(({ row, choice }) => {
                const account = choice.accountId ? accountById.get(choice.accountId) : undefined;
                return (
                  <tr key={row.rowNumber} className={choice.accountId || choice.skip ? '' : 'bg-amber-50 dark:bg-amber-900/20'}>
                    <Td className="tabular-nums text-gray-500 dark:text-gray-400">{row.rowNumber}</Td>
                    <Td className="whitespace-nowrap text-gray-900 dark:text-gray-100">{formatDate(row.date)}</Td>
                    <Td className="text-gray-900 dark:text-gray-100 break-words">
                      {row.payee}
                      {row.isTransfer && (
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {t('sourceReview.transferTo', { account: row.transferAccount })}
                        </span>
                      )}
                    </Td>
                    <Td align="right" className="tabular-nums whitespace-nowrap text-gray-900 dark:text-gray-100">
                      {formatCurrency(row.amount, account?.currencyCode)}
                    </Td>
                    <Td className="text-gray-700 dark:text-gray-300 break-words">
                      {row.sourceAccount || t('mapSourceAccounts.blankSource')}
                    </Td>
                    <Td className="min-w-[10rem]">
                      <Select
                        id={`source-row-${row.rowNumber}`}
                        aria-label={t('sourceReview.postToRow', { row: row.rowNumber })}
                        options={options}
                        value={sourceChoiceValue(choice)}
                        onChange={(e) => onOverride(row, e.target.value)}
                      />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {unresolved > 0 && (
          <p role="status" className="mt-4 text-sm text-amber-700 dark:text-amber-400">
            {t('mapSourceAccounts.unresolved', { count: unresolved })}
          </p>
        )}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onBack}>
            {t('navigation.back')}
          </Button>
          <Button onClick={onImport} isLoading={isLoading} disabled={blocked}>
            {t('review.importButton')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

