import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app/app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';

describe('Itinerary API (e2e)', () => {
  let app: INestApplication;
  let ownerAuth: Record<string, string>;
  let enquiryId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'itinerary-e2e-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();

    const reg = await api()
      .post('/v1/auth/register-org')
      .send({
        org: { name: 'Alpine DMC', defaultCurrency: 'CHF' },
        owner: { email: 'owner@alpine.test', name: 'Owner', password: 'password123' },
      })
      .expect(201);
    ownerAuth = { Authorization: `Bearer ${reg.body.token}` };

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
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('builds a Switzerland-style day with timed segments and updates a status', async () => {
    const itin = await api()
      .post('/v1/itineraries')
      .set(ownerAuth)
      .send({ enquiryId, title: 'Swiss Tour' })
      .expect(201);

    await api()
      .post(`/v1/itineraries/${itin.body.id}/days`)
      .set(ownerAuth)
      .send({ dayNumber: 1, date: '2026-07-01', headline: 'Interlaken → Jungfraujoch' })
      .expect(201);

    const built = await api()
      .post(`/v1/itineraries/${itin.body.id}/days/1/segments`)
      .set(ownerAuth)
      .send({
        startTime: '08:30',
        endTime: '16:00',
        type: 'Excursion',
        description: 'Top of Europe',
        bookingStatus: 'TM',
        supplier: 'Jungfrau Railways',
      })
      .expect(201);

    const segment = built.body.days[0].segments[0];
    expect(segment.bookingStatus).toBe('TM');
    expect(segment.startTime).toBe('08:30');

    const updated = await api()
      .patch(`/v1/itineraries/${itin.body.id}/segments/${segment.id}/status`)
      .set(ownerAuth)
      .send({ bookingStatus: 'Confirmed' })
      .expect(200);
    expect(updated.body.days[0].segments[0].bookingStatus).toBe('Confirmed');
  });

  it('rejects an unconfigured booking status (400)', async () => {
    const itin = await api().post('/v1/itineraries').set(ownerAuth).send({ enquiryId }).expect(201);
    await api()
      .post(`/v1/itineraries/${itin.body.id}/days`)
      .set(ownerAuth)
      .send({ dayNumber: 1, date: '2026-07-01', headline: 'Day 1' })
      .expect(201);
    const res = await api()
      .post(`/v1/itineraries/${itin.body.id}/days/1/segments`)
      .set(ownerAuth)
      .send({ type: 'Meal', description: 'Dinner', bookingStatus: 'Nope' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('requires authentication', async () => {
    await api().post('/v1/itineraries').send({ enquiryId }).expect(401);
  });
});
