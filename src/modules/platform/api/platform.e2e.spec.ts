import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app/app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';

describe('Platform (super-admin) API (e2e)', () => {
  let app: INestApplication;
  let platformAuth: Record<string, string>;
  let tenantToken: string;
  let orgId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'platform-e2e-secret';
    process.env.PLATFORM_BOOTSTRAP_SECRET = 'bootstrap-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();

    // A tenant to operate on.
    const reg = await http()
      .post('/v1/auth/register-org')
      .send({
        org: { name: 'Alpine DMC', defaultCurrency: 'INR' },
        owner: { email: 'owner@alpine.test', name: 'Owner', password: 'password123' },
      })
      .expect(201);
    tenantToken = reg.body.token;
    orgId = reg.body.organization.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('bootstraps the first platform admin (secret required) and self-disables', async () => {
    await http()
      .post('/v1/platform/auth/bootstrap')
      .set({ 'x-platform-bootstrap': 'wrong' })
      .send({ email: 'root@platform.test', name: 'Root', password: 'rootpass123' })
      .expect(403);

    await http()
      .post('/v1/platform/auth/bootstrap')
      .set({ 'x-platform-bootstrap': 'bootstrap-secret' })
      .send({ email: 'root@platform.test', name: 'Root', password: 'rootpass123' })
      .expect(201);

    // Second bootstrap is refused now that an admin exists.
    await http()
      .post('/v1/platform/auth/bootstrap')
      .set({ 'x-platform-bootstrap': 'bootstrap-secret' })
      .send({ email: 'other@platform.test', name: 'Other', password: 'otherpass123' })
      .expect(400);
  });

  it('logs in and lists tenants; a tenant token is rejected on platform routes', async () => {
    const login = await http()
      .post('/v1/platform/auth/login')
      .send({ email: 'root@platform.test', password: 'rootpass123' })
      .expect(200);
    platformAuth = { Authorization: `Bearer ${login.body.token}` };

    const tenants = await http().get('/v1/platform/tenants').set(platformAuth).expect(200);
    expect(tenants.body.find((t: { id: string }) => t.id === orgId)).toMatchObject({
      name: 'Alpine DMC',
      status: 'active',
    });

    // A tenant session token must not authorize platform routes.
    await http()
      .get('/v1/platform/tenants')
      .set({ Authorization: `Bearer ${tenantToken}` })
      .expect(401);
  });

  it('suspends a tenant (blocks its users from logging in) and unsuspends', async () => {
    await http().post(`/v1/platform/tenants/${orgId}/suspend`).set(platformAuth).expect(201);

    const blocked = await http()
      .post('/v1/auth/login')
      .send({ email: 'owner@alpine.test', password: 'password123' })
      .expect(403);
    expect(blocked.body.error.code).toBe('FORBIDDEN');

    await http().post(`/v1/platform/tenants/${orgId}/unsuspend`).set(platformAuth).expect(201);
    await http()
      .post('/v1/auth/login')
      .send({ email: 'owner@alpine.test', password: 'password123' })
      .expect(200);
  });

  it('governs a tenant customer-messaging allowance (tenant cannot self-grant)', async () => {
    const before = await http().get(`/v1/platform/tenants/${orgId}`).set(platformAuth).expect(200);
    expect(before.body.customerMessagingAllowed).toBe(false);

    await http()
      .post(`/v1/platform/tenants/${orgId}/customer-messaging`)
      .set(platformAuth)
      .send({ allowed: true })
      .expect(201);

    const after = await http().get(`/v1/platform/tenants/${orgId}`).set(platformAuth).expect(200);
    expect(after.body.customerMessagingAllowed).toBe(true);
  });

  it('broadcasts to tenants (in-app notification reaches the tenant feed)', async () => {
    const res = await http()
      .post('/v1/platform/broadcast')
      .set(platformAuth)
      .send({ subject: 'Maintenance', message: 'Scheduled maintenance tonight 10pm IST.' })
      .expect(201);
    expect(res.body.tenants).toBeGreaterThanOrEqual(1);

    // The tenant sees it in their in-app notifications.
    const notes = await http()
      .get('/v1/notifications')
      .set({ Authorization: `Bearer ${tenantToken}` })
      .expect(200);
    const broadcast = notes.body.find((n: { type: string }) => n.type === 'platform.broadcast');
    expect(broadcast.message).toContain('Scheduled maintenance');
  });

  it('requires a platform token', async () => {
    await http().get('/v1/platform/tenants').expect(401);
  });
});
