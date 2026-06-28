/**
 * Token abstraction for auth sessions. The service signs/verifies short-lived
 * bearer tokens carrying the tenant claims. A JWT implementation is provided in
 * the module; tests use a fake. Keeping this an interface lets AuthService and
 * the guard stay decoupled from the JWT library.
 */

import type { OrgId, Role, UserId } from '@common/tenancy/tenant-context';

export interface AuthClaims {
  readonly sub: UserId;
  readonly orgId: OrgId;
  readonly role: Role;
}

export interface TokenService {
  sign(claims: AuthClaims): string;
  /** Returns the claims, or throws if the token is invalid/expired. */
  verify(token: string): AuthClaims;
}
