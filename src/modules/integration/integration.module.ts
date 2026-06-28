/**
 * Integration module (Build guide §6). Provides the outbound webhook publisher
 * (signed, retrying, dead-lettered) and exposes it via the shared
 * OUTBOUND_PUBLISHER token so Quotation/Itinerary can emit events without
 * depending on the delivery mechanism.
 *
 * Delivery target + secret come from config (OUTBOUND_WEBHOOK_URL,
 * OUTBOUND_WEBHOOK_SECRET). With no URL set, deliveries are dropped with a
 * warning (safe dev default).
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { resolveSecret } from '@common/config/secrets';
import { OUTBOUND_PUBLISHER } from '@common/integration/outbound';
import { DEAD_LETTER_STORE, WEBHOOK_TRANSPORT } from './api/tokens';
import { FetchWebhookTransport, type WebhookTransport } from './service/transport';
import { InMemoryDeadLetterStore, type DeadLetterStore } from './service/dead-letter';
import { WebhookDispatcher } from './service/webhook-dispatcher';

@Module({
  imports: [ConfigModule],
  providers: [
    { provide: WEBHOOK_TRANSPORT, useClass: FetchWebhookTransport },
    { provide: DEAD_LETTER_STORE, useClass: InMemoryDeadLetterStore },
    {
      provide: OUTBOUND_PUBLISHER,
      inject: [WEBHOOK_TRANSPORT, DEAD_LETTER_STORE, ConfigService],
      useFactory: (
        transport: WebhookTransport,
        deadLetters: DeadLetterStore,
        config: ConfigService,
      ) =>
        new WebhookDispatcher(transport, deadLetters, {
          url: config.get<string>('OUTBOUND_WEBHOOK_URL') ?? '',
          secret: resolveSecret(
            config.get<string>('OUTBOUND_WEBHOOK_SECRET'),
            'OUTBOUND_WEBHOOK_SECRET',
          ),
        }),
    },
  ],
  exports: [OUTBOUND_PUBLISHER, DEAD_LETTER_STORE],
})
export class IntegrationModule {}
