import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app/app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';

describe('Document API (e2e)', () => {
  let app: INestApplication;
  let ownerAuth: Record<string, string>;
  let salesAuth: Record<string, string>;
  let quoteId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'document-e2e-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();

    const reg = await api()
      .post('/v1/auth/register-org')
      .send({
        org: { name: 'Alpine DMC', defaultCurrency: 'CHF', defaultMarkupPercent: 20 },
        owner: { email: 'owner@alpine.test', name: 'Owner', password: 'password123' },
      })
      .expect(201);
    ownerAuth = { Authorization: `Bearer ${reg.body.token}` };

    await api()
      .post('/v1/users')
      .set(ownerAuth)
      .send({ email: 'sales@alpine.test', name: 'Sally', role: 'Sales', password: 'password123' })
      .expect(201);
    const salesLogin = await api()
      .post('/v1/auth/login')
      .send({ email: 'sales@alpine.test', password: 'password123' })
      .expect(200);
    salesAuth = { Authorization: `Bearer ${salesLogin.body.token}` };

    const enquiry = await api()
      .post('/v1/enquiries')
      .set(ownerAuth)
      .send({
        agencyId: 'AG-1',
        destinations: ['Switzerland'],
        pax: { adults: 2, children: [], infants: 0 },
        quoteDeadline: '2026-06-15T00:00:00Z',
      })
      .expect(201);
    const supplier = await api()
      .post('/v1/suppliers')
      .set(ownerAuth)
      .send({ name: 'Jungfrau', currency: 'CHF' })
      .expect(201);
    const component = await api()
      .post('/v1/components')
      .set(ownerAuth)
      .send({ type: 'Ticket', supplierId: supplier.body.id, name: 'Ticket', unitBasis: 'per_pax' })
      .expect(201);
    await api()
      .post(`/v1/components/${component.body.id}/rates`)
      .set(ownerAuth)
      .send({
        net: { amountMinor: 10000, currency: 'CHF' },
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      })
      .expect(201);
    const quote = await api()
      .post('/v1/quotes')
      .set(ownerAuth)
      .send({
        enquiryId: enquiry.body.id,
        lines: [
          { componentId: component.body.id, travelDate: '2026-07-01', inclusion: 'included' },
        ],
      })
      .expect(201);
    quoteId = quote.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('serves the client quote document as HTML', async () => {
    const res = await api().get(`/v1/quotes/${quoteId}/document`).set(salesAuth).expect(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Alpine DMC');
    expect(res.text).toContain('240.00 CHF');
  });

  it('serves the costing sheet to an Owner', async () => {
    const res = await api().get(`/v1/quotes/${quoteId}/costing-sheet`).set(ownerAuth).expect(200);
    expect(res.text).toContain('Cost &amp; margin');
    expect(res.text).toContain('40.00 CHF');
  });

  it('forbids a non-owner from the costing sheet (403 envelope)', async () => {
    const res = await api().get(`/v1/quotes/${quoteId}/costing-sheet`).set(salesAuth).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('requires authentication', async () => {
    await api().get(`/v1/quotes/${quoteId}/document`).expect(401);
  });
});
