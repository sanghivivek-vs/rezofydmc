import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app/app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';
import { signPayload } from '@common/integration/signature';

const SECRET = 'ops-webhook-secret';

describe('Operations API (e2e)', () => {
  let app: INestApplication;
  let auth: Record<string, string>;
  let orgId: string;
  let enquiryId: string;
  let quoteId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'ops-e2e-secret';
    process.env.WEBHOOK_SIGNING_SECRET = SECRET;
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
    auth = { Authorization: `Bearer ${reg.body.token}` };
    orgId = (await api().get('/v1/org').set(auth).expect(200)).body.id;

    const enquiry = await api()
      .post('/v1/enquiries')
      .set(auth)
      .send({
        agencyId: 'AG-1',
        destinations: ['Switzerland'],
        pax: { adults: 2, children: [], infants: 0 },
        quoteDeadline: '2026-06-15T00:00:00Z',
      })
      .expect(201);
    enquiryId = enquiry.body.id;

    const supplier = await api()
      .post('/v1/suppliers')
      .set(auth)
      .send({ name: 'Jungfrau', currency: 'CHF' })
      .expect(201);
    const component = await api()
      .post('/v1/components')
      .set(auth)
      .send({ type: 'Ticket', supplierId: supplier.body.id, name: 'Ticket', unitBasis: 'per_pax' })
      .expect(201);
    await api()
      .post(`/v1/components/${component.body.id}/rates`)
      .set(auth)
      .send({
        net: { amountMinor: 10000, currency: 'CHF' },
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      })
      .expect(201);
    const quote = await api()
      .post('/v1/quotes')
      .set(auth)
      .send({
        enquiryId,
        lines: [
          { componentId: component.body.id, travelDate: '2026-07-01', inclusion: 'included' },
        ],
      })
      .expect(201);
    quoteId = quote.body.id;

    // advance enquiry to Quoted
    await api()
      .post(`/v1/enquiries/${enquiryId}/status`)
      .set(auth)
      .send({ status: 'In Progress' })
      .expect(201);
    await api()
      .post(`/v1/enquiries/${enquiryId}/status`)
      .set(auth)
      .send({ status: 'Quoted' })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('accepts a quote → booking → confirm item → supplier POs', async () => {
    const accept = await api().post(`/v1/quotes/${quoteId}/accept`).set(auth).expect(201);
    const booking = accept.body;
    expect(booking.status).toBe('Confirming');
    expect(booking.items).toHaveLength(1);

    const itemId = booking.items[0].id;
    const confirmed = await api()
      .post(`/v1/bookings/${booking.id}/items/${itemId}/confirm`)
      .set(auth)
      .send({ confirmationRef: 'SUP-1' })
      .expect(201);
    expect(confirmed.body.status).toBe('Confirmed');

    const pos = await api().get(`/v1/bookings/${booking.id}/supplier-pos`).set(auth).expect(200);
    expect(pos.body[0].supplierName).toBe('Jungfrau');
  });

  it('reports the pipeline (enquiry now Won)', async () => {
    const res = await api().get('/v1/reports/pipeline').set(auth).expect(200);
    expect(res.body.won).toBeGreaterThanOrEqual(1);
  });

  it('accepts via signed inbound webhook (idempotent with the manual accept)', async () => {
    const envelope = {
      event: 'quote.accepted',
      version: 'v1',
      idempotency_key: 'qd-1',
      occurred_at: '2026-06-28T10:00:00Z',
      data: { quote_external_id: quoteId, enquiry_external_id: enquiryId, agency_id: 'AG-1' },
    };
    const raw = JSON.stringify(envelope);
    const res = await api()
      .post('/v1/integration/webhooks/quote-decision')
      .set({
        'content-type': 'application/json',
        'x-org-id': orgId,
        'x-signature': signPayload(raw, SECRET),
      })
      .send(raw)
      .expect(202);
    expect(res.body).toHaveProperty('bookingId');
  });

  it('rejects an unsigned webhook', async () => {
    const raw = JSON.stringify({ event: 'quote.accepted', version: 'v1', data: {} });
    await api()
      .post('/v1/integration/webhooks/quote-decision')
      .set({ 'content-type': 'application/json', 'x-org-id': 'org-header', 'x-signature': 'bad' })
      .send(raw)
      .expect(401);
  });
});
