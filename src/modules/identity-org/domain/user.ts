/**
 * User entity (Build guide §3). Belongs to an Organization; has a Role.
 *
 * `passwordHash` never leaves the service layer — controllers return
 * {@link PublicUser}. Owner-only authorization (margins, settings) keys off
 * `role` and is enforced server-side (Build guide §9).
 */

import type { OrgId, Role, UserId } from '@common/tenancy/tenant-context';

export type UserStatus = 'active' | 'disabled';

export interface User {
  readonly id: UserId;
  readonly orgId: OrgId;
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly status: UserStatus;
  readonly passwordHash: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** User shape safe to return over the API (no password hash). */
export type PublicUser = Omit<User, 'passwordHash'>;

export interface CreateUserInput {
  readonly email: string;
  readonly name: string;
  readonly role: Role;
  readonly password: string;
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}
