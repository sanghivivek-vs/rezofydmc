/**
 * Documents module — public interface (Build guide §4).
 */

export * from './domain/document';
export {
  type DocumentRenderer,
  HtmlDocumentRenderer,
  escapeHtml,
} from './service/document-renderer';
export { DocumentService, type DocumentServiceDeps } from './service/document.service';
export { DocumentsModule } from './documents.module';
