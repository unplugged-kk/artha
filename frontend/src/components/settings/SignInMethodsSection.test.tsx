import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@/test/render';
import toast from 'react-hot-toast';
import { SignInMethodsSection } from './SignInMethodsSection';
import { useStepUpTokenStore } from '@/lib/stepUpToken';
import type { User } from '@/types/auth';

// The modal is covered by its own tests; this stub stamps a token and verifies.
vi.mock('@/components/auth/StepUpAuthModal', () => ({
  StepUpAuthModal: ({ isOpen, purpose, onVerified }: any) =>
    isOpen ? (
      <div data-testid="step-up-modal" data-purpose={purpose}>
        <button
          onClick={() => {
            useStepUpTokenStore
              .getState()
              .set(purpose, 'step-up-1', new Date(Date.now() + 300_000).toISOString());
            onVerified?.();
          }}
        >
          Mock Verify
        </button>
      </div>
    ) : null,
}));

vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
import apiClient from '@/lib/api';
const api = apiClient as unknown as Record<'get' | 'post' | 'delete', ReturnType<typeof vi.fn>>;

const user = { id: 'u1', authProvider: 'local', hasPassword: true } as User;

const identities = [
  {
    id: 'id-1',
    provider: 'google-oauth2',
    createdAt: '2025-01-02T10:00:00Z',
    lastLoginAt: '2025-03-04T10:00:00Z',
  },
  { id: 'id-2', provider: 'github', createdAt: '2025-02-01T10:00:00Z', lastLoginAt: null },
];

function stepUpError() {
  return Object.assign(new Error('forbidden'), {
    isAxiosError: true,
    response: { status: 403, data: { code: 'STEP_UP_REQUIRED', purpose: 'manage-identities' } },
  });
}

describe('SignInMethodsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStepUpTokenStore.getState().clear('manage-identities');
    sessionStorage.clear();
    api.get.mockResolvedValue({ data: identities });
  });

  it('lists linked identities with provider, linked date and last use', async () => {
    render(<SignInMethodsSection user={user} oidcEnabled />);
    expect(await screen.findByText('Google')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText(/Never used/)).toBeInTheDocument();
    expect(screen.getAllByText(/Linked /)).toHaveLength(2);
    expect(api.get).toHaveBeenCalledWith('/auth/identities');
  });

  it('hides the link action when the provider is not configured', async () => {
    render(<SignInMethodsSection user={user} oidcEnabled={false} />);
    await screen.findByText('Google');
    expect(
      screen.queryByRole('button', { name: 'Link another sign-in method' }),
    ).not.toBeInTheDocument();
  });

  it('steps up for manage-identities, then follows the link URL', async () => {
    const assign = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, assign },
      configurable: true,
      writable: true,
    });
    api.post.mockResolvedValue({ data: { url: 'https://idp.example/authorize?x=1' } });
    render(<SignInMethodsSection user={user} oidcEnabled />);
    await screen.findByText('Google');

    fireEvent.click(screen.getByRole('button', { name: 'Link another sign-in method' }));
    expect(screen.getByTestId('step-up-modal')).toHaveAttribute('data-purpose', 'manage-identities');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Mock Verify' }));
    });

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://idp.example/authorize?x=1'));
    expect(api.post).toHaveBeenCalledWith('/auth/identities/link', undefined, {
      headers: { 'X-Step-Up-Token': 'step-up-1' },
    });
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      configurable: true,
      writable: true,
    });
  });

  it('removes an identity after confirmation and reloads the list', async () => {
    useStepUpTokenStore
      .getState()
      .set('manage-identities', 'step-up-1', new Date(Date.now() + 300_000).toISOString());
    api.delete.mockResolvedValue({ data: { message: 'Sign-in method removed' } });
    render(<SignInMethodsSection user={user} oidcEnabled />);
    await screen.findByText('Google');

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(screen.getByText('Remove sign-in method?')).toBeInTheDocument();
    expect(screen.getByText('You will no longer be able to sign in with Google.')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Remove' }).at(-1)!);
    });

    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith('/auth/identities/id-1', {
        headers: { 'X-Step-Up-Token': 'step-up-1' },
      }),
    );
    expect(toast.success).toHaveBeenCalledWith('Sign-in method removed');
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it('shows the server message when removing the last sign-in method', async () => {
    useStepUpTokenStore
      .getState()
      .set('manage-identities', 'step-up-1', new Date(Date.now() + 300_000).toISOString());
    api.delete.mockRejectedValue({
      response: {
        status: 409,
        data: { code: 'LAST_SIGN_IN_METHOD', message: 'This is your only way to sign in.' },
      },
    });
    render(<SignInMethodsSection user={user} oidcEnabled />);
    await screen.findByText('Google');

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Remove' }).at(-1)!);
    });

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('This is your only way to sign in.'),
    );
  });

  it('re-prompts when the server rejects the step-up token', async () => {
    useStepUpTokenStore
      .getState()
      .set('manage-identities', 'stale', new Date(Date.now() + 300_000).toISOString());
    api.post.mockRejectedValue(stepUpError());
    render(<SignInMethodsSection user={user} oidcEnabled />);
    await screen.findByText('Google');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Link another sign-in method' }));
    });
    expect(await screen.findByTestId('step-up-modal')).toBeInTheDocument();
    expect(useStepUpTokenStore.getState().getValid('manage-identities')).toBeNull();
  });

  it('resumes a removal after an OIDC re-authentication round trip', async () => {
    sessionStorage.setItem(
      'stepUpOidcPending',
      JSON.stringify({ purpose: 'manage-identities', payload: { action: 'remove', id: 'id-2' } }),
    );
    sessionStorage.setItem('oidcReauthArtifact', 'signed.artifact');
    api.post.mockResolvedValue({
      data: { stepUpToken: 'oidc-token', expiresAt: new Date(Date.now() + 300_000).toISOString() },
    });
    api.delete.mockResolvedValue({ data: { message: 'Removed' } });
    render(<SignInMethodsSection user={user} oidcEnabled />);

    await waitFor(() =>
      expect(api.delete).toHaveBeenCalledWith('/auth/identities/id-2', {
        headers: { 'X-Step-Up-Token': 'oidc-token' },
      }),
    );
    expect(api.post).toHaveBeenCalledWith('/auth/step-up', {
      purpose: 'manage-identities',
      oidcReauthToken: 'signed.artifact',
    });
    expect(sessionStorage.getItem('stepUpOidcPending')).toBeNull();
  });
});
