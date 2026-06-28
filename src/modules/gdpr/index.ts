/**
 * GDPR module — public interface (ADR 0008).
 */

export * from './domain/pii';
export * from './domain/consent';
export { GdprService, type GdprServiceDeps, type DataExport } from './service/gdpr.service';
export type { ConsentRepository } from './repository/consent.repository';
export { InMemoryConsentRepository } from './repository/consent.repository';
export { GdprModule } from './gdpr.module';
