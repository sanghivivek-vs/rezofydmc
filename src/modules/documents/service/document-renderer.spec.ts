import { HtmlDocumentRenderer, escapeHtml } from './document-renderer';

describe('HtmlDocumentRenderer', () => {
  const renderer = new HtmlDocumentRenderer();

  it('wraps content in a full HTML page with the title', () => {
    const doc = renderer.render({ title: 'Quote 1', bodyHtml: '<p>Hi</p>' }, 'quote-1');
    expect(doc.contentType).toBe('text/html; charset=utf-8');
    expect(doc.filename).toBe('quote-1.html');
    expect(doc.body).toContain('<title>Quote 1</title>');
    expect(doc.body).toContain('<p>Hi</p>');
  });

  it('escapeHtml neutralises markup', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });
});
