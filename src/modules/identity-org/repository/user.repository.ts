/**
 * User repository. Most methods are tenant-scoped (take a TenantContext). The
 * one deliberate exception is {@link findByEmailGlobal}, used only by login:
 * authentication resolves a user by email BEFORE a tenant context exists, then
 * derives the org from the user. Email is therefore globally unique.
 */

import { type TenantContext, assertSameTenant } from '@common/tenancy/tenant-context';
import type { User } from '../domain/user';

export interface UserRepository {
  create(user: User): Promise<User>;
  update(ctx: TenantContext, user: User): Promise<User>;
  findById(ctx: TenantContext, id: string): Promise<User | null>;
  list(ctx: TenantContext): Promise<User[]>;
  /** Login-only, intentionally un-scoped. Returns null if no such email. */
  findByEmailGlobal(email: string): Promise<User | null>;
}

export class InMemoryUserRepository implements UserRepository {
  private readonly store = new Map<string, User>();

  async create(user: User): Promise<User> {
    this.store.set(user.id, user);
    return user;
  }

  async update(ctx: TenantContext, user: User): Promise<User> {
    assertSameTenant(ctx, user);
    const existing = this.store.get(user.id);
    if (existing) assertSameTenant(ctx, existing);
    this.store.set(user.id, user);
    return user;
  }

  async findById(ctx: TenantContext, id: string): Promise<User | null> {
    const row = this.store.get(id);
    if (!row || row.orgId !== ctx.orgId) return null;
    return row;
  }

  async list(ctx: TenantContext): Promise<User[]> {
    return [...this.store.values()].filter((u) => u.orgId === ctx.orgId);
  }

  async findByEmailGlobal(email: string): Promise<User | null> {
    const needle = email.toLowerCase();
    for (const u of this.store.values()) {
      if (u.email.toLowerCase() === needle) return u;
    }
    return null;
  }
}
