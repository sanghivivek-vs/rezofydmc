/**
 * User API (Build guide §4, §9). Creating users is Owner-only; listing/me are
 * open to any authenticated tenant user. Password hashes never leave the service.
 */

import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ValidationError } from '@common/errors/errors';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { JwtAuthGuard } from '../../../app/auth/jwt-auth.guard';
import { RolesGuard } from '../../../app/auth/roles.guard';
import { Roles } from '../../../app/auth/roles.decorator';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { UserService } from '../service/user.service';
import { type CreateUserInput, type UpdateUserInput, toPublicUser } from '../domain/user';

@Controller('v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly users: UserService) {}

  @Post()
  @Roles('Owner')
  async create(@CurrentTenant() ctx: TenantContext, @Body() body: CreateUserInput) {
    const user = await this.users.create(ctx, body);
    return toPublicUser(user);
  }

  @Get()
  async list(@CurrentTenant() ctx: TenantContext) {
    const users = await this.users.list(ctx);
    return users.map(toPublicUser);
  }

  @Get('me')
  async me(@CurrentTenant() ctx: TenantContext) {
    return toPublicUser(await this.users.getMe(ctx));
  }

  /** Self-service password change. Any authenticated user, for their own account. */
  @Post('me/password')
  async changeMyPassword(
    @CurrentTenant() ctx: TenantContext,
    @Body() body: { currentPassword?: string; newPassword?: string },
  ) {
    if (!body?.currentPassword || !body?.newPassword) {
      throw new ValidationError('currentPassword and newPassword are required');
    }
    await this.users.changeOwnPassword(ctx, body.currentPassword, body.newPassword);
    return { changed: true };
  }

  /** Owner: update a user's name, role, or status (enable/disable). */
  @Patch(':id')
  @Roles('Owner')
  async update(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() body: UpdateUserInput,
  ) {
    return toPublicUser(await this.users.update(ctx, id, body ?? {}));
  }

  /** Owner: reset another user's password (lockout recovery). */
  @Post(':id/reset-password')
  @Roles('Owner')
  async resetPassword(
    @CurrentTenant() ctx: TenantContext,
    @Param('id') id: string,
    @Body() body: { newPassword?: string },
  ) {
    if (!body?.newPassword) {
      throw new ValidationError('newPassword is required');
    }
    await this.users.adminResetPassword(ctx, id, body.newPassword);
    return { reset: true };
  }
}
