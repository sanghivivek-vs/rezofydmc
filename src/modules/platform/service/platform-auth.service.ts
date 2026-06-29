/**
 * Platform auth (super-admin). Bootstraps the first platform admin from a deploy
 * secret, then authenticates admins by email + password. Mirrors tenant auth
 * (scrypt hashing, opaque failures) but lives outside tenant scope.
 */

import { ValidationError } from '@common/errors/errors';
import type { Clock } from '@common/clock/clock';
import type { IdGenerator } from '@common/ids/id';
import { hashPassword, verifyPassword } from '@common/auth/password';
import {
  type PlatformAdmin,
  type PublicPlatformAdmin,
  toPublicPlatformAdmin,
} from '../domain/platform-admin';
import type { PlatformAdminRepository } from '../repository/platform-admin.repository';
import { PlatformTokenService } from './platform-token.service';

export interface PlatformLoginResult {
  readonly token: string;
  readonly admin: PublicPlatformAdmin;
}

export interface PlatformAuthDeps {
  readonly repository: PlatformAdminRepository;
  readonly tokens: PlatformTokenService;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
}

export class PlatformAuthService {
  constructor(private readonly deps: PlatformAuthDeps) {}

  /**
   * Create the first platform admin. Idempotently refuses once any admin exists,
   * so the bootstrap endpoint (guarded by a deploy secret) is safe to expose.
   */
  async bootstrapFirstAdmin(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<PublicPlatformAdmin> {
    if ((await this.deps.repository.count()) > 0) {
      throw new ValidationError('A platform admin already exists');
    }
    const email = (input.email ?? '').trim().toLowerCase();
    if (!email.includes('@')) throw new ValidationError('A valid email is required');
    if (!input.name) throw new ValidationError('Name is required');
    if (!input.password || input.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }
    const now = this.deps.clock();
    const admin: PlatformAdmin = {
      id: this.deps.idGenerator('padm'),
      email,
      name: input.name,
      status: 'active',
      passwordHash: hashPassword(input.password),
      createdAt: now,
      updatedAt: now,
    };
    return toPublicPlatformAdmin(await this.deps.repository.create(admin));
  }

  async login(email: string, password: string): Promise<PlatformLoginResult | null> {
    const admin = await this.deps.repository.findByEmail((email ?? '').trim().toLowerCase());
    if (!admin || admin.status !== 'active') return null;
    if (!verifyPassword(password, admin.passwordHash)) return null;
    return { token: this.deps.tokens.sign(admin.id), admin: toPublicPlatformAdmin(admin) };
  }

  async getById(id: string): Promise<PublicPlatformAdmin | null> {
    const admin = await this.deps.repository.findById(id);
    return admin ? toPublicPlatformAdmin(admin) : null;
  }
}
