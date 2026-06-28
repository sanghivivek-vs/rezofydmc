/**
 * Clock abstraction.
 *
 * Services that stamp timestamps (createdAt, audit `at`) take a {@link Clock} so
 * they stay deterministic in tests. Pure domain logic (e.g. the costing engine)
 * takes its dates as explicit inputs and does not use a clock at all.
 *
 * Time is stored in UTC (Build guide §9); display-time conversion to trip-local
 * happens at the presentation edge.
 */

export type Clock = () => string; // ISO-8601 UTC, e.g. "2026-06-28T10:00:00.000Z"

export const systemClock: Clock = () => new Date().toISOString();

/** Deterministic clock for tests. */
export const fixedClock =
  (iso: string): Clock =>
  () =>
    iso;
