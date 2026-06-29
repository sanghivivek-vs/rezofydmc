/**
 * PlatformAdmin repository. Not tenant-scoped (the platform tier spans tenants).
 * Email is globally unique.
 */

import type { PlatformAdmin } from '../domain/platform-admin';

export interface PlatformAdminRepository {
  create(admin: PlatformAdmin): Promise<PlatformAdmin>;
  findByEmail(email: string): Promise<PlatformAdmin | null>;
  findById(id: string): Promise<PlatformAdmin | null>;
  count(): Promise<number>;
}

export class InMemoryPlatformAdminRepository implements PlatformAdminRepository {
  private readonly store = new Map<string, PlatformAdmin>();

  async create(admin: PlatformAdmin): Promise<PlatformAdmin> {
    this.store.set(admin.id, admin);
    return admin;
  }

  async findByEmail(email: string): Promise<PlatformAdmin | null> {
    const needle = email.toLowerCase();
    for (const a of this.store.values()) {
      if (a.email.toLowerCase() === needle) return a;
    }
    return null;
  }

  async findById(id: string): Promise<PlatformAdmin | null> {
    return this.store.get(id) ?? null;
  }

  async count(): Promise<number> {
    return this.store.size;
  }
}
