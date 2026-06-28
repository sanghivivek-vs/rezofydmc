import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import type { PipelineReport } from '../api/types';
import { Card, ErrorText } from '../components/ui';

export function ReportsPage() {
  const [report, setReport] = useState<PipelineReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .pipeline()
      .then(setReport)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'));
  }, []);

  return (
    <div className="space-y-4">
      <ErrorText>{error}</ErrorText>
      {report && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Total enquiries" value={report.total} />
            <Stat label="Won" value={report.won} />
            <Stat label="Lost" value={report.lost} />
          </div>
          <Card title="Pipeline by status">
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(report.byStatus).map(([status, count]) => (
                  <tr key={status} className="border-t border-gray-100">
                    <td className="py-1.5">{status}</td>
                    <td className="text-right font-medium">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </Card>
  );
}
