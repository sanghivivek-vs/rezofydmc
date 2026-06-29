/**
 * Messaging channels & per-tenant channel configuration (Build guide §4
 * Notifications). Lives in the shared kernel so both Identity/Org (which stores
 * the config in org settings) and Notifications (which delivers through it) can
 * reference these types without a cross-module dependency.
 *
 * Provider CREDENTIALS are never stored here — only the per-tenant choice of
 * provider and the sender identity (from address / number / sender id). Secrets
 * are resolved server-side from config (ADR 0007 fail-closed), keeping tenant
 * data free of credential material.
 */

export type MessageChannel = 'email' | 'sms' | 'whatsapp';
export type ProviderName = 'logging' | 'twilio' | 'gupshup' | 'heydoot';

export const MESSAGE_CHANNELS: readonly MessageChannel[] = ['email', 'sms', 'whatsapp'];
export const PROVIDER_NAMES: readonly ProviderName[] = ['logging', 'twilio', 'gupshup', 'heydoot'];

export interface ChannelConfig {
  readonly channel: MessageChannel;
  readonly enabled: boolean;
  readonly provider: ProviderName;
  /** Sender identity: from email, phone number, or WhatsApp sender id. */
  readonly from?: string;
}

export interface OutboundMessage {
  readonly channel: MessageChannel;
  readonly to: string;
  readonly subject?: string;
  readonly body: string;
}

export type DeliveryStatus = 'sent' | 'skipped' | 'failed';

export interface DeliveryResult {
  readonly channel: MessageChannel;
  readonly provider: ProviderName;
  readonly to: string;
  readonly status: DeliveryStatus;
  readonly detail?: string;
}

export function isMessageChannel(value: unknown): value is MessageChannel {
  return typeof value === 'string' && (MESSAGE_CHANNELS as readonly string[]).includes(value);
}

export function isProviderName(value: unknown): value is ProviderName {
  return typeof value === 'string' && (PROVIDER_NAMES as readonly string[]).includes(value);
}

/**
 * Validate and normalise a channel-config list (one entry per channel max).
 * Throws a plain Error with a stable message on invalid input; callers wrap it
 * in their domain error type.
 */
export function normaliseChannelConfigs(input: unknown): ChannelConfig[] {
  if (!Array.isArray(input)) throw new Error('channels must be an array');
  const seen = new Set<MessageChannel>();
  return input.map((raw) => {
    const c = raw as Partial<ChannelConfig>;
    if (!isMessageChannel(c.channel)) throw new Error(`Invalid channel: ${String(c.channel)}`);
    if (!isProviderName(c.provider)) throw new Error(`Invalid provider: ${String(c.provider)}`);
    if (typeof c.enabled !== 'boolean') throw new Error('channel.enabled must be a boolean');
    if (seen.has(c.channel)) throw new Error(`Duplicate channel: ${c.channel}`);
    seen.add(c.channel);
    return {
      channel: c.channel,
      enabled: c.enabled,
      provider: c.provider,
      from: typeof c.from === 'string' && c.from.trim() ? c.from.trim() : undefined,
    };
  });
}

/** The channel config a fresh org starts with: everything off, logging provider. */
export function defaultChannelConfigs(): ChannelConfig[] {
  return MESSAGE_CHANNELS.map((channel) => ({ channel, enabled: false, provider: 'logging' }));
}
