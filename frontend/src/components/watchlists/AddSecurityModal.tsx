'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Security } from '@/types/investment';
import { Badge } from '@/components/ui/Badge';
import { HOVER_ROW_ON_CARD } from '@/components/ui/Card';

interface AddSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (securityId: string) => Promise<void>;
  securities: Security[];
  existingSecurityIds: Set<string>;
}

export function AddSecurityModal({
  isOpen,
  onClose,
  onAdd,
  securities,
  existingSecurityIds,
}: AddSecurityModalProps) {
  const t = useTranslations('watchlists');
  const [search, setSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  const availableSecurities = useMemo(() => {
    return securities.filter((s) => !existingSecurityIds.has(s.id));
  }, [securities, existingSecurityIds]);

  const filteredSecurities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableSecurities;
    return availableSecurities.filter((s) => {
      return (
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.isin && s.isin.toLowerCase().includes(q))
      );
    });
  }, [availableSecurities, search]);

  const handleAdd = async (securityId: string) => {
    setAddingId(securityId);
    try {
      await onAdd(securityId);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('addSecurityModal.title')}
    >
      <div className="space-y-4">
        <div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('addSecurityModal.searchPlaceholder')}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
            autoFocus
          />
        </div>

        <div className="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
          {availableSecurities.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('addSecurityModal.allAdded')}
            </div>
          ) : filteredSecurities.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('addSecurityModal.noSecurities')}
            </div>
          ) : (
            filteredSecurities.map((sec) => (
              <div
                key={sec.id}
                className={`flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700/60 last:border-b-0 ${HOVER_ROW_ON_CARD}`}
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {sec.symbol}
                    </span>
                    {sec.exchange && (
                      <Badge variant="gray" size="sm">
                        {sec.exchange}
                      </Badge>
                    )}
                    {sec.securityType && (
                      <Badge variant="blue" size="sm">
                        {sec.securityType}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {sec.name}
                  </p>
                  {sec.isin && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      ISIN: {sec.isin}
                    </p>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={addingId === sec.id}
                  onClick={() => handleAdd(sec.id)}
                >
                  {addingId === sec.id ? '...' : t('addSecurityModal.add')}
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('form.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
