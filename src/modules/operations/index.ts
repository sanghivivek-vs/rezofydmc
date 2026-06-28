/**
 * Operations module — public interface (Build guide §4, §10 Phase 2).
 */

export * from './domain/booking';
export {
  OperationsService,
  type OperationsServiceDeps,
  type PipelineReport,
} from './service/operations.service';
export type { BookingRepository } from './repository/booking.repository';
export { InMemoryBookingRepository } from './repository/booking.repository';
export { OperationsModule } from './operations.module';
