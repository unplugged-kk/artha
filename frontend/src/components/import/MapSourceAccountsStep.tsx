'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { ParsedSourceRow, SourceAccountMapping } from '@/lib/import';
import { Account } from '@/types/account';

/** Select value for "leave these rows out"; never a valid account id. */
export const SKIP_SOURCE = '__skip__';

export function sourceChoiceValue(choice: { accountId?: string; skip?: boolean } | undefined): string {
  return choice?.skip ? SKIP_SOURCE : choice?.accountId ?? '';
}

export function choiceFromValue(value: string): { accountId?: string; skip?: boolean } {
  if (value === SKIP_SOURCE) return { skip: true };
  return value ? { accountId: value } : {};
}

/** Accounts a banking row may post to: the user's open, non-brokerage accounts. */
export function sourceAccountOptions(accounts: Account[]) {
  return accounts
    .filter((a) => !a.isClosed && a.accountSubType !== 'INVESTMENT_BROKERAGE')
    .map((a) => ({ value: a.id, label: a.name }));
}

interface MapSourceAccountsStepProps {
  mappings: SourceAccountMapping[];
  rows: ParsedSourceRow[];
  accounts: Account[];
  onChange: (originalName: string, value: string) => void;
  onBack: () => void;
  onNext: () => void;
}

/**
 * A tracker sheet names each row's account in a column. Each distinct name is
 * matched to an owned account once here (or deliberately skipped); single rows
 * can still be moved on the review step. Nothing proceeds while a name is
 * unmatched, so no row can land in an account the user did not choose.
 */
export function MapSourceAccountsStep({
  mappings,
  rows,
  accounts,
  onChange,
  onBack,
  onNext,
}: MapSourceAccountsStepProps) {
  const t = useTranslations('import');
  const options = [
    { value: '', label: t('mapSourceAccounts.choose') },
    ...sourceAccountOptions(accounts),
    { value: SKIP_SOURCE, label: t('mapSourceAccounts.skip') },
  ];
  const unresolved = mappings.filter((m) => !m.accountId && !m.skip).length;

  return (
    <div className="max-w-4xl mx-auto">
      <Card padding="md">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('mapSourceAccounts.heading')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {t('mapSourceAccounts.description')}
        </p>
        <ul className="space-y-4">
          {mappings.map((mapping) => {
            const count = rows.filter((r) => r.sourceAccount === mapping.originalName).length;
            const ready = !!(mapping.accountId || mapping.skip);
            return (
              <li
                key={mapping.originalName}
                className={ready
                  ? 'border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg p-4'
                  : 'border-2 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4'}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100 break-words">
                      {mapping.originalName || t('mapSourceAccounts.blankSource')}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('mapSourceAccounts.rowCount', { count })}
                    </p>
                  </div>
                  <Select
                    label={t('mapSourceAccounts.postTo', { source: mapping.originalName || t('mapSourceAccounts.blankSource') })}
                    options={options}
                    value={sourceChoiceValue(mapping)}
                    onChange={(e) => onChange(mapping.originalName, e.target.value)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        {unresolved > 0 && (
          <p role="status" className="mt-4 text-sm text-amber-700 dark:text-amber-400">
            {t('mapSourceAccounts.unresolved', { count: unresolved })}
          </p>
        )}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onBack}>
            {t('navigation.back')}
          </Button>
          <Button onClick={onNext} disabled={unresolved > 0}>
            {t('navigation.next')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
