import { CatalogService } from './catalog.service';
import {
  InMemorySupplierRepository,
  InMemoryComponentRepository,
  InMemoryRateRepository,
} from '../repository/catalog.repository';
import { fixedClock } from '@common/clock/clock';
import { sequentialIdGenerator } from '@common/ids/id';
import { money } from '@common/money/money';
import { NotFoundError, ValidationError } from '@common/errors/errors';
import { priceLine, type CostLineInput } from '@modules/costing';
import type { TenantContext } from '@common/tenancy/tenant-context';

const ORG_A: TenantContext = { orgId: 'org-A', userId: 'u1', role: 'Ops' };
const ORG_B: TenantContext = { orgId: 'org-B', userId: 'u2', role: 'Ops' };

function makeService() {
  return new CatalogService({
    suppliers: new InMemorySupplierRepository(),
    components: new InMemoryComponentRepository(),
    rates: new InMemoryRateRepository(),
    clock: fixedClock('2026-06-28T10:00:00.000Z'),
    idGenerator: sequentialIdGenerator(),
  });
}

async function seedComponent(svc: CatalogService, ctx: TenantContext) {
  const supplier = await svc.createSupplier(ctx, { name: 'Jungfrau Railways', currency: 'CHF' });
  return svc.createComponent(ctx, {
    type: 'Ticket',
    supplierId: supplier.id,
    name: 'Jungfraujoch ticket',
    unitBasis: 'per_pax',
  });
}

describe('CatalogService', () => {
  it('creates suppliers and components, validating references', async () => {
    const svc = makeService();
    const component = await seedComponent(svc, ORG_A);
    expect(component).toMatchObject({ type: 'Ticket', unitBasis: 'per_pax', orgId: 'org-A' });

    await expect(
      svc.createComponent(ORG_A, {
        type: 'Ticket',
        supplierId: 'nope',
        name: 'x',
        unitBasis: 'per_pax',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('adds a rate inheriting the component unit basis and validates it', async () => {
    const svc = makeService();
    const component = await seedComponent(svc, ORG_A);
    const rate = await svc.addRate(ORG_A, {
      componentId: component.id,
      net: money(10000, 'CHF'),
      validFrom: '2026-06-01',
      validTo: '2026-09-30',
      season: 'Summer',
      childRules: [{ minAge: 2, maxAge: 11, chargePercent: 50 }],
    });
    expect(rate.unitBasis).toBe('per_pax');

    await expect(
      svc.addRate(ORG_A, {
        componentId: component.id,
        net: money(1, 'CHF'),
        validFrom: '2026-09-30',
        validTo: '2026-06-01', // inverted
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('isolates catalog data by tenant', async () => {
    const svc = makeService();
    await seedComponent(svc, ORG_A);
    expect(await svc.listSuppliers(ORG_A)).toHaveLength(1);
    expect(await svc.listSuppliers(ORG_B)).toHaveLength(0);
    expect(await svc.listComponents(ORG_B)).toHaveLength(0);
  });

  it('bridges catalog rates into costing-engine rates that price correctly', async () => {
    const svc = makeService();
    const component = await seedComponent(svc, ORG_A);
    await svc.addRate(ORG_A, {
      componentId: component.id,
      net: money(10000, 'CHF'),
      validFrom: '2026-06-01',
      validTo: '2026-09-30',
    });

    const [costingRate] = await svc.listCostingRates(ORG_A, component.id);
    expect(costingRate).toMatchObject({
      rateId: expect.stringMatching(/^rate_/),
      componentId: component.id,
      unitBasis: 'per_pax',
      net: money(10000, 'CHF'),
    });

    // Feed the bridged rate straight into the costing engine.
    const line: CostLineInput = {
      lineId: 'L1',
      componentId: component.id,
      componentType: 'Ticket',
      description: 'Jungfraujoch ticket',
      inclusion: 'included',
      travelDate: '2026-07-01',
      rate: costingRate,
    };
    const priced = priceLine(
      line,
      { adults: 2, children: [], infants: 0 },
      { orgDefaultPercent: 20 },
      { quoteCurrency: 'CHF', rates: {} },
      'half-up',
    );
    expect(priced.netSource).toEqual(money(20000, 'CHF')); // 10000 * 2 pax
    expect(priced.sell).toEqual(money(24000, 'CHF')); // +20%
  });
});
