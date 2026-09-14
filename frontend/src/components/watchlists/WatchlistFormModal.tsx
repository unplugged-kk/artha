'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Watchlist } from '@/types/watchlist';

interface WatchlistFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; description?: string }) => Promise<void>;
  watchlist?: Watchlist | null;
}

export function WatchlistFormModal({
  isOpen,
  onClose,
  onSave,
  watchlist,
}: WatchlistFormModalProps) {
  const t = useTranslations('watchlists');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (watchlist) {
      setName(watchlist.name);
      setDescription(watchlist.description || '');
    } else {
      setName('');
      setDescription('');
    }
    setError(null);
  }, [watchlist, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('form.nameLabel') + ' is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave({
        name: trimmed,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={watchlist ? t('editWatchlist') : t('newWatchlist')}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="watchlist-name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {t('form.nameLabel')}
          </label>
          <input
            id="watchlist-name"
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('form.namePlaceholder')}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="watchlist-description"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {t('form.descriptionLabel')}
          </label>
          <textarea
            id="watchlist-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('form.descriptionPlaceholder')}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t('form.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !name.trim()}
          >
            {isSubmitting ? '...' : watchlist ? t('form.save') : t('form.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
