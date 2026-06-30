/**
 * Agency CRM NestJS module (Build guide §4). Counterparty records (agencies),
 * contacts, and interaction history. The repository comes from the @Global
 * persistence module (in-memory by default, Prisma in a DB env — ADR 0009).
 */

import { Module } from '@nestjs/common';
import { systemClock } from '@common/clock/clock';
import { uuidIdGenerator } from '@common/ids/id';
import { IdentityModule } from '../identity-org/identity.module';
import { CrmController } from './api/crm.controller';
import { CRM_REPOSITORY } from './api/tokens';
import type { CrmRepository } from './repository/crm.repository';
import { CrmService } from './service/crm.service';

@Module({
  imports: [IdentityModule],
  controllers: [CrmController],
  providers: [
    {
      provide: CrmService,
      inject: [CRM_REPOSITORY],
      useFactory: (repository: CrmRepository) =>
        new CrmService({ repository, clock: systemClock, idGenerator: uuidIdGenerator }),
    },
  ],
  exports: [CrmService],
})
export class CrmModule {}
