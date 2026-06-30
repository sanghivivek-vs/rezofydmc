/**
 * CRM service (Build guide §4). Agency counterparty records, their contacts, and
 * interaction history. All operations are tenant-scoped via TenantContext.
 */

import type { TenantContext } from '@common/tenancy/tenant-context';
import { NotFoundError, ValidationError } from '@common/errors/errors';
import type { Clock } from '@common/clock/clock';
import type { IdGenerator } from '@common/ids/id';
import {
  type Agency,
  type Contact,
  type CreateAgencyInput,
  type CreateContactInput,
  type Interaction,
  type LogInteractionInput,
  type UpdateAgencyInput,
  type UpdateContactInput,
  INTERACTION_TYPES,
} from '../domain/crm';
import type { CrmRepository } from '../repository/crm.repository';

export interface CrmServiceDeps {
  readonly repository: CrmRepository;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
}

export class CrmService {
  private readonly repo: CrmRepository;
  private readonly clock: Clock;
  private readonly newId: IdGenerator;

  constructor(deps: CrmServiceDeps) {
    this.repo = deps.repository;
    this.clock = deps.clock;
    this.newId = deps.idGenerator;
  }

  // ---- Agencies ----------------------------------------------------------

  async createAgency(ctx: TenantContext, input: CreateAgencyInput): Promise<Agency> {
    if (!input.name?.trim()) throw new ValidationError('Agency name is required');
    const now = this.clock();
    const agency: Agency = {
      id: this.newId('agcy'),
      orgId: ctx.orgId,
      name: input.name.trim(),
      type: input.type,
      email: input.email,
      phone: input.phone,
      country: input.country,
      website: input.website,
      notes: input.notes,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    return this.repo.createAgency(ctx, agency);
  }

  async listAgencies(ctx: TenantContext): Promise<Agency[]> {
    return this.repo.listAgencies(ctx);
  }

  async getAgency(ctx: TenantContext, id: string): Promise<Agency> {
    const agency = await this.repo.findAgency(ctx, id);
    if (!agency) throw new NotFoundError(`Agency ${id} not found`, { id });
    return agency;
  }

  async updateAgency(ctx: TenantContext, id: string, patch: UpdateAgencyInput): Promise<Agency> {
    const agency = await this.getAgency(ctx, id);
    if (patch.name !== undefined && !patch.name.trim()) {
      throw new ValidationError('Agency name cannot be empty');
    }
    const next: Agency = {
      ...agency,
      ...patch,
      name: patch.name?.trim() ?? agency.name,
      updatedAt: this.clock(),
    };
    return this.repo.updateAgency(ctx, next);
  }

  // ---- Contacts ----------------------------------------------------------

  async addContact(
    ctx: TenantContext,
    agencyId: string,
    input: CreateContactInput,
  ): Promise<Contact> {
    await this.getAgency(ctx, agencyId); // tenant-scoped existence
    if (!input.name?.trim()) throw new ValidationError('Contact name is required');
    const now = this.clock();
    const contact: Contact = {
      id: this.newId('cont'),
      orgId: ctx.orgId,
      agencyId,
      name: input.name.trim(),
      title: input.title,
      email: input.email,
      phone: input.phone,
      isPrimary: input.isPrimary ?? false,
      createdAt: now,
      updatedAt: now,
    };
    return this.repo.createContact(ctx, contact);
  }

  async listContacts(ctx: TenantContext, agencyId: string): Promise<Contact[]> {
    return this.repo.listContacts(ctx, agencyId);
  }

  async updateContact(ctx: TenantContext, id: string, patch: UpdateContactInput): Promise<Contact> {
    const contact = await this.repo.findContact(ctx, id);
    if (!contact) throw new NotFoundError(`Contact ${id} not found`, { id });
    const next: Contact = {
      ...contact,
      ...patch,
      name: patch.name?.trim() ?? contact.name,
      updatedAt: this.clock(),
    };
    return this.repo.updateContact(ctx, next);
  }

  async removeContact(ctx: TenantContext, id: string): Promise<void> {
    await this.repo.deleteContact(ctx, id);
  }

  // ---- Interactions ------------------------------------------------------

  async logInteraction(
    ctx: TenantContext,
    agencyId: string,
    input: LogInteractionInput,
  ): Promise<Interaction> {
    await this.getAgency(ctx, agencyId);
    if (!INTERACTION_TYPES.includes(input.type)) {
      throw new ValidationError('Invalid interaction type', { type: input.type });
    }
    if (!input.summary?.trim()) throw new ValidationError('Interaction summary is required');
    const now = this.clock();
    const interaction: Interaction = {
      id: this.newId('intx'),
      orgId: ctx.orgId,
      agencyId,
      type: input.type,
      summary: input.summary.trim(),
      occurredAt: input.occurredAt ?? now,
      recordedBy: ctx.userId,
      createdAt: now,
    };
    return this.repo.createInteraction(ctx, interaction);
  }

  async listInteractions(ctx: TenantContext, agencyId: string): Promise<Interaction[]> {
    return this.repo.listInteractions(ctx, agencyId);
  }
}
