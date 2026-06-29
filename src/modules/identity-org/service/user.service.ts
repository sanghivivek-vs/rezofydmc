/**
 * User service (Build guide §4). Handles user creation (with password hashing)
 * and authentication. Owner-only authorization for creating users is enforced at
 * the controller via RolesGuard; the service still validates inputs and tenancy.
 */

import type { TenantContext } from '@common/tenancy/tenant-context';
import { NotFoundError, ValidationError } from '@common/errors/errors';
import type { Clock } from '@common/clock/clock';
import type { IdGenerator } from '@common/ids/id';
import { hashPassword, verifyPassword } from '@common/auth/password';
import {
  type CreateUserInput,
  type UpdateUserInput,
  type User,
  isRole,
  losesActiveOwner,
} from '../domain/user';
import type { UserRepository } from '../repository/user.repository';

export interface UserServiceDeps {
  readonly repository: UserRepository;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
}

export class UserService {
  private readonly repo: UserRepository;
  private readonly clock: Clock;
  private readonly newId: IdGenerator;

  constructor(deps: UserServiceDeps) {
    this.repo = deps.repository;
    this.clock = deps.clock;
    this.newId = deps.idGenerator;
  }

  async create(ctx: TenantContext, input: CreateUserInput): Promise<User> {
    const email = normaliseEmail(input.email);
    if (!email.includes('@')) throw new ValidationError('A valid email is required');
    if (!input.name) throw new ValidationError('User name is required');

    const existing = await this.repo.findByEmailGlobal(email);
    if (existing) throw new ValidationError('A user with this email already exists', { email });

    const now = this.clock();
    const user: User = {
      id: this.newId('usr'),
      orgId: ctx.orgId,
      email,
      name: input.name,
      role: input.role,
      status: 'active',
      passwordHash: hashPassword(input.password),
      createdAt: now,
      updatedAt: now,
    };
    return this.repo.create(user);
  }

  /**
   * Administer an existing user: change name, role, or status (enable/disable).
   * Owner-gated at the controller. Refuses to remove the last active Owner so a
   * tenant can never lock itself out of administration.
   */
  async update(ctx: TenantContext, userId: string, input: UpdateUserInput): Promise<User> {
    const user = await this.repo.findById(ctx, userId);
    if (!user) throw new NotFoundError(`User ${userId} not found`, { userId });

    if (input.role !== undefined && !isRole(input.role)) {
      throw new ValidationError('Invalid role', { role: input.role });
    }
    if (input.status !== undefined && input.status !== 'active' && input.status !== 'disabled') {
      throw new ValidationError('Invalid status', { status: input.status });
    }
    if (input.name !== undefined && !input.name.trim()) {
      throw new ValidationError('User name cannot be empty');
    }

    const next = {
      ...user,
      name: input.name?.trim() ?? user.name,
      role: input.role ?? user.role,
      status: input.status ?? user.status,
    };

    if (losesActiveOwner(user, next) && !(await this.hasAnotherActiveOwner(ctx, user.id))) {
      throw new ValidationError('Cannot remove the last active Owner of the organization');
    }

    return this.repo.update(ctx, { ...next, updatedAt: this.clock() });
  }

  /** Self-service: change your own password after re-entering the current one. */
  async changeOwnPassword(
    ctx: TenantContext,
    currentPassword: string,
    newPassword: string,
  ): Promise<User> {
    assertPasswordPolicy(newPassword);
    const user = await this.repo.findById(ctx, ctx.userId);
    if (!user) throw new NotFoundError('Current user not found');
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw new ValidationError('Current password is incorrect');
    }
    return this.repo.update(ctx, {
      ...user,
      passwordHash: hashPassword(newPassword),
      updatedAt: this.clock(),
    });
  }

  /** Owner action: set a new password for another user (e.g. lockout recovery). */
  async adminResetPassword(ctx: TenantContext, userId: string, newPassword: string): Promise<User> {
    assertPasswordPolicy(newPassword);
    const user = await this.repo.findById(ctx, userId);
    if (!user) throw new NotFoundError(`User ${userId} not found`, { userId });
    return this.repo.update(ctx, {
      ...user,
      passwordHash: hashPassword(newPassword),
      updatedAt: this.clock(),
    });
  }

  private async hasAnotherActiveOwner(ctx: TenantContext, excludeUserId: string): Promise<boolean> {
    const users = await this.repo.list(ctx);
    return users.some((u) => u.id !== excludeUserId && u.role === 'Owner' && u.status === 'active');
  }

  async getMe(ctx: TenantContext): Promise<User> {
    const user = await this.repo.findById(ctx, ctx.userId);
    if (!user) throw new NotFoundError('Current user not found');
    return user;
  }

  async list(ctx: TenantContext): Promise<User[]> {
    return this.repo.list(ctx);
  }

  /**
   * Resolve a user by email + password for login. Returns null on ANY failure
   * (unknown email, disabled, wrong password) so callers cannot distinguish
   * which check failed.
   */
  async authenticate(email: string, password: string): Promise<User | null> {
    const user = await this.repo.findByEmailGlobal(normaliseEmail(email));
    if (!user || user.status !== 'active') return null;
    if (!verifyPassword(password, user.passwordHash)) return null;
    return user;
  }

  // ---- GDPR (ADR 0008) --------------------------------------------------

  /** The personal data held about a staff user (no credential material). */
  async exportPersonalData(ctx: TenantContext, userId: string): Promise<Record<string, unknown>> {
    const user = await this.repo.findById(ctx, userId);
    if (!user) throw new NotFoundError(`User ${userId} not found`, { userId });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  /**
   * Right to erasure: anonymise the user in place. The row and id are retained
   * for referential integrity and the audit trail, but all PII and credential
   * material are tombstoned and the account is disabled. Idempotent.
   */
  async anonymise(ctx: TenantContext, userId: string): Promise<User> {
    const user = await this.repo.findById(ctx, userId);
    if (!user) throw new NotFoundError(`User ${userId} not found`, { userId });
    const erased: User = {
      ...user,
      email: `erased+${user.id}@erased.invalid`,
      name: 'ERASED',
      passwordHash: '',
      status: 'disabled',
      updatedAt: this.clock(),
    };
    return this.repo.update(ctx, erased);
  }
}

function normaliseEmail(email: string): string {
  return (email ?? '').trim().toLowerCase();
}

function assertPasswordPolicy(password: string): void {
  if (!password || password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }
}
