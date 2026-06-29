/**
 * Channel configuration API (Build guide §4). Owners configure which messaging
 * channels (email/SMS/WhatsApp) are enabled and which provider each uses, and can
 * send a test message to verify wiring. Reading config is open to any tenant
 * user; mutations and test sends are Owner-only (server-side gate, §9).
 *
 * Provider credentials are never exposed or accepted here — only channel,
 * provider, and sender identity.
 */

import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ValidationError } from '@common/errors/errors';
import type { TenantContext } from '@common/tenancy/tenant-context';
import {
  type ChannelConfig,
  defaultChannelConfigs,
  isMessageChannel,
} from '@common/messaging/channel';
import { JwtAuthGuard } from '../../../app/auth/jwt-auth.guard';
import { RolesGuard } from '../../../app/auth/roles.guard';
import { Roles } from '../../../app/auth/roles.decorator';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { OrgService } from '../../identity-org/service/org.service';
import { MessageService } from '../service/message.service';

@Controller('v1/notifications/channels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChannelsController {
  constructor(
    private readonly orgs: OrgService,
    private readonly messages: MessageService,
  ) {}

  @Get()
  async get(@CurrentTenant() ctx: TenantContext): Promise<ChannelConfig[]> {
    const org = await this.orgs.getCurrent(ctx);
    return org.settings.channels ?? defaultChannelConfigs();
  }

  @Put()
  @Roles('Owner')
  async update(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: { channels?: ChannelConfig[] },
  ): Promise<ChannelConfig[]> {
    const org = await this.orgs.updateSettings(ctx, { channels: body?.channels ?? [] });
    return org.settings.channels ?? [];
  }

  @Post('test')
  @Roles('Owner')
  async test(@CurrentTenant() ctx: TenantContext, @Body() body: { channel?: string; to?: string }) {
    if (!isMessageChannel(body?.channel)) {
      throw new ValidationError('A valid channel is required (email | sms | whatsapp)');
    }
    if (!body?.to?.trim()) {
      throw new ValidationError('A recipient "to" address is required');
    }
    const org = await this.orgs.getCurrent(ctx);
    return this.messages.send(org.settings.channels ?? [], {
      channel: body.channel,
      to: body.to.trim(),
      subject: 'DMC test message',
      body: 'This is a test message from your DMC platform channel configuration.',
    });
  }
}
