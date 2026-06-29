/**
 * Platform (super-admin) module — public interface.
 */

export * from './domain/platform-admin';
export { PlatformAuthService, type PlatformLoginResult } from './service/platform-auth.service';
export {
  PlatformService,
  type TenantSummary,
  type BroadcastInput,
  type BroadcastResult,
} from './service/platform.service';
export { PlatformTokenService, type PlatformClaims } from './service/platform-token.service';
export type { PlatformAdminRepository } from './repository/platform-admin.repository';
export { InMemoryPlatformAdminRepository } from './repository/platform-admin.repository';
export { PLATFORM_ADMIN_REPOSITORY } from './api/tokens';
export { PlatformModule } from './platform.module';
