/**
 * Agency CRM domain (Build guide §4). Counterparty records: agencies (the
 * tour-agency clients a DMC sells to), their contacts, and a lightweight
 * interaction history. Every row is org-scoped (Build guide §0).
 */

import type { OrgId, UserId } from '@common/tenancy/tenant-context';

export type AgencyType = 'OTA' | 'Retail' | 'Corporate' | 'Wholesaler' | 'Other';
export type AgencyStatus = 'active' | 'inactive';

export interface Agency {
  readonly id: string;
  readonly orgId: OrgId;
  readonly name: string;
  readonly type?: AgencyType;
  readonly email?: string;
  readonly phone?: string;
  readonly country?: string;
  readonly website?: string;
  readonly notes?: string;
  readonly status: AgencyStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateAgencyInput {
  readonly name: string;
  readonly type?: AgencyType;
  readonly email?: string;
  readonly phone?: string;
  readonly country?: string;
  readonly website?: string;
  readonly notes?: string;
}

export interface UpdateAgencyInput {
  readonly name?: string;
  readonly type?: AgencyType;
  readonly email?: string;
  readonly phone?: string;
  readonly country?: string;
  readonly website?: string;
  readonly notes?: string;
  readonly status?: AgencyStatus;
}

export interface Contact {
  readonly id: string;
  readonly orgId: OrgId;
  readonly agencyId: string;
  readonly name: string;
  readonly title?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly isPrimary: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateContactInput {
  readonly name: string;
  readonly title?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly isPrimary?: boolean;
}

export type UpdateContactInput = Partial<CreateContactInput>;

export type InteractionType = 'call' | 'email' | 'meeting' | 'note';

export interface Interaction {
  readonly id: string;
  readonly orgId: OrgId;
  readonly agencyId: string;
  readonly type: InteractionType;
  readonly summary: string;
  readonly occurredAt: string;
  readonly recordedBy: UserId;
  readonly createdAt: string;
}

export interface LogInteractionInput {
  readonly type: InteractionType;
  readonly summary: string;
  readonly occurredAt?: string;
}

export const AGENCY_TYPES: readonly AgencyType[] = [
  'OTA',
  'Retail',
  'Corporate',
  'Wholesaler',
  'Other',
];
export const INTERACTION_TYPES: readonly InteractionType[] = ['call', 'email', 'meeting', 'note'];
