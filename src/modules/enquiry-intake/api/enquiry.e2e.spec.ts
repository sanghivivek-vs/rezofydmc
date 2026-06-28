import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app/app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';
import { signPayload } from '@common/integration/signature';

const SECRET = 'test-secret';

const createBody = {
  agencyId: 'AG-1',
  destinations: ['Switzerland'],
  pax: { adults: 2, children: [], infants: 0 },
  quoteDeadline: '2026-06-15T00:00:00Z',
};

describe('Enquiry API (e2e)', () => {
  let app: INestApplication;
  let authA: Record<string, string>;
  let authB: Record<string, string>;

  beforeAll(async () => {
    process.env.WEBHOOK_SIGNING_SECRET = SECRET;
    process.env.JWT_SECRET = 'e2e-jwt-secret';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();

    authA = await registerOrg('a@dmc.test');
    authB = await registerOrg('b@dmc.test');
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function registerOrg(email: string): Promise<Record<string, string>> {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register-org')
      .send({
        org: { name: email, defaultCurrency: 'EUR' },
        owner: { email, name: 'Owner', password: 'password123' },
      })
      .expect(201);
    return { Authorization: `Bearer ${res.body.token}` };
  }

  describe('REST /v1/enquiries', () => {
    it('rejects unauthenticated requests with the error envelope', async () => {
      const res = await http().post('/v1/enquiries').send(createBody).expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('creates a New enquiry for the tenant', async () => {
      const res = await http().post('/v1/enquiries').set(authA).send(createBody).expect(201);
      expect(res.body).toMatchObject({ source: 'manual', status: 'New', agencyId: 'AG-1' });
      expect(res.body.id).toMatch(/^enq_/);
    });

    it('isolates tenants on list', async () => {
      await http().post('/v1/enquiries').set(authB).send(createBody).expect(201);
      const listA = await http().get('/v1/enquiries').set(authA).expect(200);
      const listB = await http().get('/v1/enquiries').set(authB).expect(200);
      const orgsA = new Set(listA.body.map((e: { orgId: string }) => e.orgId));
      const orgsB = new Set(listB.body.map((e: { orgId: string }) => e.orgId));
      expect(orgsA.size).toBe(1);
      expect(orgsB.size).toBe(1);
      expect([...orgsA][0]).not.toBe([...orgsB][0]);
    });

    it('returns 404 (envelope) for another tenant’s enquiry', async () => {
      const created = await http().post('/v1/enquiries').set(authA).send(createBody).expect(201);
      const res = await http().get(`/v1/enquiries/${created.body.id}`).set(authB).expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('validates status transitions (409 on illegal)', async () => {
      const created = await http().post('/v1/enquiries').set(authA).send(createBody).expect(201);
      await http()
        .post(`/v1/enquiries/${created.body.id}/status`)
        .set(authA)
        .send({ status: 'In Progress' })
        .expect(201);
      const bad = await http()
        .post(`/v1/enquiries/${created.body.id}/status`)
        .set(authA)
        .send({ status: 'Won' })
        .expect(409);
      expect(bad.body.error.code).toBe('BUSINESS_RULE');
    });

    it('rejects a malformed create body with 400 envelope', async () => {
      const res = await http()
        .post('/v1/enquiries')
        .set(authA)
        .send({ ...createBody, destinations: [] })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Webhook /v1/integration/webhooks/enquiry', () => {
    const envelope = {
      event: 'enquiry.created',
      version: 'v1',
      idempotency_key: 'idem-1',
      occurred_at: '2026-06-28T10:00:00Z',
      data: {
        enquiry_external_id: 'EXT-100',
        agency_id: 'AG-9',
        destinations: ['Switzerland'],
        pax: { adults: 4 },
        quote_deadline: '2026-06-20T00:00:00Z',
      },
    };
    const raw = JSON.stringify(envelope);

    const post = (sig: string, headers: Record<string, string> = {}) =>
      http()
        .post('/v1/integration/webhooks/enquiry')
        .set({
          'content-type': 'application/json',
          'x-org-id': 'org-webhook',
          'x-signature': sig,
          ...headers,
        })
        .send(raw);

    it('accepts a correctly-signed webhook and ingests the enquiry', async () => {
      const res = await post(signPayload(raw, SECRET)).expect(202);
      expect(res.body.idempotent).toBe(false);
      expect(res.body.enquiryId).toMatch(/^enq_/);
    });

    it('is idempotent on redelivery of the same key', async () => {
      const sig = signPayload(raw, SECRET);
      const first = await post(sig).expect(202);
      const second = await post(sig).expect(202);
      expect(second.body.idempotent).toBe(true);
      expect(second.body.enquiryId).toBe(first.body.enquiryId);
    });

    it('rejects an invalid signature with 401', async () => {
      const res = await post('deadbeef').expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects a missing x-org-id with 401', async () => {
      const res = await http()
        .post('/v1/integration/webhooks/enquiry')
        .set({ 'content-type': 'application/json', 'x-signature': signPayload(raw, SECRET) })
        .send(raw)
        .expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects an unsupported event with 400', async () => {
      const badEnvelope = JSON.stringify({ ...envelope, event: 'enquiry.deleted' });
      const res = await http()
        .post('/v1/integration/webhooks/enquiry')
        .set({
          'content-type': 'application/json',
          'x-org-id': 'org-webhook',
          'x-signature': signPayload(badEnvelope, SECRET),
        })
        .send(badEnvelope)
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
