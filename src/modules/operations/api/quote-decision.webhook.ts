/**
 * Inbound integration webhook: quote.accepted / quote.rejected (Build guide §6,
 * docs/integration/inbound/quote.decision.schema.json). HMAC-signed like the
 * enquiry webhook; idempotent via the acceptance lifecycle (re-accepting returns
 * the existing booking, re-rejecting is a no-op).
 *
 * The target DMC tenant is identified by x-org-id (provisional pending the
 * integration-auth decision #1).
 */

import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
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
import { OperationsService } from '../service/operations.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

const ALLOWED = new Set(['quote.accepted', 'quote.rejected']);

@Controller('v1/integration/webhooks')
export class QuoteDecisionWebhookController {
  constructor(
    private readonly ops: OperationsService,
    private readonly config: ConfigService,
  ) {}

  @Post('quote-decision')
  @HttpCode(HttpStatus.ACCEPTED)
  async receive(
    @Req() req: RawBodyRequest,
    @Headers('x-signature') signature: string,
    @Headers('x-org-id') orgId: string,
    @Headers('x-request-id') requestId: string,
  ) {
    if (!orgId) throw new UnauthorizedException('Missing x-org-id');
    const secret = this.config.get<string>('WEBHOOK_SIGNING_SECRET');
    if (!secret) throw new ServiceUnavailableException('Webhook signing secret not configured');

    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    if (!verifySignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const body = (req.body ?? {}) as {
      event?: unknown;
      version?: unknown;
      data?: { quote_external_id?: unknown };
    };
    if (typeof body.event !== 'string' || !ALLOWED.has(body.event)) {
      throw new ValidationError('Unsupported or missing webhook event', { event: body.event });
    }
    if (body.version !== 'v1') {
      throw new ValidationError('Unsupported webhook version', { version: body.version });
    }
    const quoteId = body.data?.quote_external_id;
    if (typeof quoteId !== 'string') {
      throw new ValidationError('Missing quote_external_id');
    }

    const ctx: TenantContext = {
      orgId,
      userId: 'system:integration',
      role: 'Ops',
      requestId: requestId || undefined,
    };

    if (body.event === 'quote.accepted') {
      const booking = await this.ops.acceptQuote(ctx, quoteId);
      return { bookingId: booking.id };
    }
    await this.ops.rejectQuote(ctx, quoteId);
    return { rejected: true };
  }
}
