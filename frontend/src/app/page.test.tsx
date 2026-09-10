import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedirect = vi.hoisted(() => vi.fn());
const mockCookiesGet = vi.hoisted(() => vi.fn());
const mockCookiesFn = vi.hoisted(() => vi.fn().mockResolvedValue({ get: mockCookiesGet }));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock('next/headers', () => ({
  cookies: mockCookiesFn,
}));

import HomePage from './page';

describe('HomePage', () => {
  beforeEach(() => {
    mockRedirect.mockClear();
    mockCookiesGet.mockClear();
    mockCookiesFn.mockResolvedValue({ get: mockCookiesGet });
  });

  it('redirects to /dashboard when auth_token cookie exists', async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === 'auth_token') return { value: 'some-token' };
      return undefined;
    });
    await HomePage();
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects to /dashboard when only refresh_token cookie exists', async () => {
    mockCookiesGet.mockImplementation((name: string) => {
      if (name === 'refresh_token') return { value: 'refresh-tok' };
      return undefined;
    });
    await HomePage();
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('redirects to /login when no auth cookies exist', async () => {
    mockCookiesGet.mockReturnValue(undefined);
    await HomePage();
    expect(mockRedirect).toHaveBeenCalledWith('/login');
  });
});
