/**
 * Catalog repository interfaces + in-memory implementations (Build guide §9).
 * Tenant scoping (org_id) is applied centrally here (ADR 0004). The Prisma-backed
 * implementations follow the same pattern in a DB env.
 */

import { type TenantContext, assertSameTenant } from '@common/tenancy/tenant-context';
import type { Supplier } from '../domain/supplier';
import type { Component } from '../domain/component';
import type { Rate } from '../domain/rate';

export interface SupplierRepository {
  create(ctx: TenantContext, supplier: Supplier): Promise<Supplier>;
  findById(ctx: TenantContext, id: string): Promise<Supplier | null>;
  list(ctx: TenantContext): Promise<Supplier[]>;
}

export interface ComponentRepository {
  create(ctx: TenantContext, component: Component): Promise<Component>;
  findById(ctx: TenantContext, id: string): Promise<Component | null>;
  list(ctx: TenantContext): Promise<Component[]>;
}

export interface RateRepository {
  create(ctx: TenantContext, rate: Rate): Promise<Rate>;
  listByComponent(ctx: TenantContext, componentId: string): Promise<Rate[]>;
}

abstract class InMemoryScoped<T extends { id: string; orgId: string }> {
  protected readonly store = new Map<string, T>();

  protected put(ctx: TenantContext, row: T): T {
    assertSameTenant(ctx, row);
    this.store.set(row.id, row);
    return row;
  }

  protected get(ctx: TenantContext, id: string): T | null {
    const row = this.store.get(id);
    if (!row || row.orgId !== ctx.orgId) return null;
    return row;
  }

  protected all(ctx: TenantContext): T[] {
    return [...this.store.values()].filter((r) => r.orgId === ctx.orgId);
  }
}

export class InMemorySupplierRepository
  extends InMemoryScoped<Supplier>
  implements SupplierRepository
{
  async create(ctx: TenantContext, supplier: Supplier): Promise<Supplier> {
    return this.put(ctx, supplier);
  }
  async findById(ctx: TenantContext, id: string): Promise<Supplier | null> {
    return this.get(ctx, id);
  }
  async list(ctx: TenantContext): Promise<Supplier[]> {
    return this.all(ctx);
  }
}

export class InMemoryComponentRepository
  extends InMemoryScoped<Component>
  implements ComponentRepository
{
  async create(ctx: TenantContext, component: Component): Promise<Component> {
    return this.put(ctx, component);
  }
  async findById(ctx: TenantContext, id: string): Promise<Component | null> {
    return this.get(ctx, id);
  }
  async list(ctx: TenantContext): Promise<Component[]> {
    return this.all(ctx);
  }
}

export class InMemoryRateRepository extends InMemoryScoped<Rate> implements RateRepository {
  async create(ctx: TenantContext, rate: Rate): Promise<Rate> {
    return this.put(ctx, rate);
  }
  async listByComponent(ctx: TenantContext, componentId: string): Promise<Rate[]> {
    return this.all(ctx).filter((r) => r.componentId === componentId);
  }
}
