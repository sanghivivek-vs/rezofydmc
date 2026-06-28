import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app/app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';
import { OUTBOUND_PUBLISHER, type OutboundPublisher } from '@common/integration/outbound';

class CapturingPublisher implements OutboundPublisher {
  readonly published: Array<{ event: string; data: Record<string, unknown>; key: string }> = [];
  async publish(event: string, data: Record<string, unknown>, key: string): Promise<void> {
    this.published.push({ event, data, key });
  }
}

describe('Outbound integration (e2e)', () => {
  let app: INestApplication;
  let auth: Record<string, string>;
  const publisher = new CapturingPublisher();

  beforeAll(async () => {
    process.env.JWT_SECRET = 'outbound-e2e-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OUTBOUND_PUBLISHER)
      .useValue(publisher)
      .compile();
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
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('emits quote.sent when a quote is sent', async () => {
    const enquiry = await api()
      .post('/v1/enquiries')
      .set(auth)
      .send({
        agencyId: 'AG-9',
        destinations: ['Switzerland'],
        pax: { adults: 2, children: [], infants: 0 },
        quoteDeadline: '2026-06-15T00:00:00Z',
      })
      .expect(201);
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
        enquiryId: enquiry.body.id,
        lines: [
          { componentId: component.body.id, travelDate: '2026-07-01', inclusion: 'included' },
        ],
      })
      .expect(201);

    const sent = await api().post(`/v1/quotes/${quote.body.id}/send`).set(auth).expect(201);
    expect(sent.body.status).toBe('Sent');

    const event = publisher.published.find((p) => p.event === 'quote.sent');
    expect(event).toBeDefined();
    expect(event?.data).toMatchObject({
      quote_external_id: quote.body.id,
      agency_id: 'AG-9',
      total: { amount_minor: 24000, currency: 'CHF' },
      status: 'Sent',
    });
  });

  it('emits segment.status.updated when a segment status changes', async () => {
    const enquiry = await api()
      .post('/v1/enquiries')
      .set(auth)
      .send({
        agencyId: 'AG-7',
        destinations: ['Switzerland'],
        pax: { adults: 2, children: [], infants: 0 },
        quoteDeadline: '2026-06-15T00:00:00Z',
      })
      .expect(201);
    const itin = await api()
      .post('/v1/itineraries')
      .set(auth)
      .send({ enquiryId: enquiry.body.id })
      .expect(201);
    await api()
      .post(`/v1/itineraries/${itin.body.id}/days`)
      .set(auth)
      .send({ dayNumber: 1, date: '2026-07-01', headline: 'Day 1' })
      .expect(201);
    const built = await api()
      .post(`/v1/itineraries/${itin.body.id}/days/1/segments`)
      .set(auth)
      .send({ type: 'Excursion', description: 'Jungfraujoch', bookingStatus: 'Pending' })
      .expect(201);
    const segId = built.body.days[0].segments[0].id;

    await api()
      .patch(`/v1/itineraries/${itin.body.id}/segments/${segId}/status`)
      .set(auth)
      .send({ bookingStatus: 'Confirmed' })
      .expect(200);

    const event = publisher.published.find(
      (p) => p.event === 'segment.status.updated' && p.data.segment_id === segId,
    );
    expect(event).toBeDefined();
    expect(event?.data).toMatchObject({
      agency_id: 'AG-7',
      booking_status: 'Confirmed',
      day_number: 1,
    });
  });
});
