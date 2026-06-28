import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ReportsPage } from './ReportsPage';
import { api } from '../api/client';

describe('ReportsPage', () => {
  it('renders the pipeline report', async () => {
    vi.spyOn(api, 'pipeline').mockResolvedValue({
      byStatus: { Won: 2, New: 1 },
      total: 3,
      won: 2,
      lost: 0,
    });

    render(<ReportsPage />);

    await waitFor(() => expect(screen.getByText('Total enquiries')).toBeInTheDocument());
    expect(screen.getByText('3')).toBeInTheDocument(); // total stat
    expect(screen.getAllByText('Won').length).toBeGreaterThanOrEqual(1);
  });
});
