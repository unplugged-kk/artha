import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@/test/render';
import { GettingStarted } from './GettingStarted';
import { useTourStore } from '@/store/tourStore';
import { useDemoStore } from '@/store/demoStore';

const mockUpdatePreferences = vi.fn();

vi.mock('@/store/preferencesStore', () => ({
  usePreferencesStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      preferences: { gettingStartedDismissed: false },
      updatePreferences: mockUpdatePreferences,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/lib/user-settings', () => ({
  userSettingsApi: { updatePreferences: vi.fn().mockResolvedValue({}) },
}));

describe('GettingStarted', () => {
  it('renders getting started steps', () => {
    render(<GettingStarted />);
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Review your settings')).toBeInTheDocument();
    expect(screen.getByText('Set up categories')).toBeInTheDocument();
    expect(screen.getByText('Add your first account')).toBeInTheDocument();
    expect(screen.getByText('Import from QIF')).toBeInTheDocument();
    expect(screen.getByText('Connect an AI provider')).toBeInTheDocument();
    expect(screen.getByText('Choose notifications')).toBeInTheDocument();
  });

  it('renders links to appropriate pages', () => {
    render(<GettingStarted />);
    const links = screen.getAllByRole('link');
    const hrefs = links.map((l) => l.getAttribute('href'));
    expect(hrefs).toContain('/settings');
    expect(hrefs).toContain('/categories');
    expect(hrefs).toContain('/accounts');
    expect(hrefs).toContain('/import');
    expect(hrefs).toContain('/settings/ai');
    expect(hrefs).toContain('/settings#notifications');
  });

  it('offers six distinct steps, none repeated', () => {
    render(<GettingStarted />);
    const hrefs = screen.getAllByRole('link').map((l) => l.getAttribute('href'));
    expect(hrefs).toHaveLength(6);
    expect(new Set(hrefs).size).toBe(6);
  });

  it('every step is a real link a keyboard can reach, with a name and a description', () => {
    render(<GettingStarted />);
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('tabindex')).not.toBe('-1');
      expect((link.textContent ?? '').trim().length).toBeGreaterThan(10);
    }
  });

  it('decorative step icons are hidden from assistive technology', () => {
    const { container } = render(<GettingStarted />);
    const aiLink = container.querySelector('a[href="/settings/ai"] svg');
    const bellLink = container.querySelector('a[href="/settings#notifications"] svg');
    expect(aiLink?.getAttribute('aria-hidden')).toBe('true');
    expect(bellLink?.getAttribute('aria-hidden')).toBe('true');
  });

  it('calls updatePreferences on dismiss', () => {
    render(<GettingStarted />);
    const dismissBtn = screen.getByTitle('Dismiss');
    fireEvent.click(dismissBtn);
    expect(mockUpdatePreferences).toHaveBeenCalledWith({ gettingStartedDismissed: true });
  });
});

describe('GettingStarted tour CTA', () => {
  beforeEach(() => {
    useTourStore.setState({ active: null, progress: {}, progressLoaded: true });
    useDemoStore.setState({ isDemoMode: false });
  });
  afterEach(() => cleanup());

  it('starts the introduction tour from the CTA', () => {
    render(<GettingStarted />);
    fireEvent.click(screen.getByText('Take the tour'));
    expect(useTourStore.getState().active?.tour.id).toBe('intro/basics');
  });

  it('flips to "Retake the tour" once the intro is completed', () => {
    useTourStore.setState({
      progress: { 'intro/basics': { status: 'completed', updatedAt: 'now' } },
    });
    render(<GettingStarted />);
    expect(screen.getByText('Retake the tour')).toBeInTheDocument();
  });

  it('hides the CTA in demo mode', () => {
    useDemoStore.setState({ isDemoMode: true });
    render(<GettingStarted />);
    expect(screen.queryByText('Take the tour')).toBeNull();
  });
});
