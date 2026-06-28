/**
 * Catalog & Suppliers NestJS module (Build guide §4). In-memory infrastructure
 * by default; swap repository providers for Prisma-backed ones in a DB env.
 */

import { Module } from '@nestjs/common';
import { systemClock } from '@common/clock/clock';
import { uuidIdGenerator } from '@common/ids/id';
import { IdentityModule } from '../identity-org/identity.module';
import { SupplierController } from './api/supplier.controller';
import { ComponentController } from './api/component.controller';
import { COMPONENT_REPOSITORY, RATE_REPOSITORY, SUPPLIER_REPOSITORY } from './api/tokens';
import {
  InMemoryComponentRepository,
  InMemoryRateRepository,
  InMemorySupplierRepository,
  type ComponentRepository,
  type RateRepository,
  type SupplierRepository,
} from './repository/catalog.repository';
import { CatalogService } from './service/catalog.service';

@Module({
  imports: [IdentityModule],
  controllers: [SupplierController, ComponentController],
  providers: [
    { provide: SUPPLIER_REPOSITORY, useClass: InMemorySupplierRepository },
    { provide: COMPONENT_REPOSITORY, useClass: InMemoryComponentRepository },
    { provide: RATE_REPOSITORY, useClass: InMemoryRateRepository },
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
