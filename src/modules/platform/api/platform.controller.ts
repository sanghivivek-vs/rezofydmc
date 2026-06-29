/**
 * Platform (super-admin) API. All routes require a platform token. Powers:
 * list/inspect tenants, suspend/unsuspend, govern customer messaging, and
 * broadcast announcements to tenants.
 */

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ValidationError } from '@common/errors/errors';
import { PlatformAuthGuard } from './platform-auth.guard';
import { CurrentAdmin } from './current-admin.decorator';
import { PlatformAuthService } from '../service/platform-auth.service';
import { PlatformService } from '../service/platform.service';

@Controller('v1/platform')
@UseGuards(PlatformAuthGuard)
export class PlatformController {
  constructor(
    private readonly platform: PlatformService,
    private readonly auth: PlatformAuthService,
  ) {}

  @Get('me')
  async me(@CurrentAdmin() adminId: string) {
    return this.auth.getById(adminId);
  }

  @Get('tenants')
  listTenants() {
    return this.platform.listTenants();
  }

  @Get('tenants/:orgId')
  getTenant(@Param('orgId') orgId: string) {
    return this.platform.getTenant(orgId);
  }

  @Post('tenants/:orgId/suspend')
  suspend(@Param('orgId') orgId: string) {
    return this.platform.setSuspended(orgId, true);
  }

  @Post('tenants/:orgId/unsuspend')
  unsuspend(@Param('orgId') orgId: string) {
    return this.platform.setSuspended(orgId, false);
  }

  @Post('tenants/:orgId/customer-messaging')
  setCustomerMessaging(@Param('orgId') orgId: string, @Body() body: { allowed?: boolean }) {
    if (typeof body?.allowed !== 'boolean') {
      throw new ValidationError('"allowed" (boolean) is required');
    }
    return this.platform.setCustomerMessagingAllowed(orgId, body.allowed);
  }

  @Post('broadcast')
  broadcast(@Body() body: { orgIds?: string[]; subject?: string; message?: string }) {
    if (!body?.subject?.trim() || !body?.message?.trim()) {
      throw new ValidationError('subject and message are required');
    }
    return this.platform.broadcast({
      orgIds: body.orgIds,
      subject: body.subject,
      message: body.message,
    });
  }
}
