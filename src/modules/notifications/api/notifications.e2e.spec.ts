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

  describe('channel configuration', () => {
    it('returns a default channel config (all disabled, logging provider)', async () => {
      const res = await api().get('/v1/notifications/channels').set(auth).expect(200);
      const email = res.body.find((c: { channel: string }) => c.channel === 'email');
      expect(email).toMatchObject({ channel: 'email', enabled: false, provider: 'logging' });
      expect(res.body).toHaveLength(3);
    });

    it('an Owner can update the channel config and it round-trips', async () => {
      const updated = await api()
        .put('/v1/notifications/channels')
        .set(auth)
        .send({
          channels: [
            { channel: 'email', enabled: true, provider: 'logging', from: 'ops@alpine.test' },
            { channel: 'sms', enabled: false, provider: 'twilio', from: '+15550000000' },
            { channel: 'whatsapp', enabled: true, provider: 'gupshup', from: 'DMC' },
          ],
        })
        .expect(200);
      expect(updated.body.find((c: { channel: string }) => c.channel === 'email').enabled).toBe(
        true,
      );

      const reread = await api().get('/v1/notifications/channels').set(auth).expect(200);
      expect(reread.body.find((c: { channel: string }) => c.channel === 'whatsapp').provider).toBe(
        'gupshup',
      );
    });

    it('rejects an invalid provider in the channel config', async () => {
      const res = await api()
        .put('/v1/notifications/channels')
        .set(auth)
        .send({ channels: [{ channel: 'email', enabled: true, provider: 'nope' }] })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('sends a test message through an enabled channel (logging provider → sent)', async () => {
      const res = await api()
        .post('/v1/notifications/channels/test')
        .set(auth)
        .send({ channel: 'email', to: 'someone@alpine.test' })
        .expect(201);
      expect(res.body).toMatchObject({ channel: 'email', status: 'sent', provider: 'logging' });
    });

    it('skips a test message for a disabled channel', async () => {
      const res = await api()
        .post('/v1/notifications/channels/test')
        .set(auth)
        .send({ channel: 'sms', to: '+15551112222' })
        .expect(201);
      expect(res.body.status).toBe('skipped');
    });

    it('validates the test payload', async () => {
      await api()
        .post('/v1/notifications/channels/test')
        .set(auth)
        .send({ channel: 'email' })
        .expect(400);
      await api()
        .post('/v1/notifications/channels/test')
        .set(auth)
        .send({ channel: 'pigeon', to: 'x' })
        .expect(400);
    });
  });

  describe('routing rules', () => {
    it('seeds default routing rules for a new org', async () => {
      const res = await api().get('/v1/notifications/rules').set(auth).expect(200);
      const quoteSent = res.body.find((r: { event: string }) => r.event === 'quote.sent');
      expect(quoteSent).toMatchObject({ audience: 'team', channels: ['email'] });
    });

    it('an Owner can replace the routing rules', async () => {
      const updated = await api()
        .put('/v1/notifications/rules')
        .set(auth)
        .send({
          rules: [{ event: 'quote.sent', audience: 'team', channels: ['email', 'whatsapp'] }],
        })
        .expect(200);
      expect(updated.body).toHaveLength(1);
      expect(updated.body[0].channels).toEqual(['email', 'whatsapp']);
    });

    it('rejects an invalid audience', async () => {
      const res = await api()
        .put('/v1/notifications/rules')
        .set(auth)
        .send({ rules: [{ event: 'quote.sent', audience: 'martians', channels: ['email'] }] })
        .expect(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
