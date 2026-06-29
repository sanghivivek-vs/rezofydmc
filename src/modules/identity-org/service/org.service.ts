/**
 * Organization service (Build guide §4 Identity & Org).
 */

import { type TenantContext, canSeeMargins } from '@common/tenancy/tenant-context';
import { ForbiddenError, NotFoundError, ValidationError } from '@common/errors/errors';
import { money } from '@common/money/money';
import { defaultChannelConfigs, normaliseChannelConfigs } from '@common/messaging/channel';
import { defaultRoutingRules, normaliseRoutingRules } from '@common/messaging/routing';
import type { Clock } from '@common/clock/clock';
import type { IdGenerator } from '@common/ids/id';
import {
  type CreateOrgInput,
  type OrgSettings,
  type Organization,
  DEFAULT_BOOKING_STATUSES,
} from '../domain/organization';
import type { OrgRepository } from '../repository/org.repository';

export interface OrgServiceDeps {
  readonly repository: OrgRepository;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
}

export class OrgService {
  private readonly repo: OrgRepository;
  private readonly clock: Clock;
  private readonly newId: IdGenerator;

  constructor(deps: OrgServiceDeps) {
    this.repo = deps.repository;
    this.clock = deps.clock;
    this.newId = deps.idGenerator;
  }

  async create(input: CreateOrgInput): Promise<Organization> {
    if (!input.name) throw new ValidationError('Organization name is required');
    // Validate the currency via the Money constructor (throws on bad code).
    money(0, input.defaultCurrency);
    const now = this.clock();
    const org: Organization = {
      id: this.newId('org'),
      name: input.name,
      settings: {
        defaultCurrency: input.defaultCurrency.toUpperCase(),
        defaultMarkupPercent: input.defaultMarkupPercent ?? 0,
        bookingStatuses: input.bookingStatuses ?? [...DEFAULT_BOOKING_STATUSES],
        channels: defaultChannelConfigs(),
        notificationRules: defaultRoutingRules(),
      },
      createdAt: now,
      updatedAt: now,
    };
    return this.repo.create(org);
  }

  async getCurrent(ctx: TenantContext): Promise<Organization> {
    const org = await this.repo.findById(ctx.orgId);
    if (!org) throw new NotFoundError(`Organization ${ctx.orgId} not found`);
    return org;
  }

  /** Update org settings. Owner-only (gated server-side — Build guide §9). */
  async updateSettings(ctx: TenantContext, patch: Partial<OrgSettings>): Promise<Organization> {
    if (!canSeeMargins(ctx)) {
      throw new ForbiddenError('Only an Owner may change organization settings');
    }
    const org = await this.getCurrent(ctx);
    if (patch.defaultCurrency) money(0, patch.defaultCurrency);
    let channels = org.settings.channels;
    if (patch.channels !== undefined) {
      try {
        channels = normaliseChannelConfigs(patch.channels);
      } catch (err) {
        throw new ValidationError((err as Error).message);
      }
    }
    let notificationRules = org.settings.notificationRules;
    if (patch.notificationRules !== undefined) {
      try {
        notificationRules = normaliseRoutingRules(patch.notificationRules);
      } catch (err) {
        throw new ValidationError((err as Error).message);
      }
    }
    const settings: OrgSettings = {
      defaultCurrency: (patch.defaultCurrency ?? org.settings.defaultCurrency).toUpperCase(),
      defaultMarkupPercent: patch.defaultMarkupPercent ?? org.settings.defaultMarkupPercent,
      bookingStatuses: patch.bookingStatuses ?? org.settings.bookingStatuses,
      channels,
      notificationRules,
    };
    return this.repo.update({ ...org, settings, updatedAt: this.clock() });
  }
}
