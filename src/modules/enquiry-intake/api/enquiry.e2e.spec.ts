import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app/app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';
import { signPayload } from '@common/integration/signature';

const SECRET = 'test-secret';

const orgA = { 'x-org-id': 'org-A', 'x-user-id': 'u-1', 'x-role': 'Sales' };
const orgB = { 'x-org-id': 'org-B', 'x-user-id': 'u-2', 'x-role': 'Sales' };

const createBody = {
  agencyId: 'AG-1',
  destinations: ['Switzerland'],
  pax: { adults: 2, children: [], infants: 0 },
  quoteDeadline: '2026-06-15T00:00:00Z',
};

describe('Enquiry API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.WEBHOOK_SIGNING_SECRET = SECRET;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('REST /v1/enquiries', () => {
    it('rejects unauthenticated requests with the error envelope', async () => {
      const res = await http().post('/v1/enquiries').send(createBody).expect(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('creates a New enquiry for the tenant', async () => {
      const res = await http().post('/v1/enquiries').set(orgA).send(createBody).expect(201);
      expect(res.body).toMatchObject({
        orgId: 'org-A',
        source: 'manual',
        status: 'New',
        agencyId: 'AG-1',
      });
      expect(res.body.id).toMatch(/^enq_/);
    });

    it('isolates tenants on list', async () => {
      await http().post('/v1/enquiries').set(orgB).send(createBody).expect(201);
      const listA = await http().get('/v1/enquiries').set(orgA).expect(200);
      const listB = await http().get('/v1/enquiries').set(orgB).expect(200);
      expect(listA.body.every((e: { orgId: string }) => e.orgId === 'org-A')).toBe(true);
      expect(listB.body.every((e: { orgId: string }) => e.orgId === 'org-B')).toBe(true);
    });

    it('returns 404 (envelope) for another tenant’s enquiry', async () => {
      const created = await http().post('/v1/enquiries').set(orgA).send(createBody).expect(201);
      const res = await http().get(`/v1/enquiries/${created.body.id}`).set(orgB).expect(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('validates status transitions (409 on illegal)', async () => {
      const created = await http().post('/v1/enquiries').set(orgA).send(createBody).expect(201);
      await http()
        .post(`/v1/enquiries/${created.body.id}/status`)
        .set(orgA)
        .send({ status: 'In Progress' })
        .expect(201);
      const bad = await http()
        .post(`/v1/enquiries/${created.body.id}/status`)
        .set(orgA)
        .send({ status: 'Won' })
        .expect(409);
      expect(bad.body.error.code).toBe('BUSINESS_RULE');
    });

    it('rejects a malformed create body with 400 envelope', async () => {
      const res = await http()
        .post('/v1/enquiries')
        .set(orgA)
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
          'x-org-id': 'org-A',
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
          'x-org-id': 'org-A',
          'x-signature': signPayload(badEnvelope, SECRET),
        })
        .send(badEnvelope)
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
