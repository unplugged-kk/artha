import { useCallback, useRef, useState } from 'react';
import {
  ParsedQifResponse,
  ParsedSourceRow,
  SourceAccountMapping,
  SourceRowOverlap,
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
 * The overlap check for one routing. `key` names the routing it answers, so a
 * response that arrives after the user changed a mapping is never shown as the
 * answer for the new one; `failed` is not "no overlaps".
 */
export interface OverlapState {
  key: string;
  status: 'loading' | 'ready' | 'failed';
  rows: SourceRowOverlap[];
}

/**
 * The per-file routing state of a CSV/XLSX whose rows name their own account:
 * one decision per source label, optional per-row overrides, whether the user
 * chose to leave unreadable rows out, and which look-alike rows they kept.
 */
export function useImportSourceRouting() {
  const [mappings, setMappings] = useState<SourceAccountMapping[]>([]);
  const [overrides, setOverrides] = useState<Record<number, SourceRowOverride>>({});
  const [skipRejectedRows, setSkipRejectedRows] = useState(false);
  const [acknowledged, setAcknowledged] = useState<number[]>([]);
  const [overlaps, setOverlaps] = useState<OverlapState | null>(null);
  const latestKey = useRef('');

  const start = useCallback((parsed: ParsedQifResponse, accounts: Account[]) => {
    setMappings(initialSourceMappings(parsed.sourceAccounts ?? [], accounts));
    setOverrides({});
    setSkipRejectedRows(false);
    setAcknowledged([]);
    setOverlaps(null);
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

  const acknowledge = useCallback((rowNumber: number, keep: boolean) => {
    setAcknowledged((prev) => (keep ? [...prev.filter((r) => r !== rowNumber), rowNumber] : prev.filter((r) => r !== rowNumber)));
  }, []);

  const routingKey = JSON.stringify([mappings, overrides]);

  /** Fetch the overlap check for the current routing; stale answers are dropped. */
  const checkOverlaps = useCallback(
    async (fetchOverlaps: () => Promise<SourceRowOverlap[]>) => {
      const key = routingKey;
      latestKey.current = key;
      setOverlaps({ key, status: 'loading', rows: [] });
      try {
        const rows = await fetchOverlaps();
        if (latestKey.current === key) setOverlaps({ key, status: 'ready', rows });
      } catch {
        if (latestKey.current === key) setOverlaps({ key, status: 'failed', rows: [] });
      }
    },
    [routingKey],
  );

  return {
    mappings,
    overrides,
    skipRejectedRows,
    setSkipRejectedRows,
    acknowledged,
    acknowledge,
    // Only an answer for the routing on screen counts.
    overlaps: overlaps && overlaps.key === routingKey ? overlaps : null,
    routingKey,
    checkOverlaps,
    start,
    setLabelChoice,
    setRowChoice,
    /** What the import request carries for this routing. */
    request: () => ({
      sourceAccountMappings: mappings,
      sourceRowOverrides: Object.values(overrides),
      skipRejectedRows,
      acknowledgedOverlapRows: acknowledged,
    }),
  };
}
