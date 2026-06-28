/**
 * User API (Build guide §4, §9). Creating users is Owner-only; listing/me are
 * open to any authenticated tenant user. Password hashes never leave the service.
 */

import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { JwtAuthGuard } from '../../../app/auth/jwt-auth.guard';
import { RolesGuard } from '../../../app/auth/roles.guard';
import { Roles } from '../../../app/auth/roles.decorator';
import { CurrentTenant } from '../../../app/tenant/current-tenant.decorator';
import { UserService } from '../service/user.service';
import { type CreateUserInput, toPublicUser } from '../domain/user';

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
}
