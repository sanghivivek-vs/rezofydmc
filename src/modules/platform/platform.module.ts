/**
 * Platform (super-admin) module. Provides the platform tier that operates above
 * tenants: its own auth (bootstrap + login), guard, and cross-tenant operations.
 *
 * Repositories come from the @Global persistence module (in-memory by default,
 * Prisma in a DB env — ADR 0009). OrgService/UserService come from IdentityModule;
 * MessageService/NotificationsService are provided globally by NotificationsModule.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { systemClock } from '@common/clock/clock';
import { uuidIdGenerator } from '@common/ids/id';
import { IdentityModule } from '../identity-org/identity.module';
import { OrgService, UserService } from '@modules/identity-org';
import { MessageService, NotificationsService } from '@modules/notifications';
import { PlatformAuthController } from './api/platform-auth.controller';
import { PlatformController } from './api/platform.controller';
import { PlatformAuthGuard } from './api/platform-auth.guard';
import { PLATFORM_ADMIN_REPOSITORY } from './api/tokens';
import type { PlatformAdminRepository } from './repository/platform-admin.repository';
import { PlatformTokenService } from './service/platform-token.service';
import { PlatformAuthService } from './service/platform-auth.service';
import { PlatformService } from './service/platform.service';

@Module({
  imports: [ConfigModule, JwtModule.register({}), IdentityModule],
  controllers: [PlatformAuthController, PlatformController],
  providers: [
    PlatformTokenService,
    PlatformAuthGuard,
    {
      provide: PlatformAuthService,
      inject: [PLATFORM_ADMIN_REPOSITORY, PlatformTokenService],
      useFactory: (repository: PlatformAdminRepository, tokens: PlatformTokenService) =>
        new PlatformAuthService({
          repository,
          tokens,
          clock: systemClock,
          idGenerator: uuidIdGenerator,
        }),
    },
    {
      provide: PlatformService,
      inject: [OrgService, UserService, MessageService, NotificationsService],
      useFactory: (
        orgs: OrgService,
        users: UserService,
        messages: MessageService,
        notifications: NotificationsService,
      ) => new PlatformService(orgs, users, messages, notifications),
    },
  ],
  exports: [PlatformAuthService, PlatformService],
})
export class PlatformModule {}
