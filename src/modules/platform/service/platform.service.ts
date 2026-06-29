/**
 * PlatformService (super-admin operations). Cross-tenant by design — every method
 * here is reachable only behind the PlatformAuthGuard. It composes the tenant
 * modules through their service interfaces (OrgService, UserService,
 * MessageService, NotificationsService), never touching their tables directly.
 */

import { Injectable } from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { OrgService } from '../../identity-org/service/org.service';
import { UserService } from '../../identity-org/service/user.service';
import {
  type Organization,
  customerMessagingEffective,
} from '../../identity-org/domain/organization';
import { MessageService } from '../../notifications/service/message.service';
import { NotificationsService } from '../../notifications/service/notifications.service';

export interface TenantSummary {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly customerMessagingAllowed: boolean;
  readonly customerMessagingEnabled: boolean;
  readonly customerMessagingEffective: boolean;
  readonly enabledChannels: string[];
}

export interface BroadcastInput {
  readonly orgIds?: string[];
  readonly subject: string;
  readonly message: string;
}

export interface BroadcastResult {
  readonly tenants: number;
  readonly emailsAttempted: number;
  readonly emailsSent: number;
  readonly emailsSkipped: number;
}

@Injectable()
export class PlatformService {
  constructor(
    private readonly orgs: OrgService,
    private readonly users: UserService,
    private readonly messages: MessageService,
    private readonly notifications: NotificationsService,
  ) {}

  async listTenants(): Promise<TenantSummary[]> {
    const orgs = await this.orgs.listAllForPlatform();
    return orgs.map(toSummary);
  }

  async getTenant(orgId: string): Promise<TenantSummary> {
    return toSummary(await this.orgs.getByIdForPlatform(orgId));
  }

  async setSuspended(orgId: string, suspended: boolean): Promise<TenantSummary> {
    return toSummary(
      await this.orgs.setStatusForPlatform(orgId, suspended ? 'suspended' : 'active'),
    );
  }

  async setCustomerMessagingAllowed(orgId: string, allowed: boolean): Promise<TenantSummary> {
    return toSummary(
      await this.orgs.setGovernanceForPlatform(orgId, { customerMessagingAllowed: allowed }),
    );
  }

  /**
   * Send an announcement to tenants: an in-app notification for each, plus email
   * to each tenant's active users via that tenant's own email channel.
   */
  async broadcast(input: BroadcastInput): Promise<BroadcastResult> {
    const all = await this.orgs.listAllForPlatform();
    const targets = input.orgIds?.length ? all.filter((o) => input.orgIds!.includes(o.id)) : all;

    let attempted = 0;
    let sent = 0;
    let skipped = 0;

    for (const org of targets) {
      await this.notifications.raiseDirect(
        org.id,
        'platform.broadcast',
        { type: 'Platform', id: 'broadcast' },
        input.message,
      );
      const ctx: TenantContext = { orgId: org.id, userId: 'platform', role: 'Owner' };
      const recipients = (await this.users.list(ctx)).filter((u) => u.status === 'active');
      for (const user of recipients) {
        attempted += 1;
        const result = await this.messages.send(org.settings.channels ?? [], {
          channel: 'email',
          to: user.email,
          subject: input.subject,
          body: input.message,
        });
        if (result.status === 'sent') sent += 1;
        else skipped += 1;
      }
    }

    return {
      tenants: targets.length,
      emailsAttempted: attempted,
      emailsSent: sent,
      emailsSkipped: skipped,
    };
  }
}

function toSummary(org: Organization): TenantSummary {
  return {
    id: org.id,
    name: org.name,
    status: org.status,
    customerMessagingAllowed: org.governance.customerMessagingAllowed,
    customerMessagingEnabled: org.settings.customerMessagingEnabled === true,
    customerMessagingEffective: customerMessagingEffective(org),
    enabledChannels: (org.settings.channels ?? []).filter((c) => c.enabled).map((c) => c.channel),
  };
}
