import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../../app/app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';

describe('GDPR API (e2e)', () => {
  let app: INestApplication;
  let ownerAuth: Record<string, string>;
  let salesAuth: Record<string, string>;
  let salesUserId: string;
  let enquiryId: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'gdpr-e2e-secret';
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

    const sales = await api()
      .post('/v1/users')
      .set(ownerAuth)
      .send({ email: 'sales@alpine.test', name: 'Sally', role: 'Sales', password: 'password123' })
      .expect(201);
    salesUserId = sales.body.id;
    const salesLogin = await api()
      .post('/v1/auth/login')
      .send({ email: 'sales@alpine.test', password: 'password123' })
      .expect(200);
    salesAuth = { Authorization: `Bearer ${salesLogin.body.token}` };

    const enquiry = await api()
      .post('/v1/enquiries')
      .set(ownerAuth)
      .send({
        agencyId: 'AG-1',
        destinations: ['Switzerland'],
        pax: { adults: 2, children: [{ age: 8 }], infants: 0 },
        mealPreference: 'Jain',
        specialRequirements: 'Wheelchair access',
        quoteDeadline: '2026-06-15T00:00:00Z',
      })
      .expect(201);
    enquiryId = enquiry.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const api = () => request(app.getHttpServer());

  it('exposes the PII registry to any authenticated user', async () => {
    const res = await api().get('/v1/gdpr/pii-registry').set(salesAuth).expect(200);
    expect(res.body.some((f: { field: string }) => f.field === 'specialRequirements')).toBe(true);
  });

  it('lets an Owner export and erase a user (anonymise in place)', async () => {
    const exp = await api().get(`/v1/gdpr/users/${salesUserId}/export`).set(ownerAuth).expect(200);
    expect(exp.body.data.email).toBe('sales@alpine.test');

    await api().post(`/v1/gdpr/users/${salesUserId}/erase`).set(ownerAuth).expect(201);
    const after = await api()
      .get(`/v1/gdpr/users/${salesUserId}/export`)
      .set(ownerAuth)
      .expect(200);
    expect(after.body.data.name).toBe('ERASED');
    expect(after.body.data.status).toBe('disabled');
  });

  it('exports and erases traveller PII on an enquiry', async () => {
    const exp = await api()
      .get(`/v1/gdpr/enquiries/${enquiryId}/export`)
      .set(ownerAuth)
      .expect(200);
    expect(exp.body.data.enquiry.mealPreference).toBe('Jain');

    await api().post(`/v1/gdpr/enquiries/${enquiryId}/erase`).set(ownerAuth).expect(201);
    const after = await api().get(`/v1/enquiries/${enquiryId}`).set(ownerAuth).expect(200);
    expect(after.body.specialRequirements).toBeUndefined();
    expect(after.body.mealPreference).toBeUndefined();
  });

  it('records and lists consent', async () => {
    await api()
      .post('/v1/gdpr/consent')
      .set(ownerAuth)
      .send({
        subjectType: 'traveller',
        subjectRef: enquiryId,
        purpose: 'Trip fulfilment',
        lawfulBasis: 'contract',
        granted: true,
      })
      .expect(201);
    const list = await api()
      .get(`/v1/gdpr/consent?subjectRef=${enquiryId}`)
      .set(ownerAuth)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('forbids a non-Owner from data-subject controls (403)', async () => {
    const res = await api().get(`/v1/gdpr/users/${salesUserId}/export`).set(salesAuth).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
