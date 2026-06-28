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
import { type CreateUserInput, type User } from '../domain/user';
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
