/**
 * PlatformAdmin — a super-admin operating ABOVE all tenants (Build guide §3
 * tenancy; platform tier). Deliberately NOT org-scoped: this is the one identity
 * that spans tenants, so it lives in its own store and authenticates through its
 * own login, never mixing with tenant users.
 */

export type PlatformAdminStatus = 'active' | 'disabled';

export interface PlatformAdmin {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly status: PlatformAdminStatus;
  readonly passwordHash: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type PublicPlatformAdmin = Omit<PlatformAdmin, 'passwordHash'>;

export function toPublicPlatformAdmin(admin: PlatformAdmin): PublicPlatformAdmin {
  const { passwordHash: _passwordHash, ...rest } = admin;
  return rest;
}
