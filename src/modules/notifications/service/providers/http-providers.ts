/**
 * Real provider adapters (Build guide §4). Each maps an {@link OutboundMessage}
 * onto a provider HTTP API. Credentials are injected (resolved from config —
 * ADR 0007), never read from tenant data.
 *
 * NOTE: these issue live HTTP calls and are exercised only in a configured
 * environment; the sandbox/test default is the LoggingMessageProvider. Each
 * adapter fails fast with a clear message when credentials are missing, so a
 * misconfigured channel surfaces as a `failed` DeliveryResult, not a silent drop.
 */

import type { OutboundMessage, ProviderName } from '@common/messaging/channel';
import type { MessageProvider } from './provider';

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`provider HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

export interface TwilioSecrets {
  accountSid?: string;
  authToken?: string;
}

/** Twilio Programmable Messaging (SMS) + WhatsApp (`whatsapp:` prefixed numbers). */
export class TwilioProvider implements MessageProvider {
  readonly name: ProviderName = 'twilio';
  constructor(private readonly secrets: TwilioSecrets) {}

  async send(message: OutboundMessage, from?: string): Promise<void> {
    const sid = required(this.secrets.accountSid, 'TWILIO_ACCOUNT_SID');
    const token = required(this.secrets.authToken, 'TWILIO_AUTH_TOKEN');
    const sender = required(from, 'channel.from (Twilio sender)');
    const wa = message.channel === 'whatsapp';
    const params = new URLSearchParams({
      To: wa ? `whatsapp:${message.to}` : message.to,
      From: wa ? `whatsapp:${sender}` : sender,
      Body: message.subject ? `${message.subject}\n\n${message.body}` : message.body,
    });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!res.ok) throw new Error(`twilio HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

export interface GupshupSecrets {
  apiKey?: string;
}

/** Gupshup messaging API (SMS + WhatsApp), popular in the India market. */
export class GupshupProvider implements MessageProvider {
  readonly name: ProviderName = 'gupshup';
  constructor(private readonly secrets: GupshupSecrets) {}

  async send(message: OutboundMessage, from?: string): Promise<void> {
    const apiKey = required(this.secrets.apiKey, 'GUPSHUP_API_KEY');
    const sender = required(from, 'channel.from (Gupshup source)');
    const params = new URLSearchParams({
      channel: message.channel === 'whatsapp' ? 'whatsapp' : 'sms',
      source: sender,
      destination: message.to,
      message: message.body,
      'src.name': sender,
    });
    const res = await fetch('https://api.gupshup.io/wa/api/v1/msg', {
      method: 'POST',
      headers: { apikey: apiKey, 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    if (!res.ok) throw new Error(`gupshup HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

export interface HeydootSecrets {
  apiKey?: string;
  baseUrl?: string;
}

/** Heydoot messaging API. Generic JSON contract behind the provider port. */
export class HeydootProvider implements MessageProvider {
  readonly name: ProviderName = 'heydoot';
  constructor(private readonly secrets: HeydootSecrets) {}

  async send(message: OutboundMessage, from?: string): Promise<void> {
    const apiKey = required(this.secrets.apiKey, 'HEYDOOT_API_KEY');
    const baseUrl = (this.secrets.baseUrl ?? 'https://api.heydoot.com').replace(/\/$/, '');
    await postJson(
      `${baseUrl}/v1/messages`,
      { authorization: `Bearer ${apiKey}` },
      {
        channel: message.channel,
        from,
        to: message.to,
        subject: message.subject,
        body: message.body,
      },
    );
  }
}
