/**
 * Costing & Quotation module — public service interface.
 *
 * Other modules call THIS surface, never the engine internals or any future
 * costing tables directly (Build guide §4 bounded contexts).
 */

export * from './domain/enums';
export * from './domain/types';
export {
  priceQuote,
  priceLine,
  priceSlabTable,
  resolveMarkupPercent,
  resolveFxRate,
} from './service/costing-engine';
export { resolveRate, isWithinValidity } from './service/rate-resolver';
