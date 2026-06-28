/**
 * Catalog & Suppliers service (Build guide §4, §5). Manages suppliers,
 * components, and rate cards, and bridges catalog rates into the Costing engine's
 * rate shape so a quote can be priced from real catalog data.
 *
 * Tenant-scoped throughout; framework-agnostic (clock/ids/repos injected).
 */

import { type TenantContext } from '@common/tenancy/tenant-context';
import { NotFoundError, ValidationError } from '@common/errors/errors';
import { money } from '@common/money/money';
import type { Clock } from '@common/clock/clock';
import type { IdGenerator } from '@common/ids/id';
import type { Rate as CostingRate } from '@modules/costing';
import { type CreateSupplierInput, type Supplier } from '../domain/supplier';
import { type Component, type CreateComponentInput } from '../domain/component';
import { type CreateRateInput, type Rate } from '../domain/rate';
import type {
  ComponentRepository,
  RateRepository,
  SupplierRepository,
} from '../repository/catalog.repository';

export interface CatalogServiceDeps {
  readonly suppliers: SupplierRepository;
  readonly components: ComponentRepository;
  readonly rates: RateRepository;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
}

export class CatalogService {
  private readonly suppliers: SupplierRepository;
  private readonly components: ComponentRepository;
  private readonly rates: RateRepository;
  private readonly clock: Clock;
  private readonly newId: IdGenerator;

  constructor(deps: CatalogServiceDeps) {
    this.suppliers = deps.suppliers;
    this.components = deps.components;
    this.rates = deps.rates;
    this.clock = deps.clock;
    this.newId = deps.idGenerator;
  }

  // ---- Suppliers --------------------------------------------------------

  async createSupplier(ctx: TenantContext, input: CreateSupplierInput): Promise<Supplier> {
    if (!input.name) throw new ValidationError('Supplier name is required');
    money(0, input.currency); // validate currency code
    const now = this.clock();
    return this.suppliers.create(ctx, {
      id: this.newId('sup'),
      orgId: ctx.orgId,
      name: input.name,
      type: input.type,
      contact: input.contact,
      currency: input.currency.toUpperCase(),
      region: input.region,
      createdAt: now,
      updatedAt: now,
    });
  }

  async listSuppliers(ctx: TenantContext): Promise<Supplier[]> {
    return this.suppliers.list(ctx);
  }

  async getSupplier(ctx: TenantContext, id: string): Promise<Supplier> {
    const supplier = await this.suppliers.findById(ctx, id);
    if (!supplier) throw new NotFoundError(`Supplier ${id} not found`, { id });
    return supplier;
  }

  // ---- Components -------------------------------------------------------

  async createComponent(ctx: TenantContext, input: CreateComponentInput): Promise<Component> {
    if (!input.name) throw new ValidationError('Component name is required');
    await this.getSupplier(ctx, input.supplierId); // tenant-scoped existence check
    const now = this.clock();
    return this.components.create(ctx, {
      id: this.newId('cmp'),
      orgId: ctx.orgId,
      type: input.type,
      supplierId: input.supplierId,
      name: input.name,
      unitBasis: input.unitBasis,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    });
  }

  async listComponents(ctx: TenantContext): Promise<Component[]> {
    return this.components.list(ctx);
  }

  async getComponent(ctx: TenantContext, id: string): Promise<Component> {
    const component = await this.components.findById(ctx, id);
    if (!component) throw new NotFoundError(`Component ${id} not found`, { id });
    return component;
  }

  // ---- Rates ------------------------------------------------------------

  async addRate(ctx: TenantContext, input: CreateRateInput): Promise<Rate> {
    const component = await this.getComponent(ctx, input.componentId);
    validateRateInput(input);
    const now = this.clock();
    return this.rates.create(ctx, {
      id: this.newId('rate'),
      orgId: ctx.orgId,
      componentId: component.id,
      unitBasis: component.unitBasis, // inherited from the component
      net: input.net,
      validFrom: input.validFrom,
      validTo: input.validTo,
      season: input.season,
      childRules: input.childRules,
      slabs: input.slabs,
      createdAt: now,
      updatedAt: now,
    });
  }

  async listRates(ctx: TenantContext, componentId: string): Promise<Rate[]> {
    await this.getComponent(ctx, componentId);
    return this.rates.listByComponent(ctx, componentId);
  }

  /**
   * Bridge: expose a component's rates as Costing-engine rates. The Costing &
   * Quotation engine consumes these to price a CostLine (Build guide §5). This is
   * the boundary other modules call — they never read catalog tables directly.
   */
  async listCostingRates(ctx: TenantContext, componentId: string): Promise<CostingRate[]> {
    const rates = await this.listRates(ctx, componentId);
    return rates.map(toCostingRate);
  }
}

export function toCostingRate(rate: Rate): CostingRate {
  return {
    rateId: rate.id,
    componentId: rate.componentId,
    unitBasis: rate.unitBasis,
    net: rate.net,
    validFrom: rate.validFrom,
    validTo: rate.validTo,
    season: rate.season,
    childRules: rate.childRules,
    slabs: rate.slabs,
  };
}

function validateRateInput(input: CreateRateInput): void {
  money(input.net.amountMinor, input.net.currency); // validates integer + currency
  if (!input.validFrom || !input.validTo) {
    throw new ValidationError('Rate requires validFrom and validTo');
  }
  if (input.validFrom > input.validTo) {
    throw new ValidationError('Rate validFrom must be on or before validTo', {
      validFrom: input.validFrom,
      validTo: input.validTo,
    });
  }
  for (const slab of input.slabs ?? []) {
    if (slab.minPax > slab.maxPax) {
      throw new ValidationError('Slab minPax must be <= maxPax', { slab });
    }
    money(slab.net.amountMinor, slab.net.currency);
  }
  for (const rule of input.childRules ?? []) {
    if (rule.minAge > rule.maxAge) {
      throw new ValidationError('Child rule minAge must be <= maxAge', { rule });
    }
    if (rule.chargePercent < 0) {
      throw new ValidationError('Child rule chargePercent must be >= 0', { rule });
    }
  }
}
