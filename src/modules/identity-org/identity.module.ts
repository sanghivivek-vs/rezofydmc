/**
 * Identity & Org NestJS module (Build guide §4). Provides auth (login + org
 * bootstrap), org settings, and user management. Exports TOKEN_SERVICE and the
 * guards so other modules can authenticate requests via the same session tokens.
 *
 * Infrastructure is in-memory by default; swap the repository providers for
 * Prisma-backed ones in a DB env (same pattern as enquiry-intake).
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { systemClock } from '@common/clock/clock';
import { uuidIdGenerator } from '@common/ids/id';
import { AuthController } from './api/auth.controller';
import { OrgController } from './api/org.controller';
import { UserController } from './api/user.controller';
import { ORG_REPOSITORY, TOKEN_SERVICE, USER_REPOSITORY } from './api/tokens';
import { InMemoryOrgRepository, type OrgRepository } from './repository/org.repository';
import { InMemoryUserRepository, type UserRepository } from './repository/user.repository';
import { OrgService } from './service/org.service';
import { UserService } from './service/user.service';
import { AuthService } from './service/auth.service';
import { JwtTokenService } from './service/jwt-token.service';
import type { TokenService } from './service/token.service';
import { JwtAuthGuard } from '../../app/auth/jwt-auth.guard';
import { RolesGuard } from '../../app/auth/roles.guard';

@Module({
  imports: [ConfigModule, JwtModule.register({})],
  controllers: [AuthController, OrgController, UserController],
  providers: [
    { provide: ORG_REPOSITORY, useClass: InMemoryOrgRepository },
    { provide: USER_REPOSITORY, useClass: InMemoryUserRepository },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    {
      provide: OrgService,
      inject: [ORG_REPOSITORY],
      useFactory: (repository: OrgRepository) =>
        new OrgService({ repository, clock: systemClock, idGenerator: uuidIdGenerator }),
    },
    {
      provide: UserService,
      inject: [USER_REPOSITORY],
      useFactory: (repository: UserRepository) =>
        new UserService({ repository, clock: systemClock, idGenerator: uuidIdGenerator }),
    },
    {
      provide: AuthService,
      inject: [OrgService, UserService, TOKEN_SERVICE],
      useFactory: (orgs: OrgService, users: UserService, tokens: TokenService) =>
        new AuthService(orgs, users, tokens),
    },
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [TOKEN_SERVICE, OrgService, UserService, JwtAuthGuard, RolesGuard],
})
export class IdentityModule {}
