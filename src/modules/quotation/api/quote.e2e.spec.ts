import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app/app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';

describe('Quote API (e2e) — full Phase-1 loop', () => {
  let app: INestApplication;
  let ownerAuth: Record<string, string>;
  let salesAuth: Record<string, string>;
  let enquiryId: string;
  let componentId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'quote-e2e-secret';
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

    // Enquiry
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
    enquiryId = enquiry.body.id;

    // Catalog: supplier -> component -> rate
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
    componentId = component.body.id;
    await api()
      .post(`/v1/components/${componentId}/rates`)
      .set(ownerAuth)
      .send({
        net: { amountMinor: 10000, currency: 'CHF' },
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('prices a quote end-to-end and returns the margin to an Owner', async () => {
    const res = await api()
      .post('/v1/quotes')
      .set(ownerAuth)
      .send({
        enquiryId,
        lines: [{ componentId, travelDate: '2026-07-01', inclusion: 'included' }],
      })
      .expect(201);
    expect(res.body.sell.total).toEqual({ amountMinor: 24000, currency: 'CHF' });
    expect(res.body.sell.perPax).toEqual({ amountMinor: 12000, currency: 'CHF' });
    expect(res.body.margin.totalMargin).toEqual({ amountMinor: 4000, currency: 'CHF' });
    expect(res.body.version).toBe(1);
  });

  it('hides the margin view from a Sales user but shows the sell view', async () => {
    const created = await api()
      .post('/v1/quotes')
      .set(salesAuth)
      .send({
        enquiryId,
        lines: [{ componentId, travelDate: '2026-07-01', inclusion: 'included' }],
      })
      .expect(201);
    expect(created.body.margin).toBeUndefined();
    expect(created.body.sell.total).toEqual({ amountMinor: 24000, currency: 'CHF' });

    // Re-fetching as Sales still hides the margin (server-side gate).
    const fetched = await api().get(`/v1/quotes/${created.body.id}`).set(salesAuth).expect(200);
    expect(fetched.body.margin).toBeUndefined();
  });

  it('lists quotes for an enquiry', async () => {
    const res = await api().get(`/v1/quotes?enquiryId=${enquiryId}`).set(ownerAuth).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body.every((q: { enquiryId: string }) => q.enquiryId === enquiryId)).toBe(true);
  });

  it('rejects a quote with no lines (400)', async () => {
    const res = await api()
      .post('/v1/quotes')
      .set(ownerAuth)
      .send({ enquiryId, lines: [] })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires an editor role to create a quote', async () => {
    // create a ReadOnly user
    await api()
      .post('/v1/users')
      .set(ownerAuth)
      .send({ email: 'ro@alpine.test', name: 'RO', role: 'ReadOnly', password: 'password123' })
      .expect(201);
    const roLogin = await api()
      .post('/v1/auth/login')
      .send({ email: 'ro@alpine.test', password: 'password123' })
      .expect(200);
    await api()
      .post('/v1/quotes')
      .set({ Authorization: `Bearer ${roLogin.body.token}` })
      .send({
        enquiryId,
        lines: [{ componentId, travelDate: '2026-07-01', inclusion: 'included' }],
      })
      .expect(403);
  });
});
