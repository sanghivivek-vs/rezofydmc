/**
 * Document domain types (Build guide §3 Documents, §10 Quote PDF).
 */

/** Inner content a renderer turns into a final document. */
export interface DocumentContent {
  readonly title: string;
  /** Body HTML fragment (already escaped by the builder). */
  readonly bodyHtml: string;
}

export interface RenderedDocument {
  readonly filename: string;
  readonly contentType: string;
  readonly body: string;
}
