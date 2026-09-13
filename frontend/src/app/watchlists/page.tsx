'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { PageLayout } from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { watchlistsApi } from '@/lib/watchlists';
import { investmentsApi } from '@/lib/investments';
import { Watchlist, WatchlistItem } from '@/types/watchlist';
import { Security } from '@/types/investment';
import { WatchlistFormModal } from '@/components/watchlists/WatchlistFormModal';
import { AddSecurityModal } from '@/components/watchlists/AddSecurityModal';
import { WatchlistItemsTable } from '@/components/watchlists/WatchlistItemsTable';

export default function WatchlistsPage() {
  return (
    <ProtectedRoute>
      <WatchlistsContent />
    </ProtectedRoute>
  );
}

function WatchlistsContent() {
  const t = useTranslations('watchlists');

  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
  const [activeWatchlistDetail, setActiveWatchlistDetail] = useState<Watchlist | null>(null);
  const [allSecurities, setAllSecurities] = useState<Security[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingWatchlist, setEditingWatchlist] = useState<Watchlist | null>(null);
  const [isAddSecurityOpen, setIsAddSecurityOpen] = useState(false);
  const [deleteConfirmWatchlist, setDeleteConfirmWatchlist] = useState<Watchlist | null>(null);

  // Load list of watchlists
  const loadWatchlists = useCallback(async (selectId?: string) => {
    try {
      const data = await watchlistsApi.getWatchlists();
      setWatchlists(data);

      if (data.length > 0) {
        const targetId = selectId && data.some((w) => w.id === selectId)
          ? selectId
          : data[0].id;
        setActiveWatchlistId(targetId);
      } else {
        setActiveWatchlistId(null);
        setActiveWatchlistDetail(null);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  }, []);

  // Initial load
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setIsLoading(true);
      try {
        const [watchlistsData, securitiesData] = await Promise.all([
          watchlistsApi.getWatchlists(),
          investmentsApi.getSecurities(true).catch(() => []),
        ]);
        if (!isMounted) return;

        setWatchlists(watchlistsData);
        setAllSecurities(securitiesData);

        if (watchlistsData.length > 0) {
          setActiveWatchlistId(watchlistsData[0].id);
        }
      } catch (err: unknown) {
        if (isMounted) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load active watchlist details whenever activeWatchlistId changes
  useEffect(() => {
    if (!activeWatchlistId) {
      setActiveWatchlistDetail(null);
      return;
    }

    let isMounted = true;
    setIsDetailLoading(true);

    watchlistsApi
      .getWatchlist(activeWatchlistId)
      .then((data) => {
        if (isMounted) {
          setActiveWatchlistDetail(data);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (isMounted) setIsDetailLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeWatchlistId]);

  const existingSecurityIds = useMemo(() => {
    if (!activeWatchlistDetail?.items) return new Set<string>();
    return new Set(activeWatchlistDetail.items.map((i) => i.securityId));
  }, [activeWatchlistDetail]);

  // Create or update watchlist
  const handleSaveWatchlist = async (data: { name: string; description?: string }) => {
    if (editingWatchlist) {
      const updated = await watchlistsApi.updateWatchlist(editingWatchlist.id, data);
      toast.success(t('toast.updated'));
      await loadWatchlists(updated.id);
      setActiveWatchlistDetail((prev) => (prev ? { ...prev, ...updated } : null));
    } else {
      const created = await watchlistsApi.createWatchlist(data);
      toast.success(t('toast.created'));
      await loadWatchlists(created.id);
    }
  };

  // Delete watchlist
  const handleDeleteWatchlist = async () => {
    if (!deleteConfirmWatchlist) return;
    try {
      await watchlistsApi.deleteWatchlist(deleteConfirmWatchlist.id);
      toast.success(t('toast.deleted'));
      setDeleteConfirmWatchlist(null);
      await loadWatchlists();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  // Add security item
  const handleAddSecurity = async (securityId: string) => {
    if (!activeWatchlistId) return;
    try {
      await watchlistsApi.addWatchlistItem(activeWatchlistId, { securityId });
      toast.success(t('toast.itemAdded'));
      // Reload active watchlist
      const updated = await watchlistsApi.getWatchlist(activeWatchlistId);
      setActiveWatchlistDetail(updated);
      setIsAddSecurityOpen(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  // Remove security item
  const handleRemoveItem = async (itemId: string) => {
    if (!activeWatchlistId) return;
    try {
      await watchlistsApi.removeWatchlistItem(activeWatchlistId, itemId);
      toast.success(t('toast.itemRemoved'));
      setActiveWatchlistDetail((prev) => {
        if (!prev || !prev.items) return prev;
        return {
          ...prev,
          items: prev.items.filter((item) => item.id !== itemId),
        };
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  // Reorder items
  const handleReorder = async (newItems: WatchlistItem[]) => {
    if (!activeWatchlistId) return;
    const itemIds = newItems.map((i) => i.id);
    // Optimistic update
    setActiveWatchlistDetail((prev) => (prev ? { ...prev, items: newItems } : null));

    try {
      await watchlistsApi.reorderWatchlistItems(activeWatchlistId, itemIds);
      toast.success(t('toast.reordered'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
      // Revert on error
      const fresh = await watchlistsApi.getWatchlist(activeWatchlistId);
      setActiveWatchlistDetail(fresh);
    }
  };

  const handleMoveUp = (index: number) => {
    if (!activeWatchlistDetail?.items || index <= 0) return;
    const copy = [...activeWatchlistDetail.items];
    const temp = copy[index - 1];
    copy[index - 1] = copy[index];
    copy[index] = temp;
    handleReorder(copy);
  };

  const handleMoveDown = (index: number) => {
    if (!activeWatchlistDetail?.items || index >= activeWatchlistDetail.items.length - 1) return;
    const copy = [...activeWatchlistDetail.items];
    const temp = copy[index + 1];
    copy[index + 1] = copy[index];
    copy[index] = temp;
    handleReorder(copy);
  };

  // Refresh quotes
  const handleRefreshQuotes = async () => {
    if (!activeWatchlistId) return;
    setIsRefreshing(true);
    try {
      const refreshed = await watchlistsApi.refreshWatchlistQuotes(activeWatchlistId);
      setActiveWatchlistDetail(refreshed);
      toast.success(t('toast.quotesRefreshed'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex h-64 items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setEditingWatchlist(null);
              setIsFormModalOpen(true);
            }}
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            {t('newWatchlist')}
          </Button>
        }
      />

      {watchlists.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 p-12 text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {t('emptyStateTitle')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            {t('emptyStateDescription')}
          </p>
          <Button
            variant="primary"
            onClick={() => {
              setEditingWatchlist(null);
              setIsFormModalOpen(true);
            }}
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            {t('createFirstWatchlist')}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Watchlists Tabs & Top Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 dark:border-gray-700 pb-3">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              {watchlists.map((w) => {
                const isActive = w.id === activeWatchlistId;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setActiveWatchlistId(w.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 border border-blue-200 dark:border-blue-700'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    {w.name}
                  </button>
                );
              })}
            </div>

            {/* Actions for current watchlist */}
            {activeWatchlistDetail && (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setIsAddSecurityOpen(true)}
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  {t('addSecurity')}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRefreshing || !activeWatchlistDetail.items?.length}
                  onClick={handleRefreshQuotes}
                  title={t('refreshQuotes')}
                >
                  <ArrowPathIcon
                    className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                  {t('refreshQuotes')}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingWatchlist(activeWatchlistDetail);
                    setIsFormModalOpen(true);
                  }}
                  title={t('editWatchlist')}
                >
                  <PencilSquareIcon className="h-4 w-4" />
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  onClick={() => setDeleteConfirmWatchlist(activeWatchlistDetail)}
                  title={t('deleteWatchlist')}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Watchlist Description */}
          {activeWatchlistDetail?.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              {activeWatchlistDetail.description}
            </p>
          )}

          {/* Table */}
          {isDetailLoading ? (
            <div className="flex h-48 items-center justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <WatchlistItemsTable
              items={activeWatchlistDetail?.items || []}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onRemove={handleRemoveItem}
              onAddClick={() => setIsAddSecurityOpen(true)}
            />
          )}
        </div>
      )}

      {/* Form Modal (Create / Edit) */}
      <WatchlistFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingWatchlist(null);
        }}
        onSave={handleSaveWatchlist}
        watchlist={editingWatchlist}
      />

      {/* Add Security Modal */}
      <AddSecurityModal
        isOpen={isAddSecurityOpen}
        onClose={() => setIsAddSecurityOpen(false)}
        onAdd={handleAddSecurity}
        securities={allSecurities}
        existingSecurityIds={existingSecurityIds}
      />

      {/* Delete Watchlist Confirm Dialog */}
      {deleteConfirmWatchlist && (
        <ConfirmDialog
          isOpen={true}
          title={t('confirmDelete.title')}
          message={t('confirmDelete.message', {
            name: deleteConfirmWatchlist.name,
          })}
          confirmLabel={t('confirmDelete.confirm')}
          cancelLabel={t('confirmDelete.cancel')}
          onConfirm={handleDeleteWatchlist}
          onCancel={() => setDeleteConfirmWatchlist(null)}
          variant="danger"
        />
      )}
    </PageLayout>
  );
}
