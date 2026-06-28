import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app/app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';

describe('Notifications API (e2e) — derived from the audit stream', () => {
  let app: INestApplication;
  let auth: Record<string, string>;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'notif-e2e-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();

    const reg = await api()
      .post('/v1/auth/register-org')
      .send({
        org: { name: 'Alpine', defaultCurrency: 'CHF' },
        owner: { email: 'owner@alpine.test', name: 'Owner', password: 'password123' },
      })
      .expect(201);
    auth = { Authorization: `Bearer ${reg.body.token}` };
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('creates an in-app notification when an enquiry status changes', async () => {
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

    await api()
      .post(`/v1/enquiries/${enquiry.body.id}/status`)
      .set(auth)
      .send({ status: 'In Progress' })
      .expect(201);

    const list = await api().get('/v1/notifications').set(auth).expect(200);
    const match = list.body.find(
      (n: { type: string; message: string }) => n.type === 'enquiry.status_changed',
    );
    expect(match).toBeDefined();
    expect(match.message).toContain('In Progress');

    // mark read
    const read = await api().post(`/v1/notifications/${match.id}/read`).set(auth).expect(201);
    expect(read.body.read).toBe(true);
  });

  it('requires authentication', async () => {
    await api().get('/v1/notifications').expect(401);
  });
});
