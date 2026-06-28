/**
 * Integration module — public interface (Build guide §6).
 *
 * Producers depend on the OUTBOUND_PUBLISHER port (in @common/integration);
 * this module binds the concrete dispatcher.
 */

export * from './service/transport';
export * from './service/dead-letter';
export {
  WebhookDispatcher,
  backoffMs,
  type DispatcherConfig,
  type DispatchResult,
} from './service/webhook-dispatcher';
export { IntegrationModule } from './integration.module';
