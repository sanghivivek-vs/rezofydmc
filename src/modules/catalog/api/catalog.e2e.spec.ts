import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app/app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';

describe('Catalog API (e2e)', () => {
  let app: INestApplication;
  let ownerAuth: Record<string, string>;
  let salesAuth: Record<string, string>;
  let readOnlyAuth: Record<string, string>;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'catalog-e2e-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();

    const reg = await request(app.getHttpServer())
      .post('/v1/auth/register-org')
      .send({
        org: { name: 'Alpine DMC', defaultCurrency: 'CHF' },
        owner: { email: 'owner@alpine.test', name: 'Owner', password: 'password123' },
      })
      .expect(201);
    ownerAuth = { Authorization: `Bearer ${reg.body.token}` };

    salesAuth = await addUser('sales@alpine.test', 'Sales');
    readOnlyAuth = await addUser('ro@alpine.test', 'ReadOnly');
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function addUser(email: string, role: string): Promise<Record<string, string>> {
    await http()
      .post('/v1/users')
      .set(ownerAuth)
      .send({ email, name: role, role, password: 'password123' })
      .expect(201);
    const login = await http()
      .post('/v1/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    return { Authorization: `Bearer ${login.body.token}` };
  }

  it('lets an editor create a supplier, component, and rate', async () => {
    const supplier = await http()
      .post('/v1/suppliers')
      .set(salesAuth)
      .send({ name: 'Jungfrau Railways', currency: 'CHF', type: 'Ticket' })
      .expect(201);

    const component = await http()
      .post('/v1/components')
      .set(salesAuth)
      .send({
        type: 'Ticket',
        supplierId: supplier.body.id,
        name: 'Jungfraujoch ticket',
        unitBasis: 'per_pax',
      })
      .expect(201);

    const rate = await http()
      .post(`/v1/components/${component.body.id}/rates`)
      .set(salesAuth)
      .send({
        net: { amountMinor: 10000, currency: 'CHF' },
        validFrom: '2026-06-01',
        validTo: '2026-09-30',
        season: 'Summer',
        slabs: [
          { minPax: 1, maxPax: 9, net: { amountMinor: 12000, currency: 'CHF' } },
          { minPax: 10, maxPax: 99, net: { amountMinor: 9000, currency: 'CHF' } },
        ],
      })
      .expect(201);
    expect(rate.body.unitBasis).toBe('per_pax');

    const rates = await http()
      .get(`/v1/components/${component.body.id}/rates`)
      .set(readOnlyAuth)
      .expect(200);
    expect(rates.body).toHaveLength(1);
  });

  it('forbids a ReadOnly user from creating catalog entries', async () => {
    const res = await http()
      .post('/v1/suppliers')
      .set(readOnlyAuth)
      .send({ name: 'X', currency: 'CHF' })
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects a component referencing a missing supplier (404 envelope)', async () => {
    const res = await http()
      .post('/v1/components')
      .set(salesAuth)
      .send({ type: 'Hotel', supplierId: 'missing', name: 'x', unitBasis: 'per_night' })
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('requires authentication', async () => {
    await http().get('/v1/suppliers').expect(401);
  });
});
