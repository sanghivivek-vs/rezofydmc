/**
 * Identity & Org module — public service interface (Build guide §4).
 */

export * from './domain/organization';
export * from './domain/user';
export { OrgService, type OrgServiceDeps } from './service/org.service';
export { UserService, type UserServiceDeps } from './service/user.service';
export {
  AuthService,
  type LoginResult,
  type RegisterOrgInput,
  type RegisterOrgResult,
} from './service/auth.service';
export { type TokenService, type AuthClaims } from './service/token.service';
export type { OrgRepository } from './repository/org.repository';
export { InMemoryOrgRepository } from './repository/org.repository';
export type { UserRepository } from './repository/user.repository';
export { InMemoryUserRepository } from './repository/user.repository';
export { IdentityModule } from './identity.module';
