/**
 * Document renderer port (Build guide §4 Documents). The service builds an HTML
 * fragment; the renderer turns it into a final document. The HTML renderer is
 * dependency-free and used everywhere; a PDF renderer (e.g. a headless-browser
 * or PDF engine) can be swapped in behind this same port without changing the
 * service — mirroring how persistence and webhook transport are abstracted.
 */

import type { DocumentContent, RenderedDocument } from '../domain/document';

export interface DocumentRenderer {
  render(content: DocumentContent, filename: string): RenderedDocument;
}

/** Escape text for safe interpolation into HTML. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BASE_STYLES = `
  body { font-family: Arial, Helvetica, sans-serif; color: #222; margin: 2rem; }
  h1 { font-size: 1.5rem; } h2 { font-size: 1.1rem; margin-top: 1.5rem; }
  table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
  th { background: #f5f5f5; } .total { font-weight: bold; }
  .muted { color: #777; font-size: 0.85rem; }
`;

export class HtmlDocumentRenderer implements DocumentRenderer {
  render(content: DocumentContent, filename: string): RenderedDocument {
    const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(content.title)}</title>
<style>${BASE_STYLES}</style></head>
<body>
${content.bodyHtml}
</body>
</html>`;
    return {
      filename: filename.endsWith('.html') ? filename : `${filename}.html`,
      contentType: 'text/html; charset=utf-8',
      body: html,
    };
  }
}
