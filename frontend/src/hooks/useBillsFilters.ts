import { useMemo, useCallback } from 'react';
import {
  BillsFilterState,
  countActiveBillsFilters,
} from '@/lib/bills-filters';
import { useLocalStorage } from '@/hooks/useLocalStorage';

const STORAGE_KEYS = {
  nameSearch: 'artha-bills-name-search',
  payeeIds: 'artha-bills-payee-ids',
  accountIds: 'artha-bills-account-ids',
  categoryIds: 'artha-bills-category-ids',
  filtersExpanded: 'artha-bills-filters-expanded',
} as const;

/**
 * State management for the Bills & Deposits filter panel. Mirrors the
 * useTransactionFilters pattern: derived active count and a clear helper.
 * Filter selections persist to localStorage so they survive page reloads.
 */
export function useBillsFilters() {
  const [nameSearch, setNameSearch] = useLocalStorage(
    STORAGE_KEYS.nameSearch,
    '',
  );
  const [selectedPayeeIds, setSelectedPayeeIds] = useLocalStorage<string[]>(
    STORAGE_KEYS.payeeIds,
    [],
  );
  const [selectedAccountIds, setSelectedAccountIds] = useLocalStorage<string[]>(
    STORAGE_KEYS.accountIds,
    [],
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useLocalStorage<
    string[]
  >(STORAGE_KEYS.categoryIds, []);
  const [filtersExpanded, setFiltersExpanded] = useLocalStorage(
    STORAGE_KEYS.filtersExpanded,
    false,
  );

  const filterState: BillsFilterState = useMemo(
    () => ({
      nameSearch,
      selectedPayeeIds,
      selectedAccountIds,
      selectedCategoryIds,
    }),
    [nameSearch, selectedPayeeIds, selectedAccountIds, selectedCategoryIds],
  );

  const activeFilterCount = useMemo(
    () => countActiveBillsFilters(filterState),
    [filterState],
  );

  const clearFilters = useCallback(() => {
    setNameSearch('');
    setSelectedPayeeIds([]);
    setSelectedAccountIds([]);
    setSelectedCategoryIds([]);
  }, [
    setNameSearch,
    setSelectedPayeeIds,
    setSelectedAccountIds,
    setSelectedCategoryIds,
  ]);

  return {
    nameSearch,
    setNameSearch,
    selectedPayeeIds,
    setSelectedPayeeIds,
    selectedAccountIds,
    setSelectedAccountIds,
    selectedCategoryIds,
    setSelectedCategoryIds,
    filtersExpanded,
    setFiltersExpanded,
    filterState,
    activeFilterCount,
    clearFilters,
  };
}
