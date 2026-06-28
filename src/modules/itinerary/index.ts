/**
 * Itinerary Builder module — public service interface (Build guide §4).
 */

export * from './domain/enums';
export * from './domain/itinerary';
export { ItineraryService, type ItineraryServiceDeps } from './service/itinerary.service';
export type { ItineraryRepository } from './repository/itinerary.repository';
export { InMemoryItineraryRepository } from './repository/itinerary.repository';
export { ItineraryModule } from './itinerary.module';
