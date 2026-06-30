/**
 * CRM repository (Build guide §9). One repository for the agency bounded context
 * (agencies + contacts + interactions). Tenant scoping (org_id) is applied
 * centrally here (ADR 0004); the Prisma implementation follows the same shape.
 */

import { type TenantContext, assertSameTenant } from '@common/tenancy/tenant-context';
import type { Agency, Contact, Interaction } from '../domain/crm';

export interface CrmRepository {
  createAgency(ctx: TenantContext, agency: Agency): Promise<Agency>;
  updateAgency(ctx: TenantContext, agency: Agency): Promise<Agency>;
  findAgency(ctx: TenantContext, id: string): Promise<Agency | null>;
  listAgencies(ctx: TenantContext): Promise<Agency[]>;

  createContact(ctx: TenantContext, contact: Contact): Promise<Contact>;
  updateContact(ctx: TenantContext, contact: Contact): Promise<Contact>;
  findContact(ctx: TenantContext, id: string): Promise<Contact | null>;
  listContacts(ctx: TenantContext, agencyId: string): Promise<Contact[]>;
  deleteContact(ctx: TenantContext, id: string): Promise<void>;

  createInteraction(ctx: TenantContext, interaction: Interaction): Promise<Interaction>;
  listInteractions(ctx: TenantContext, agencyId: string): Promise<Interaction[]>;
}

function scopedGet<T extends { orgId: string }>(
  store: Map<string, T>,
  ctx: TenantContext,
  id: string,
): T | null {
  const row = store.get(id);
  if (!row || row.orgId !== ctx.orgId) return null;
  return row;
}

export class InMemoryCrmRepository implements CrmRepository {
  private readonly agencies = new Map<string, Agency>();
  private readonly contacts = new Map<string, Contact>();
  private readonly interactions = new Map<string, Interaction>();

  async createAgency(ctx: TenantContext, agency: Agency): Promise<Agency> {
    assertSameTenant(ctx, agency);
    this.agencies.set(agency.id, agency);
    return agency;
  }
  async updateAgency(ctx: TenantContext, agency: Agency): Promise<Agency> {
    assertSameTenant(ctx, agency);
    this.agencies.set(agency.id, agency);
    return agency;
  }
  async findAgency(ctx: TenantContext, id: string): Promise<Agency | null> {
    return scopedGet(this.agencies, ctx, id);
  }
  async listAgencies(ctx: TenantContext): Promise<Agency[]> {
    return [...this.agencies.values()].filter((a) => a.orgId === ctx.orgId);
  }

  async createContact(ctx: TenantContext, contact: Contact): Promise<Contact> {
    assertSameTenant(ctx, contact);
    this.contacts.set(contact.id, contact);
    return contact;
  }
  async updateContact(ctx: TenantContext, contact: Contact): Promise<Contact> {
    assertSameTenant(ctx, contact);
    this.contacts.set(contact.id, contact);
    return contact;
  }
  async findContact(ctx: TenantContext, id: string): Promise<Contact | null> {
    return scopedGet(this.contacts, ctx, id);
  }
  async listContacts(ctx: TenantContext, agencyId: string): Promise<Contact[]> {
    return [...this.contacts.values()].filter(
      (c) => c.orgId === ctx.orgId && c.agencyId === agencyId,
    );
  }
  async deleteContact(ctx: TenantContext, id: string): Promise<void> {
    const row = scopedGet(this.contacts, ctx, id);
    if (row) this.contacts.delete(id);
  }

  async createInteraction(ctx: TenantContext, interaction: Interaction): Promise<Interaction> {
    assertSameTenant(ctx, interaction);
    this.interactions.set(interaction.id, interaction);
    return interaction;
  }
  async listInteractions(ctx: TenantContext, agencyId: string): Promise<Interaction[]> {
    return [...this.interactions.values()]
      .filter((i) => i.orgId === ctx.orgId && i.agencyId === agencyId)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  }
}
