'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { WatchlistItem } from '@/types/watchlist';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CARD_CLASS, HOVER_ROW_ON_CARD } from '@/components/ui/Card';
import { TABLE_CLASS, TABLE_BODY_CLASS } from '@/components/ui/Table';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useNumberFormat } from '@/hooks/useNumberFormat';

interface WatchlistItemsTableProps {
  items: WatchlistItem[];
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (itemId: string) => Promise<void>;
  onAddClick: () => void;
}

export function WatchlistItemsTable({
  items,
  onMoveUp,
  onMoveDown,
  onRemove,
  onAddClick,
}: WatchlistItemsTableProps) {
  const t = useTranslations('watchlists');
  const { formatCurrency, formatPercent } = useNumberFormat();

  const [confirmItem, setConfirmItem] = useState<{
    id: string;
    symbol: string;
  } | null>(null);

  const handleConfirmRemove = async () => {
    if (!confirmItem) return;
    try {
      await onRemove(confirmItem.id);
      setConfirmItem(null);
    } catch {
      // Handled by parent or toast
    }
  };

  if (items.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {t('emptyItemsTitle')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-sm mx-auto">
          {t('emptyItemsDescription')}
        </p>
        <Button variant="primary" onClick={onAddClick}>
          {t('addFirstSecurity')}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className={`overflow-x-auto ${CARD_CLASS}`}>
        <table className={TABLE_CLASS}>
          <thead className="bg-gray-50 dark:bg-gray-750 text-xs uppercase font-medium text-gray-500 dark:text-gray-400 tracking-wider">
            <tr>
              <th scope="col" className="w-10 px-3 py-3 text-center">
                #
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                {t('columns.symbol')} & {t('columns.name')}
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                {t('columns.type')}
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                {t('columns.price')}
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                {t('columns.change')}
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                {t('columns.asOf')}
              </th>
              <th scope="col" className="px-4 py-3 text-center">
                {t('columns.actions')}
              </th>
            </tr>
          </thead>
          <tbody className={`${TABLE_BODY_CLASS} text-sm`}>
            {items.map((item, index) => {
              const quote = item.quote;
              const isAvailable =
                quote.status === 'available' && quote.currentPrice !== null;
              const hasChange =
                isAvailable &&
                quote.dailyChange !== null &&
                quote.dailyChangePercent !== null;

              const isPositive = hasChange && quote.dailyChange! > 0;
              const isNegative = hasChange && quote.dailyChange! < 0;

              return (
                <tr
                  key={item.id}
                  className={HOVER_ROW_ON_CARD}
                >
                  {/* Sort Order Controls */}
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => onMoveUp(index)}
                        disabled={index === 0}
                        aria-label={`Move ${item.security.symbol} up`}
                        className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 disabled:hover:text-gray-400"
                      >
                        <ChevronUpIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveDown(index)}
                        disabled={index === items.length - 1}
                        aria-label={`Move ${item.security.symbol} down`}
                        className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-20 disabled:hover:text-gray-400"
                      >
                        <ChevronDownIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* Symbol & Name */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div>
                      <Link
                        href={`/securities/${item.securityId}`}
                        className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1.5"
                      >
                        <span>{item.security.symbol}</span>
                      </Link>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                        {item.security.name}
                      </div>
                      {item.security.isin && (
                        <div className="text-xs text-gray-400 dark:text-gray-500">
                          {item.security.isin}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Type / Exchange */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {item.security.exchange && (
                        <Badge variant="gray" size="sm">
                          {item.security.exchange}
                        </Badge>
                      )}
                      {item.security.securityType && (
                        <Badge variant="blue" size="sm">
                          {item.security.securityType}
                        </Badge>
                      )}
                    </div>
                  </td>

                  {/* Last Price */}
                  <td className="px-4 py-3 text-right whitespace-nowrap font-medium text-gray-900 dark:text-gray-100">
                    {isAvailable ? (
                      formatCurrency(
                        quote.currentPrice!,
                        item.security.currencyCode,
                      )
                    ) : (
                      <Badge variant="gray" size="sm">
                        {t('status.unavailable')}
                      </Badge>
                    )}
                  </td>

                  {/* 24h Change */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {hasChange ? (
                      <div
                        className={`font-medium ${
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isNegative
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        <span>
                          {isPositive ? '+' : ''}
                          {formatCurrency(
                            quote.dailyChange!,
                            item.security.currencyCode,
                          )}
                        </span>{' '}
                        <span className="text-xs">
                          ({isPositive ? '+' : ''}
                          {formatPercent(quote.dailyChangePercent!)})
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">
                        —
                      </span>
                    )}
                  </td>

                  {/* As Of */}
                  <td className="px-4 py-3 text-right whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                    {quote.priceDate || '—'}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setConfirmItem({
                          id: item.id,
                          symbol: item.security.symbol,
                        })
                      }
                      aria-label={`Remove ${item.security.symbol} from watchlist`}
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmItem && (
        <ConfirmDialog
          isOpen={true}
          title={t('confirmRemoveItem.title')}
          message={t('confirmRemoveItem.message', {
            symbol: confirmItem.symbol,
          })}
          confirmLabel={t('confirmRemoveItem.confirm')}
          cancelLabel={t('confirmRemoveItem.cancel')}
          onConfirm={handleConfirmRemove}
          onCancel={() => setConfirmItem(null)}
          variant="danger"
        />
      )}
    </>
  );
}
