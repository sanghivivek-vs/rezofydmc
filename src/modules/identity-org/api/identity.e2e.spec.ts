import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app/app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';

describe('Identity & Org API (e2e)', () => {
  let app: INestApplication;
  let ownerAuth: Record<string, string>;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'identity-e2e-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();

    const reg = await request(app.getHttpServer())
      .post('/v1/auth/register-org')
      .send({
        org: { name: 'Alpine DMC', defaultCurrency: 'CHF', defaultMarkupPercent: 15 },
        owner: { email: 'owner@alpine.test', name: 'Owner', password: 'password123' },
      })
      .expect(201);
    ownerAuth = { Authorization: `Bearer ${reg.body.token}` };
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('register-org returns no password hash and a usable token', async () => {
    const me = await http().get('/v1/users/me').set(ownerAuth).expect(200);
    expect(me.body.email).toBe('owner@alpine.test');
    expect(me.body).not.toHaveProperty('passwordHash');
  });

  it('login issues a token for valid credentials, 401 otherwise', async () => {
    const ok = await http()
      .post('/v1/auth/login')
      .send({ email: 'owner@alpine.test', password: 'password123' })
      .expect(200);
    expect(ok.body.token).toBeDefined();

    const bad = await http()
      .post('/v1/auth/login')
      .send({ email: 'owner@alpine.test', password: 'nope' })
      .expect(401);
    expect(bad.body.error.code).toBe('UNAUTHORIZED');
  });

  it('exposes org settings, including the default booking statuses', async () => {
    const org = await http().get('/v1/org').set(ownerAuth).expect(200);
    expect(org.body.settings).toMatchObject({
      defaultCurrency: 'CHF',
      defaultMarkupPercent: 15,
      bookingStatuses: ['Confirmed', 'TM', 'Pending'],
    });
  });

  it('lets an Owner create a user; that user gets a working token but cannot create users', async () => {
    await http()
      .post('/v1/users')
      .set(ownerAuth)
      .send({ email: 'sales@alpine.test', name: 'Sally', role: 'Sales', password: 'password123' })
      .expect(201);

    const salesLogin = await http()
      .post('/v1/auth/login')
      .send({ email: 'sales@alpine.test', password: 'password123' })
      .expect(200);
    const salesAuth = { Authorization: `Bearer ${salesLogin.body.token}` };

    // Sales can read users...
    await http().get('/v1/users').set(salesAuth).expect(200);
    // ...but cannot create them (Owner-only).
    const forbidden = await http()
      .post('/v1/users')
      .set(salesAuth)
      .send({ email: 'x@alpine.test', name: 'X', role: 'Ops', password: 'password123' })
      .expect(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });

  it('forbids a non-Owner from changing org settings', async () => {
    const salesLogin = await http()
      .post('/v1/auth/login')
      .send({ email: 'sales@alpine.test', password: 'password123' })
      .expect(200);
    const salesAuth = { Authorization: `Bearer ${salesLogin.body.token}` };

    await http()
      .patch('/v1/org/settings')
      .set(salesAuth)
      .send({ defaultMarkupPercent: 99 })
      .expect(403);

    const updated = await http()
      .patch('/v1/org/settings')
      .set(ownerAuth)
      .send({ defaultMarkupPercent: 22 })
      .expect(200);
    expect(updated.body.settings.defaultMarkupPercent).toBe(22);
  });

  it('rejects requests with no/invalid bearer token', async () => {
    await http().get('/v1/org').expect(401);
    await http().get('/v1/org').set({ Authorization: 'Bearer garbage' }).expect(401);
  });
});
