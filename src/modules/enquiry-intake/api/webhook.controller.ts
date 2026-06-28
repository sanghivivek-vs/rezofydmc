/**
 * Inbound integration webhook: enquiry.created / enquiry.updated (Build guide §6).
 *
 * Security & reliability:
 *  - HMAC-SHA256 signature over the RAW body (x-signature) verified before any
 *    processing (ADR 0005). Misconfigured/absent secret fails closed.
 *  - Idempotent: redelivery of the same idempotency_key returns the original
 *    result without reprocessing.
 *  - Validates the envelope (event, version) and delegates to the service, which
 *    upserts and preserves workflow status.
 *
 * The target DMC tenant is identified by x-org-id (per-tenant integration config)
 * — provisional pending the integration-auth decision (#1 in
 * docs/decisions-to-confirm.md).
 */

import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { TenantContext } from '@common/tenancy/tenant-context';
import { ValidationError } from '@common/errors/errors';
import { verifySignature } from '@common/integration/signature';
import { EnquiryService } from '../service/enquiry.service';
import type { InboundEnquiryData } from '../service/inbound-mapper';
import { IDEMPOTENCY_STORE } from './tokens';
import type { IdempotencyStore } from '../repository/idempotency-store';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

interface WebhookEnvelope {
  event?: unknown;
  version?: unknown;
  idempotency_key?: unknown;
  occurred_at?: unknown;
  data?: unknown;
}

const ALLOWED_EVENTS = new Set(['enquiry.created', 'enquiry.updated']);

@Controller('v1/integration/webhooks')
export class EnquiryWebhookController {
  constructor(
    private readonly enquiries: EnquiryService,
    private readonly config: ConfigService,
    @Inject(IDEMPOTENCY_STORE) private readonly idempotency: IdempotencyStore,
  ) {}

  @Post('enquiry')
  @HttpCode(HttpStatus.ACCEPTED)
  async receive(
    @Req() req: RawBodyRequest,
    @Headers('x-signature') signature: string,
    @Headers('x-org-id') orgId: string,
    @Headers('x-request-id') requestId: string,
  ) {
    if (!orgId) {
      throw new UnauthorizedException('Missing x-org-id');
    }

    const secret = this.config.get<string>('WEBHOOK_SIGNING_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('Webhook signing secret not configured');
    }

    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    if (!verifySignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const envelope = (req.body ?? {}) as WebhookEnvelope;
    validateEnvelope(envelope);
    const idempotencyKey = envelope.idempotency_key as string;

    const seen = await this.idempotency.get(orgId, idempotencyKey);
    if (seen) {
      return { enquiryId: seen.enquiryId, idempotent: true };
    }

    const ctx: TenantContext = {
      orgId,
      userId: 'system:integration',
      role: 'Ops',
      requestId: requestId || undefined,
    };

    const enquiry = await this.enquiries.ingestInbound(ctx, envelope.data as InboundEnquiryData);
    await this.idempotency.put(orgId, idempotencyKey, { enquiryId: enquiry.id });

    return { enquiryId: enquiry.id, idempotent: false };
  }
}

function validateEnvelope(envelope: WebhookEnvelope): void {
  if (typeof envelope.event !== 'string' || !ALLOWED_EVENTS.has(envelope.event)) {
    throw new ValidationError('Unsupported or missing webhook event', { event: envelope.event });
  }
  if (envelope.version !== 'v1') {
    throw new ValidationError('Unsupported webhook version', { version: envelope.version });
  }
  if (typeof envelope.idempotency_key !== 'string' || envelope.idempotency_key.length === 0) {
    throw new ValidationError('Missing idempotency_key');
  }
  if (typeof envelope.data !== 'object' || envelope.data === null) {
    throw new ValidationError('Missing webhook data');
  }
}
