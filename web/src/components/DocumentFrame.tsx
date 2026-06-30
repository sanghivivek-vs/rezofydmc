import { useEffect, useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { Button, ErrorText, Spinner } from './ui';

/**
 * Renders an authenticated, server-rendered HTML document (quote, voucher,
 * costing sheet) inline, with a Print → Save-as-PDF action. Fetches with the
 * bearer token so it works even though the endpoint is auth-gated.
 */
export function DocumentFrame({ path, height = '70vh' }: { path: string; height?: string }) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setHtml('');
    setError('');
    api
      .fetchDocument(path)
      .then(setHtml)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load document'));
  }, [path]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => frameRef.current?.contentWindow?.print()}
          disabled={!html}
        >
          <Printer className="h-4 w-4" /> Print / PDF
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
      {html ? (
        <iframe
          ref={frameRef}
          title="document"
          srcDoc={html}
          className="w-full rounded-lg border border-slate-200 bg-white"
          style={{ height }}
        />
      ) : (
        !error && (
          <div className="flex items-center gap-2 p-8 text-slate-400">
            <Spinner /> Rendering document…
          </div>
        )
      )}
    </div>
  );
}
