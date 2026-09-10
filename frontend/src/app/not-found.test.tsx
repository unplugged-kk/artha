import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/render';
import NotFound from './not-found';

describe('NotFound', () => {
  it('renders 404 heading', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders page not found message', () => {
    render(<NotFound />);
    expect(screen.getByText('Page not found')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<NotFound />);
    expect(screen.getByText(/doesn't exist or has been moved/i)).toBeInTheDocument();
  });

  it('renders Go to Dashboard link', () => {
    render(<NotFound />);
    const link = screen.getByRole('link', { name: /Go to Dashboard/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('renders Sign In link', () => {
    render(<NotFound />);
    const link = screen.getByRole('link', { name: /Sign In/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/login');
  });
});
