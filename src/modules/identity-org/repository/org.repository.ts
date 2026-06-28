import type { Organization } from '../domain/organization';

export interface OrgRepository {
  create(org: Organization): Promise<Organization>;
  update(org: Organization): Promise<Organization>;
  findById(id: string): Promise<Organization | null>;
}

export class InMemoryOrgRepository implements OrgRepository {
  private readonly store = new Map<string, Organization>();

  async create(org: Organization): Promise<Organization> {
    this.store.set(org.id, org);
    return org;
  }

  async update(org: Organization): Promise<Organization> {
    this.store.set(org.id, org);
    return org;
  }

  async findById(id: string): Promise<Organization | null> {
    return this.store.get(id) ?? null;
  }
}
