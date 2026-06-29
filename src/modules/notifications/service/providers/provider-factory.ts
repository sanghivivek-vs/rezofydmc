/**
 * Provider registry (Build guide §4, ADR 0007). Resolves a {@link ProviderName}
 * to a {@link MessageProvider}, injecting credentials from config. Unknown or
 * 'logging' providers fall back to the logging adapter, so the platform is always
 * safe to run with no messaging credentials set.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ProviderName } from '@common/messaging/channel';
import { LoggingMessageProvider, type MessageProvider } from './provider';
import { GupshupProvider, HeydootProvider, TwilioProvider } from './http-providers';

@Injectable()
export class ProviderRegistry {
  private readonly logging = new LoggingMessageProvider();

  constructor(private readonly config: ConfigService) {}

  resolve(name: ProviderName): MessageProvider {
    switch (name) {
      case 'twilio':
        return new TwilioProvider({
          accountSid: this.config.get<string>('TWILIO_ACCOUNT_SID'),
          authToken: this.config.get<string>('TWILIO_AUTH_TOKEN'),
        });
      case 'gupshup':
        return new GupshupProvider({ apiKey: this.config.get<string>('GUPSHUP_API_KEY') });
      case 'heydoot':
        return new HeydootProvider({
          apiKey: this.config.get<string>('HEYDOOT_API_KEY'),
          baseUrl: this.config.get<string>('HEYDOOT_BASE_URL'),
        });
      case 'logging':
      default:
        return this.logging;
    }
  }
}
