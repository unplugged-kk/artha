'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StepUpAuthModal } from '@/components/auth/StepUpAuthModal';
import { useDateFormat } from '@/hooks/useDateFormat';
import {
  identitiesApi,
  LinkedIdentity,
  MANAGE_IDENTITIES_PURPOSE,
} from '@/lib/identities';
import {
  StepUpRequiredError,
  consumeOidcReauthArtifact,
  consumeOidcStepUpPending,
  useStepUpTokenStore,
} from '@/lib/stepUpToken';
import { isEmailConnection, oidcProviderBrand } from '@/lib/oidc-providers';
import { getErrorMessage } from '@/lib/errors';
import type { User } from '@/types/auth';

/** What to do once the step-up is proven: start a link, or remove one identity. */
type PendingAction = { action: 'link' } | { action: 'remove'; id: string };

interface SignInMethodsSectionProps {
  /** The owner's own profile; the step-up modal picks its factor from it. */
  user: User;
  /** Whether the provider is configured at all; linking needs it. */
  oidcEnabled: boolean;
}

/**
 * Settings > Security: the provider identities linked to this account, with
 * link and remove behind a `manage-identities` step-up. Owner view only: the
 * endpoints refuse a delegate, so the delegate Settings view never renders it.
 */
export function SignInMethodsSection({ user, oidcEnabled }: SignInMethodsSectionProps) {
  const t = useTranslations('settings.signInMethods');
  const { formatDate } = useDateFormat();
  const clearStepUp = useStepUpTokenStore((s) => s.clear);

  const [identities, setIdentities] = useState<LinkedIdentity[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<LinkedIdentity | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const providerLabel = (provider: string | null) =>
    !provider
      ? t('unknownProvider')
      : isEmailConnection(provider)
        ? t('emailPassword')
        : oidcProviderBrand(provider);

  const load = useCallback(async () => {
    try {
      setIdentities(await identitiesApi.getAll());
    } catch (error) {
      setIdentities([]);
      toast.error(getErrorMessage(error, t('toasts.loadFailed')));
    }
  }, [t]);

  const run = useCallback(
    async (action: PendingAction) => {
      setBusy(true);
      try {
        if (action.action === 'link') {
          const { url } = await identitiesApi.startLink();
          window.location.assign(url);
          return;
        }
        const { message } = await identitiesApi.remove(action.id);
        toast.success(message || t('toasts.removed'));
        await load();
      } catch (error) {
        if (error instanceof StepUpRequiredError) {
          clearStepUp(MANAGE_IDENTITIES_PURPOSE);
          setPending(action);
          return;
        }
        // 409 LAST_SIGN_IN_METHOD carries the server's explanation; show it.
        toast.error(
          getErrorMessage(
            error,
            action.action === 'link' ? t('toasts.linkFailed') : t('toasts.removeFailed'),
          ),
        );
      } finally {
        setBusy(false);
      }
    },
    [clearStepUp, load, t],
  );

  const request = (action: PendingAction) => {
    if (useStepUpTokenStore.getState().getValid(MANAGE_IDENTITIES_PURPOSE)) {
      void run(action);
    } else {
      setPending(action);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  // Back from an OIDC re-authentication: spend the artifact for a step-up token
  // and resume the action the user started. The sentinel is consumed on read,
  // so this runs at most once per round trip.
  useEffect(() => {
    const resumed = consumeOidcStepUpPending(MANAGE_IDENTITIES_PURPOSE);
    if (!resumed) return;
    const action = resumed.payload as PendingAction | undefined;
    (async () => {
      try {
        await identitiesApi.completeOidcStepUp(consumeOidcReauthArtifact());
      } catch (error) {
        toast.error(getErrorMessage(error, t('toasts.reauthFailed')));
        return;
      }
      if (action?.action === 'link' || (action?.action === 'remove' && action.id)) {
        await run(action);
      }
    })();
    // Once per mount: the sentinel is gone after the first read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card padding="md" className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('heading')}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('description')}</p>
        </div>
        {oidcEnabled && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => request({ action: 'link' })}
          >
            {t('linkButton')}
          </Button>
        )}
      </div>

      {identities === null ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="sm" fullContainer={false} />
        </div>
      ) : identities.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('empty')}</p>
      ) : (
        <ul className="space-y-3">
          {identities.map((identity) => (
            <li
              key={identity.id}
              className="flex items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {providerLabel(identity.provider)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('linkedOn', { date: formatDate(new Date(identity.createdAt)) })}
                  {' \u00B7 '}
                  {identity.lastLoginAt
                    ? t('lastUsed', { date: formatDate(new Date(identity.lastLoginAt)) })
                    : t('neverUsed')}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setRemoveTarget(identity)}
                className="shrink-0"
              >
                {t('removeButton')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={!!removeTarget}
        title={t('confirmTitle')}
        message={t('confirmMessage', {
          provider: removeTarget ? providerLabel(removeTarget.provider) : '',
        })}
        confirmLabel={t('removeButton')}
        variant="danger"
        pushHistory
        onConfirm={() => {
          const target = removeTarget;
          setRemoveTarget(null);
          if (target) request({ action: 'remove', id: target.id });
        }}
        onCancel={() => setRemoveTarget(null)}
      />

      <StepUpAuthModal
        isOpen={!!pending}
        purpose={MANAGE_IDENTITIES_PURPOSE}
        authProvider={user.authProvider}
        hasPassword={user.hasPassword ?? false}
        reason={t('stepUpReason')}
        oidcReturnTo="/settings#security"
        oidcResumePayload={pending ?? undefined}
        onClose={() => setPending(null)}
        onVerified={() => {
          const action = pending;
          setPending(null);
          if (action) void run(action);
        }}
      />
    </Card>
  );
}
