/**
 * Email sender port (Build guide §4 Notifications). The logging implementation is
 * the default; a real SMTP/provider sender swaps in behind this interface without
 * touching the notifications service.
 */

import { Injectable, Logger } from '@nestjs/common';

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

@Injectable()
export class LoggingEmailSender implements EmailSender {
  private readonly logger = new Logger('Email');
  async send(message: EmailMessage): Promise<void> {
    this.logger.log(JSON.stringify({ to: message.to, subject: message.subject }));
  }
}
