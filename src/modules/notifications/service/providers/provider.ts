/**
 * Message provider port (Build guide §4). One adapter per delivery backend
 * (Twilio, Gupshup, Heydoot, …) implements this. The notifications service talks
 * only to the port, so a tenant's provider choice is config, not code.
 *
 * `send` throws on failure; {@link MessageService} catches and records a failed
 * DeliveryResult — a delivery error never breaks the business operation.
 */

import { Logger } from '@nestjs/common';
import type { OutboundMessage, ProviderName } from '@common/messaging/channel';

export interface MessageProvider {
  readonly name: ProviderName;
  send(message: OutboundMessage, from?: string): Promise<void>;
}

/**
 * Default provider: logs the message instead of sending. Used in the sandbox,
 * tests, and any channel an org has not pointed at a real provider yet.
 */
export class LoggingMessageProvider implements MessageProvider {
  readonly name: ProviderName = 'logging';
  private readonly logger = new Logger('Message');

  async send(message: OutboundMessage, from?: string): Promise<void> {
    this.logger.log(
      JSON.stringify({
        channel: message.channel,
        to: message.to,
        from,
        subject: message.subject,
        preview: message.body.slice(0, 80),
      }),
    );
  }
}
