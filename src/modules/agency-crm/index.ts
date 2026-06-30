/**
 * Agency CRM module — public interface (Build guide §4).
 */

export * from './domain/crm';
export { CrmService, type CrmServiceDeps } from './service/crm.service';
export type { CrmRepository } from './repository/crm.repository';
export { InMemoryCrmRepository } from './repository/crm.repository';
export { CRM_REPOSITORY } from './api/tokens';
export { CrmModule } from './crm.module';
