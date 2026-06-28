import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';

describe('Security hardening (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'security-e2e-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('sets helmet security headers on responses', async () => {
    const res = await api().get('/v1/quotes/none').expect(401); // guard rejects, headers still set
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('rate-limits the login endpoint (429 after the per-route limit)', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await api()
        .post('/v1/auth/login')
        .send({ email: 'nobody@x.test', password: 'wrongpassword' });
      statuses.push(res.status);
    }
    // First 10 are processed (401 invalid creds); the 11th+ are throttled (429).
    expect(statuses).toContain(429);
    expect(statuses.filter((s) => s === 401).length).toBeLessThanOrEqual(10);
  });
});
