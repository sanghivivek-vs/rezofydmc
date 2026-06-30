import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogPage } from './CatalogPage';
import { api } from '../api/client';
import type { Component, Rate, Supplier } from '../api/types';

const suppliers: Supplier[] = [
  { id: 's1', name: 'Taj Hotels', currency: 'INR', type: 'Hotel', region: 'Goa' },
];
const components: Component[] = [
  { id: 'c1', name: 'Daily Breakfast', type: 'Meal', supplierId: 's1', unitBasis: 'per_pax' },
];
const rates: Rate[] = [
  {
    id: 'r1',
    componentId: 'c1',
    unitBasis: 'per_pax',
    net: { amountMinor: 120000, currency: 'INR' },
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    season: 'All-year',
  },
];

describe('CatalogPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'listSuppliers').mockResolvedValue(suppliers);
    vi.spyOn(api, 'listComponents').mockResolvedValue(components);
    vi.spyOn(api, 'listRates').mockResolvedValue(rates);
  });

  it('shows suppliers and components, and loads rates on expand', async () => {
    render(<CatalogPage />);
    await waitFor(() => expect(screen.getByText('Taj Hotels')).toBeInTheDocument());
    expect(screen.getByText('Daily Breakfast')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Daily Breakfast'));
    await waitFor(() => expect(api.listRates).toHaveBeenCalledWith('c1'));
    expect(await screen.findByText('1200.00 INR')).toBeInTheDocument();
  });
});
