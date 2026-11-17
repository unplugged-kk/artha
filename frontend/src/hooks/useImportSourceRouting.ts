import { useCallback, useState } from 'react';
import {
  ParsedQifResponse,
  ParsedSourceRow,
  SourceAccountMapping,
  SourceRowOverride,
} from '@/lib/import';
import { Account } from '@/types/account';
import {
  choiceFromValue,
  sourceAccountOptions,
} from '@/components/import/MapSourceAccountsStep';

/**
 * Pre-match each source label to an owned account by exact name, case and
 * surrounding whitespace aside. Anything else -- a partial match, a combined
 * label, a blank cell -- is left for the user to decide.
 */
export function initialSourceMappings(
  labels: string[],
  accounts: Account[],
): SourceAccountMapping[] {
  const options = sourceAccountOptions(accounts);
  return labels.map((label) => {
    const key = label.trim().toLowerCase();
    const match = key ? options.find((o) => o.label.trim().toLowerCase() === key) : undefined;
    return match ? { originalName: label, accountId: match.value } : { originalName: label };
  });
}

/**
 * The per-file routing state of a CSV/XLSX whose rows name their own account:
 * one decision per source label, optional per-row overrides, and whether the
 * user chose to leave unreadable rows out.
 */
export function useImportSourceRouting() {
  const [mappings, setMappings] = useState<SourceAccountMapping[]>([]);
  const [overrides, setOverrides] = useState<Record<number, SourceRowOverride>>({});
  const [skipRejectedRows, setSkipRejectedRows] = useState(false);

  const start = useCallback((parsed: ParsedQifResponse, accounts: Account[]) => {
    setMappings(initialSourceMappings(parsed.sourceAccounts ?? [], accounts));
    setOverrides({});
    setSkipRejectedRows(false);
  }, []);

  const setLabelChoice = useCallback((originalName: string, value: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.originalName === originalName ? { originalName, ...choiceFromValue(value) } : m)),
    );
  }, []);

  const setRowChoice = useCallback((row: ParsedSourceRow, value: string) => {
    setOverrides((prev) => ({
      ...prev,
      [row.rowNumber]: { rowNumber: row.rowNumber, ...choiceFromValue(value) },
    }));
  }, []);

  return {
    mappings,
    overrides,
    skipRejectedRows,
    setSkipRejectedRows,
    start,
    setLabelChoice,
    setRowChoice,
    /** What the import request carries for this routing. */
    request: () => ({
      sourceAccountMappings: mappings,
      sourceRowOverrides: Object.values(overrides),
      skipRejectedRows,
    }),
  };
}
