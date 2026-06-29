/**
 * MessageService (Build guide §4). Delivers an {@link OutboundMessage} through a
 * tenant's configured channel, selecting the provider per the org's
 * {@link ChannelConfig}. Delivery failures are captured as a `failed`
 * DeliveryResult, never thrown — notifications must not break business writes.
 */

import { Injectable } from '@nestjs/common';
import type { ChannelConfig, DeliveryResult, OutboundMessage } from '@common/messaging/channel';
import { ProviderRegistry } from './providers/provider-factory';

@Injectable()
export class MessageService {
  constructor(private readonly providers: ProviderRegistry) {}

  /** Deliver one message on its channel using the tenant's channel config. */
  async send(channels: ChannelConfig[], message: OutboundMessage): Promise<DeliveryResult> {
    const cfg = channels.find((c) => c.channel === message.channel);
    if (!cfg || !cfg.enabled) {
      return {
        channel: message.channel,
        provider: cfg?.provider ?? 'logging',
        to: message.to,
        status: 'skipped',
        detail: cfg ? 'channel disabled' : 'channel not configured',
      };
    }
    if (!message.to.trim()) {
      return {
        channel: message.channel,
        provider: cfg.provider,
        to: message.to,
        status: 'skipped',
        detail: 'no recipient address',
      };
    }
    const provider = this.providers.resolve(cfg.provider);
    try {
      await provider.send(message, cfg.from);
      return { channel: message.channel, provider: cfg.provider, to: message.to, status: 'sent' };
    } catch (err) {
      return {
        channel: message.channel,
        provider: cfg.provider,
        to: message.to,
        status: 'failed',
        detail: (err as Error).message,
      };
    }
  }
}
