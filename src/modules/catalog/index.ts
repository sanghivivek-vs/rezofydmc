/**
 * Catalog & Suppliers module — public service interface (Build guide §4).
 *
 * Other modules (notably the Quotation flow) consume catalog data through
 * {@link CatalogService} — especially `listCostingRates` — never the tables.
 */

export * from './domain/supplier';
export * from './domain/component';
export * from './domain/rate';
export { CatalogService, type CatalogServiceDeps, toCostingRate } from './service/catalog.service';
export type {
  SupplierRepository,
  ComponentRepository,
  RateRepository,
} from './repository/catalog.repository';
export {
  InMemorySupplierRepository,
  InMemoryComponentRepository,
  InMemoryRateRepository,
} from './repository/catalog.repository';
export { CatalogModule } from './catalog.module';
