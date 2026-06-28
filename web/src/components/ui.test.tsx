import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button, money } from './ui';

describe('ui helpers', () => {
  it('formats money in major units', () => {
    expect(money({ amountMinor: 24000, currency: 'CHF' })).toBe('240.00 CHF');
    expect(money()).toBe('—');
  });

  it('renders a button', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
  });
});
