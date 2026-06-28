/**
 * Catalog & Suppliers NestJS module (Build guide §4). Repositories come from the
 * @Global persistence module (in-memory by default, Prisma in a DB env — ADR 0009).
 */

import { Module } from '@nestjs/common';
import { systemClock } from '@common/clock/clock';
import { uuidIdGenerator } from '@common/ids/id';
import { IdentityModule } from '../identity-org/identity.module';
import { SupplierController } from './api/supplier.controller';
import { ComponentController } from './api/component.controller';
import { COMPONENT_REPOSITORY, RATE_REPOSITORY, SUPPLIER_REPOSITORY } from './api/tokens';
import type {
  ComponentRepository,
  RateRepository,
  SupplierRepository,
} from './repository/catalog.repository';
import { CatalogService } from './service/catalog.service';

@Module({
  imports: [IdentityModule],
  controllers: [SupplierController, ComponentController],
  providers: [
    {
      provide: CatalogService,
      inject: [SUPPLIER_REPOSITORY, COMPONENT_REPOSITORY, RATE_REPOSITORY],
      useFactory: (
        suppliers: SupplierRepository,
        components: ComponentRepository,
        rates: RateRepository,
      ) =>
        new CatalogService({
          suppliers,
          components,
          rates,
          clock: systemClock,
          idGenerator: uuidIdGenerator,
        }),
    },
  ],
  exports: [CatalogService],
})
export class CatalogModule {}
