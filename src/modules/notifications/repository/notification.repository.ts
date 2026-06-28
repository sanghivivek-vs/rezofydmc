import { type TenantContext, assertSameTenant } from '@common/tenancy/tenant-context';
import type { Notification } from '../domain/notification';

export interface NotificationRepository {
  create(ctx: TenantContext, notification: Notification): Promise<Notification>;
  list(ctx: TenantContext): Promise<Notification[]>;
  findById(ctx: TenantContext, id: string): Promise<Notification | null>;
  markRead(ctx: TenantContext, id: string): Promise<Notification | null>;
}

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly store = new Map<string, Notification>();

  async create(ctx: TenantContext, n: Notification): Promise<Notification> {
    assertSameTenant(ctx, n);
    this.store.set(n.id, n);
    return n;
  }
  async list(ctx: TenantContext): Promise<Notification[]> {
    return [...this.store.values()]
      .filter((n) => n.orgId === ctx.orgId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  async findById(ctx: TenantContext, id: string): Promise<Notification | null> {
    const n = this.store.get(id);
    if (!n || n.orgId !== ctx.orgId) return null;
    return n;
  }
  async markRead(ctx: TenantContext, id: string): Promise<Notification | null> {
    const n = await this.findById(ctx, id);
    if (!n) return null;
    const updated = { ...n, read: true };
    this.store.set(id, updated);
    return updated;
  }
}
