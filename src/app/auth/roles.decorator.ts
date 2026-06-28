import { SetMetadata } from '@nestjs/common';
import type { Role } from '@common/tenancy/tenant-context';

export const ROLES_KEY = 'required_roles';

/** Restrict a route to one or more roles (checked by {@link RolesGuard}). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
