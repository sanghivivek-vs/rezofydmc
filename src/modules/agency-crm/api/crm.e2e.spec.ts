import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app/app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';

describe('Agency CRM API (e2e)', () => {
  let app: INestApplication;
  let auth: Record<string, string>;
  let agencyId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'crm-e2e-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();

    const reg = await http()
      .post('/v1/auth/register-org')
      .send({
        org: { name: 'Alpine DMC', defaultCurrency: 'CHF' },
        owner: { email: 'owner@alpine.test', name: 'Owner', password: 'password123' },
      })
      .expect(201);
    auth = { Authorization: `Bearer ${reg.body.token}` };
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('creates and lists agencies', async () => {
    const created = await http()
      .post('/v1/crm/agencies')
      .set(auth)
      .send({ name: 'MakeMyTrip', type: 'OTA', country: 'India', email: 'b2b@mmt.test' })
      .expect(201);
    agencyId = created.body.id;
    expect(created.body).toMatchObject({ name: 'MakeMyTrip', type: 'OTA', status: 'active' });

    const list = await http().get('/v1/crm/agencies').set(auth).expect(200);
    expect(list.body.find((a: { id: string }) => a.id === agencyId)).toBeDefined();
  });

  it('adds and lists contacts for an agency', async () => {
    await http()
      .post(`/v1/crm/agencies/${agencyId}/contacts`)
      .set(auth)
      .send({
        name: 'Priya Sharma',
        title: 'Key Account Manager',
        email: 'priya@mmt.test',
        isPrimary: true,
      })
      .expect(201);

    const contacts = await http()
      .get(`/v1/crm/agencies/${agencyId}/contacts`)
      .set(auth)
      .expect(200);
    expect(contacts.body).toHaveLength(1);
    expect(contacts.body[0]).toMatchObject({ name: 'Priya Sharma', isPrimary: true });
  });

  it('logs and lists interactions (most recent first)', async () => {
    await http()
      .post(`/v1/crm/agencies/${agencyId}/interactions`)
      .set(auth)
      .send({
        type: 'call',
        summary: 'Intro call — discussed Goa packages',
        occurredAt: '2026-06-20T10:00:00Z',
      })
      .expect(201);
    await http()
      .post(`/v1/crm/agencies/${agencyId}/interactions`)
      .set(auth)
      .send({ type: 'email', summary: 'Sent rate sheet', occurredAt: '2026-06-25T10:00:00Z' })
      .expect(201);

    const log = await http().get(`/v1/crm/agencies/${agencyId}/interactions`).set(auth).expect(200);
    expect(log.body).toHaveLength(2);
    expect(log.body[0].summary).toBe('Sent rate sheet'); // newest first
  });

  it('rejects an invalid interaction type and missing agency name', async () => {
    await http()
      .post(`/v1/crm/agencies/${agencyId}/interactions`)
      .set(auth)
      .send({ type: 'smoke-signal', summary: 'x' })
      .expect(400);
    await http().post('/v1/crm/agencies').set(auth).send({ name: '' }).expect(400);
  });

  it('requires authentication', async () => {
    await http().get('/v1/crm/agencies').expect(401);
  });
});
