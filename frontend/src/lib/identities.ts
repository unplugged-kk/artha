import apiClient from './api';
import { rethrowStepUpError, useStepUpTokenStore } from '@/lib/stepUpToken';

/** Step-up purpose guarding link and unlink of sign-in methods. */
export const MANAGE_IDENTITIES_PURPOSE = 'manage-identities';

/** A sign-in method linked to the account (`GET /auth/identities`). */
export interface LinkedIdentity {
  id: string;
  /** Provider connection, e.g. "google-oauth2"; null when the provider did not say. */
  provider: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

function stepUpHeader(): Record<string, string> {
  const token = useStepUpTokenStore.getState().getValid(MANAGE_IDENTITIES_PURPOSE);
  return token ? { 'X-Step-Up-Token': token } : {};
}

export const identitiesApi = {
  getAll: async (): Promise<LinkedIdentity[]> => {
    const res = await apiClient.get<LinkedIdentity[]>('/auth/identities');
    return res.data;
  },

  /** Returns the provider URL that starts the link round trip. */
  startLink: async (): Promise<{ url: string }> => {
    try {
      const res = await apiClient.post<{ url: string }>(
        '/auth/identities/link',
        undefined,
        { headers: stepUpHeader() },
      );
      return res.data;
    } catch (error) {
      rethrowStepUpError(error);
    }
  },

  remove: async (id: string): Promise<{ message: string }> => {
    try {
      const res = await apiClient.delete<{ message: string }>(
        `/auth/identities/${encodeURIComponent(id)}`,
        { headers: stepUpHeader() },
      );
      return res.data;
    } catch (error) {
      rethrowStepUpError(error);
    }
  },

  /**
   * Exchange the artifact an OIDC re-authentication minted for a step-up
   * token, the way the emergency-access page finishes its round trip.
   */
  completeOidcStepUp: async (artifact: string | null): Promise<void> => {
    const res = await apiClient.post<{ stepUpToken: string; expiresAt: string }>(
      '/auth/step-up',
      { purpose: MANAGE_IDENTITIES_PURPOSE, oidcReauthToken: artifact ?? undefined },
    );
    useStepUpTokenStore
      .getState()
      .set(MANAGE_IDENTITIES_PURPOSE, res.data.stepUpToken, res.data.expiresAt);
  },
};
